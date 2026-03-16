"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  cashbookTransactionSchema,
  type CashbookTransactionFormValues,
} from "@/lib/validators/cashbook-transaction";
import { createTransaction } from "@/lib/queries/cashbook-transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  CustomerPickerWithCreate,
  type CustomerOption,
} from "@/components/shared/customer-picker";

interface CashbookTransactionFormProps {
  cashbookId: string;
  cashbookDayId: string;
  companyId: string;
  branchId: string;
  financialYearId?: string;
  currentUserId: string;
  customers: CustomerOption[];
  otherCashbooks?: { id: string; name: string }[];
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "finance", label: "Finance" },
];

export function CashbookTransactionForm({
  cashbookId,
  cashbookDayId,
  companyId,
  branchId,
  financialYearId,
  currentUserId,
  customers,
  otherCashbooks = [],
}: CashbookTransactionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CashbookTransactionFormValues>({
    resolver: zodResolver(cashbookTransactionSchema),
    defaultValues: {
      txn_type: "receipt",
      amount: 0,
      payment_mode: "cash",
      narration: "",
      party_name: "",
      customer_id: "",
      contra_cashbook_id: "",
    },
  });

  const customerId = useWatch({ control: form.control, name: "customer_id" });

  function handleCustomerSelect(customer: CustomerOption | null) {
    if (customer) {
      form.setValue("customer_id", customer.id);
      form.setValue("party_name", customer.full_name);
    } else {
      form.setValue("customer_id", "");
      // Keep party_name so user doesn't lose manually typed text
    }
  }

  async function onSubmit(values: CashbookTransactionFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createTransaction({
        ...values,
        cashbook_id: cashbookId,
        cashbook_day_id: cashbookDayId,
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId,
        created_by: currentUserId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Transaction recorded");
        router.back();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title="New Transaction"
      description="Record a receipt or payment"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="txn_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transaction Type *</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="receipt" id="receipt" />
                      <Label htmlFor="receipt" className="text-green-600 font-medium">
                        Receipt (Money In)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="payment" id="payment" />
                      <Label htmlFor="payment" className="text-red-600 font-medium">
                        Payment (Money Out)
                      </Label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Customer picker — primary selection; auto-fills Party Name below */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-none">Customer</p>
            <CustomerPickerWithCreate
              customers={customers}
              companyId={companyId}
              currentUserId={currentUserId}
              value={customerId || undefined}
              onSelect={handleCustomerSelect}
              placeholder="Search or create customer..."
            />
            {customerId && (
              <p className="text-xs text-green-600">
                ✓ Customer selected — party name auto-filled below
              </p>
            )}
          </div>

          {/* Party Name — auto-filled from customer, or type manually */}
          <FormField
            control={form.control}
            name="party_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Party Name{" "}
                  <span className="font-normal text-xs text-muted-foreground">
                    (auto-filled from customer, or type manually)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter party / customer name..."
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      // Unlink customer if user edits name manually
                      if (customerId) form.setValue("customer_id", "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Mode *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
          </div>

          <FormField
            control={form.control}
            name="narration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Narration *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the transaction..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {otherCashbooks.length > 0 && (
            <FormField
              control={form.control}
              name="contra_cashbook_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contra Cashbook</FormLabel>
                  <Select
                    onValueChange={(val) =>
                      field.onChange(val === "none" ? "" : val)
                    }
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None (not a transfer)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">
                        None (not a transfer)
                      </SelectItem>
                      {otherCashbooks.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id}>
                          {cb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select if this is a transfer between cashbooks
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Transaction"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
