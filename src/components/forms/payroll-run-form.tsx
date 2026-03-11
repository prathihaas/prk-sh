"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  payrollRunSchema,
  type PayrollRunFormValues,
} from "@/lib/validators/payroll";
import { createPayrollRun } from "@/lib/queries/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface PayrollRunFormProps {
  companyId: string;
  branchId: string;
  currentUserId: string;
}

export function PayrollRunForm({
  companyId,
  branchId,
  currentUserId,
}: PayrollRunFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const now = new Date();
  const form = useForm<PayrollRunFormValues>({
    resolver: zodResolver(payrollRunSchema),
    defaultValues: { month: now.getMonth() + 1, year: now.getFullYear() },
  });

  async function onSubmit(values: PayrollRunFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createPayrollRun({
        ...values,
        company_id: companyId,
        branch_id: branchId,
        created_by: currentUserId,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Payroll run created");
        router.push("/hr/payroll");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard title="New Payroll Run" description="Create a monthly payroll run">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Month *</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseInt(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="2020"
                      max="2099"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Run"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/hr/payroll")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
