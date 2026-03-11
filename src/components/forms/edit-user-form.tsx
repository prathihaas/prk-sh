"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, ShieldX } from "lucide-react";
import {
  editUserSchema,
  userAssignmentSchema,
  type EditUserFormValues,
  type UserAssignmentFormValues,
} from "@/lib/validators/user";
import { updateUser, addUserAssignment, revokeUserAssignment } from "@/lib/queries/users";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EditUserFormProps {
  userId: string;
  profile: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
  };
  assignments: {
    id: string;
    role_id: string;
    group_id: string;
    company_id: string | null;
    branch_id: string | null;
    is_active: boolean;
    role: { id: string; name: string; hierarchy_level: number };
  }[];
  groupId: string;
  currentUserId: string;
  roles: { id: string; name: string; hierarchy_level: number }[];
  companies: { id: string; name: string }[];
  branches: { id: string; name: string; company_id: string }[];
}

function formatRoleName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EditUserForm({
  userId,
  profile,
  assignments,
  groupId,
  currentUserId,
  roles,
  companies,
  branches,
}: EditUserFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Profile form
  const profileForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      full_name: profile.full_name,
      phone: profile.phone || "",
      is_active: profile.is_active,
    },
  });

  // Assignment form
  const assignmentForm = useForm<UserAssignmentFormValues>({
    resolver: zodResolver(userAssignmentSchema),
    defaultValues: {
      role_id: "",
      company_id: "",
      branch_id: "",
    },
  });

  const selectedCompanyId = assignmentForm.watch("company_id");
  const filteredBranches = selectedCompanyId
    ? branches.filter((b) => b.company_id === selectedCompanyId)
    : [];

  async function onProfileSubmit(values: EditUserFormValues) {
    setIsSubmitting(true);
    try {
      const result = await updateUser(userId, values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("User profile updated");
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onAddAssignment(values: UserAssignmentFormValues) {
    setIsAddingAssignment(true);
    try {
      const result = await addUserAssignment(
        userId,
        groupId,
        values.role_id,
        values.company_id || null,
        values.branch_id || null,
        currentUserId
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Role assignment added");
        assignmentForm.reset();
        setShowAddAssignment(false);
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsAddingAssignment(false);
    }
  }

  async function onRevokeAssignment(assignmentId: string) {
    setRevokingId(assignmentId);
    try {
      const result = await revokeUserAssignment(assignmentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Assignment revoked");
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setRevokingId(null);
    }
  }

  function getScopeName(companyId: string | null, branchId: string | null) {
    if (!companyId) return "All Companies (Group-wide)";
    const company = companies.find((c) => c.id === companyId);
    const companyName = company?.name || "Unknown Company";
    if (!branchId) return `${companyName} — All Branches`;
    const branch = branches.find((b) => b.id === branchId);
    return `${companyName} / ${branch?.name || "Unknown Branch"}`;
  }

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <FormCard title="User Profile" description="Update basic user information">
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={profileForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input value={profile.email} disabled />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Deactivating prevents the user from logging in
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/users")}
              >
                Back to Users
              </Button>
            </div>
          </form>
        </Form>
      </FormCard>

      {/* Assignments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Role Assignments</CardTitle>
              <CardDescription>Manage roles and scope access for this user</CardDescription>
            </div>
            {!showAddAssignment && (
              <Button size="sm" onClick={() => setShowAddAssignment(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Assignment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Assignments */}
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active assignments.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {formatRoleName(assignment.role.name)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Level {assignment.role.hierarchy_level}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getScopeName(assignment.company_id, assignment.branch_id)}
                    </p>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={revokingId === assignment.id}
                      >
                        {revokingId === assignment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldX className="h-4 w-4" />
                        )}
                      </Button>
                    }
                    title="Revoke Assignment"
                    description={`This will revoke the ${formatRoleName(assignment.role.name)} role from this user. They will lose access to the associated resources.`}
                    onConfirm={() => onRevokeAssignment(assignment.id)}
                    variant="destructive"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add Assignment Form */}
          {showAddAssignment && (
            <>
              <Separator />
              <Form {...assignmentForm}>
                <form
                  onSubmit={assignmentForm.handleSubmit(onAddAssignment)}
                  className="space-y-4"
                >
                  <h4 className="text-sm font-medium">New Assignment</h4>
                  <FormField
                    control={assignmentForm.control}
                    name="role_id"
                    render={({ field }) => (
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
                                {formatRoleName(role.name)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={assignmentForm.control}
                      name="company_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Scope</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val === "all" ? "" : val);
                              assignmentForm.setValue("branch_id", "");
                            }}
                            value={field.value || "all"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All companies" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">
                                All Companies (Group-wide)
                              </SelectItem>
                              {companies.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assignmentForm.control}
                      name="branch_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch Scope</FormLabel>
                          <Select
                            onValueChange={(val) =>
                              field.onChange(val === "all" ? "" : val)
                            }
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
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button type="submit" size="sm" disabled={isAddingAssignment}>
                      {isAddingAssignment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Assignment"
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAddAssignment(false);
                        assignmentForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
