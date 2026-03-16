"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/components/shared/currency-display";
import { payExpense } from "@/lib/queries/expenses";

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: { name: string } | null;
}

interface PayExpenseFormProps {
  expenses: Expense[];
  cashbookId: string;
  dayDate: string;
  companyId: string;
  branchId: string;
  financialYearId: string | null;
  currentUserId: string;
  backUrl: string;
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "finance", label: "Finance" },
] as const;

type PaymentMode = (typeof PAYMENT_MODES)[number]["value"];

export function PayExpenseForm({
  expenses,
  cashbookId,
  dayDate,
  companyId,
  branchId,
  financialYearId,
  currentUserId,
  backUrl,
}: PayExpenseFormProps) {
  const router = useRouter();
  const [expenseId, setExpenseId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedExpense = expenses.find((e) => e.id === expenseId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseId) {
      toast.error("Please select an expense to pay.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await payExpense(expenseId, {
        cashbook_id: cashbookId,
        payment_date: dayDate,
        payment_mode: paymentMode,
        notes: notes || undefined,
        company_id: companyId,
        branch_id: branchId,
        paid_by: currentUserId,
        financial_year_id: financialYearId ?? undefined,
        bypass_approval: false,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Expense paid successfully and recorded in cashbook.");
        router.push(backUrl);
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-medium">No approved expenses pending payment.</p>
        <p className="mt-1 text-xs">
          Only expenses with <strong>Owner Approved</strong> status and no prior payment date are
          shown here.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Expense picker */}
      <div className="space-y-1.5">
        <Label htmlFor="expense-select">Select Expense *</Label>
        <Select value={expenseId} onValueChange={setExpenseId}>
          <SelectTrigger id="expense-select">
            <SelectValue placeholder="Choose an approved expense…" />
          </SelectTrigger>
          <SelectContent>
            {expenses.map((exp) => (
              <SelectItem key={exp.id} value={exp.id}>
                <span className="font-medium">
                  {exp.category?.name ?? "General"}
                </span>{" "}
                — {exp.description.slice(0, 50)}
                {exp.description.length > 50 ? "…" : ""} —{" "}
                {formatINR(exp.amount)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected expense summary */}
      {selectedExpense && (
        <Card className="bg-muted/40">
          <CardContent className="pt-4 pb-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Category</p>
              <p className="font-medium">{selectedExpense.category?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Amount</p>
              <p className="font-semibold text-red-600">{formatINR(selectedExpense.amount)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs">Description</p>
              <p>{selectedExpense.description}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Expense Date</p>
              <p>{new Date(selectedExpense.expense_date).toLocaleDateString("en-IN")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Payment Date</p>
              <p>{new Date(dayDate).toLocaleDateString("en-IN")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment mode */}
      <div className="space-y-1.5">
        <Label htmlFor="payment-mode">Payment Mode *</Label>
        <Select
          value={paymentMode}
          onValueChange={(v) => setPaymentMode(v as PaymentMode)}
        >
          <SelectTrigger id="payment-mode" className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {paymentMode === "cash" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠ Cash payment — system checks Section 40A(3) limit (₹10,000 per expense payment).
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Any additional payment notes…"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || !expenseId}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            "Pay Expense"
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(backUrl)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
