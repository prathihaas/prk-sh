"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  voidTransactionSchema,
  type VoidTransactionFormValues,
} from "@/lib/validators/cashbook-transaction";
import { voidTransaction } from "@/lib/queries/cashbook-transactions";
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

interface VoidTransactionFormProps {
  transactionId: string;
  currentUserId: string;
  onSuccess?: () => void;
}

export function VoidTransactionForm({
  transactionId,
  currentUserId,
  onSuccess,
}: VoidTransactionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VoidTransactionFormValues>({
    resolver: zodResolver(voidTransactionSchema),
    defaultValues: { void_reason: "" },
  });

  async function onSubmit(values: VoidTransactionFormValues) {
    setIsSubmitting(true);
    try {
      const result = await voidTransaction(
        transactionId,
        values.void_reason,
        currentUserId
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Transaction voided");
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
          name="void_reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Void Reason *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain why this transaction is being voided..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>Minimum 10 characters. This action cannot be undone.</FormDescription>
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
              Voiding...
            </>
          ) : (
            "Void Transaction"
          )}
        </Button>
      </form>
    </Form>
  );
}
