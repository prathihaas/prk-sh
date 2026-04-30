"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { submitExpense } from "@/lib/queries/expenses";
import { Button } from "@/components/ui/button";

export function SubmitDraftButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const result = await submitExpense(expenseId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Submitted for approval");
      router.refresh();
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" className="w-full gap-2" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      Submit for Approval
    </Button>
  );
}
