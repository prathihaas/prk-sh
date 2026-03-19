"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Wrench,
  CheckCircle2,
  Trash2,
  Receipt,
  FileText,
  Car,
  Phone,
  Hash,
  IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createSalesReceipt } from "@/lib/queries/sales-receipts";
import { completePendingRoJob, removePendingRoJob } from "@/lib/queries/pending-ro";
import type { PendingRoJob } from "@/lib/queries/pending-ro";

// ── Types ────────────────────────────────────────────────────────────────────

interface PendingRoClientProps {
  jobs: PendingRoJob[];
  cashbooks: { id: string; name: string }[];
  companyId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
  canCreate: boolean;
  canIssueGatePass: boolean;
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer / NEFT / RTGS" },
  { value: "card", label: "Debit / Credit Card" },
  { value: "finance", label: "Finance / Loan" },
  { value: "credit", label: "Credit (Pay Later)" },
] as const;

function formatINR(val: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

// ── Complete R/O Dialog ────────────────────────────────────────────────────────

interface CompleteDialogProps {
  job: PendingRoJob;
  cashbooks: { id: string; name: string }[];
  companyId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CompleteRoDialog({
  job,
  cashbooks,
  companyId,
  branchId,
  financialYearId,
  userId,
  open,
  onOpenChange,
}: CompleteDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(
    job.estimated_amount ? String(job.estimated_amount) : ""
  );
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [cashbookId, setCashbookId] = useState("");

  const handleComplete = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!paymentMode) {
      toast.error("Select a payment mode.");
      return;
    }
    if (paymentMode === "cash" && !cashbookId) {
      toast.error("Select a cashbook for cash payment.");
      return;
    }
    if (
      paymentMode !== "cash" &&
      paymentMode !== "credit" &&
      !paymentRef.trim()
    ) {
      toast.error("Payment reference is required for non-cash payments.");
      return;
    }

    startTransition(async () => {
      // Step 1: Create sales receipt
      const receiptResult = await createSalesReceipt({
        invoice_type: "service",
        invoice_date: new Date().toISOString().split("T")[0],
        dms_invoice_number: job.ro_number || undefined,
        customer_name: job.customer_name,
        customer_phone: job.customer_phone || undefined,
        vehicle_model: job.vehicle_model || undefined,
        vehicle_variant: job.vehicle_variant || undefined,
        vin_number: job.vin_number || undefined,
        engine_number: job.engine_number || undefined,
        base_amount: parseFloat(amount),
        payment_mode: paymentMode as
          | "cash"
          | "cheque"
          | "upi"
          | "bank_transfer"
          | "card"
          | "finance"
          | "credit",
        payment_reference: paymentRef || undefined,
        cashbook_id: cashbookId || undefined,
        notes: job.description || undefined,
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId,
        created_by: userId,
      });

      if (receiptResult.error) {
        toast.error(receiptResult.error);
        return;
      }

      // Step 2: Mark R/O as completed
      await completePendingRoJob(job.id, receiptResult.invoiceId!);

      toast.success("Sales receipt created — issue gate pass to complete delivery.");
      onOpenChange(false);
      router.push(`/invoices/${receiptResult.invoiceId}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Sales Receipt</DialogTitle>
          <DialogDescription>
            {job.customer_name}
            {job.vehicle_model ? ` · ${job.vehicle_model}` : ""}
            {job.ro_number ? ` · R/O ${job.ro_number}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ro-amount">Service Amount (₹) *</Label>
            <Input
              id="ro-amount"
              type="number"
              min={1}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Payment Mode *</Label>
            <Select
              value={paymentMode}
              onValueChange={(v) => {
                setPaymentMode(v);
                if (v !== "cash") setCashbookId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment mode…" />
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

          {paymentMode && paymentMode !== "cash" && paymentMode !== "credit" && (
            <div className="space-y-1.5">
              <Label htmlFor="ro-ref">
                {paymentMode === "cheque"
                  ? "Cheque Number *"
                  : paymentMode === "upi"
                  ? "UPI Transaction ID *"
                  : "Reference Number *"}
              </Label>
              <Input
                id="ro-ref"
                placeholder="Enter reference…"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>
          )}

          {paymentMode === "cash" && (
            <div className="space-y-1.5">
              <Label>Cash Received In *</Label>
              {cashbooks.length > 0 ? (
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
              ) : (
                <p className="text-sm text-destructive">
                  No active cash cashbook. Configure one first.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={handleComplete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Receipt className="mr-2 h-4 w-4" />
                  Create Receipt & Go to Gate Pass
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── R/O Card ──────────────────────────────────────────────────────────────────

interface RoCardProps {
  job: PendingRoJob;
  cashbooks: { id: string; name: string }[];
  companyId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
  canIssueGatePass: boolean;
}

function RoCard({
  job,
  cashbooks,
  companyId,
  branchId,
  financialYearId,
  userId,
  canIssueGatePass,
}: RoCardProps) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const router = useRouter();

  const isCompleted = !!job.completed_at;

  const dateFormatted = new Date(job.ro_closed_date).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "short", year: "numeric" }
  );

  const handleRemove = async () => {
    setRemoving(true);
    const result = await removePendingRoJob(job.id);
    if (result.error) {
      toast.error(result.error);
      setRemoving(false);
    } else {
      toast.success("R/O removed from pending list.");
      router.refresh();
    }
  };

  return (
    <>
      <Card
        className={`transition-colors ${
          isCompleted
            ? "border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/20"
            : ""
        }`}
      >
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: R/O info */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Wrench className="h-4 w-4 text-orange-500 shrink-0" />
                )}
                <span className="font-semibold">{job.customer_name}</span>
                {isCompleted ? (
                  <Badge variant="secondary" className="text-xs text-green-700">
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                    Pending
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {job.ro_number && (
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    R/O {job.ro_number}
                  </span>
                )}
                {job.customer_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {job.customer_phone}
                  </span>
                )}
                {(job.vehicle_model || job.vin_number) && (
                  <span className="flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {[job.vehicle_model, job.vehicle_variant]
                      .filter(Boolean)
                      .join(" ")}
                    {job.vin_number && ` · ${job.vin_number.slice(-8)}`}
                  </span>
                )}
                {job.estimated_amount && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <IndianRupee className="h-3 w-3" />
                    {formatINR(job.estimated_amount)}
                  </span>
                )}
                <span>{dateFormatted}</span>
              </div>

              {job.description && (
                <p className="text-xs text-muted-foreground italic line-clamp-1">
                  {job.description}
                </p>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {isCompleted && job.invoice_id ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/invoices/${job.invoice_id}`}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      {canIssueGatePass ? "Receipt & Gate Pass" : "View Receipt"}
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveOpen(true)}
                    disabled={removing}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => setCompleteOpen(true)}
                  >
                    <Receipt className="mr-1.5 h-3.5 w-3.5" />
                    Generate Sales Receipt
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveOpen(true)}
                    disabled={removing}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate sales receipt dialog */}
      <CompleteRoDialog
        job={job}
        cashbooks={cashbooks}
        companyId={companyId}
        branchId={branchId}
        financialYearId={financialYearId}
        userId={userId}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
      />

      {/* Remove confirmation */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from pending list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{job.customer_name}</strong>
              {job.ro_number ? ` (R/O ${job.ro_number})` : ""} from the pending
              list. Use this if the job was cancelled or entered by mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

export function PendingRoClient({
  jobs,
  cashbooks,
  companyId,
  branchId,
  financialYearId,
  userId,
  canCreate,
  canIssueGatePass,
}: PendingRoClientProps) {
  const pending = jobs.filter((j) => !j.completed_at);
  const completed = jobs.filter((j) => !!j.completed_at);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No pending R/Os</p>
        <p className="text-sm mt-1">
          Add a repair order here when it is closed by the workshop but the
          customer hasn&apos;t paid or taken delivery yet.
        </p>
        {canCreate && (
          <Button asChild className="mt-4">
            <Link href="/sales/pending-ro/new">Add Pending R/O</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending section */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Awaiting Payment & Delivery ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((job) => (
              <RoCard
                key={job.id}
                job={job}
                cashbooks={cashbooks}
                companyId={companyId}
                branchId={branchId}
                financialYearId={financialYearId}
                userId={userId}
                canIssueGatePass={canIssueGatePass}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Completed ({completed.length})
          </h2>
          <div className="space-y-3">
            {completed.map((job) => (
              <RoCard
                key={job.id}
                job={job}
                cashbooks={cashbooks}
                companyId={companyId}
                branchId={branchId}
                financialYearId={financialYearId}
                userId={userId}
                canIssueGatePass={canIssueGatePass}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
