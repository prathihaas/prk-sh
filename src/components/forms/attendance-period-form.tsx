"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { attendancePeriodSchema, type AttendancePeriodFormValues } from "@/lib/validators/attendance";
import { createAttendancePeriod } from "@/lib/queries/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface AttendancePeriodFormProps { companyId: string; branchId: string; }

export function AttendancePeriodForm({ companyId, branchId }: AttendancePeriodFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const now = new Date();
  const form = useForm<AttendancePeriodFormValues>({
    resolver: zodResolver(attendancePeriodSchema),
    defaultValues: { month: now.getMonth() + 1, year: now.getFullYear() },
  });

  async function onSubmit(values: AttendancePeriodFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createAttendancePeriod({ ...values, company_id: companyId, branch_id: branchId });
      if (result.error) toast.error(result.error);
      else { toast.success("Period created"); router.push("/hr/attendance"); }
    } catch { toast.error("An unexpected error occurred"); }
    finally { setIsSubmitting(false); }
  }

  return (
    <FormCard title="New Attendance Period" description="Create a monthly attendance period">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="month" render={({ field }) => (
              <FormItem><FormLabel>Month *</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{MONTHS.map((m, i) => (<SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>))}</SelectContent>
                </Select><FormMessage />
              </FormItem>)} />
            <FormField control={form.control} name="year" render={({ field }) => (
              <FormItem><FormLabel>Year *</FormLabel><FormControl><Input type="number" min="2020" max="2099" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>)} />
          </div>
          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Period"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/hr/attendance")}>Cancel</Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
