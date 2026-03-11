"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { invoicePaymentSchema, type InvoicePaymentFormValues } from "@/lib/validators/invoice";
import { createInvoicePayment } from "@/lib/queries/invoice-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";
import { formatINR } from "@/components/shared/currency-display";

interface InvoicePaymentFormProps {
  invoiceId: string;
  currentUserId: string;
  balanceDue: number;
}

export function InvoicePaymentForm({ invoiceId, currentUserId, balanceDue }: InvoicePaymentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InvoicePaymentFormValues>({
    resolver: zodResolver(invoicePaymentSchema),
    defaultValues: {
      payment_mode: "cash",
      amount: 0,
      reference_number: "",
      payment_date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  async function onSubmit(values: InvoicePaymentFormValues) {
    if (values.amount > balanceDue) {
      toast.error(`Payment cannot exceed balance due of ${formatINR(balanceDue)}`);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createInvoicePayment({
        ...values,
        invoice_id: invoiceId,
        created_by: currentUserId,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Payment recorded");
        router.back();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard title="Record Payment" description={`Balance due: ${formatINR(balanceDue)}`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="payment_mode" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormDescription>Max: {formatINR(balanceDue)}</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="payment_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="reference_number" render={({ field }) => (
              <FormItem>
                <FormLabel>Reference #</FormLabel>
                <FormControl><Input placeholder="Cheque/UTR number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl><Textarea rows={2} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</> : "Record Payment"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
