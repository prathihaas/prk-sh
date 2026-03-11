"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  supplierSchema,
  purchaseInvoiceSchema,
  type SupplierFormValues,
  type PurchaseInvoiceFormValues,
} from "@/lib/validators/purchase";

// ─── Suppliers ────────────────────────────────────────────────────────────────

export async function getSuppliers(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createSupplier(
  values: SupplierFormValues & { company_id: string; created_by: string }
) {
  const validated = supplierSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("suppliers").insert({
    company_id: values.company_id,
    name: validated.name,
    gstin: validated.gstin || null,
    pan: validated.pan || null,
    phone: validated.phone || null,
    email: validated.email || null,
    address: {
      line1: validated.address_line1 || "",
      city: validated.address_city || "",
      state: validated.address_state || "",
      pincode: validated.address_pincode || "",
    },
    created_by: values.created_by,
  });

  if (error) return { error: error.message };
  revalidatePath("/purchases/suppliers");
  return { success: true };
}

export async function updateSupplier(
  id: string,
  values: SupplierFormValues
) {
  const validated = supplierSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: validated.name,
      gstin: validated.gstin || null,
      pan: validated.pan || null,
      phone: validated.phone || null,
      email: validated.email || null,
      address: {
        line1: validated.address_line1 || "",
        city: validated.address_city || "",
        state: validated.address_state || "",
        pincode: validated.address_pincode || "",
      },
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/purchases/suppliers");
  return { success: true };
}

// ─── Purchase Invoices ────────────────────────────────────────────────────────

export async function getPurchaseInvoices(
  companyId: string,
  branchId?: string | null,
  filters?: { purchase_type?: string; status?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("purchase_invoices")
    .select(`
      *,
      supplier:suppliers(id, name, gstin, phone),
      items:purchase_invoice_items(*)
    `)
    .eq("company_id", companyId)
    .order("supplier_invoice_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.purchase_type) query = query.eq("purchase_type", filters.purchase_type);
  if (filters?.status === "due") query = query.gt("balance_due", 0);
  if (filters?.status === "paid") query = query.eq("balance_due", 0);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getDuePurchases(companyId: string, branchId?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("purchase_invoices")
    .select(`*, supplier:suppliers(id, name, phone)`)
    .eq("company_id", companyId)
    .gt("balance_due", 0)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPurchaseInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select(`*, supplier:suppliers(*), items:purchase_invoice_items(*)`)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPurchaseInvoice(
  values: PurchaseInvoiceFormValues & {
    company_id: string;
    branch_id: string;
    financial_year_id: string;
    created_by: string;
  }
) {
  const validated = purchaseInvoiceSchema.parse(values);
  const supabase = await createClient();

  // Compute totals from items
  const subtotal = validated.items.reduce((s, i) => s + i.amount, 0);
  const totalTax = validated.items.reduce(
    (s, i) => s + (i.amount * i.tax_percent) / 100,
    0
  );
  const grandTotal = subtotal + totalTax;

  const { data: invoice, error: invErr } = await supabase
    .from("purchase_invoices")
    .insert({
      company_id: values.company_id,
      branch_id: values.branch_id,
      financial_year_id: values.financial_year_id,
      supplier_id: validated.supplier_id,
      purchase_type: validated.purchase_type,
      supplier_invoice_number: validated.supplier_invoice_number,
      supplier_invoice_date: validated.supplier_invoice_date,
      due_date: validated.due_date || null,
      narration: validated.narration || null,
      subtotal,
      total_tax: totalTax,
      grand_total: grandTotal,
      total_paid: 0,
      created_by: values.created_by,
    })
    .select("id")
    .single();

  if (invErr) return { error: invErr.message };

  // Insert items
  const itemRows = validated.items.map((item, idx) => ({
    purchase_invoice_id: invoice.id,
    sort_order: idx + 1,
    description: item.description,
    hsn_sac: item.hsn_sac || null,
    quantity: item.quantity,
    unit: item.unit || null,
    unit_price: item.unit_price,
    tax_percent: item.tax_percent,
    amount: item.amount,
  }));

  const { error: itemErr } = await supabase
    .from("purchase_invoice_items")
    .insert(itemRows);

  if (itemErr) return { error: itemErr.message };

  revalidatePath("/purchases");
  return { success: true, invoiceId: invoice.id };
}

export async function recordPurchasePayment(
  invoiceId: string,
  amount: number,
  paymentDate: string,
  notes?: string
) {
  const supabase = await createClient();

  // Fetch current total_paid and grand_total
  const { data: inv, error: fetchErr } = await supabase
    .from("purchase_invoices")
    .select("total_paid, grand_total")
    .eq("id", invoiceId)
    .single();

  if (fetchErr || !inv) return { error: "Invoice not found" };

  const newPaid = inv.total_paid + amount;
  if (newPaid > inv.grand_total) {
    return { error: `Payment exceeds balance due. Max payable: ₹${(inv.grand_total - inv.total_paid).toFixed(2)}` };
  }

  const { error } = await supabase
    .from("purchase_invoices")
    .update({ total_paid: newPaid })
    .eq("id", invoiceId);

  if (error) return { error: error.message };
  revalidatePath("/purchases");
  revalidatePath("/purchases/dues");
  return { success: true };
}
