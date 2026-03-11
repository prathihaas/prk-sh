"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { employeeSchema, type EmployeeFormValues } from "@/lib/validators/employee";
import { createEmployee, updateEmployee } from "@/lib/queries/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface EmployeeFormProps { companyId: string; branchId: string; employee?: Record<string, unknown>; }

export function EmployeeForm({ companyId, branchId, employee }: EmployeeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!employee;

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employee_code: (employee?.employee_code as string) || "",
      full_name: (employee?.full_name as string) || "",
      designation: (employee?.designation as string) || "",
      department: (employee?.department as string) || "",
      ctc_annual: (employee?.ctc_annual as number) ?? 0,
      basic_salary: (employee?.basic_salary as number) ?? 0,
      hra: (employee?.hra as number) ?? 0,
      allowances: (employee?.allowances as number) ?? 0,
      pf_applicable: (employee?.pf_applicable as boolean) ?? true,
      esi_applicable: (employee?.esi_applicable as boolean) ?? false,
      pt_applicable: (employee?.pt_applicable as boolean) ?? true,
      bank_name: (employee?.bank_name as string) || "",
      bank_account_number: (employee?.bank_account_number as string) || "",
      bank_ifsc: (employee?.bank_ifsc as string) || "",
      joining_date: (employee?.joining_date as string) || "",
      exit_date: (employee?.exit_date as string) || "",
      status: (employee?.status as "active" | "inactive" | "terminated" | "on_notice") || "active",
    },
  });

  async function onSubmit(values: EmployeeFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateEmployee(employee!.id as string, values)
        : await createEmployee({ ...values, company_id: companyId, branch_id: branchId });
      if (result.error) toast.error(result.error);
      else { toast.success(isEditing ? "Employee updated" : "Employee created"); router.push("/hr/employees"); }
    } catch { toast.error("An unexpected error occurred"); }
    finally { setIsSubmitting(false); }
  }

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Employee" : "Add Employee"}</CardTitle>
        <CardDescription>{isEditing ? `Editing ${employee!.full_name}` : "Add a new employee record"}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div><h3 className="text-lg font-medium mb-4">Personal Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="employee_code" render={({ field }) => (<FormItem><FormLabel>Employee Code *</FormLabel><FormControl><Input placeholder="EMP-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="full_name" render={({ field }) => (<FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="designation" render={({ field }) => (<FormItem><FormLabel>Designation</FormLabel><FormControl><Input placeholder="Sales Manager" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><FormControl><Input placeholder="Sales" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </div>
            <Separator />
            <div><h3 className="text-lg font-medium mb-4">Compensation</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="ctc_annual" render={({ field }) => (<FormItem><FormLabel>Annual CTC *</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="basic_salary" render={({ field }) => (<FormItem><FormLabel>Basic Salary (Monthly) *</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="hra" render={({ field }) => (<FormItem><FormLabel>HRA (Monthly)</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="allowances" render={({ field }) => (<FormItem><FormLabel>Other Allowances (Monthly)</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </div>
            <Separator />
            <div><h3 className="text-lg font-medium mb-4">Statutory</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="pf_applicable" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div><FormLabel className="text-base">PF</FormLabel><FormDescription>Provident Fund</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="esi_applicable" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div><FormLabel className="text-base">ESI</FormLabel><FormDescription>Employee State Insurance</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="pt_applicable" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div><FormLabel className="text-base">PT</FormLabel><FormDescription>Professional Tax</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              </div>
            </div>
            <Separator />
            <div><h3 className="text-lg font-medium mb-4">Bank Details</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="bank_name" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="bank_account_number" render={({ field }) => (<FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="bank_ifsc" render={({ field }) => (<FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </div>
            <Separator />
            <div><h3 className="text-lg font-medium mb-4">Employment</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="joining_date" render={({ field }) => (<FormItem><FormLabel>Joining Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="exit_date" render={({ field }) => (<FormItem><FormLabel>Exit Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                {isEditing && <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="on_notice">On Notice</SelectItem><SelectItem value="terminated">Terminated</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />}
              </div>
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Saving..." : "Creating..."}</>) : isEditing ? "Save Changes" : "Add Employee"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/hr/employees")}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
