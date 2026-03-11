"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  closeDaySchema,
  type CloseDayFormValues,
} from "@/lib/validators/cashbook-day";
import { closeCashbookDay } from "@/lib/queries/cashbook-days";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { formatINR } from "@/components/shared/currency-display";

interface CashbookDayCloseFormProps {
  dayId: string;
  systemClosing: number | null;
  currentUserId: string;
  onSuccess?: () => void;
}

export function CashbookDayCloseForm({
  dayId,
  systemClosing,
  currentUserId,
  onSuccess,
}: CashbookDayCloseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CloseDayFormValues>({
    resolver: zodResolver(closeDaySchema),
    defaultValues: { physical_count: 0 },
  });

  const physicalCount = form.watch("physical_count");
  const variance =
    physicalCount !== undefined && systemClosing !== null
      ? Number(physicalCount) - Number(systemClosing)
      : null;

  async function onSubmit(values: CloseDayFormValues) {
    setIsSubmitting(true);
    try {
      const result = await closeCashbookDay(
        dayId,
        values.physical_count,
        currentUserId
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Day closed successfully");
        onSuccess?.();
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">System Closing</span>
            <span className="font-medium">{formatINR(systemClosing)}</span>
          </div>
          <FormField
            control={form.control}
            name="physical_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Physical Count *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {variance !== null && (
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Variance</span>
              <span
                className={
                  variance === 0
                    ? "text-green-600"
                    : variance > 0
                      ? "text-blue-600"
                      : "text-red-600 font-semibold"
                }
              >
                {formatINR(variance)}
              </span>
            </div>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Closing...
            </>
          ) : (
            "Close Day"
          )}
        </Button>
      </form>
    </Form>
  );
}
