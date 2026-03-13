"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  branchTransferSchema,
  type BranchTransferFormValues,
  TRANSFER_TYPE_LABELS,
  ITEM_TYPE_LABELS,
} from "@/lib/validators/transfer";
import { createBranchTransfer } from "@/lib/queries/transfers";
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

interface CompanyWithBranches {
  id: string;
  name: string;
  branches: { id: string; name: string }[];
}

interface BranchTransferFormProps {
  fromCompanyId: string;
  fromBranchId: string;
  groupId: string;
  currentUserId: string;
  companies: CompanyWithBranches[];
}

const DEFAULT_ITEM = {
  item_type: "other" as const,
  description: "",
  quantity: 1,
  unit: "Nos",
  unit_value: 0,
  vin_chassis_number: "",
  engine_number: "",
  notes: "",
};

export function BranchTransferForm({
  fromCompanyId,
  fromBranchId,
  groupId,
  currentUserId,
  companies,
}: BranchTransferFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toBranches, setToBranches] = useState<{ id: string; name: string }[]>([]);

  const form = useForm<BranchTransferFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(branchTransferSchema) as any,
    defaultValues: {
      transfer_type: "inter_branch",
      to_company_id: "",
      to_branch_id: "",
      transfer_date: new Date().toISOString().split("T")[0],
      notes: "",
      items: [{ ...DEFAULT_ITEM }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const watchToCompanyId = form.watch("to_company_id");
  const watchTransferType = form.watch("transfer_type");
  const isInterCompany = watchTransferType === "inter_company";

  useEffect(() => {
    const company = companies.find((c) => c.id === watchToCompanyId);
    setToBranches(company?.branches ?? []);
    form.setValue("to_branch_id", "");
  }, [watchToCompanyId, companies, form]);

  const totalValue = watchItems.reduce(
    (s: number, i) => s + (i.unit_value || 0) * (i.quantity || 0),
    0
  );

  async function onSubmit(values: BranchTransferFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createBranchTransfer({
        ...values,
        from_company_id: fromCompanyId,
        from_branch_id: fromBranchId,
        group_id: groupId,
        created_by: currentUserId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Transfer created and challan generated");
        router.push(`/transfers/${result.transferId}`);
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
        <FormCard title="Transfer Details">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="transfer_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transfer Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(TRANSFER_TYPE_LABELS).map(([v, l]) => (
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
              name="transfer_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transfer Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to_company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Company *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies
                        .filter((c) => c.id !== fromCompanyId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to_branch_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    To Branch {isInterCompany ? <span className="text-muted-foreground text-xs">(optional)</span> : "*"}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={!watchToCompanyId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !watchToCompanyId
                            ? "Select company first"
                            : isInterCompany
                            ? "Any branch (optional)"
                            : "Select branch"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isInterCompany && (
                        <SelectItem value="">Any / No specific branch</SelectItem>
                      )}
                      {toBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Notes / Narration</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Reason for transfer..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCard>

        <FormCard title="Items to Transfer">
          <div className="space-y-4">
            {fields.map((field, index) => {
              const itemType = form.watch(`items.${index}.item_type`);
              const isVehicle = itemType === "vehicle";

              return (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.item_type`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Item Type *</FormLabel>
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => (
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
                      name={`items.${index}.description`}
                      render={({ field: f }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Description *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Honda Activa 6G — White" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Qty *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...f}
                              onChange={(e) => f.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_value`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Unit Value (₹)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...f}
                              onChange={(e) => f.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Vehicle-specific fields */}
                  {isVehicle && (
                    <div className="grid gap-3 sm:grid-cols-2 border-t pt-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.vin_chassis_number`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Chassis / VIN</FormLabel>
                            <FormControl>
                              <Input placeholder="ME4JF502..." className="uppercase" {...f} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.engine_number`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Engine Number</FormLabel>
                            <FormControl>
                              <Input placeholder="JF50E..." className="uppercase" {...f} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-xs text-muted-foreground">
                      Line Total: ₹{((form.watch(`items.${index}.unit_value`) || 0) * (form.watch(`items.${index}.quantity`) || 0)).toLocaleString("en-IN")}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}

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

          <div className="mt-4 border-t pt-4 flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Transfer Value</p>
              <p className="text-xl font-bold">₹{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </FormCard>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Transfer...
              </>
            ) : (
              "Create Transfer & Generate Challan"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/transfers")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
