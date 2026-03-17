"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  ClipboardList,
  Package,
  PackageCheck,
  Wrench,
  CheckSquare,
  CheckCircle2,
  Truck,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateVehicleStatus,
  markVehicleDelivered,
} from "@/lib/queries/vehicle-register";
import { STATUS_LABELS, type VehicleStatus, type ShopType } from "@/lib/constants/vehicle-register";

export type VehicleForAction = {
  id: string;
  status: string;
  shop_type?: string | null;
};

type TransitionDef = {
  to: VehicleStatus;
  label: string;
  Icon: React.ElementType;
};

// Primary fast-path transition per status (same for both shop types unless overridden)
const PRIMARY: Partial<Record<VehicleStatus, TransitionDef>> = {
  waiting_for_parts: { to: "parts_received", label: "Parts Received", Icon: PackageCheck },
  parts_received: { to: "work_in_progress", label: "Start Work", Icon: Wrench },
  insurance_approved: { to: "work_in_progress", label: "Start Work", Icon: Wrench },
  work_in_progress: { to: "work_done", label: "Work Done", Icon: CheckSquare },
  work_done: { to: "ready_for_delivery", label: "Ready for Delivery", Icon: CheckCircle2 },
};

// Alternative transitions (shown in the "⌄" dropdown) per status × shop_type
function getAlternatives(status: VehicleStatus, shopType: ShopType): TransitionDef[] {
  if (status === "ro_opened") {
    const alts: TransitionDef[] = [
      { to: "waiting_for_parts", label: "Wait for Parts", Icon: Package },
      { to: "work_in_progress", label: "Start Work", Icon: Wrench },
    ];
    if (shopType === "bodyshop") {
      alts.push({ to: "insurance_approved", label: "Insurance Approved", Icon: ShieldCheck });
    }
    return alts;
  }
  if (status === "parts_received") {
    return [{ to: "waiting_for_parts", label: "Back to Waiting", Icon: Package }];
  }
  return [];
}

// ─── R/O Dialog ───────────────────────────────────────────────────────────────

function RoOpenDialog({
  vehicleId,
  open,
  onClose,
}: {
  vehicleId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [roNumber, setRoNumber] = useState("");
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!roNumber.trim()) { toast.error("R/O Number is required."); return; }
    startTransition(async () => {
      const result = await updateVehicleStatus(vehicleId, "ro_opened", { ro_number: roNumber.trim() });
      if (result.error) { toast.error(result.error); }
      else { toast.success("R/O opened ✓"); setRoNumber(""); onClose(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setRoNumber(""); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Open Repair Order</DialogTitle>
          <DialogDescription>Enter the R/O number to begin the job.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>R/O Number <span className="text-destructive">*</span></Label>
          <Input
            placeholder="e.g. RO-2026-00123"
            value={roNumber}
            onChange={(e) => setRoNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ClipboardList className="mr-2 h-4 w-4" />
            Open R/O
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Deliver Dialog ───────────────────────────────────────────────────────────

function DeliverDialog({
  vehicleId,
  open,
  onClose,
}: {
  vehicleId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await markVehicleDelivered(vehicleId, notes || undefined);
      if (result.error) { toast.error(result.error); }
      else { toast.success("Vehicle delivered ✓"); setNotes(""); onClose(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setNotes(""); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Delivery</DialogTitle>
          <DialogDescription>Confirm the vehicle has been handed over to the customer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Delivery Notes (optional)</Label>
          <Textarea
            placeholder="Any final notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Confirm Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VehicleQuickAction({ vehicle }: { vehicle: VehicleForAction }) {
  const status = vehicle.status as VehicleStatus;
  const shopType = (vehicle.shop_type as ShopType) ?? "workshop";

  const [roDialogOpen, setRoDialogOpen] = useState(false);
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Already delivered ──
  if (status === "delivered") {
    return (
      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Delivered
      </span>
    );
  }

  // ── Arrived: needs R/O dialog ──
  if (status === "arrived") {
    return (
      <>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setRoDialogOpen(true)}>
          <ClipboardList className="h-3.5 w-3.5" />
          Open R/O
        </Button>
        <RoOpenDialog vehicleId={vehicle.id} open={roDialogOpen} onClose={() => setRoDialogOpen(false)} />
      </>
    );
  }

  // ── R/O opened: show dropdown with all options ──
  if (status === "ro_opened") {
    const alts = getAlternatives("ro_opened", shopType);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            Next Step
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {alts.map(({ to, label, Icon }) => (
            <DropdownMenuItem
              key={to}
              className="gap-2 cursor-pointer"
              onClick={() => {
                startTransition(async () => {
                  const result = await updateVehicleStatus(vehicle.id, to);
                  if (result.error) toast.error(result.error);
                  else toast.success(`✓ ${STATUS_LABELS[to]}`);
                });
              }}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ── Ready / gate pass: deliver dialog ──
  if (
    status === "ready_for_delivery" ||
    status === "gate_pass_issued" ||
    status === "challan_issued"
  ) {
    return (
      <>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setDeliverDialogOpen(true)}>
          <Truck className="h-3.5 w-3.5" />
          Deliver
        </Button>
        <DeliverDialog vehicleId={vehicle.id} open={deliverDialogOpen} onClose={() => setDeliverDialogOpen(false)} />
      </>
    );
  }

  // ── Simple direct-fire transitions ──
  const primary = PRIMARY[status];
  const alts = getAlternatives(status, shopType);

  if (!primary) return null;

  const { to, label, Icon } = primary;

  function fireDirect(targetStatus: VehicleStatus) {
    startTransition(async () => {
      const result = await updateVehicleStatus(vehicle.id, targetStatus);
      if (result.error) toast.error(result.error);
      else toast.success(`✓ ${STATUS_LABELS[targetStatus]}`);
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1.5 rounded-r-none border-r-0"
        disabled={isPending}
        onClick={() => fireDirect(to)}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
        {label}
      </Button>

      {alts.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 px-0 rounded-l-none"
              disabled={isPending}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {alts.map(({ to: altTo, label: altLabel, Icon: AltIcon }) => (
              <DropdownMenuItem
                key={altTo}
                className="gap-2 cursor-pointer"
                onClick={() => fireDirect(altTo)}
              >
                <AltIcon className="h-4 w-4" />
                {altLabel}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
