"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Resolve a cashbook day for a transaction, handling bank vs cash cashbooks differently:
 *
 * - BANK cashbooks: auto-create the day if it doesn't exist. Banks don't follow
 *   the manual open/close day workflow — transactions can happen any time.
 *
 * - CASH / PETTY cashbooks: require an existing open or reopened day. Returns
 *   an error if no open day exists (forces the user to open the day first).
 *
 * Returns { day: { id } } on success, or { error: string } on failure.
 */
export async function resolveOrCreateCashbookDay(
  cashbookId: string,
  date: string
): Promise<{ day: { id: string } } | { error: string }> {
  const supabase = await createClient();

  // Look up the cashbook type so we can decide which path to take
  const { data: cashbook, error: cashbookError } = await supabase
    .from("cashbooks")
    .select("id, type, company_id, branch_id")
    .eq("id", cashbookId)
    .single();

  if (cashbookError || !cashbook) {
    return { error: "Cashbook not found." };
  }

  if (cashbook.type === "bank") {
    // Bank accounts: find or auto-create the day (no manual open required)
    const { data: existingDay } = await supabaseAdmin
      .from("cashbook_days")
      .select("id")
      .eq("cashbook_id", cashbookId)
      .eq("date", date)
      .maybeSingle();

    if (existingDay) return { day: existingDay };

    // Auto-create a day for this bank account + date
    const { data: newDay, error: createError } = await supabaseAdmin
      .from("cashbook_days")
      .insert({
        cashbook_id: cashbook.id,
        company_id: cashbook.company_id,
        branch_id: cashbook.branch_id,
        date,
        opening_balance: 0,
        status: "open",
      })
      .select("id")
      .single();

    if (createError) {
      if (createError.code === "23505") {
        // Race condition: another request created the same day simultaneously — re-fetch
        const { data: racedDay } = await supabaseAdmin
          .from("cashbook_days")
          .select("id")
          .eq("cashbook_id", cashbookId)
          .eq("date", date)
          .single();
        if (racedDay) return { day: racedDay };
      }
      return { error: `Could not initialise bank account day: ${createError.message}` };
    }

    return { day: newDay };
  }

  // Cash / petty cashbooks: require a manually opened day
  const { data: openDay, error: dayError } = await supabase
    .from("cashbook_days")
    .select("id")
    .eq("cashbook_id", cashbookId)
    .eq("date", date)
    .in("status", ["open", "reopened"])
    .single();

  if (dayError || !openDay) {
    return {
      error:
        "No open cashbook day found for this date. The day may be closed or does not exist yet. Please open the day first from the Cashbooks section.",
    };
  }

  return { day: openDay };
}

export async function getCashbookDays(cashbookId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cashbook_days")
    .select("*")
    .eq("cashbook_id", cashbookId)
    .order("date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCashbookDay(dayId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cashbook_days")
    .select("*")
    .eq("id", dayId)
    .single();

  if (error) throw error;
  return data;
}

export async function openCashbookDay(
  cashbookId: string,
  date: string,
  companyId: string,
  branchId: string
) {
  const supabase = await createClient();

  // Get the latest day's system_closing as opening balance, or the cashbook opening_balance
  const { data: latestDay } = await supabase
    .from("cashbook_days")
    .select("system_closing")
    .eq("cashbook_id", cashbookId)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  let openingBalance = 0;
  if (latestDay?.system_closing !== null && latestDay?.system_closing !== undefined) {
    openingBalance = Number(latestDay.system_closing);
  } else {
    // First day — use cashbook opening_balance
    const { data: cashbook } = await supabase
      .from("cashbooks")
      .select("opening_balance")
      .eq("id", cashbookId)
      .single();
    openingBalance = Number(cashbook?.opening_balance ?? 0);
  }

  const { error } = await supabase.from("cashbook_days").insert({
    cashbook_id: cashbookId,
    company_id: companyId,
    branch_id: branchId,
    date,
    opening_balance: openingBalance,
    status: "open",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A day entry already exists for this date." };
    }
    return { error: error.message };
  }

  revalidatePath(`/cash/cashbooks/${cashbookId}/days`);
  return { success: true };
}

export async function closeCashbookDay(
  dayId: string,
  physicalCount: number,
  closedBy: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cashbook_days")
    .update({
      physical_count: physicalCount,
      status: "closed",
      closed_by: closedBy,
      closed_at: new Date().toISOString(),
    })
    .eq("id", dayId);

  if (error) return { error: error.message };

  revalidatePath("/cash/cashbooks");
  return { success: true };
}

export async function reopenCashbookDay(
  dayId: string,
  reopenReason: string,
  reopenedBy: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cashbook_days")
    .update({
      status: "reopened",
      reopened_by: reopenedBy,
      reopened_at: new Date().toISOString(),
      reopen_reason: reopenReason,
    })
    .eq("id", dayId);

  if (error) return { error: error.message };

  revalidatePath("/cash/cashbooks");
  return { success: true };
}

export async function approveVariance(
  dayId: string,
  approvedBy: string,
  reason: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cashbook_days")
    .update({
      variance_approved: true,
      variance_approved_by: approvedBy,
      variance_approved_at: new Date().toISOString(),
      variance_reason: reason,
    })
    .eq("id", dayId);

  if (error) return { error: error.message };

  revalidatePath("/cash/cashbooks");
  return { success: true };
}
