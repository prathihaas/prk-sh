"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Loader2, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCashLimits, type CashLimits } from "@/lib/queries/company-configs";

interface CashLimitsFormProps {
  companyId: string;
  limits: CashLimits;
  canEdit: boolean;
}

function formatINR(val: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

export function CashLimitsForm({ companyId, limits, canEdit }: CashLimitsFormProps) {
  const [customerCash, setCustomerCash] = useState(limits.customer_cash_per_fy);
  const [expenseCash, setExpenseCash] = useState(limits.expense_cash_per_payment);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!companyId) { toast.error("No company selected. Please select a company first."); return; }
    startTransition(async () => {
      const result = await updateCashLimits(companyId, {
        customer_cash_per_fy: customerCash,
        expense_cash_per_payment: expenseCash,
      });
      if (result.error) toast.error(result.error);
      else toast.success("Cash limits updated successfully.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Legal notice */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4 text-sm text-blue-800 dark:text-blue-200">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Indian Income Tax Act — Cash Transaction Limits</p>
          <ul className="space-y-1 list-disc list-inside text-xs">
            <li><strong>Section 269ST:</strong> No person shall receive ₹2,00,000 or more in cash from a single person in a financial year. Violation: penalty equal to the amount received.</li>
            <li><strong>Section 40A(3):</strong> Cash payments exceeding ₹10,000 in a single day to a single person for business expenses are disallowed as a deduction.</li>
          </ul>
          <p className="text-xs mt-2 text-blue-600 dark:text-blue-400">These limits are enforced as hard blocks in the system. Changing them is at your own legal risk.</p>
        </div>
      </div>

      {!canEdit && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Only <strong>Owner</strong> and <strong>Admin</strong> users can change these limits.</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Customer Cash Receipt Limit</CardTitle>
          <CardDescription>
            Maximum total cash that can be received from a single customer in a financial year (Section 269ST).
            System blocks any receipt that would push the customer&apos;s total over this limit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="customer_cash">Limit per Customer per Financial Year (₹)</Label>
            <Input
              id="customer_cash"
              type="number"
              min={1}
              value={customerCash}
              onChange={(e) => setCustomerCash(Number(e.target.value))}
              disabled={!canEdit}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Current: {formatINR(customerCash)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expense Cash Payment Limit</CardTitle>
          <CardDescription>
            Maximum cash allowed per single expense payment (Section 40A(3)).
            System blocks expense payments in cash that exceed this amount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="expense_cash">Limit per Expense Payment (₹)</Label>
            <Input
              id="expense_cash"
              type="number"
              min={1}
              value={expenseCash}
              onChange={(e) => setExpenseCash(Number(e.target.value))}
              disabled={!canEdit}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Current: {formatINR(expenseCash)}</p>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Cash Limits
        </Button>
      )}
    </div>
  );
}
