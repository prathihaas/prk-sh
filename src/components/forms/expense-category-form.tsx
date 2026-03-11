"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { expenseCategorySchema, type ExpenseCategoryFormValues } from "@/lib/validators/expense-category";
import { createExpenseCategory, updateExpenseCategory } from "@/lib/queries/expense-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

interface ExpenseCategoryFormProps {
  companyId: string;
  category?: {
    id: string;
    name: string;
    budget_limit: number | null;
    is_active: boolean;
  };
}

export function ExpenseCategoryForm({ companyId, category }: ExpenseCategoryFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!category;

  const form = useForm<ExpenseCategoryFormValues>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: {
      name: category?.name || "",
      budget_limit: category?.budget_limit ?? undefined,
      is_active: category?.is_active ?? true,
    },
  });

  async function onSubmit(values: ExpenseCategoryFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateExpenseCategory(category!.id, values)
        : await createExpenseCategory({ ...values, company_id: companyId });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditing ? "Category updated" : "Category created");
        router.push("/expenses/categories");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title={isEditing ? "Edit Category" : "Create Category"}
      description={isEditing ? `Editing ${category!.name}` : "Add a new expense category"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl><Input placeholder="Office Supplies" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="budget_limit" render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly Budget Limit</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Leave empty for no limit"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val === "" ? undefined : e.target.valueAsNumber);
                  }}
                />
              </FormControl>
              <FormDescription>Optional monthly spending limit for this category</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          {isEditing && (
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active</FormLabel>
                  <FormDescription>Deactivating hides this category from new expenses</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />
          )}
          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Saving..." : "Creating..."}</>
              ) : isEditing ? "Save Changes" : "Create Category"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/expenses/categories")}>Cancel</Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
