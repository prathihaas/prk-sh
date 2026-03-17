/**
 * GET /api/v1/tally-export
 *
 * Generates a Tally Prime XML file for the given date range.
 * Supports two authentication modes:
 *   1. Session cookie (browser / dashboard UI)
 *   2. Bearer <api_key> header (programmatic / external)
 *
 * Query params:
 *   from_date  — YYYY-MM-DD  (required)
 *   to_date    — YYYY-MM-DD  (required, can equal from_date for daily export)
 *   branch_id  — UUID        (optional)
 *
 * Returns: XML file download (Content-Type: application/xml)
 * Errors:  JSON { error: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiKey, apiError } from "@/lib/api/auth";
import {
  getTxnsForExport,
  getTransfersForExport,
  getTallySettings,
  logTallyExport,
} from "@/lib/queries/tally-export";
import { generateTallyXml } from "@/lib/utils/tally-xml-generator";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  // ── Auth: API key or session cookie ───────────────────────
  let companyId: string | null = null;
  let userId: string | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const auth = await authenticateApiKey(req);
    if (!auth.valid) return apiError(auth.error || "Unauthorized", 401);
    companyId = auth.companyId!;
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Not authenticated", 401);
    userId = user.id;
    const cookieStore = await cookies();
    companyId = cookieStore.get("scope_company_id")?.value ?? null;
    if (!companyId) {
      return apiError("No company selected. Choose a company from the header.", 400);
    }
  }

  // ── Params ─────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const branchId = searchParams.get("branch_id") || null;

  if (!fromDate || !toDate) {
    return apiError("from_date and to_date are required (YYYY-MM-DD)", 400);
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(fromDate) || !dateRe.test(toDate)) {
    return apiError("Invalid date format. Use YYYY-MM-DD", 400);
  }
  if (fromDate > toDate) {
    return apiError("from_date must be on or before to_date", 400);
  }

  // ── Fetch data & settings ──────────────────────────────────
  const [txns, transfers, settings] = await Promise.all([
    getTxnsForExport(companyId!, fromDate, toDate, branchId),
    getTransfersForExport(companyId!, fromDate, toDate, branchId),
    getTallySettings(companyId!),
  ]);

  if (txns.length === 0 && transfers.length === 0) {
    return apiError(
      `No transactions found for ${fromDate} to ${toDate}. Nothing to export.`,
      404
    );
  }

  if (!settings.company_name) {
    return apiError(
      "Tally settings not configured. Go to Settings → Tally Prime to set the company name and ledger mappings before exporting.",
      400
    );
  }

  // ── Generate XML ───────────────────────────────────────────
  const { xml, voucher_count, errors } = generateTallyXml(txns, transfers, settings);

  // Build filename
  const safeName = settings.company_name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const dateTag = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
  const filename = `tally_${safeName}_${dateTag}.xml`;

  // ── Log export for audit trail ─────────────────────────────
  if (userId) {
    await logTallyExport({
      company_id: companyId!,
      branch_id: branchId,
      from_date: fromDate,
      to_date: toDate,
      voucher_count,
      exported_by: userId,
      filename,
    });
  }

  // ── Return XML with warnings as comment ───────────────────
  let finalXml = xml;
  if (errors.length > 0) {
    const warningComment = `\n<!--\n  WARNINGS (${errors.length}):\n${errors.map((e) => `  - ${e}`).join("\n")}\n-->\n`;
    finalXml = finalXml.replace("</ENVELOPE>", `${warningComment}</ENVELOPE>`);
  }

  return new NextResponse(finalXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Voucher-Count": String(voucher_count),
      "X-Warning-Count": String(errors.length),
    },
  });
}
