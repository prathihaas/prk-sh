"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Package,
  CheckSquare,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Truck,
  PackageCheck,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updateVehicleStatus,
  markVehicleDelivered,
} from "@/lib/queries/vehicle-register";
import type { VehicleStatus, ShopType } from "@/lib/constants/vehicle-register";

interface VehicleActionsProps {
  vehicle: Record<string, unknown>;
  userId: string;
}

// Status transition rules: what button to show based on current status
type TransitionDef = {
  from: VehicleStatus[];
  to: VehicleStatus;
  label: string;
  Icon: React.ElementType;
  variant?: "default" | "outline" | "destructive";
  requiresRoNumber?: boolean;
  requiresNotes?: boolean;
  confirmMsg?: string;
};

const WORKSHOP_TRANSITIONS: TransitionDef[] = [
  {
    from: ["arrived"],
    to: "ro_opened",
    label: "Open R/O",
    Icon: ClipboardList,
    requiresRoNumber: true,
  },
  {
    from: ["ro_opened", "parts_received"],
    to: "waiting_for_parts",
    label: "Waiting for Parts",
    Icon: Package,
  },
  {
    from: ["waiting_for_parts"],
    to: "parts_received",
    label: "Parts Received",
    Icon: PackageCheck,
  },
  {
    from: ["ro_opened", "parts_received"],
    to: "work_in_progress",
    label: "Start Work",
    Icon: Wrench,
  },
  {
    from: ["work_in_progress"],
    to: "work_done",
    label: "Work Done",
    Icon: CheckSquare,
  },
  {
    from: ["work_done"],
    to: "ready_for_delivery",
    label: "Ready for Delivery",
    Icon: CheckCircle2,
  },
];

const BODYSHOP_TRANSITIONS: TransitionDef[] = [
  {
    from: ["arrived"],
    to: "ro_opened",
    label: "Open R/O",
    Icon: ClipboardList,
    requiresRoNumber: true,
  },
  {
    from: ["ro_opened", "parts_received"],
    to: "waiting_for_parts",
    label: "Waiting for Parts",
    Icon: Package,
  },
  {
    from: ["waiting_for_parts"],
    to: "parts_received",
    label: "Parts Received",
    Icon: PackageCheck,
  },
  {
    from: ["ro_opened", "parts_received", "waiting_for_parts"],
    to: "insurance_approved",
    label: "Insurance Approved",
    Icon: ShieldCheck,
  },
  {
    from: ["ro_opened", "insurance_approved", "parts_received"],
    to: "work_in_progress",
    label: "Start Work",
    Icon: Wrench,
  },
  {
    from: ["work_in_progress"],
    to: "work_done",
    label: "Work Done",
    Icon: CheckSquare,
  },
  {
    from: ["work_done"],
    to: "ready_for_delivery",
    label: "Ready for Delivery",
    Icon: CheckCircle2,
  },
];

function ActionButton({
  transition,
  vehicleId,
}: {
  transition: TransitionDef;
  vehicleId: string;
}) {
  const [open, setOpen] = useState(false);
  const [roNumber, setRoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const { Icon, label } = transition;

  function handle() {
    if (transition.requiresRoNumber && !roNumber.trim()) {
      toast.error("R/O Number is required.");
      return;
    }
    startTransition(async () => {
      const result = await updateVehicleStatus(vehicleId, transition.to, {
        ro_number: roNumber || undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Status updated to: ${label}`);
        setOpen(false);
        setRoNumber("");
        setNotes("");
      }
    });
  }

  // If no extra inputs needed, just a confirm button
  if (!transition.requiresRoNumber && !transition.requiresNotes) {
    return (
      <Button
        variant={transition.variant || "outline"}
        size="sm"
        className="w-full justify-start gap-2"
        disabled={isPending}
        onClick={handle}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={transition.variant || "outline"}
          size="sm"
          className="w-full justify-start gap-2"
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {transition.confirmMsg || `Update status to "${label}".`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {transition.requiresRoNumber && (
            <div className="space-y-1.5">
              <Label>
                R/O Number <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. RO-2025-00123"
                value={roNumber}
                onChange={(e) => setRoNumber(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {transition.requiresNotes && (
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icon className="mr-2 h-4 w-4" />
            )}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliverButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await markVehicleDelivered(vehicleId, notes || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Vehicle marked as delivered.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2">
          <Truck className="h-4 w-4" />
          Mark as Delivered
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Vehicle Delivery</DialogTitle>
          <DialogDescription>
            Confirm that the vehicle has been handed over to the customer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Delivery Notes (optional)</Label>
            <Textarea
              placeholder="Any final notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Truck className="mr-2 h-4 w-4" />
            )}
            Confirm Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Invoice link hint for gate pass
function GatePassHint({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-200">
      <p className="font-medium flex items-center gap-1">
        <FileText className="h-3.5 w-3.5" />
        Gate Pass Pending
      </p>
      <p className="mt-1">
        Issue the gate pass from the linked invoice before marking as delivered.
      </p>
      <a
        href={`/invoices/${invoiceId}`}
        className="mt-1.5 inline-block text-amber-700 underline"
      >
        Go to Invoice →
      </a>
    </div>
  );
}

export function VehicleActions({ vehicle, userId: _userId }: VehicleActionsProps) {
  const status = String(vehicle.status) as VehicleStatus;
  const shopType = (vehicle.shop_type as ShopType) || "workshop";
  const invoiceId = vehicle.invoice_id as string | null;

  const transitions =
    shopType === "bodyshop" ? BODYSHOP_TRANSITIONS : WORKSHOP_TRANSITIONS;

  const availableTransitions = transitions.filter((t) =>
    t.from.includes(status)
  );

  const canDeliver =
    status === "gate_pass_issued" ||
    status === "ready_for_delivery" ||
    status === "challan_issued";

  const needsGatePass = status === "ready_for_delivery" && invoiceId && !vehicle.gate_pass_issued_at;

  if (status === "delivered") {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-300 text-center">
        ✓ Vehicle has been delivered
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {availableTransitions.map((t) => (
        <ActionButton
          key={t.to}
          transition={t}
          vehicleId={String(vehicle.id)}
        />
      ))}

      {needsGatePass && invoiceId && (
        <GatePassHint invoiceId={invoiceId} />
      )}

      {canDeliver && !needsGatePass && (
        <DeliverButton vehicleId={String(vehicle.id)} />
      )}
    </div>
  );
}
