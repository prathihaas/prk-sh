"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, IndianRupee, AlertTriangle } from "lucide-react";
import {
  expensePaymentSchema,
  type ExpensePaymentFormValues,
} from "@/lib/validators/expense";
import { payExpense } from "@/lib/queries/expenses";
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

interface ExpensePaymentFormProps {
  expenseId: string;
  companyId: string;
  branchId: string;
  currentUserId: string;
  financialYearId: string;
  expense: {
    description: string;
    amount: number;
    category_name: string;
    expense_date: string;
    approval_status: string;
  };
  cashbooks: { id: string; name: string; cashbook_type: string }[];
  canBypassApproval?: boolean;
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "finance", label: "Finance" },
];

export function ExpensePaymentForm({
  expenseId,
  companyId,
  branchId,
  currentUserId,
  financialYearId,
  expense,
  cashbooks,
  canBypassApproval = false,
}: ExpensePaymentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bypassApproval, setBypassApproval] = useState(false);

  const form = useForm<ExpensePaymentFormValues>({
    resolver: zodResolver(expensePaymentSchema),
    defaultValues: {
      cashbook_id: "",
      payment_date: new Date().toISOString().split("T")[0],
      payment_mode: "cash",
      notes: "",
    },
  });

  async function onSubmit(values: ExpensePaymentFormValues) {
    setIsSubmitting(true);
    try {
      const result = await payExpense(expenseId, {
        ...values,
        company_id: companyId,
        branch_id: branchId,
        paid_by: currentUserId,
        financial_year_id: financialYearId,
        bypass_approval: bypassApproval,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        if (bypassApproval) {
          toast.warning("Payment recorded without full approval. This will appear in the Unapproved Payments report.");
        } else {
          toast.success("Expense paid successfully. Payment recorded in cashbook.");
        }
        router.push("/expenses");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusLabel = expense.approval_status.replace(/_/g, " ");

  return (
    <FormCard
      title="Pay Expense"
      description="Record payment for this expense through a cashbook"
    >
      {/* Expense Summary */}
      <div className="rounded-md border bg-muted/30 px-4 py-3 mb-6">
        <p className="text-xs text-muted-foreground mb-2">Expense Summary</p>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <span className="text-muted-foreground">Category:</span>{" "}
            <span className="font-medium">{expense.category_name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Expense Date:</span>{" "}
            <span className="font-medium">
              {new Date(expense.expense_date).toLocaleDateString("en-IN")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Approval Status:</span>{" "}
            <span className="font-medium capitalize">{statusLabel}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Description:</span>{" "}
            <span className="font-medium">{expense.description}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-green-600" />
          <span className="text-xl font-bold tabular-nums">
            {formatINR(expense.amount)}
          </span>
        </div>
      </div>

      {/* Cashier bypass approval warning */}
      {canBypassApproval && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Cashier Direct Payment</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                This expense has not completed the full approval workflow (status: <strong>{statusLabel}</strong>).
                Paying now will be flagged in the Unapproved Payments report for manager review.
              </p>
              <button
                type="button"
                onClick={() => setBypassApproval(!bypassApproval)}
                className={`mt-3 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${
                  bypassApproval
                    ? "border-amber-600 bg-amber-600 text-white"
                    : "border-amber-600 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
                }`}
              >
                {bypassApproval ? "Direct Payment Mode: ON" : "Enable Direct Payment (Bypass Approval)"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="cashbook_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay From Cashbook *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cashbook" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cashbooks.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id}>
                          {cb.name}
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
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Must fall on an open cashbook day
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="payment_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full sm:w-[240px]">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Notes</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Optional payment notes..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              variant={bypassApproval ? "destructive" : "default"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : bypassApproval ? (
                <>Pay {formatINR(expense.amount)} Without Approval</>
              ) : (
                <>Pay {formatINR(expense.amount)}</>
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/expenses")}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
