import { CheckCircle2, Circle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
] as const;

/**
 * Map any expense.approval_status enum value to a position in the simplified
 * 3-stage flow:
 *   0 = before submitted (draft)
 *   1 = submitted (waiting for approval)
 *   2 = approved (any of branch_/accounts_/owner_approved — single approval is enough)
 *   3 = paid
 */
function stageIndex(status: string): number {
  switch (status) {
    case "draft":
      return 0;
    case "submitted":
      return 1;
    case "branch_approved":
    case "accounts_approved":
    case "owner_approved":
      return 2;
    case "paid":
    case "paid_direct":
      return 3;
    default:
      return 0;
  }
}

interface Props {
  status: string;
  className?: string;
}

export function ExpenseApprovalProgress({ status, className }: Props) {
  const isRejected = status === "rejected";
  const isPaidDirect = status === "paid_direct";
  const current = stageIndex(status);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 sm:gap-3">
        {STAGES.map((stage, idx) => {
          const stagePos = idx + 1;
          const isDone = !isRejected && current >= stagePos;
          const isCurrent = !isRejected && current === stagePos - 1;
          const isPending = !isRejected && current < stagePos - 1;

          let icon = <Circle className="h-6 w-6" />;
          let color = "text-muted-foreground";
          if (isRejected) {
            icon = idx === 0 ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />;
            color = idx === 0 ? "text-green-600" : "text-red-500";
          } else if (isDone) {
            icon = <CheckCircle2 className="h-6 w-6" />;
            color = "text-green-600";
          } else if (isCurrent) {
            icon = <Clock className="h-6 w-6 animate-pulse" />;
            color = "text-blue-600";
          } else if (isPending) {
            color = "text-muted-foreground/40";
          }

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center text-center min-w-0 flex-1">
                <div className={color}>{icon}</div>
                <p className={cn("text-xs font-medium mt-1 truncate w-full", color)}>
                  {stage.label}
                </p>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 sm:mx-2",
                    !isRejected && current > stagePos ? "bg-green-600" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {isRejected && (
        <p className="text-xs text-red-600 text-center font-medium">
          Rejected — flow stopped
        </p>
      )}
      {isPaidDirect && (
        <p className="text-xs text-amber-600 text-center font-medium">
          Paid by cashier without approval
        </p>
      )}
    </div>
  );
}
