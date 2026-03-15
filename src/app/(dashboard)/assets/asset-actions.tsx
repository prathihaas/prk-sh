"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { recordKmReading, recordAssetAudit, assignAsset, updateAssetStatus } from "@/lib/queries/assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface KmFormProps {
  assetId: string;
  userId: string;
  currentKm?: number;
}

export function KmReadingForm({ assetId, userId, currentKm }: KmFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [km, setKm] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!km || isNaN(Number(km))) { toast.error("Enter a valid km reading"); return; }
    if (currentKm && Number(km) < currentKm) {
      toast.error(`Reading must be >= current reading (${currentKm} km)`);
      return;
    }
    setLoading(true);
    const result = await recordKmReading({
      asset_id: assetId, reading_date: date, km_reading: Number(km),
      notes: notes || undefined, recorded_by: userId,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Km reading recorded");
    setOpen(false); setKm(""); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Record Km Reading</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Record Km Reading</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {currentKm && (
            <p className="text-sm text-muted-foreground">Current: <strong>{currentKm.toLocaleString("en-IN")} km</strong></p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label>Odometer (km) *</Label>
              <Input type="number" min={currentKm || 0} placeholder="e.g. 45200"
                value={km} onChange={(e) => setKm(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Reading
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AuditFormProps {
  assetId: string;
  userId: string;
  isVehicle: boolean;
}

export function AuditForm({ assetId, userId, isVehicle }: AuditFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [condition, setCondition] = useState("");
  const [km, setKm] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!condition) { toast.error("Select condition"); return; }
    setLoading(true);
    const result = await recordAssetAudit({
      asset_id: assetId, condition, audited_by: userId,
      km_reading: km ? Number(km) : undefined,
      notes: notes || undefined,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Audit recorded");
    setOpen(false); setCondition(""); setKm(""); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Conduct Audit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Asset Audit</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Condition *</Label>
            <Select onValueChange={setCondition} value={condition}>
              <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="needs_repair">Needs Repair</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isVehicle && (
            <div>
              <Label>Current Km Reading</Label>
              <Input type="number" min="0" placeholder="e.g. 45200"
                value={km} onChange={(e) => setKm(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Audit Notes</Label>
            <Textarea rows={3} placeholder="Observations, findings..." value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Audit
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AssignFormProps {
  assetId: string;
  userId: string;
  employees: { id: string; name: string; employee_code?: string }[];
  currentAssigneeId?: string | null;
}

export function AssignForm({ assetId, userId, employees, currentAssigneeId }: AssignFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState(currentAssigneeId ?? "");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await assignAsset({
      asset_id: assetId,
      employee_id: employeeId || null,
      notes: notes || undefined,
      assigned_by: userId,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(employeeId ? "Asset assigned" : "Asset unassigned");
    setOpen(false); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {currentAssigneeId ? "Reassign / Return" : "Assign to Employee"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{currentAssigneeId ? "Reassign / Return Asset" : "Assign Asset"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Employee</Label>
            <Select
              onValueChange={(val) => setEmployeeId(val === "__none__" ? "" : val)}
              value={employeeId || "__none__"}
            >
              <SelectTrigger><SelectValue placeholder="Select employee (or none to unassign)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Unassign (Return) —</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}{emp.employee_code ? ` (${emp.employee_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {employeeId ? "Assign" : "Return / Unassign"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface StatusFormProps {
  assetId: string;
  currentStatus: string;
}

export function StatusToggle({ assetId, currentStatus }: StatusFormProps) {
  const [loading, setLoading] = useState(false);

  const statuses = ["active", "under_maintenance", "disposed", "lost"];

  async function handleChange(status: string) {
    if (status === currentStatus) return;
    setLoading(true);
    const result = await updateAssetStatus(assetId, status);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else toast.success("Status updated");
  }

  return (
    <Select onValueChange={handleChange} value={currentStatus} disabled={loading}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
