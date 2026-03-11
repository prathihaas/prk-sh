"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  cashbookSchema,
  type CashbookFormValues,
} from "@/lib/validators/cashbook";
import { createCashbook, updateCashbook } from "@/lib/queries/cashbooks";
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
  FormDescription,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

interface CashbookFormProps {
  companyId: string;
  branchId: string;
  currentUserId: string;
  cashbook?: {
    id: string;
    name: string;
    type: string;
    opening_balance: number;
    is_active: boolean;
  };
}

export function CashbookForm({
  companyId,
  branchId,
  currentUserId,
  cashbook,
}: CashbookFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!cashbook;

  const form = useForm<CashbookFormValues>({
    resolver: zodResolver(cashbookSchema),
    defaultValues: {
      name: cashbook?.name || "",
      type: (cashbook?.type as "main" | "petty" | "bank") || "main",
      opening_balance: cashbook?.opening_balance ?? 0,
      is_active: cashbook?.is_active ?? true,
    },
  });

  async function onSubmit(values: CashbookFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateCashbook(cashbook!.id, values)
        : await createCashbook({
            ...values,
            company_id: companyId,
            branch_id: branchId,
            created_by: currentUserId,
          });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditing ? "Cashbook updated" : "Cashbook created");
        router.push("/cash/cashbooks");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title={isEditing ? "Edit Cashbook" : "Create Cashbook"}
      description={
        isEditing
          ? `Editing ${cashbook!.name}`
          : "Add a new cashbook for this branch"
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Main Cash" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="main">Main Cash</SelectItem>
                      <SelectItem value="petty">Petty Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
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
              name="opening_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening Balance *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                  </FormControl>
                  <FormDescription>Starting balance in rupees</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditing && (
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Deactivating hides this cashbook from daily operations
                      </FormDescription>
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
            )}
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Cashbook"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/cash/cashbooks")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
