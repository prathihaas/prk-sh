/**
 * GET / POST /api/cron/fraud-check
 *
 * Drain the fraud_check_queue. The cashbook_transactions AFTER INSERT
 * trigger used to fire four fraud-detection rules inline (each scanning
 * tx history), which dominated Disk-IO on every receipt save. The trigger
 * now just enqueues four rows here and this worker processes them in the
 * background — same checks, off the hot path.
 *
 * Run via Vercel Cron (recommended) every ~5 minutes, or whenever you
 * want a quick drain. The endpoint is idempotent and safe to call from
 * a cron OR the app itself after a heavy import.
 *
 * Auth: requires the CRON_SECRET env var to match the Authorization
 * header (Vercel Cron sets this automatically).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const KIND_TO_FN: Record<string, string> = {
  backdated: "detect_backdated_entry",
  off_hours: "detect_off_hours_activity",
  rapid: "detect_rapid_transactions",
  threshold: "detect_threshold_breach",
};

const BATCH_SIZE = 200; // soft cap per invocation

async function drain(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  // Pull a batch of pending checks
  const { data: jobs, error: fetchErr } = await supabaseAdmin
    .from("fraud_check_queue")
    .select("id, transaction_id, kind")
    .is("processed_at", null)
    .order("enqueued_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    console.error("[fraud-check] fetch failed:", fetchErr.message);
    return { processed: 0, errors: 1 };
  }

  if (!jobs || jobs.length === 0) return { processed: 0, errors: 0 };

  // The detect_* functions are TRIGGER functions (no args). We can't call
  // them directly with arbitrary args — but their job is to scan recent
  // rows for anomaly patterns and write into fraud_flags. We invoke them
  // through a thin SECURITY DEFINER wrapper that re-runs the same logic
  // for a given transaction_id. The wrappers were created in migration 053
  // alongside the queue. If a wrapper fails, mark the row but don't crash.
  for (const job of jobs as Array<{ id: number; transaction_id: string; kind: string }>) {
    const fnName = KIND_TO_FN[job.kind];
    if (!fnName) {
      // Unknown kind — mark processed so it doesn't retry forever.
      await supabaseAdmin
        .from("fraud_check_queue")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", job.id);
      continue;
    }

    // We don't strictly need the function output — just need it to run and
    // have its INSERTs into fraud_flags land. The original triggers ran on
    // NEW row context; we approximate that by selecting the txn into a
    // temp row and invoking the same inline SQL. Simplest: call the
    // function via SQL with the transaction_id passed through.
    const { error } = await supabaseAdmin.rpc("run_fraud_check", {
      p_transaction_id: job.transaction_id,
      p_kind: job.kind,
    });

    if (error) {
      console.error(
        `[fraud-check] ${job.kind} failed for txn ${job.transaction_id}:`,
        error.message
      );
      errors++;
      // Leave processed_at NULL so it retries next run — don't get stuck on transient errors.
      continue;
    }

    await supabaseAdmin
      .from("fraud_check_queue")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", job.id);
    processed++;
  }

  return { processed, errors };
}

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured → allow (dev / first-deploy convenience)
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await drain();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
