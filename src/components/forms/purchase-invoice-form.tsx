"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, IndianRupee } from "lucide-react";
import {
  purchaseInvoiceSchema,
  type PurchaseInvoiceFormValues,
  PURCHASE_TYPE_LABELS,
} from "@/lib/validators/purchase";
import { createPurchaseInvoice } from "@/lib/queries/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

interface PurchaseInvoiceFormProps {
  companyId: string;
  branchId: string;
  financialYearId: string;
  currentUserId: string;
  suppliers: { id: string; name: string; gstin?: string | null }[];
}

const DEFAULT_ITEM = {
  description: "",
  hsn_sac: "",
  quantity: 1,
  unit: "Nos",
  unit_price: 0,
  tax_percent: 0,
  amount: 0,
};

export function PurchaseInvoiceForm({
  companyId,
  branchId,
  financialYearId,
  currentUserId,
  suppliers,
}: PurchaseInvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      supplier_id: "",
      purchase_type: "general",
      supplier_invoice_number: "",
      supplier_invoice_date: new Date().toISOString().split("T")[0],
      due_date: "",
      narration: "",
      items: [{ ...DEFAULT_ITEM }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");

  function recalcItem(index: number) {
    const item = watchItems[index];
    if (!item) return;
    const amount = (item.quantity || 0) * (item.unit_price || 0);
    form.setValue(`items.${index}.amount`, parseFloat(amount.toFixed(2)));
  }

  const subtotal = watchItems.reduce((s: number, i) => s + (i.amount || 0), 0);
  const totalTax = watchItems.reduce(
    (s: number, i) => s + ((i.amount || 0) * (i.tax_percent || 0)) / 100,
    0
  );
  const grandTotal = subtotal + totalTax;

  async function onSubmit(values: PurchaseInvoiceFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createPurchaseInvoice({
        ...values,
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId,
        created_by: currentUserId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase invoice created");
        router.push("/purchases");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <FormCard title="Purchase Details">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.gstin && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({s.gstin})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchase_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(PURCHASE_TYPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_invoice_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Invoice # *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. INV/2025/001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_invoice_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="narration"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Narration / Notes</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Optional notes..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCard>

        {/* Items */}
        <FormCard title="Items">
          <div className="space-y-3">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <span className="col-span-4">Description</span>
              <span className="col-span-1">Qty</span>
              <span className="col-span-2">Unit Price</span>
              <span className="col-span-1">Tax %</span>
              <span className="col-span-2">Amount</span>
              <span className="col-span-2"></span>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start border rounded-md p-2 sm:border-0 sm:p-0">
                <div className="col-span-12 sm:col-span-4">
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="sm:hidden text-xs">Description</FormLabel>
                        <FormControl>
                          <Input placeholder="Item description" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-4 sm:col-span-1">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="sm:hidden text-xs">Qty</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            {...f}
                            onChange={(e) => {
                              f.onChange(e.target.valueAsNumber);
                              recalcItem(index);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-4 sm:col-span-2">
                  <FormField
                    control={form.control}
                    name={`items.${index}.unit_price`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="sm:hidden text-xs">Unit Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            {...f}
                            onChange={(e) => {
                              f.onChange(e.target.valueAsNumber);
                              recalcItem(index);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-4 sm:col-span-1">
                  <FormField
                    control={form.control}
                    name={`items.${index}.tax_percent`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="sm:hidden text-xs">Tax %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            {...f}
                            onChange={(e) => f.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-10 sm:col-span-2">
                  <FormField
                    control={form.control}
                    name={`items.${index}.amount`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="sm:hidden text-xs">Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            readOnly
                            className="bg-muted"
                            {...f}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2 sm:col-span-2 flex items-end pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...DEFAULT_ITEM })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          {/* Totals */}
          <div className="mt-4 border-t pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Tax</span>
              <span className="font-medium">₹{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
              <span>Grand Total</span>
              <span className="flex items-center gap-1">
                <IndianRupee className="h-4 w-4" />
                {grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </FormCard>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Create Purchase Invoice"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/purchases")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
