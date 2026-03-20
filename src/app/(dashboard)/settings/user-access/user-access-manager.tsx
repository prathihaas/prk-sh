"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Save, UserCog, CheckSquare, Square, Wallet, RefreshCw,
  ChevronDown, Building2, GitBranch, ShieldCheck, MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Special permissions that can be granted per-user beyond their role
const GRANTABLE_PERMISSIONS = [
  {
    group: "Receipts",
    permissions: [
      { key: "receipt:backdate", label: "Backdate Receipts", description: "Allow entering receipts with past dates", risk: "medium" },
      { key: "receipt:delete", label: "Void/Delete Receipts", description: "Allow voiding existing receipts", risk: "high" },
    ],
  },
  {
    group: "Expenses",
    permissions: [
      { key: "expense:pay_direct", label: "Direct Payment (Bypass Approval)", description: "Allow paying expenses without completing approval workflow", risk: "high" },
    ],
  },
  {
    group: "Cashbook",
    permissions: [
      { key: "cashbook:reopen_day", label: "Reopen Closed Days", description: "Allow reopening a closed cashbook day for corrections", risk: "medium" },
      { key: "cashbook:void_transaction", label: "Void Transactions", description: "Allow voiding cashbook transactions", risk: "medium" },
    ],
  },
];

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  minHierarchy: number;
  currentRoleId: string | null;
  companyAccess: Record<string, (string | null)[]>;
}

interface Company { id: string; name: string; code: string }
interface Branch { id: string; name: string; code: string; company_id: string }
interface Role { id: string; name: string; hierarchy_level: number }
interface Cashbook { id: string; name: string; type: string; branch_id: string | null; company_id: string }

interface UserAccessManagerProps {
  groupId: string;
  users: UserProfile[];
  cashierUsers: UserProfile[];
  companies: Company[];
  branches: Branch[];
  roles: Role[];
  cashbooks: Cashbook[];
  initialOverrides: Record<string, string[]>;
  initialCashierAssignments: Record<string, string>;
  initialTelegramChatIds: Record<string, string | null>;
  primaryCompanyId: string | null;
}

export function UserAccessManager({
  users,
  cashierUsers,
  companies,
  branches,
  roles,
  cashbooks,
  initialOverrides,
  initialCashierAssignments,
  initialTelegramChatIds,
  primaryCompanyId,
}: UserAccessManagerProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(users[0]?.id || null);

  // Section 1: Company+Branch assignment
  const [accessState, setAccessState] = useState<Record<string, Record<string, (string | null)[]>>>(
    Object.fromEntries(users.map((u) => [u.id, { ...u.companyAccess }]))
  );
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.currentRoleId || ""]))
  );
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  // Section 2: Cashier cashbook assignment
  const [cashierAssignments, setCashierAssignments] = useState<Record<string, string>>(initialCashierAssignments);
  const [isSavingCashbooks, setIsSavingCashbooks] = useState(false);

  // Section 3: Special permissions
  const [overrides, setOverrides] = useState<Record<string, string[]>>(initialOverrides);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Section 4: Telegram Chat IDs
  const [telegramChatIds, setTelegramChatIds] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initialTelegramChatIds).map(([uid, cid]) => [uid, cid ?? ""])
    )
  );
  const [savingTelegramFor, setSavingTelegramFor] = useState<string | null>(null);

  // ─── Access helpers ───────────────────────────────────────────────────

  function getUserAccess(userId: string): Record<string, (string | null)[]> {
    return accessState[userId] || {};
  }

  function isCompanyEnabled(userId: string, companyId: string): boolean {
    return companyId in getUserAccess(userId);
  }

  function isAllBranches(userId: string, companyId: string): boolean {
    return (getUserAccess(userId)[companyId] || []).includes(null);
  }

  function isBranchEnabled(userId: string, companyId: string, branchId: string): boolean {
    const list = getUserAccess(userId)[companyId] || [];
    return list.includes(null) || list.includes(branchId);
  }

  function toggleCompany(userId: string, companyId: string) {
    setAccessState((prev) => {
      const ua = { ...(prev[userId] || {}) };
      if (companyId in ua) {
        delete ua[companyId];
      } else {
        ua[companyId] = [null]; // default all branches
      }
      return { ...prev, [userId]: ua };
    });
  }

  function toggleAllBranches(userId: string, companyId: string) {
    setAccessState((prev) => {
      const ua = { ...(prev[userId] || {}) };
      const current = ua[companyId] || [];
      ua[companyId] = current.includes(null) ? [] : [null];
      return { ...prev, [userId]: ua };
    });
  }

  function toggleBranch(userId: string, companyId: string, branchId: string) {
    setAccessState((prev) => {
      const ua = { ...(prev[userId] || {}) };
      const current = (ua[companyId] || []).filter((b) => b !== null) as string[];
      const idx = current.indexOf(branchId);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(branchId);
      ua[companyId] = current;
      return { ...prev, [userId]: ua };
    });
  }

  function getBranchesForCompany(companyId: string): Branch[] {
    return branches.filter((b) => b.company_id === companyId);
  }

  function getUserPerms(userId: string): string[] {
    return overrides[userId] || [];
  }

  function togglePermission(userId: string, permission: string) {
    setOverrides((prev) => {
      const current = prev[userId] || [];
      const updated = current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission];
      return { ...prev, [userId]: updated };
    });
  }

  // ─── Save handlers ────────────────────────────────────────────────────

  async function saveAccess() {
    if (!selectedUser) return;
    setIsSavingAccess(true);
    try {
      const userAccess = getUserAccess(selectedUser);
      const companyAssignments = Object.entries(userAccess).map(([cId, branchList]) => ({
        company_id: cId,
        branch_ids: branchList.filter((b) => b !== null) as string[],
      }));

      const res = await fetch("/api/settings/user-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser,
          role_id: selectedRole[selectedUser] || "",
          company_assignments: companyAssignments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Access settings saved");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSavingAccess(false);
    }
  }

  async function saveCashierAssignments() {
    if (!primaryCompanyId) { toast.error("No company found"); return; }
    setIsSavingCashbooks(true);
    try {
      const res = await fetch("/api/settings/cashier-cashbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: primaryCompanyId, assignments: cashierAssignments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Cashier cashbook assignments saved");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSavingCashbooks(false);
    }
  }

  async function savePermissions() {
    if (!primaryCompanyId) { toast.error("No company found"); return; }
    setIsSavingPerms(true);
    try {
      const res = await fetch("/api/settings/user-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: primaryCompanyId, overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Special permissions saved");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSavingPerms(false);
    }
  }

  async function saveTelegramChatId(userId: string) {
    const rawId = telegramChatIds[userId]?.trim() || "";
    // Telegram chat IDs are numeric (positive integers or negative for groups)
    if (rawId && !/^-?\d+$/.test(rawId)) {
      toast.error(
        "Telegram Chat ID must be a numeric ID (e.g. 123456789). " +
        "Ask the user to message @userinfobot on Telegram to get their numeric ID."
      );
      return;
    }
    setSavingTelegramFor(userId);
    try {
      const res = await fetch("/api/settings/telegram-chat-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          telegram_chat_id: rawId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Telegram Chat ID saved");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setSavingTelegramFor(null);
    }
  }

  const riskColors: Record<string, string> = {
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const selectedUserData = users.find((u) => u.id === selectedUser);

  return (
    <div className="space-y-10">

      {/* ═══ SECTION 1: Company & Branch Access ════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Company & Branch Access</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which companies and branches each user can access, and assign their role.
        </p>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* User selector */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Users</p>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              users.map((u) => {
                const companiesCount = Object.keys(getUserAccess(u.id)).length;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-primary ${
                      selectedUser === u.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {u.full_name || u.email || "Unknown User"}
                        </p>
                        {u.full_name && u.email && (
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        )}
                      </div>
                      {companiesCount > 0 && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">{companiesCount} co.</Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Access panel */}
          <div className="space-y-4">
            {!selectedUser ? (
              <Card>
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  Select a user on the left to configure access
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {selectedUserData?.full_name || selectedUserData?.email || "User"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedUserData?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Role:</Label>
                    <Select
                      value={selectedRole[selectedUser] || ""}
                      onValueChange={(val) =>
                        setSelectedRole((prev) => ({ ...prev, [selectedUser]: val }))
                      }
                    >
                      <SelectTrigger className="w-44 h-8 text-sm">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Companies & Branches</CardTitle>
                    <CardDescription>
                      Check a company to enable access, then specify which branches within it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No companies found.
                      </p>
                    ) : (
                      companies.map((company) => {
                        const isEnabled = isCompanyEnabled(selectedUser, company.id);
                        const companyBranches = getBranchesForCompany(company.id);
                        const allBranch = isAllBranches(selectedUser, company.id);

                        return (
                          <div
                            key={company.id}
                            className={`rounded-lg border transition-colors ${
                              isEnabled ? "border-primary/40 bg-primary/[0.02]" : "border-border"
                            }`}
                          >
                            {/* Company toggle */}
                            <div className="flex items-center gap-3 p-3">
                              <Checkbox
                                id={`co-${selectedUser}-${company.id}`}
                                checked={isEnabled}
                                onCheckedChange={() => toggleCompany(selectedUser, company.id)}
                              />
                              <Label
                                htmlFor={`co-${selectedUser}-${company.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <span className="font-medium">{company.name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">({company.code})</span>
                              </Label>
                              {isEnabled && (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>

                            {/* Branch access (shown when company is enabled) */}
                            {isEnabled && (
                              <div className="px-3 pb-3 space-y-2 border-t">
                                <div className="flex items-center gap-1.5 pt-3">
                                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Branches</span>
                                </div>

                                {/* All branches */}
                                <div className="flex items-center gap-3 pl-1">
                                  <Checkbox
                                    id={`ab-${selectedUser}-${company.id}`}
                                    checked={allBranch}
                                    onCheckedChange={() => toggleAllBranches(selectedUser, company.id)}
                                  />
                                  <Label htmlFor={`ab-${selectedUser}-${company.id}`} className="text-sm cursor-pointer font-medium">
                                    All branches
                                  </Label>
                                  <Badge variant="secondary" className="text-xs">{companyBranches.length} total</Badge>
                                </div>

                                {/* Specific branches */}
                                {!allBranch && companyBranches.length > 0 && (
                                  <div className="pl-7 space-y-2">
                                    {companyBranches.map((branch) => (
                                      <div key={branch.id} className="flex items-center gap-3">
                                        <Checkbox
                                          id={`br-${selectedUser}-${branch.id}`}
                                          checked={isBranchEnabled(selectedUser, company.id, branch.id)}
                                          onCheckedChange={() => toggleBranch(selectedUser, company.id, branch.id)}
                                        />
                                        <Label htmlFor={`br-${selectedUser}-${branch.id}`} className="text-sm cursor-pointer">
                                          {branch.name}
                                          <span className="ml-1 text-xs text-muted-foreground">({branch.code})</span>
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {!allBranch && companyBranches.length === 0 && (
                                  <p className="pl-7 text-xs text-muted-foreground">No branches found for this company.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={saveAccess} disabled={isSavingAccess} className="gap-2">
                    {isSavingAccess ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Access Settings
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2: Cashier Cashbook Assignments ═══════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Cashier Cashbook Assignments</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Cashiers are restricted to one cashbook. Managers and above see all cashbooks automatically.
        </p>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assign Cashbooks to Cashiers</CardTitle>
            <CardDescription>Each cashier can only operate on their one assigned cashbook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cashierUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No cashier-level users found.</p>
            ) : (
              cashierUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border p-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name || u.email || "Unknown"}</p>
                    {u.full_name && u.email && (
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    )}
                  </div>
                  <Select
                    value={cashierAssignments[u.id] || "__none__"}
                    onValueChange={(val) => {
                      if (val === "__none__") {
                        setCashierAssignments((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
                      } else {
                        setCashierAssignments((prev) => ({ ...prev, [u.id]: val }));
                      }
                    }}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="No cashbook assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">No cashbook assigned</span>
                      </SelectItem>
                      {cashbooks.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          <span className="ml-1 text-xs text-muted-foreground capitalize">({c.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={saveCashierAssignments} disabled={isSavingCashbooks} size="sm" className="gap-2">
                {isSavingCashbooks ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Cashbook Assignments
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══ SECTION 3: Special Permissions ════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Special Permissions</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Grant individual users extra capabilities beyond what their role allows.
        </p>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Users</p>
            {users.map((u) => {
              const permsCount = getUserPerms(u.id).length;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-primary ${
                    selectedUser === u.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name || u.email || "Unknown"}</p>
                      {u.full_name && u.email && (
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      )}
                    </div>
                    {permsCount > 0 && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">{permsCount}</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {!selectedUser ? (
              <Card>
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  Select a user to manage their special permissions
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedUserData?.full_name || selectedUserData?.email || "User"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedUserData?.email}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{getUserPerms(selectedUser).length} grant(s)</span>
                </div>

                {GRANTABLE_PERMISSIONS.map((group) => (
                  <Card key={group.group}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{group.group}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.permissions.map((perm) => {
                        const isGranted = getUserPerms(selectedUser).includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              isGranted ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                            }`}
                            onClick={() => togglePermission(selectedUser, perm.key)}
                          >
                            <div className="mt-0.5 flex-shrink-0">
                              {isGranted ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{perm.label}</span>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${riskColors[perm.risk]}`}>
                                  {perm.risk} risk
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-end">
                  <Button onClick={savePermissions} disabled={isSavingPerms} className="gap-2">
                    {isSavingPerms ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
                    Save Special Permissions
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: Telegram Chat IDs ═══════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Telegram Chat IDs</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Link each manager&apos;s Telegram account so they can receive OTP codes and expense approval requests.
        </p>
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 mb-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">⚠️ Two steps required before OTP delivery works:</p>
          <ol className="text-xs text-amber-700 dark:text-amber-300 list-decimal list-inside space-y-0.5">
            <li>The manager must open Telegram and send <span className="font-mono font-medium">/start</span> to your bot (otherwise Telegram blocks delivery)</li>
            <li>Enter their numeric Chat ID below — ask them to message <span className="font-mono font-medium">@userinfobot</span> to get it (it&apos;s a number like <span className="font-mono">123456789</span>, not a username)</li>
          </ol>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">User Telegram Chat IDs</CardTitle>
            <CardDescription>Numeric ID only (e.g. 123456789). Leave blank to disconnect.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border p-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || u.email || "Unknown"}</p>
                  {u.full_name && u.email && (
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={telegramChatIds[u.id] ?? ""}
                    onChange={(e) =>
                      setTelegramChatIds((prev) => ({ ...prev, [u.id]: e.target.value }))
                    }
                    placeholder="e.g. 123456789"
                    className="w-44 font-mono text-sm h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    onClick={() => saveTelegramChatId(u.id)}
                    disabled={savingTelegramFor === u.id}
                  >
                    {savingTelegramFor === u.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
