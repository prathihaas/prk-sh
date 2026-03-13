"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createAsset, updateAsset } from "@/lib/queries/assets";
import { assetSchema } from "@/lib/validators/asset";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";

type AssetFormValues = z.infer<typeof assetSchema>;

interface AssetFormProps {
  companyId: string;
  userId: string;
  categories: { id: string; name: string }[];
  branches: { id: string; name: string; code: string }[];
  asset?: Record<string, unknown>;
}

export function AssetForm({ companyId, userId, categories, branches, asset }: AssetFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!asset;

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      asset_code: (asset?.asset_code as string) || "",
      name: (asset?.name as string) || "",
      description: (asset?.description as string) || "",
      category_id: (asset?.category_id as string) || "",
      branch_id: (asset?.branch_id as string) || "",
      is_vehicle: (asset?.is_vehicle as boolean) ?? false,
      purchase_date: (asset?.purchase_date as string) || "",
      purchase_value: (asset?.purchase_value as number) || undefined,
      useful_life_years: (asset?.useful_life_years as number) || undefined,
      salvage_value: (asset?.salvage_value as number) || 0,
    },
  });

  const isVehicle = form.watch("is_vehicle");

  async function onSubmit(values: AssetFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateAsset(asset!.id as string, values)
        : await createAsset({ ...values, company_id: companyId, created_by: userId });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditing ? "Asset updated" : "Asset created");
        if (!isEditing && "id" in result && result.id) {
          router.push(`/assets/${result.id}`);
        } else {
          router.push("/assets");
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard
      title={isEditing ? "Edit Asset" : "New Asset"}
      description={isEditing ? "Update asset details" : "Register a new company asset"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="asset_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Code *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. AST-0001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Mahindra Tractor 575" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">— None —</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="branch_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">— Company Level —</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Additional details..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="purchase_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchase_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Value (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="salvage_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salvage Value (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormDescription>Value at end of useful life</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="useful_life_years"
            render={({ field }) => (
              <FormItem className="max-w-xs">
                <FormLabel>Useful Life (Years)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    placeholder="e.g. 10"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                  />
                </FormControl>
                <FormDescription>Used for depreciation calculations</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_vehicle"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Is this a Vehicle?</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Enables km reading tracking for this asset
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          {isVehicle && (
            <p className="text-sm text-blue-600 bg-blue-50 rounded px-3 py-2">
              Km readings can be logged from the asset detail page after creation.
            </p>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : isEditing ? "Update Asset" : "Create Asset"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/assets")}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
