import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, string> = {
  // General
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  open: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  locked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  processed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reopened: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  closing: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  // Approval chain
  accounts_approved: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  manager_approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  branch_approved: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  owner_approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  // Fraud severity
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  // Attendance
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  half_day: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  leave: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  holiday: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  weekly_off: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  // Cashbook/transaction types
  main: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  petty: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  bank: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  receipt: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  payment: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  // Invoice types & statuses
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  vehicle_sale: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  spare_parts: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  service: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  // Cashbook types
  cash: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  petty_cash: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  // Vehicle register workshop statuses
  arrived: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ro_opened: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  waiting_for_parts: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  parts_received: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  insurance_approved: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  work_in_progress: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  work_done: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  ready_for_delivery: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  gate_pass_issued: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  challan_issued: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  billed: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  // Fraud resolution
  investigating: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  false_positive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  // Fallback
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const safeStatus = status || "unknown";
  const variant = STATUS_VARIANTS[safeStatus.toLowerCase()] || STATUS_VARIANTS.draft;
  const label = safeStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge variant="outline" className={cn("font-medium border-0", variant, className)}>
      {label}
    </Badge>
  );
}
