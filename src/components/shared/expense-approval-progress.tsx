import { CheckCircle2, Circle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type ExpenseApprovalStatus =
  | "draft"
  | "submitted"
  | "branch_approved"
  | "accounts_approved"
  | "owner_approved"
  | "rejected"
  | "paid"
  | "paid_direct";

const STAGES = [
  { key: "submitted", label: "Submitted", description: "Expense entered" },
  { key: "branch_approved", label: "Branch", description: "Branch manager review" },
  { key: "accounts_approved", label: "Accounts", description: "Accounts review" },
  { key: "owner_approved", label: "Owner", description: "Final approval" },
  { key: "paid", label: "Paid", description: "Payment recorded" },
] as const;

const ORDER: Record<string, number> = {
  draft: 0,
  submitted: 1,
  branch_approved: 2,
  accounts_approved: 3,
  owner_approved: 4,
  paid: 5,
  paid_direct: 5,
};

interface Props {
  status: ExpenseApprovalStatus | string;
  className?: string;
}

/**
 * Visual horizontal step indicator for the expense approval flow.
 * Shows where the expense currently is, what's done, and what's pending.
 */
export function ExpenseApprovalProgress({ status, className }: Props) {
  const isRejected = status === "rejected";
  const isPaidDirect = status === "paid_direct";
  const currentIndex = ORDER[status] ?? 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1 sm:gap-2">
        {STAGES.map((stage, idx) => {
          const stageIndex = idx + 1; // 1-indexed to match ORDER
          const isDone = !isRejected && currentIndex >= stageIndex;
          const isCurrent = !isRejected && currentIndex === stageIndex - 1;
          const isPending = !isRejected && currentIndex < stageIndex - 1;

          let icon = <Circle className="h-5 w-5" />;
          let color = "text-muted-foreground";
          if (isRejected) {
            icon = idx === 0 ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />;
            color = idx === 0 ? "text-green-600" : "text-red-500";
          } else if (isDone) {
            icon = <CheckCircle2 className="h-5 w-5" />;
            color = "text-green-600";
          } else if (isCurrent) {
            icon = <Clock className="h-5 w-5 animate-pulse" />;
            color = "text-blue-600";
          } else if (isPending) {
            color = "text-muted-foreground/40";
          }

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center text-center min-w-0 flex-1">
                <div className={color}>{icon}</div>
                <p className={cn("text-[11px] font-medium mt-1 truncate w-full", color)}>
                  {stage.label}
                </p>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 sm:mx-2",
                    !isRejected && currentIndex > stageIndex
                      ? "bg-green-600"
                      : "bg-muted"
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
          Paid by cashier without full approval
        </p>
      )}
    </div>
  );
}
