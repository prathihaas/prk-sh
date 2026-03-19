"use client";

import { useState, useEffect } from "react";
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

const DENOMINATIONS = [
  { value: 500, label: "₹500" },
  { value: 200, label: "₹200" },
  { value: 100, label: "₹100" },
  { value: 50, label: "₹50" },
  { value: 20, label: "₹20" },
  { value: 10, label: "₹10" },
  { value: 5, label: "₹5" },
  { value: 2, label: "₹2" },
  { value: 1, label: "₹1" },
];

type DenomCounts = Record<number, number>;

interface CashbookDayCloseFormProps {
  dayId: string;
  systemClosing: number | null;
  currentUserId: string;
  showDenomination?: boolean;
  onSuccess?: () => void;
}

export function CashbookDayCloseForm({
  dayId,
  systemClosing,
  currentUserId,
  showDenomination = false,
  onSuccess,
}: CashbookDayCloseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [denomCounts, setDenomCounts] = useState<DenomCounts>(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [d.value, 0]))
  );

  const form = useForm<CloseDayFormValues>({
    resolver: zodResolver(closeDaySchema),
    defaultValues: { physical_count: 0 },
  });

  // When denomination mode is on, auto-sum into physical_count
  const denomTotal = showDenomination
    ? DENOMINATIONS.reduce((sum, d) => sum + d.value * (denomCounts[d.value] || 0), 0)
    : null;

  useEffect(() => {
    if (showDenomination && denomTotal !== null) {
      form.setValue("physical_count", denomTotal, { shouldValidate: true });
    }
  }, [denomTotal, showDenomination, form]);

  const physicalCount = form.watch("physical_count");
  const variance =
    physicalCount !== undefined && systemClosing !== null
      ? Number(physicalCount) - Number(systemClosing)
      : null;

  function handleDenomChange(value: number, count: string) {
    const parsed = parseInt(count, 10);
    setDenomCounts((prev) => ({
      ...prev,
      [value]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  }

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
        <div className="rounded-lg border p-4 space-y-3">
          {/* System closing */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">System Closing</span>
            <span className="font-medium tabular-nums">{formatINR(systemClosing)}</span>
          </div>

          {/* Denomination table */}
          {showDenomination && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">
                Denomination Count
              </p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-3 py-1.5 font-medium text-xs">Note / Coin</th>
                      <th className="text-center px-3 py-1.5 font-medium text-xs">Count</th>
                      <th className="text-right px-3 py-1.5 font-medium text-xs">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DENOMINATIONS.map((d) => {
                      const count = denomCounts[d.value] || 0;
                      const lineTotal = d.value * count;
                      return (
                        <tr key={d.value} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-medium">{d.label}</td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="number"
                              min="0"
                              value={count === 0 ? "" : count}
                              placeholder="0"
                              onChange={(e) => handleDenomChange(d.value, e.target.value)}
                              className="h-7 w-20 text-center mx-auto text-xs"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-xs">
                            {lineTotal > 0 ? formatINR(lineTotal) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-3 py-2 text-sm" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums">
                        {formatINR(denomTotal ?? 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Physical count — auto-filled from denom total when denomination mode on */}
          <FormField
            control={form.control}
            name="physical_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Physical Count *
                  {showDenomination && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (auto-calculated from denominations above)
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    readOnly={showDenomination}
                    className={showDenomination ? "bg-muted cursor-not-allowed" : ""}
                    {...field}
                    onChange={(e) => {
                      if (!showDenomination) field.onChange(e.target.valueAsNumber);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Variance */}
          {variance !== null && (
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Variance</span>
              <span
                className={
                  variance === 0
                    ? "text-green-600 font-medium"
                    : variance > 0
                      ? "text-blue-600 font-medium"
                      : "text-red-600 font-semibold"
                }
              >
                {formatINR(variance)}
                {variance !== 0 && (
                  <span className="ml-1 text-xs">
                    {variance > 0 ? "(surplus)" : "(short)"}
                  </span>
                )}
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
