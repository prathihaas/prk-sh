"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { markAttendance } from "@/lib/queries/attendance";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Employee { id: string; employee_code: string; full_name: string; }
interface AttendanceRecord { employee_id: string; date: string; status: string; }
interface AttendanceGridProps { periodId: string; month: number; year: number; employees: Employee[]; records: AttendanceRecord[]; isEditable: boolean; }

const STATUS_CYCLE = ["present", "absent", "half_day", "leave", "holiday", "weekly_off"];

export function AttendanceGrid({ periodId, month, year, employees, records, isEditable }: AttendanceGridProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const [localRecords, setLocalRecords] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    records.forEach((r) => { map[`${r.employee_id}-${new Date(r.date).getDate()}`] = r.status; });
    return map;
  });
  const [saving, setSaving] = useState<string | null>(null);

  const handleCellClick = useCallback(async (employeeId: string, day: number) => {
    if (!isEditable) return;
    const key = `${employeeId}-${day}`;
    const current = localRecords[key] || "present";
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    setLocalRecords((prev) => ({ ...prev, [key]: next }));
    setSaving(key);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    try {
      const result = await markAttendance({ period_id: periodId, employee_id: employeeId, date: dateStr, status: next });
      if (result.error) { toast.error(result.error); setLocalRecords((prev) => ({ ...prev, [key]: current })); }
    } catch { toast.error("Failed to save"); setLocalRecords((prev) => ({ ...prev, [key]: current })); }
    finally { setSaving(null); }
  }, [isEditable, localRecords, month, periodId, year]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Attendance Grid</CardTitle>
        {isEditable && <p className="text-xs text-muted-foreground">Click cell to cycle: P → A → HD → L → H → WO</p>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><th className="sticky left-0 bg-background z-10 text-left p-2 min-w-[150px]">Employee</th>
              {dates.map((d) => (<th key={d} className="p-1 text-center min-w-[36px]">{d}</th>))}
            </tr></thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t">
                  <td className="sticky left-0 bg-background z-10 p-2 font-medium">
                    <span className="text-muted-foreground mr-1">{emp.employee_code}</span>{emp.full_name}
                  </td>
                  {dates.map((d) => {
                    const key = `${emp.id}-${d}`;
                    const status = localRecords[key];
                    return (
                      <td key={d} className={`p-0.5 text-center ${isEditable ? "cursor-pointer hover:bg-muted" : ""} ${saving === key ? "opacity-50" : ""}`}
                        onClick={() => handleCellClick(emp.id, d)}>
                        {status ? <StatusBadge status={status} className="text-[10px] px-1 py-0" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
