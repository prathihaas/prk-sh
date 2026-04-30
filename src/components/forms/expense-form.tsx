"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { expenseSchema, type ExpenseFormValues } from "@/lib/validators/expense";
import { createExpense, updateExpense, submitExpense } from "@/lib/queries/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

interface ExpenseFormProps {
  companyId: string;
  branchId: string;
  currentUserId: string;
  financialYearId: string;
  categories: { id: string; name: string }[];
  expense?: Record<string, unknown>;
}

export function ExpenseForm({
  companyId,
  branchId,
  currentUserId,
  financialYearId,
  categories,
  expense,
}: ExpenseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!expense;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category_id: (expense?.category_id as string) || "",
      expense_date: (expense?.expense_date as string) || new Date().toISOString().split("T")[0],
      amount: (expense?.amount as number) ?? 0,
      description: (expense?.description as string) || "",
      bill_reference: (expense?.bill_reference as string) || "",
      notes: (expense?.notes as string) || "",
    },
  });

  // Track which button the user clicked, so the form's submit handler knows
  // whether to also submit-for-approval after the create/update.
  const [submitMode, setSubmitMode] = useState<"approve" | "draft">("approve");

  async function onSubmit(values: ExpenseFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateExpense(expense!.id as string, values)
        : await createExpense({
            ...values,
            company_id: companyId,
            branch_id: branchId,
            submitted_by: currentUserId,
            financial_year_id: financialYearId,
          });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // If "Submit for Approval" was clicked, immediately submit.
      if (submitMode === "approve") {
        const targetId: string | null = isEditing
          ? ((expense!.id as string) || null)
          : ("id" in result && typeof result.id === "string" ? result.id : null);
        if (targetId) {
          const submitResult = await submitExpense(targetId);
          if (submitResult.error) {
            toast.error(submitResult.error);
            return;
          }
          toast.success("Expense submitted for approval");
        } else {
          toast.success("Expense saved");
        }
      } else {
        toast.success(isEditing ? "Expense saved" : "Saved as draft");
      }

      router.push("/expenses");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title={isEditing ? "Edit Expense" : "New Expense"}
      description={isEditing ? "Update expense details" : "Record a new expense"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="category_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="expense_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="bill_reference" render={({ field }) => (
              <FormItem>
                <FormLabel>Bill Reference</FormLabel>
                <FormControl><Input placeholder="Bill/Receipt number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl><Textarea rows={3} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl><Textarea rows={2} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="ghost" onClick={() => router.push("/expenses")}>
              Cancel
            </Button>
            <div className="flex-1" />
            <Button
              type="submit"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setSubmitMode("draft")}
            >
              {isSubmitting && submitMode === "draft" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                "Save as Draft"
              )}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              onClick={() => setSubmitMode("approve")}
            >
              {isSubmitting && submitMode === "approve" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
              ) : (
                "Submit for Approval"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
