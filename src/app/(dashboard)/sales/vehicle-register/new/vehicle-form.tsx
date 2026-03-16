"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Wrench, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createVehicle, type ShopType } from "@/lib/queries/vehicle-register";

interface VehicleFormProps {
  userId: string;
  companyId: string;
  branchId: string;
  financialYearId: string;
}

export function VehicleForm({ userId, companyId, branchId, financialYearId }: VehicleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [shopType, setShopType] = useState<ShopType>("workshop");
  const [model, setModel] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!model.trim()) { toast.error("Vehicle model is required."); return; }
    if (!registrationNumber.trim()) { toast.error("Vehicle number is required."); return; }
    if (!companyId || !branchId) { toast.error("Company and branch scope must be set."); return; }

    startTransition(async () => {
      const result = await createVehicle({
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId || undefined,
        shop_type: shopType,
        model: model.trim(),
        registration_number: registrationNumber.trim().toUpperCase(),
        customer_name: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
        created_by: userId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Vehicle added to register successfully.");
        router.push(`/sales/vehicle-register/${result.id}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Which shop is this vehicle going to?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                {
                  value: "workshop" as ShopType,
                  label: "Workshop",
                  desc: "Mechanical repairs, service, maintenance",
                  Icon: Wrench,
                  activeClass: "border-blue-500 ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700",
                },
                {
                  value: "bodyshop" as ShopType,
                  label: "Bodyshop",
                  desc: "Denting, painting, body repairs",
                  Icon: Paintbrush,
                  activeClass: "border-purple-500 ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950 text-purple-700",
                },
              ] as const
            ).map(({ value, label, desc, Icon, activeClass }) => (
              <button
                key={value}
                type="button"
                onClick={() => setShopType(value)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                  shopType === value ? activeClass : "border-border hover:border-muted-foreground/50"
                )}
              >
                <Icon className="h-6 w-6" />
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="model">
              Vehicle Model <span className="text-destructive">*</span>
            </Label>
            <Input
              id="model"
              placeholder="e.g. Swift, Bolero, Activa"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg">
              Vehicle Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg"
              placeholder="e.g. TS09AB1234"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customer">Customer Name</Label>
            <Input
              id="customer"
              placeholder="Vehicle owner's name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Problem / Notes</Label>
            <Textarea
              id="notes"
              placeholder="Problem description, initial observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Add to {shopType === "workshop" ? "Workshop" : "Bodyshop"} Register
      </Button>
    </form>
  );
}
