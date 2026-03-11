/**
 * GET /api/v1/receipts
 * Returns receipt-type transactions for the authenticated company.
 *
 * Query params:
 *   cashbook_id  — filter by cashbook
 *   from_date    — YYYY-MM-DD
 *   to_date      — YYYY-MM-DD
 *   payment_mode — cash | cheque | upi | bank_transfer | card | finance
 *   limit        — default 100, max 1000
 *   offset       — pagination offset
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiKey, apiError, apiSuccess } from "@/lib/api/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.valid) return apiError(auth.error || "Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const cashbookId = searchParams.get("cashbook_id");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const paymentMode = searchParams.get("payment_mode");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();
  let query = supabase
    .from("cashbook_transactions")
    .select("*")
    .eq("company_id", auth.companyId!)
    .eq("txn_type", "receipt")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (cashbookId) query = query.eq("cashbook_id", cashbookId);
  if (paymentMode) query = query.eq("payment_mode", paymentMode);
  if (fromDate) query = query.gte("created_at", fromDate);
  if (toDate) query = query.lte("created_at", toDate + "T23:59:59");

  const { data, error } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({ receipts: data, count: data?.length ?? 0 });
}
