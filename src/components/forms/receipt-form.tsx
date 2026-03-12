"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, IndianRupee, CheckCircle2 } from "lucide-react";
import { receiptSchema, type ReceiptFormValues } from "@/lib/validators/receipt";
import { createReceipt } from "@/lib/queries/receipts";
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
import { TelegramOtpDialog } from "@/components/shared/telegram-otp-dialog";

interface ApprovalUser {
  id: string;
  name?: string;
}

interface ReceiptFormProps {
  companyId: string;
  branchId: string;
  currentUserId: string;
  financialYearId: string;
  cashbooks: { id: string; name: string; type: string }[];
  canBackdate?: boolean;
  /** If provided, OTP approval dialog is shown after receipt creation */
  approvalChain?: {
    cashier?: ApprovalUser;
    executive?: ApprovalUser;
    manager?: ApprovalUser;
  };
  requireOtpApproval?: boolean;
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "finance", label: "Finance" },
];

const OTP_STEPS: ("cashier" | "executive" | "manager")[] = [
  "cashier",
  "executive",
  "manager",
];

export function ReceiptForm({
  companyId,
  branchId,
  currentUserId,
  financialYearId,
  cashbooks,
  canBackdate = false,
  approvalChain,
  requireOtpApproval = false,
}: ReceiptFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReceiptId, setCreatedReceiptId] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState<"cashier" | "executive" | "manager" | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const form = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      cashbook_id: "",
      date: new Date().toISOString().split("T")[0],
      party_name: "",
      amount: 0,
      payment_mode: "cash",
      narration: "",
    },
  });

  const watchAmount = form.watch("amount");
  const amountInWords =
    watchAmount > 0 ? amountToIndianWords(watchAmount) : "";

  async function onSubmit(values: ReceiptFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createReceipt({
        ...values,
        company_id: companyId,
        branch_id: branchId,
        created_by: currentUserId,
        financial_year_id: financialYearId,
        allow_backdate: canBackdate,
        require_otp_approval: requireOtpApproval && !!approvalChain,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Receipt created successfully");

      // If OTP approval is required and we have an approval chain, start OTP flow
      if (requireOtpApproval && approvalChain && result.receiptId) {
        setCreatedReceiptId(result.receiptId);
        // Find the first step with a configured user
        const firstStep = OTP_STEPS.find((s) => approvalChain[s]);
        if (firstStep) {
          setOtpStep(firstStep);
          return; // Don't navigate yet
        }
      }

      router.push("/cash/receipts");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOtpVerified() {
    if (!otpStep || !approvalChain) return;
    setCompletedSteps((prev) => [...prev, otpStep]);

    const currentIndex = OTP_STEPS.indexOf(otpStep);
    const remainingSteps = OTP_STEPS.slice(currentIndex + 1);
    const nextStep = remainingSteps.find((s) => approvalChain[s]);

    if (nextStep) {
      setOtpStep(nextStep);
    } else {
      // All steps done
      setOtpStep(null);
      toast.success("All approvals completed. Receipt is now active.");
      router.push("/cash/receipts");
    }
  }

  function handleOtpClose() {
    setOtpStep(null);
    // Navigate even if OTP was skipped/cancelled — receipt was already created
    router.push("/cash/receipts");
  }

  const currentOtpUser = otpStep ? approvalChain?.[otpStep] : null;

  return (
    <>
      <FormCard
        title="New Receipt"
        description="Create a new receipt. It will be recorded in the selected cashbook's open day."
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Row 1: Cashbook + Date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cashbook_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cashbook *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select cashbook" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cashbooks.map((cb) => (
                          <SelectItem key={cb.id} value={cb.id}>
                            {cb.name}{" "}
                            <span className="text-muted-foreground text-xs capitalize">
                              ({cb.type === "main" ? "cash" : cb.type})
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={canBackdate ? undefined : new Date().toISOString().split("T")[0]}
                        {...field}
                      />
                    </FormControl>
                    {!canBackdate && (
                      <p className="text-xs text-muted-foreground">Only today or future dates allowed</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: Party Name */}
            <FormField
              control={form.control}
              name="party_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Received From (Party Name) *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Shri Rajesh Sharma" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 3: Amount + Payment Mode */}
            <div className="grid gap-4 sm:grid-cols-2">
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

            {/* Amount in Words (live preview) */}
            {amountInWords && (
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Amount in Words
                </p>
                <p className="text-sm font-medium italic">{amountInWords}</p>
                <p className="text-lg font-bold tabular-nums mt-1">
                  {formatINR(watchAmount)}
                </p>
              </div>
            )}

            {/* Narration */}
            <FormField
              control={form.control}
              name="narration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Towards / Narration *</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="e.g. Vehicle service payment - KA01AB1234"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* OTP Approval notice */}
            {requireOtpApproval && approvalChain && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                <p className="font-medium mb-1">Telegram OTP Approval Required</p>
                <div className="flex gap-3 text-xs">
                  {OTP_STEPS.filter((s) => approvalChain[s]).map((s) => (
                    <span key={s} className="flex items-center gap-1">
                      {completedSteps.includes(s) ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-blue-400 inline-block" />
                      )}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Receipt"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/cash/receipts")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </FormCard>

      {/* Telegram OTP Approval Dialog */}
      {createdReceiptId && otpStep && currentOtpUser && (
        <TelegramOtpDialog
          open={true}
          step={otpStep}
          entityType="receipt"
          entityId={createdReceiptId}
          targetUserId={currentOtpUser.id}
          targetUserName={currentOtpUser.name}
          companyId={companyId}
          onVerified={handleOtpVerified}
          onClose={handleOtpClose}
        />
      )}
    </>
  );
}
