import { CheckCircle2, Clock, XCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalStep {
  id: string;
  step_order: number;
  step_label: string;
  status: string;
  actor_name?: string | null;
  acted_at?: string | null;
  comments?: string | null;
}

interface ApprovalTimelineProps {
  steps: ApprovalStep[];
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  approved: CheckCircle2,
  rejected: XCircle,
  pending: Clock,
};

const statusColors: Record<string, string> = {
  approved: "text-green-600 dark:text-green-400",
  rejected: "text-red-600 dark:text-red-400",
  pending: "text-yellow-600 dark:text-yellow-400",
};

export function ApprovalTimeline({ steps }: ApprovalTimelineProps) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">No approval steps configured.</p>;
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const Icon = statusIcons[step.status] || Circle;
        const color = statusColors[step.status] || "text-muted-foreground";
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Icon className={cn("h-5 w-5", color)} />
              {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium">{step.step_label}</p>
              {step.actor_name && (
                <p className="text-xs text-muted-foreground">
                  {step.status === "approved" ? "Approved" : step.status === "rejected" ? "Rejected" : "Pending"} by {step.actor_name}
                </p>
              )}
              {step.acted_at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(step.acted_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {step.comments && (
                <p className="text-xs mt-1 italic text-muted-foreground">&ldquo;{step.comments}&rdquo;</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
