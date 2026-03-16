"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createVehicle } from "@/lib/queries/vehicle-register";

interface VehicleFormProps {
  userId: string;
  companyId: string;
  branchId: string;
  financialYearId: string;
}

const VEHICLE_TYPES = [
  { value: "automobile", label: "Automobile (Car/SUV)" },
  { value: "tractor", label: "Tractor / Agri Equipment" },
  { value: "two_wheeler", label: "Two Wheeler" },
  { value: "commercial", label: "Commercial Vehicle" },
  { value: "other", label: "Other" },
];

export function VehicleForm({ userId, companyId, branchId, financialYearId }: VehicleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [vehicleType, setVehicleType] = useState("automobile");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [color, setColor] = useState("");
  const [year, setYear] = useState("");
  const [vinNumber, setVinNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!model.trim()) { toast.error("Vehicle model is required."); return; }
    if (!companyId || !branchId) { toast.error("Company and branch scope must be set."); return; }

    startTransition(async () => {
      const result = await createVehicle({
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId || undefined,
        vehicle_type: vehicleType,
        make: make || undefined,
        model,
        variant: variant || undefined,
        color: color || undefined,
        year_of_manufacture: year ? Number(year) : undefined,
        vin_number: vinNumber || undefined,
        chassis_number: chassisNumber || undefined,
        engine_number: engineNumber || undefined,
        registration_number: registrationNumber || undefined,
        customer_name: customerName || undefined,
        expected_delivery_date: expectedDate || undefined,
        notes: notes || undefined,
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
        <CardHeader><CardTitle>Vehicle Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Vehicle Type *</Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="make">Make / Manufacturer</Label>
              <Input id="make" placeholder="e.g. Maruti Suzuki" value={make} onChange={(e) => setMake(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model *</Label>
              <Input id="model" placeholder="e.g. Brezza, Bolero" value={model} onChange={(e) => setModel(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="variant">Variant</Label>
              <Input id="variant" placeholder="e.g. VXi, ZXi+" value={variant} onChange={(e) => setVariant(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Color</Label>
              <Input id="color" placeholder="e.g. Pearl White" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year">Year of Manufacture</Label>
              <Input id="year" type="number" placeholder="2024" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Identification Numbers</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vin">VIN Number</Label>
              <Input id="vin" placeholder="Vehicle Identification Number" value={vinNumber} onChange={(e) => setVinNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chassis">Chassis Number</Label>
              <Input id="chassis" placeholder="Chassis / Frame Number" value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engine">Engine Number</Label>
              <Input id="engine" placeholder="Engine Number" value={engineNumber} onChange={(e) => setEngineNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg">Registration Number</Label>
              <Input id="reg" placeholder="Temp / Final Registration" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Customer & Delivery</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="customer">Customer Name</Label>
            <Input id="customer" placeholder="Enter customer name (if known)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expected">Expected Delivery Date</Label>
            <Input id="expected" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Add to Vehicle Register
      </Button>
    </form>
  );
}
