"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Save, RefreshCw, MessageCircle, Copy, CheckCircle2,
  ChevronDown, ChevronUp, Info, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { TelegramDayCloseConfig, TelegramExpenseApprovers } from "@/lib/queries/company-configs";

const NO_MANAGER = "__none__";

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  has_telegram: boolean;
}
interface Branch { id: string; name: string }
interface Cashbook { id: string; name: string; branch_id: string | null }

interface TelegramSettingsFormProps {
  companyId: string;
  initialBotToken: string;
  initialDayCloseConfig: TelegramDayCloseConfig;
  initialExpenseApprovers: TelegramExpenseApprovers;
  users: User[];
  branches: Branch[];
  cashbooks: Cashbook[];
  webhookUrl: string;
}

export function TelegramSettingsForm({
  companyId,
  initialBotToken,
  initialDayCloseConfig,
  initialExpenseApprovers,
  users,
  branches,
  cashbooks,
  webhookUrl,
}: TelegramSettingsFormProps) {
  // ── Bot Token ────────────────────────────────────────────────────────
  const [botToken, setBotToken] = useState(initialBotToken);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [showGuide, setShowGuide] = useState(!initialBotToken);
  const [copied, setCopied] = useState(false);

  // ── Day-Close Managers ────────────────────────────────────────────────
  const [dayCloseConfig, setDayCloseConfig] = useState<TelegramDayCloseConfig>(initialDayCloseConfig);
  const [isSavingDayClose, setIsSavingDayClose] = useState(false);
  const [showBranchOverrides, setShowBranchOverrides] = useState(false);
  const [showCashbookOverrides, setShowCashbookOverrides] = useState(false);

  // ── Expense Approvers ─────────────────────────────────────────────────
  const [expenseApprovers, setExpenseApprovers] = useState<TelegramExpenseApprovers>(initialExpenseApprovers);
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────
  function userLabel(u: User) {
    const name = u.full_name || u.email || "Unknown";
    return u.has_telegram ? name : `${name} (no Telegram)`;
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Save handlers ─────────────────────────────────────────────────────
  async function saveBotToken() {
    if (!botToken.trim()) { toast.error("Bot token cannot be empty"); return; }
    setIsSavingToken(true);
    try {
      const res = await fetch("/api/telegram/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, config_key: "telegram_bot_token", config_value: botToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Bot token saved");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSavingToken(false);
    }
  }

  async function registerWebhook() {
    setIsRegisteringWebhook(true);
    try {
      const res = await fetch("/api/telegram/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register webhook");
      toast.success("Webhook registered with Telegram ✓");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsRegisteringWebhook(false);
    }
  }

  async function saveDayCloseConfig() {
    setIsSavingDayClose(true);
    try {
      const res = await fetch("/api/telegram/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, config_key: "telegram_day_close", config_value: dayCloseConfig }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Day-close OTP manager settings saved");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSavingDayClose(false);
    }
  }

  async function saveExpenseApprovers() {
    setIsSavingExpense(true);
    try {
      const res = await fetch("/api/telegram/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, config_key: "telegram_expense_approvers", config_value: expenseApprovers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Expense approvers saved");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSavingExpense(false);
    }
  }

  function setDayCloseManager(id: string | null) {
    setDayCloseConfig((c) => ({ ...c, company_manager_id: id }));
  }
  function setBranchOverride(branchId: string, managerId: string | null) {
    setDayCloseConfig((c) => {
      const branch_overrides = { ...c.branch_overrides };
      if (managerId === null) delete branch_overrides[branchId];
      else branch_overrides[branchId] = managerId;
      return { ...c, branch_overrides };
    });
  }
  function setCashbookOverride(cashbookId: string, managerId: string | null) {
    setDayCloseConfig((c) => {
      const cashbook_overrides = { ...c.cashbook_overrides };
      if (managerId === null) delete cashbook_overrides[cashbookId];
      else cashbook_overrides[cashbookId] = managerId;
      return { ...c, cashbook_overrides };
    });
  }

  const branchOverrideCount = Object.keys(dayCloseConfig.branch_overrides).length;
  const cashbookOverrideCount = Object.keys(dayCloseConfig.cashbook_overrides).length;

  return (
    <div className="space-y-8 max-w-3xl">

      {/* ── Section 1: Bot Token ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Bot Token</CardTitle>
          </div>
          <CardDescription>
            Create a Telegram bot via @BotFather and paste the API token here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="1234567890:ABCdef..."
              className="font-mono text-sm"
              type="password"
            />
            <Button onClick={saveBotToken} disabled={isSavingToken} className="shrink-0 gap-2">
              {isSavingToken ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>

          {/* Webhook URL + register button */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Webhook URL</p>
            <div className="flex gap-2 items-center">
              <code className="text-xs flex-1 truncate font-mono bg-background px-2 py-1 rounded border">
                {webhookUrl}
              </code>
              <Button variant="outline" size="sm" onClick={copyWebhookUrl} className="shrink-0 gap-1">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={registerWebhook}
              disabled={isRegisteringWebhook || !botToken}
              className="w-full gap-2"
            >
              {isRegisteringWebhook ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              Register Webhook with Telegram
            </Button>
            <p className="text-xs text-muted-foreground">
              Click after saving your bot token. This tells Telegram where to deliver messages and button presses.
            </p>
          </div>

          {/* Setup guide */}
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            {showGuide ? "Hide" : "Show"} setup guide
            {showGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showGuide && (
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4 text-sm space-y-2">
              <p className="font-semibold text-blue-800 dark:text-blue-200">Quick Setup</p>
              <ol className="space-y-1.5 text-blue-700 dark:text-blue-300 list-decimal list-inside">
                <li>Open Telegram and search for <span className="font-mono font-medium">@BotFather</span></li>
                <li>Send <span className="font-mono font-medium">/newbot</span> and follow prompts to create a bot</li>
                <li>Copy the API token (looks like <span className="font-mono">1234567890:ABC...</span>) and paste above</li>
                <li>Click <strong>Save</strong> then <strong>Register Webhook</strong></li>
                <li>Go to <strong>User Access Controls</strong> and enter each manager&apos;s Telegram Chat ID
                  <br /><span className="text-xs">(Ask them to message <span className="font-mono">@userinfobot</span> — it replies with their numeric ID)</span>
                </li>
                <li>Configure which manager to notify below</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Day-Close OTP Managers ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Day-Close OTP Managers</CardTitle>
          <CardDescription>
            Select which manager receives the Telegram OTP when a cashier tries to close a day.
            Cashbook overrides take priority over branch, which takes priority over company default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company-wide default */}
          <div className="space-y-1.5">
            <Label className="text-sm">Company-Wide Default Manager</Label>
            <Select
              value={dayCloseConfig.company_manager_id || NO_MANAGER}
              onValueChange={(val) => setDayCloseManager(val === NO_MANAGER ? null : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No manager (OTP disabled)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MANAGER}>
                  <span className="text-muted-foreground">No manager (OTP disabled)</span>
                </SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className={u.has_telegram ? "" : "text-muted-foreground"}>
                      {userLabel(u)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Branch overrides */}
          {branches.length > 0 && (
            <div>
              <button
                onClick={() => setShowBranchOverrides((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium w-full text-left py-2"
              >
                {showBranchOverrides ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Branch Overrides
                {branchOverrideCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{branchOverrideCount} set</Badge>
                )}
              </button>
              {showBranchOverrides && (
                <div className="space-y-2 pl-6 pt-1">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className="text-sm w-40 truncate">{b.name}</span>
                      <Select
                        value={dayCloseConfig.branch_overrides[b.id] || NO_MANAGER}
                        onValueChange={(val) => setBranchOverride(b.id, val === NO_MANAGER ? null : val)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Follow company" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_MANAGER}>
                            <span className="text-muted-foreground">Follow company default</span>
                          </SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <span className={u.has_telegram ? "" : "text-muted-foreground"}>
                                {userLabel(u)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cashbook overrides */}
          {cashbooks.length > 0 && (
            <div>
              <button
                onClick={() => setShowCashbookOverrides((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium w-full text-left py-2"
              >
                {showCashbookOverrides ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Cashbook Overrides
                {cashbookOverrideCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{cashbookOverrideCount} set</Badge>
                )}
              </button>
              {showCashbookOverrides && (
                <div className="space-y-2 pl-6 pt-1">
                  {cashbooks.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-sm w-40 truncate">{c.name}</span>
                      <Select
                        value={dayCloseConfig.cashbook_overrides[c.id] || NO_MANAGER}
                        onValueChange={(val) => setCashbookOverride(c.id, val === NO_MANAGER ? null : val)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Follow branch/company" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_MANAGER}>
                            <span className="text-muted-foreground">Follow branch/company</span>
                          </SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <span className={u.has_telegram ? "" : "text-muted-foreground"}>
                                {userLabel(u)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={saveDayCloseConfig} disabled={isSavingDayClose} className="gap-2">
              {isSavingDayClose ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Day-Close Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Expense Approvers ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expense Approval Notifications</CardTitle>
          <CardDescription>
            <strong>Note:</strong> approval routing is now automatic — every owner,
            finance controller, accountant (company-wide) and the branch manager
            (for the expense's branch) receives the Telegram notification and can
            approve. The settings below are kept for reference / legacy data but
            are <em>no longer used</em> by the approval flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(
            [
              { listKey: "branch_approver_ids", label: "Branch Level Approvers", description: "Notified when expense is submitted" },
              { listKey: "accounts_approver_ids", label: "Accounts Level Approvers", description: "Notified after branch approval" },
              { listKey: "owner_approver_ids", label: "Owner Level Approvers", description: "Notified after accounts approval" },
            ] as const
          ).map(({ listKey, label, description }) => {
            const ids = expenseApprovers[listKey] ?? [];
            const availableUsers = users.filter((u) => !ids.includes(u.id));
            return (
              <div key={listKey} className="space-y-2">
                <div>
                  <Label className="text-sm">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>

                {ids.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ids.map((uid) => {
                      const u = users.find((x) => x.id === uid);
                      return (
                        <Badge key={uid} variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1">
                          <span className={u?.has_telegram ? "" : "text-muted-foreground"}>
                            {u ? userLabel(u) : uid}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpenseApprovers((prev) => ({
                                ...prev,
                                [listKey]: (prev[listKey] ?? []).filter((x) => x !== uid),
                              }))
                            }
                            className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                            aria-label={`Remove ${u?.full_name || uid}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <Select
                  value={NO_MANAGER}
                  onValueChange={(val) => {
                    if (val === NO_MANAGER) return;
                    setExpenseApprovers((prev) => ({
                      ...prev,
                      [listKey]: [...(prev[listKey] ?? []), val],
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={ids.length === 0 ? "Add approver…" : "Add another approver…"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MANAGER}>
                      <span className="text-muted-foreground">{availableUsers.length === 0 ? "All users added" : "Select a user…"}</span>
                    </SelectItem>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className={u.has_telegram ? "" : "text-muted-foreground"}>
                          {userLabel(u)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          <div className="flex justify-end">
            <Button onClick={saveExpenseApprovers} disabled={isSavingExpense} className="gap-2">
              {isSavingExpense ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Expense Approvers
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
