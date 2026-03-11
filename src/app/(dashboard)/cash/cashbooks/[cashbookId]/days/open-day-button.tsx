"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { openCashbookDay } from "@/lib/queries/cashbook-days";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface OpenDayButtonProps {
  cashbookId: string;
  companyId: string;
  branchId: string;
}

export function OpenDayButton({
  cashbookId,
  companyId,
  branchId,
}: OpenDayButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleOpen() {
    if (!date) {
      toast.error("Please select a date");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await openCashbookDay(
        cashbookId,
        date,
        companyId,
        branchId
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Day opened successfully");
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Open New Day
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open New Day</DialogTitle>
          <DialogDescription>
            Create a new daily record. Opening balance will be auto-calculated
            from the previous day.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleOpen} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Open Day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
