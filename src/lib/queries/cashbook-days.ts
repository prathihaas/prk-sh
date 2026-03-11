"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
