"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { upsertLeaveBalance } from "@/lib/queries/leave-balances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LeaveBalance { leave_type: string; total_days: number; used_days: number; }
interface LeaveBalanceEditorProps { employeeId: string; financialYearId: string; balances: LeaveBalance[]; }

const LEAVE_TYPES = ["casual", "sick", "earned", "maternity", "paternity", "unpaid"];

export function LeaveBalanceEditor({ employeeId, financialYearId, balances }: LeaveBalanceEditorProps) {
  const [rows, setRows] = useState<Record<string, { total: number; used: number }>>(() => {
    const map: Record<string, { total: number; used: number }> = {};
    LEAVE_TYPES.forEach((type) => { const ex = balances.find((b) => b.leave_type === type); map[type] = { total: ex?.total_days ?? 0, used: ex?.used_days ?? 0 }; });
    return map;
  });
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(leaveType: string) {
    if (!financialYearId) { toast.error("No active financial year"); return; }
    setSaving(leaveType);
    try {
      const result = await upsertLeaveBalance({ employee_id: employeeId, financial_year_id: financialYearId, leave_type: leaveType, total_days: rows[leaveType].total, used_days: rows[leaveType].used });
      if (result.error) toast.error(result.error); else toast.success(`${leaveType} balance updated`);
    } catch { toast.error("Failed to save"); } finally { setSaving(null); }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b"><span>Leave Type</span><span>Total Days</span><span>Used Days</span><span>Balance</span><span></span></div>
      {LEAVE_TYPES.map((type) => { const balance = rows[type].total - rows[type].used; return (
        <div key={type} className="grid grid-cols-5 gap-4 items-center">
          <span className="font-medium capitalize">{type}</span>
          <Input type="number" min="0" step="0.5" value={rows[type].total} onChange={(e) => setRows((prev) => ({ ...prev, [type]: { ...prev[type], total: parseFloat(e.target.value) || 0 } }))} className="h-8" />
          <Input type="number" min="0" step="0.5" value={rows[type].used} onChange={(e) => setRows((prev) => ({ ...prev, [type]: { ...prev[type], used: parseFloat(e.target.value) || 0 } }))} className="h-8" />
          <span className={`tabular-nums font-medium ${balance < 0 ? "text-red-600" : ""}`}>{balance.toFixed(1)}</span>
          <Button size="sm" variant="outline" onClick={() => handleSave(type)} disabled={saving === type}>{saving === type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}</Button>
        </div>); })}
    </div>
  );
}
