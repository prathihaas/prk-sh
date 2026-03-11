"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  approvalMatrixSchema,
  type ApprovalMatrixFormValues,
} from "@/lib/validators/approval-matrix";
import {
  createApprovalMatrixEntry,
  updateApprovalMatrixEntry,
} from "@/lib/queries/approval-matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

const REQUEST_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "invoice", label: "Invoice" },
  { value: "cashbook_variance", label: "Cashbook Variance" },
];

interface ApprovalMatrixFormProps {
  companyId: string;
  roles: { id: string; name: string }[];
  entry?: Record<string, unknown>;
}

export function ApprovalMatrixForm({
  companyId,
  roles,
  entry,
}: ApprovalMatrixFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!entry;

  const form = useForm<ApprovalMatrixFormValues>({
    resolver: zodResolver(approvalMatrixSchema),
    defaultValues: {
      request_type: (entry?.request_type as string) || "",
      step_order: (entry?.step_order as number) ?? 1,
      approver_role_id: (entry?.approver_role_id as string) || "",
      is_active: (entry?.is_active as boolean) ?? true,
    },
  });

  async function onSubmit(values: ApprovalMatrixFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateApprovalMatrixEntry(entry!.id as string, values)
        : await createApprovalMatrixEntry({
            ...values,
            company_id: companyId,
          });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditing ? "Approval step updated" : "Approval step created"
        );
        router.push("/settings/approval-matrix");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title={isEditing ? "Edit Approval Step" : "New Approval Step"}
      description={
        isEditing
          ? "Update approval matrix configuration"
          : "Add a new step to the approval workflow"
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="request_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select request type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REQUEST_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name="step_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Step Order *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="approver_role_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Approver Role *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
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
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable this approval step
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
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
                "Update Step"
              ) : (
                "Create Step"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/settings/approval-matrix")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
