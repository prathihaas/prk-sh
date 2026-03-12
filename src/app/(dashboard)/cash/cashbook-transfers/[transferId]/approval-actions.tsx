"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { approveCashbookTransfer, rejectCashbookTransfer } from "@/lib/queries/cashbook-transfers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormCard } from "@/components/shared/form-card";

interface TransferApprovalActionsProps {
  transferId: string;
  approvedBy: string;
}

export function TransferApprovalActions({
  transferId,
  approvedBy,
}: TransferApprovalActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function handleApprove() {
    setIsApproving(true);
    try {
      const result = await approveCashbookTransfer(transferId, approvedBy);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer approved — cashbooks have been updated");
      router.push("/cash/cashbook-transfers");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      toast.error("Please provide a reason (at least 5 characters)");
      return;
    }
    setIsRejecting(true);
    try {
      const result = await rejectCashbookTransfer(transferId, approvedBy, rejectReason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer rejected");
      router.push("/cash/cashbook-transfers");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <FormCard
      title="Accountant Review"
      description="Approve to execute the transfer, or reject with a reason. Approval creates cashbook transactions immediately."
    >
      <div className="space-y-4">
        {!showRejectForm ? (
          <div className="flex gap-3">
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve Transfer
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRejectForm(true)}
              className="gap-2 border-red-300 text-red-700 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Rejection Reason *
              </label>
              <Textarea
                rows={3}
                placeholder="Explain why this transfer is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isRejecting}
                className="gap-2"
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Confirm Rejection
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ⚠️ Approving will immediately debit the source cashbook and credit the destination cashbook.
          Both cashbooks must have an open day on the transfer date.
        </p>
      </div>
    </FormCard>
  );
}
