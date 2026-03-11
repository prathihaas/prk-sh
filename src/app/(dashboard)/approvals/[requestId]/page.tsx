import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getApprovalRequest } from "@/lib/queries/approvals";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ApprovalActionForm } from "./approval-action-form";

const TYPE_LABELS: Record<string, string> = {
  expense: "Expense",
  invoice: "Invoice",
  cashbook_variance: "Cashbook Variance",
};

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let request;
  try {
    request = await getApprovalRequest(requestId);
  } catch {
    notFound();
  }

  // Sort steps by step_order for display
  const sortedSteps = [...(request.steps || [])].sort(
    (a: { step_order: number }, b: { step_order: number }) =>
      a.step_order - b.step_order
  );

  // Map steps to the ApprovalTimeline expected format
  const timelineSteps = sortedSteps.map(
    (step: {
      id: string;
      step_order: number;
      status: string;
      approver: { full_name: string } | null;
      assigned_to: string | null;
      acted_at: string | null;
      comments: string | null;
    }) => ({
      id: step.id,
      step_order: step.step_order,
      step_label: step.approver?.full_name || `Step ${step.step_order}`,
      status: step.status,
      actor_name: step.approver?.full_name || null,
      acted_at: step.acted_at,
      comments: step.comments,
    })
  );

  // Find the first pending step (the one that can be acted on)
  const pendingStep = sortedSteps.find(
    (step: { status: string }) => step.status === "pending"
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`Approval Request`} />

      {/* Request details card */}
      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium">
              {TYPE_LABELS[request.request_type] || request.request_type}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference ID</span>
            <span className="font-mono text-sm">{request.reference_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge status={request.overall_status} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>
              {new Date(request.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Step</span>
            <span className="tabular-nums">{request.current_step}</span>
          </div>
        </CardContent>
      </Card>

      {/* Approval Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalTimeline steps={timelineSteps} />
        </CardContent>
      </Card>

      {/* Action form for pending step */}
      {pendingStep && request.overall_status === "pending" && (
        <>
          <Separator />
          <ApprovalActionForm
            stepId={pendingStep.id}
            stepLabel={
              pendingStep.approver?.full_name ||
              `Step ${pendingStep.step_order}`
            }
          />
        </>
      )}

      {/* Back button */}
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/approvals">Back to Approvals</Link>
        </Button>
      </div>
    </div>
  );
}
