/**
 * GET /api/v1/audit
 * Returns audit log entries for the authenticated company.
 * Requires the API key to belong to a company with admin access.
 *
 * Query params:
 *   table_name   — filter by table (e.g. cashbook_transactions, expenses)
 *   action       — INSERT | UPDATE | DELETE
 *   from_date    — YYYY-MM-DD
 *   to_date      — YYYY-MM-DD
 *   record_id    — UUID of a specific record
 *   limit        — default 100, max 500
 *   offset       — pagination offset
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiKey, apiError, apiSuccess } from "@/lib/api/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.valid) return apiError(auth.error || "Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const tableName = searchParams.get("table_name");
  const action = searchParams.get("action");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const recordId = searchParams.get("record_id");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, table_name, record_id, action, changed_by, created_at, new_data, old_data")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tableName) query = query.eq("table_name", tableName);
  if (action) query = query.eq("action", action);
  if (recordId) query = query.eq("record_id", recordId);
  if (fromDate) query = query.gte("created_at", fromDate);
  if (toDate) query = query.lte("created_at", toDate + "T23:59:59");

  const { data, error } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({ logs: data, count: data?.length ?? 0 });
}
