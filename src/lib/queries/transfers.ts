"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  branchTransferSchema,
  type BranchTransferFormValues,
} from "@/lib/validators/transfer";

export async function getBranchTransfers(
  companyId: string,
  branchId?: string | null,
  filters?: { transfer_type?: string; status?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("branch_transfers")
    .select(`
      *,
      from_company:companies!branch_transfers_from_company_id_fkey(id, name),
      from_branch:branches!branch_transfers_from_branch_id_fkey(id, name),
      to_company:companies!branch_transfers_to_company_id_fkey(id, name),
      to_branch:branches!branch_transfers_to_branch_id_fkey(id, name),
      items:transfer_items(*),
      challans:transfer_challans(*)
    `)
    .or(`from_company_id.eq.${companyId},to_company_id.eq.${companyId}`)
    .order("transfer_date", { ascending: false });

  if (filters?.transfer_type) query = query.eq("transfer_type", filters.transfer_type);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBranchTransfer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branch_transfers")
    .select(`
      *,
      from_company:companies!branch_transfers_from_company_id_fkey(id, name, address, phone),
      from_branch:branches!branch_transfers_from_branch_id_fkey(id, name, address, phone),
      to_company:companies!branch_transfers_to_company_id_fkey(id, name, address, phone),
      to_branch:branches!branch_transfers_to_branch_id_fkey(id, name, address, phone),
      items:transfer_items(*),
      challans:transfer_challans(*)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getCompaniesAndBranches(groupId: string) {
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, branches(id, name)")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("name");
  return companies || [];
}

export async function createBranchTransfer(
  values: BranchTransferFormValues & {
    from_company_id: string;
    from_branch_id: string;
    group_id: string;
    created_by: string;
  }
) {
  const validated = branchTransferSchema.parse(values);
  const supabase = await createClient();

  const totalValue = values.items.reduce(
    (s, i) => s + i.unit_value * i.quantity,
    0
  );

  const { data: transfer, error: trErr } = await supabase
    .from("branch_transfers")
    .insert({
      group_id: values.group_id,
      from_company_id: values.from_company_id,
      from_branch_id: values.from_branch_id,
      to_company_id: validated.to_company_id,
      to_branch_id: validated.to_branch_id || null,
      transfer_type: validated.transfer_type,
      transfer_date: validated.transfer_date,
      notes: validated.notes || null,
      total_value: totalValue,
      status: "draft",
      created_by: values.created_by,
    })
    .select("id")
    .single();

  if (trErr) return { error: trErr.message };

  const itemRows = validated.items.map((item, idx) => ({
    transfer_id: transfer.id,
    sort_order: idx + 1,
    item_type: item.item_type,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit || null,
    unit_value: item.unit_value,
    vin_chassis_number: item.vin_chassis_number || null,
    engine_number: item.engine_number || null,
    notes: item.notes || null,
  }));

  const { error: itemErr } = await supabase
    .from("transfer_items")
    .insert(itemRows);

  if (itemErr) return { error: itemErr.message };

  // Auto-generate challan
  const { data: challan, error: challanErr } = await supabase
    .rpc("generate_challan_number", {
      p_company_id: values.from_company_id,
      p_branch_id: values.from_branch_id,
      p_challan_type: "transfer",
    });

  if (!challanErr && challan) {
    await supabase.from("transfer_challans").insert({
      transfer_id: transfer.id,
      challan_number: challan,
      challan_type: "transfer",
      issued_by: values.created_by,
    });
  }

  revalidatePath("/transfers");
  return { success: true, transferId: transfer.id };
}

export async function updateTransferStatus(
  id: string,
  status: "dispatched" | "in_transit" | "received" | "cancelled",
  updatedBy: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("branch_transfers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  revalidatePath(`/transfers/${id}`);
  return { success: true };
}
