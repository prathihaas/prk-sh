// Vehicle register types and constants — NO "use server" so these can be
// imported freely in both server components and client components.

export type VehicleStatus =
  | "arrived"
  | "ro_opened"
  | "waiting_for_parts"
  | "parts_received"
  | "insurance_approved"
  | "work_in_progress"
  | "work_done"
  | "ready_for_delivery"
  | "gate_pass_issued"
  | "delivered"
  // legacy (sales/showroom)
  | "billed"
  | "challan_issued";

export type ShopType = "workshop" | "bodyshop";

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  arrived: "Arrived",
  ro_opened: "R/O Opened",
  waiting_for_parts: "Waiting for Parts",
  parts_received: "Parts Received",
  insurance_approved: "Insurance Approved",
  work_in_progress: "Work in Progress",
  work_done: "Work Done",
  ready_for_delivery: "Ready for Delivery",
  gate_pass_issued: "Gate Pass Issued",
  delivered: "Delivered",
  // legacy
  billed: "Billed",
  challan_issued: "Gate Pass Issued",
};
