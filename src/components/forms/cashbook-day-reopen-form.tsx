"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  reopenDaySchema,
  type ReopenDayFormValues,
} from "@/lib/validators/cashbook-day";
import { reopenCashbookDay } from "@/lib/queries/cashbook-days";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface CashbookDayReopenFormProps {
  dayId: string;
  currentUserId: string;
  onSuccess?: () => void;
}

export function CashbookDayReopenForm({
  dayId,
  currentUserId,
  onSuccess,
}: CashbookDayReopenFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReopenDayFormValues>({
    resolver: zodResolver(reopenDaySchema),
    defaultValues: { reopen_reason: "" },
  });

  async function onSubmit(values: ReopenDayFormValues) {
    setIsSubmitting(true);
    try {
      const result = await reopenCashbookDay(
        dayId,
        values.reopen_reason,
        currentUserId
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Day reopened successfully");
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
        <FormField
          control={form.control}
          name="reopen_reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reopen Reason *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain why this day needs to be reopened..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>Minimum 10 characters</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          variant="destructive"
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reopening...
            </>
          ) : (
            "Reopen Day"
          )}
        </Button>
      </form>
    </Form>
  );
}
