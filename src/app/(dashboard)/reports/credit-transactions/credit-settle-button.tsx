"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/components/shared/currency-display";
import { settleCreditInvoicePayment } from "@/lib/queries/credit-transactions";

interface CreditSettleButtonProps {
  invoicePaymentId: string;
  partyName: string;
  amount: number;
  cashbooks: { id: string; name: string }[];
  companyId: string;
  branchId: string;
  currentUserId: string;
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer / NEFT / RTGS" },
  { value: "card", label: "Debit / Credit Card" },
];

export function CreditSettleButton({
  invoicePaymentId,
  partyName,
  amount,
  cashbooks,
  companyId,
  branchId,
  currentUserId,
}: CreditSettleButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashbookId, setCashbookId] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [narration, setNarration] = useState("");

  async function handleSettle() {
    if (!cashbookId) {
      toast.error("Please select a cashbook.");
      return;
    }

    setIsSubmitting(true);
    try {
      // We need the cashbook day ID — look it up server-side via the query
      // For simplicity we pass cashbookId and rely on server action to find the open day
      const result = await settleCreditInvoicePayment(invoicePaymentId, {
        cashbookId,
        cashbookDayId: "", // server action will look this up by date + cashbookId
        paymentDate,
        paymentMode,
        amount,
        narration: narration || undefined,
        companyId,
        branchId,
        settledBy: currentUserId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Credit transaction settled successfully.");
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-600" />
        Settle
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Credit Transaction</DialogTitle>
            <DialogDescription>
              Record payment received from <strong>{partyName}</strong> for{" "}
              <strong>{formatINR(amount)}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Cashbook *</Label>
              <Select value={cashbookId} onValueChange={setCashbookId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cashbook…" />
                </SelectTrigger>
                <SelectContent>
                  {cashbooks.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id}>
                      {cb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Mode *</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
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
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Cheque no., transaction ref, etc."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
            </div>

            <div className="rounded-md bg-muted px-4 py-3 flex items-center justify-between text-sm">
              <span className="font-medium">Amount to Settle</span>
              <span className="text-lg font-bold tabular-nums">{formatINR(amount)}</span>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSettle}
                disabled={isSubmitting || !cashbookId}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Settling…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm Settlement
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
