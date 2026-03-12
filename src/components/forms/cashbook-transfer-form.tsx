"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, IndianRupee, ArrowRightLeft } from "lucide-react";
import { createCashbookTransfer } from "@/lib/queries/cashbook-transfers";
import { amountToIndianWords } from "@/lib/utils/number-to-words";
import { formatINR } from "@/components/shared/currency-display";
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

const transferSchema = z
  .object({
    from_cashbook_id: z.string().min(1, "Select source cashbook"),
    to_cashbook_id: z.string().min(1, "Select destination cashbook"),
    amount: z.number().positive("Amount must be greater than 0"),
    description: z.string().min(3, "Description is required (min 3 chars)"),
    transfer_date: z.string().min(1, "Date is required"),
  })
  .refine((d) => d.from_cashbook_id !== d.to_cashbook_id, {
    message: "Source and destination cashbooks must be different",
    path: ["to_cashbook_id"],
  });

type TransferFormValues = z.infer<typeof transferSchema>;

interface CashbookTransferFormProps {
  companyId: string;
  branchId: string | null;
  financialYearId: string | null;
  currentUserId: string;
  cashbooks: { id: string; name: string; type: string }[];
}

function typeBadge(type: string) {
  if (type === "bank") return " (Bank)";
  if (type === "petty") return " (Petty)";
  return " (Cash)";
}

export function CashbookTransferForm({
  companyId,
  branchId,
  financialYearId,
  currentUserId,
  cashbooks,
}: CashbookTransferFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const form = useForm<TransferFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(transferSchema) as any,
    defaultValues: {
      from_cashbook_id: "",
      to_cashbook_id: "",
      amount: 0,
      description: "",
      transfer_date: today,
    },
  });

  const watchAmount = form.watch("amount");
  const watchFrom = form.watch("from_cashbook_id");
  const amountInWords = watchAmount > 0 ? amountToIndianWords(watchAmount) : "";

  // Destination options exclude the selected source
  const toOptions = cashbooks.filter((c) => c.id !== watchFrom);

  async function onSubmit(values: TransferFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createCashbookTransfer({
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId,
        from_cashbook_id: values.from_cashbook_id,
        to_cashbook_id: values.to_cashbook_id,
        amount: values.amount,
        description: values.description,
        transfer_date: values.transfer_date,
        created_by: currentUserId,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Transfer request submitted — awaiting accountant approval");
      router.push("/cash/cashbook-transfers");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title="Transfer Details"
      description="Fill in the transfer details. The accountant will review and approve or reject."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Row 1: Date */}
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

          {/* Row 2: From / To Cashbook */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="from_cashbook_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Cashbook (Debit) *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source cashbook" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cashbooks.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id}>
                          {cb.name}
                          <span className="text-muted-foreground text-xs">
                            {typeBadge(cb.type)}
                          </span>
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
              name="to_cashbook_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Cashbook (Credit) *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!watchFrom}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={watchFrom ? "Select destination" : "Select source first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {toOptions.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id}>
                          {cb.name}
                          <span className="text-muted-foreground text-xs">
                            {typeBadge(cb.type)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Direction indicator */}
          {watchFrom && form.watch("to_cashbook_id") && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-4 py-2 text-sm">
              <span className="font-medium">
                {cashbooks.find((c) => c.id === watchFrom)?.name}
              </span>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {cashbooks.find((c) => c.id === form.watch("to_cashbook_id"))?.name}
              </span>
            </div>
          )}

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (INR) *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-9"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {amountInWords && (
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Amount in Words</p>
              <p className="text-sm font-medium italic">{amountInWords}</p>
              <p className="text-lg font-bold tabular-nums mt-1">{formatINR(watchAmount)}</p>
            </div>
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason / Description *</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="e.g. Petty cash replenishment from main cashbook, transfer to cover branch expenses"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit for Approval"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/cash/cashbook-transfers")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
