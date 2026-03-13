"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  customFieldSchema,
  type CustomFieldFormValues,
} from "@/lib/validators/custom-field";
import { createCustomField, updateCustomField } from "@/lib/queries/custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

const ENTITY_OPTIONS = [
  { value: "cashbook", label: "Cashbook" },
  { value: "receipt", label: "Receipt" },
  { value: "payment", label: "Payment" },
  { value: "invoice", label: "Invoice" },
  { value: "expense", label: "Expense" },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean (Yes/No)" },
  { value: "dropdown", label: "Dropdown" },
];

interface CustomFieldFormProps {
  companyId: string;
  field?: Record<string, unknown>;
}

export function CustomFieldForm({ companyId, field }: CustomFieldFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!field;

  const form = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldSchema),
    defaultValues: {
      entity_type: (field?.entity_type as "cashbook" | "receipt" | "payment" | "invoice" | "expense") || "invoice",
      field_name: (field?.field_name as string) || "",
      field_label: (field?.field_label as string) || "",
      field_type: (field?.field_type as "text" | "number" | "dropdown" | "date" | "boolean") || "text",
      dropdown_options: field?.dropdown_options
        ? (field.dropdown_options as string[]).join(", ")
        : "",
      is_mandatory: (field?.is_mandatory as boolean) ?? false,
      display_order: (field?.display_order as number) ?? 0,
    },
  });

  const watchFieldType = form.watch("field_type");

  async function onSubmit(values: CustomFieldFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateCustomField(field!.id as string, values)
        : await createCustomField({
            ...values,
            company_id: companyId,
          });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditing ? "Custom field updated" : "Custom field created"
        );
        router.push("/settings/custom-fields");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title={isEditing ? "Edit Custom Field" : "New Custom Field"}
      description={
        isEditing
          ? "Update custom field definition"
          : "Define a new custom field for a record type"
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="entity_type"
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Entity Type *</FormLabel>
                  <Select
                    onValueChange={formField.onChange}
                    value={formField.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ENTITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
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
              name="field_type"
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Field Type *</FormLabel>
                  <Select
                    onValueChange={formField.onChange}
                    value={formField.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FIELD_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="field_name"
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Field Key *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. department_code" {...formField} />
                  </FormControl>
                  <FormDescription>
                    Internal key (no spaces, use underscores)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="field_label"
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Display Label *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Department Code" {...formField} />
                  </FormControl>
                  <FormDescription>
                    Label shown to users in forms
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="display_order"
            render={({ field: formField }) => (
              <FormItem className="max-w-xs">
                <FormLabel>Display Order *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    {...formField}
                    onChange={(e) =>
                      formField.onChange(e.target.valueAsNumber)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchFieldType === "dropdown" && (
            <FormField
              control={form.control}
              name="dropdown_options"
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Dropdown Options</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Option A, Option B, Option C"
                      rows={3}
                      {...formField}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated values for the dropdown options
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="is_mandatory"
            render={({ field: formField }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Mandatory</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Make this field required when creating records
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update Field"
              ) : (
                "Create Field"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/settings/custom-fields")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
