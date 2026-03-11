"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { approveStep, rejectStep } from "@/lib/queries/approvals";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApprovalActionFormProps {
  stepId: string;
  stepLabel: string;
}

export function ApprovalActionForm({
  stepId,
  stepLabel,
}: ApprovalActionFormProps) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  async function handleApprove() {
    setIsLoading(true);
    setAction("approve");
    try {
      const result = await approveStep(stepId, comments || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Step approved successfully");
        router.refresh();
      }
    } catch {
      toast.error("Failed to approve step");
    } finally {
      setIsLoading(false);
      setAction(null);
    }
  }

  async function handleReject() {
    if (!comments.trim()) {
      toast.error("Comments are required for rejection");
      return;
    }
    setIsLoading(true);
    setAction("reject");
    try {
      const result = await rejectStep(stepId, comments);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Step rejected");
        router.refresh();
      }
    } catch {
      toast.error("Failed to reject step");
    } finally {
      setIsLoading(false);
      setAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Take Action &mdash; {stepLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="comments">
            Comments <span className="text-muted-foreground text-xs">(required for rejection)</span>
          </Label>
          <Textarea
            id="comments"
            placeholder="Add comments..."
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleApprove}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading && action === "approve" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Approve
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isLoading}
          >
            {isLoading && action === "reject" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
