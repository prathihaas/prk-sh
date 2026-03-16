"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { markVehicleDelivered } from "@/lib/queries/vehicle-register";

interface VehicleActionsProps {
  vehicle: Record<string, unknown>;
  userId: string;
}

export function VehicleActions({ vehicle, userId: _userId }: VehicleActionsProps) {
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [delayReason, setDelayReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const canDeliver = vehicle.status === "challan_issued";

  function handleDeliver() {
    startTransition(async () => {
      const result = await markVehicleDelivered(String(vehicle.id), delayReason || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Vehicle marked as delivered.");
        setDeliverOpen(false);
      }
    });
  }

  if (!canDeliver) return null;

  return (
    <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Truck className="mr-2 h-4 w-4" />
          Mark as Delivered
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Vehicle Delivery</DialogTitle>
          <DialogDescription>
            This confirms that the vehicle has been physically handed over to the customer.
            A delivery challan must already be issued.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="delay">Delay Reason (if delivery was delayed)</Label>
            <Textarea
              id="delay"
              placeholder="Optional: explain any delay in delivery..."
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeliverOpen(false)}>Cancel</Button>
          <Button onClick={handleDeliver} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Confirm Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
