"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPendingRoJob } from "@/lib/queries/pending-ro";

interface PendingRoFormProps {
  userId: string;
  companyId: string;
  branchId: string;
}

export function PendingRoForm({ userId, companyId, branchId }: PendingRoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [roNumber, setRoNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleVariant, setVehicleVariant] = useState("");
  const [vinNumber, setVinNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [roClosedDate, setRoClosedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createPendingRoJob({
        company_id: companyId,
        branch_id: branchId,
        ro_number: roNumber || undefined,
        customer_name: customerName,
        customer_phone: customerPhone || undefined,
        vehicle_model: vehicleModel || undefined,
        vehicle_variant: vehicleVariant || undefined,
        vin_number: vinNumber || undefined,
        engine_number: engineNumber || undefined,
        description: description || undefined,
        estimated_amount: estimatedAmount ? parseFloat(estimatedAmount) : undefined,
        ro_closed_date: roClosedDate,
        created_by: userId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("R/O added to pending list.");
        router.push("/sales/pending-ro");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* R/O Details */}
      <Card>
        <CardHeader>
          <CardTitle>R/O Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ro_number">R/O Number</Label>
              <Input
                id="ro_number"
                placeholder="e.g. RO/2025-26/0042"
                value={roNumber}
                onChange={(e) => setRoNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ro_date">R/O Closed Date</Label>
              <Input
                id="ro_date"
                type="date"
                value={roClosedDate}
                onChange={(e) => setRoClosedDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Work Description</Label>
            <Textarea
              id="description"
              placeholder="e.g. Full service, brake pad replacement, AC repair…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimated_amount">Estimated Amount (₹)</Label>
            <Input
              id="estimated_amount"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={estimatedAmount}
              onChange={(e) => setEstimatedAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pre-fills the amount when generating the sales receipt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customer */}
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                placeholder="Full name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer_phone">Phone Number</Label>
              <Input
                id="customer_phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vehicle_model">Model</Label>
              <Input
                id="vehicle_model"
                placeholder="e.g. Maruti Swift"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle_variant">Variant</Label>
              <Input
                id="vehicle_variant"
                placeholder="e.g. VXi, ZXi+"
                value={vehicleVariant}
                onChange={(e) => setVehicleVariant(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vin_number">VIN / Chassis Number</Label>
              <Input
                id="vin_number"
                placeholder="17-digit VIN"
                value={vinNumber}
                onChange={(e) => setVinNumber(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engine_number">Engine Number</Label>
              <Input
                id="engine_number"
                placeholder="Engine serial number"
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full" size="lg">
        {isPending ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Wrench className="mr-2 h-5 w-5" />
        )}
        {isPending ? "Adding…" : "Add to Pending List"}
      </Button>
    </form>
  );
}
