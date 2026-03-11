"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createUserSchema, type CreateUserFormValues } from "@/lib/validators/user";
import { createUser } from "@/lib/queries/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { FormCard } from "@/components/shared/form-card";
import { Separator } from "@/components/ui/separator";

interface UserFormProps {
  groupId: string;
  currentUserId: string;
  roles: { id: string; name: string; hierarchy_level: number }[];
  companies: { id: string; name: string }[];
  branches: { id: string; name: string; company_id: string }[];
}

export function UserForm({
  groupId,
  currentUserId,
  roles,
  companies,
  branches,
}: UserFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      temporary_password: "",
      role_id: "",
      company_id: "",
      branch_id: "",
    },
  });

  const selectedCompanyId = form.watch("company_id");
  const filteredBranches = selectedCompanyId
    ? branches.filter((b) => b.company_id === selectedCompanyId)
    : [];

  async function onSubmit(values: CreateUserFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createUser({
        ...values,
        group_id: groupId,
        assigned_by: currentUserId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("User created successfully");
        router.push("/admin/users");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard title="Create User" description="Add a new user and assign their role">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* User Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl><Input type="email" placeholder="john@company.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="temporary_password" render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary Password *</FormLabel>
                <FormControl><Input type="password" placeholder="Min 8 characters" {...field} /></FormControl>
                <FormDescription>User should change this on first login</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <Separator />

          {/* Role & Scope */}
          <h3 className="text-sm font-medium">Role Assignment</h3>

          <FormField control={form.control} name="role_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Role *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="company_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Company Scope</FormLabel>
                <Select
                  onValueChange={(val) => {
                    field.onChange(val === "all" ? "" : val);
                    form.setValue("branch_id", "");
                  }}
                  value={field.value || "all"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="All companies" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Companies (Group-wide)</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Leave as &quot;All&quot; for group-level access</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="branch_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Scope</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === "all" ? "" : val)}
                  value={field.value || "all"}
                  disabled={!selectedCompanyId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="All branches" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {filteredBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Select a company first to scope to a branch</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create User"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/admin/users")}>Cancel</Button>
          </div>
        </form>
      </Form>
    </FormCard>
  );
}
