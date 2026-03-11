/**
 * GET /api/v1/expenses
 * Returns expenses for the authenticated company.
 *
 * Query params:
 *   status       — filter by approval_status
 *   from_date    — YYYY-MM-DD (expense_date)
 *   to_date      — YYYY-MM-DD (expense_date)
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
  const status = searchParams.get("status");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("*, category:expense_categories(name)")
    .eq("company_id", auth.companyId!)
    .order("expense_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("approval_status", status);
  if (fromDate) query = query.gte("expense_date", fromDate);
  if (toDate) query = query.lte("expense_date", toDate);

  const { data, error } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({ expenses: data, count: data?.length ?? 0 });
}
