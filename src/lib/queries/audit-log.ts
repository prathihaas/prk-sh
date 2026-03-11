"use server";

import { createClient } from "@/lib/supabase/server";

export async function getAuditLogs(
  companyId: string,
  filters?: {
    table_name?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
    user_id?: string;
    search?: string;
  }
) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("*, actor:user_profiles!audit_log_changed_by_fkey(full_name, email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (filters?.table_name) query = query.eq("table_name", filters.table_name);
  if (filters?.action) query = query.eq("action", filters.action);
  if (filters?.from_date) query = query.gte("created_at", filters.from_date);
  if (filters?.to_date) query = query.lte("created_at", filters.to_date + "T23:59:59");
  if (filters?.user_id) query = query.eq("changed_by", filters.user_id);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get audit log for a specific record (e.g., all changes to a specific transaction)
 */
export async function getRecordAuditLog(recordId: string, tableName: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*, actor:user_profiles!audit_log_changed_by_fkey(full_name)")
    .eq("record_id", recordId)
    .eq("table_name", tableName)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}
