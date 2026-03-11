"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { branchSchema, type BranchFormValues } from "@/lib/validators/branch";
import { createBranch, updateBranch } from "@/lib/queries/branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { Separator } from "@/components/ui/separator";

interface BranchFormProps {
  companyId: string;
  branch?: {
    id: string;
    name: string;
    code: string;
    address: Record<string, string> | null;
    is_active: boolean;
  };
}

export function BranchForm({ companyId, branch }: BranchFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!branch;

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name || "",
      code: branch?.code || "",
      address_line1: branch?.address?.line1 || "",
      address_line2: branch?.address?.line2 || "",
      city: branch?.address?.city || "",
      state: branch?.address?.state || "",
      pincode: branch?.address?.pincode || "",
      is_active: branch?.is_active ?? true,
    },
  });

  async function onSubmit(values: BranchFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateBranch(branch!.id, values)
        : await createBranch({ ...values, company_id: companyId });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditing ? "Branch updated successfully" : "Branch created successfully"
        );
        router.push("/org/branches");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title={isEditing ? "Edit Branch" : "Create Branch"}
      description={isEditing ? "Update the branch details" : "Add a new branch to the selected company"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Name *</FormLabel>
                <FormControl><Input placeholder="Main Branch" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="code" render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Code *</FormLabel>
                <FormControl><Input placeholder="MAIN-01" {...field} /></FormControl>
                <FormDescription>Unique within the company</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Address</h3>
            <FormField control={form.control} name="address_line1" render={({ field }) => (
              <FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="address_line2" render={({ field }) => (
              <FormItem><FormLabel>Address Line 2</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="pincode" render={({ field }) => (
                <FormItem><FormLabel>Pincode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </div>

          <Separator />

          <FormField control={form.control} name="is_active" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>Inactive branches are hidden from operations</FormDescription>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Updating..." : "Creating..."}</> : isEditing ? "Update Branch" : "Create Branch"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/org/branches")}>Cancel</Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
