"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { financialYearSchema, type FinancialYearFormValues } from "@/lib/validators/financial-year";
import { createFinancialYear } from "@/lib/queries/financial-years";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

interface FinancialYearFormProps {
  companyId: string;
}

export function FinancialYearForm({ companyId }: FinancialYearFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FinancialYearFormValues>({
    resolver: zodResolver(financialYearSchema),
    defaultValues: { label: "", start_date: "", end_date: "" },
  });

  async function onSubmit(values: FinancialYearFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createFinancialYear({ ...values, company_id: companyId });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Financial year created successfully");
        router.push("/org/financial-years");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard title="Create Financial Year" description="Define a new financial year for the selected company">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="label" render={({ field }) => (
            <FormItem>
              <FormLabel>Label *</FormLabel>
              <FormControl><Input placeholder="2025-26" {...field} /></FormControl>
              <FormDescription>E.g., &quot;2025-26&quot; for April 2025 to March 2026</FormDescription>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="start_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="end_date" render={({ field }) => (
              <FormItem>
                <FormLabel>End Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Financial Year"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/org/financial-years")}>Cancel</Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
