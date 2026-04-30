"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { approveExpense, rejectExpense } from "@/lib/queries/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

interface Props {
  expenseId: string;
}

export function ExpenseApprovalActions({ expenseId }: Props) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);

  const isBusy = isApproving || isRejecting;

  async function doApprove() {
    setIsApproving(true);
    try {
      const result = await approveExpense(expenseId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Expense approved — ready for payment");
      router.push(`/expenses/${expenseId}`);
      router.refresh();
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsApproving(false);
      setConfirmApproveOpen(false);
    }
  }

  async function doReject() {
    if (!reason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setIsRejecting(true);
    try {
      const result = await rejectExpense(expenseId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Expense rejected");
      router.push(`/expenses/${expenseId}`);
      router.refresh();
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsRejecting(false);
      setConfirmRejectOpen(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reject-reason" className="text-sm">
            Reason (required only if rejecting)
          </Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="If you reject, explain why so the submitter knows what to fix…"
            rows={3}
            disabled={isBusy}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="destructive"
            onClick={() => setConfirmRejectOpen(true)}
            disabled={isBusy || !reason.trim()}
            className="gap-2"
          >
            {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Reject
          </Button>
          <Button
            onClick={() => setConfirmApproveOpen(true)}
            disabled={isBusy}
            className="gap-2"
          >
            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approve
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          One approval is enough — on approval, this expense becomes payable
          through any cashbook.
        </p>
      </CardContent>

      <AlertDialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This fully approves the expense. It can then be paid via any cashbook.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doApprove} disabled={isBusy}>
              {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRejectOpen} onOpenChange={setConfirmRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              The submitter will see your reason. The expense cannot be approved
              afterwards — they will need to create a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doReject}
              disabled={isBusy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
