"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeAttendancePeriod, approveAttendancePeriod } from "@/lib/queries/attendance";

interface PeriodActionsProps { periodId: string; status: string; canClose: boolean; }

export function PeriodActions({ periodId, status, canClose }: PeriodActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleAction(action: () => Promise<{ error?: string; success?: boolean }>, msg: string) {
    setIsLoading(true);
    try { const r = await action(); if (r.error) toast.error(r.error); else { toast.success(msg); router.refresh(); } }
    catch { toast.error("Failed"); } finally { setIsLoading(false); }
  }

  return (
    <div className="flex gap-3">
      {status === "open" && canClose && <Button onClick={() => handleAction(() => closeAttendancePeriod(periodId), "Period closed")} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Close Period</Button>}
      {status === "closed" && canClose && <Button onClick={() => handleAction(() => approveAttendancePeriod(periodId), "Period approved")} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Approve Period</Button>}
      <Button variant="outline" onClick={() => router.push("/hr/attendance")}>Back</Button>
    </div>
  );
}
