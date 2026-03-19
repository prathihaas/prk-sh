"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Building2, Landmark, ChevronDown, ChevronRight } from "lucide-react";
import {
  updateDenominationCompanySetting,
  updateDenominationBranchOverride,
  updateDenominationCashbookOverride,
} from "@/lib/queries/company-configs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Branch {
  id: string;
  name: string;
}

interface Cashbook {
  id: string;
  name: string;
  type: string;
}

interface DenominationConfig {
  enabled: boolean;
  branch_overrides: Record<string, boolean>;
  cashbook_overrides: Record<string, boolean>;
}

interface DenominationSettingsFormProps {
  companyId: string;
  config: DenominationConfig;
  branches: Branch[];
  cashbooks: Cashbook[];
  canEdit: boolean;
}

type OverrideValue = "inherit" | "on" | "off";

function overrideFromConfig(overrides: Record<string, boolean>, id: string): OverrideValue {
  if (!(id in overrides)) return "inherit";
  return overrides[id] ? "on" : "off";
}

export function DenominationSettingsForm({
  companyId,
  config: initialConfig,
  branches,
  cashbooks,
  canEdit,
}: DenominationSettingsFormProps) {
  const [config, setConfig] = useState<DenominationConfig>(initialConfig);
  const [saving, setSaving] = useState<string | null>(null);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [cashbooksOpen, setCashbooksOpen] = useState(false);

  async function handleCompanyToggle(value: boolean) {
    if (!canEdit) return;
    setSaving("company");
    const prev = config.enabled;
    setConfig((c) => ({ ...c, enabled: value }));
    try {
      const result = await updateDenominationCompanySetting(companyId, value);
      if (result.error) {
        toast.error(result.error);
        setConfig((c) => ({ ...c, enabled: prev }));
      } else {
        toast.success(value ? "Denomination counting enabled company-wide" : "Denomination counting disabled company-wide");
      }
    } catch {
      toast.error("Failed to save setting");
      setConfig((c) => ({ ...c, enabled: prev }));
    } finally {
      setSaving(null);
    }
  }

  async function handleBranchOverride(branchId: string, val: OverrideValue) {
    if (!canEdit) return;
    setSaving(`branch-${branchId}`);
    const prev = { ...config.branch_overrides };
    const newValue: boolean | null = val === "inherit" ? null : val === "on";

    setConfig((c) => {
      const branch_overrides = { ...c.branch_overrides };
      if (newValue === null) delete branch_overrides[branchId];
      else branch_overrides[branchId] = newValue;
      return { ...c, branch_overrides };
    });

    try {
      const result = await updateDenominationBranchOverride(companyId, branchId, newValue);
      if (result.error) {
        toast.error(result.error);
        setConfig((c) => ({ ...c, branch_overrides: prev }));
      } else {
        toast.success("Branch override saved");
      }
    } catch {
      toast.error("Failed to save setting");
      setConfig((c) => ({ ...c, branch_overrides: prev }));
    } finally {
      setSaving(null);
    }
  }

  async function handleCashbookOverride(cashbookId: string, val: OverrideValue) {
    if (!canEdit) return;
    setSaving(`cashbook-${cashbookId}`);
    const prev = { ...config.cashbook_overrides };
    const newValue: boolean | null = val === "inherit" ? null : val === "on";

    setConfig((c) => {
      const cashbook_overrides = { ...c.cashbook_overrides };
      if (newValue === null) delete cashbook_overrides[cashbookId];
      else cashbook_overrides[cashbookId] = newValue;
      return { ...c, cashbook_overrides };
    });

    try {
      const result = await updateDenominationCashbookOverride(companyId, cashbookId, newValue);
      if (result.error) {
        toast.error(result.error);
        setConfig((c) => ({ ...c, cashbook_overrides: prev }));
      } else {
        toast.success("Cashbook override saved");
      }
    } catch {
      toast.error("Failed to save setting");
      setConfig((c) => ({ ...c, cashbook_overrides: prev }));
    } finally {
      setSaving(null);
    }
  }

  function effectiveBranchSetting(branchId: string): boolean {
    if (branchId in config.branch_overrides) return config.branch_overrides[branchId];
    return config.enabled;
  }

  function effectiveCashbookSetting(cashbook: Cashbook): boolean {
    if (cashbook.id in config.cashbook_overrides) return config.cashbook_overrides[cashbook.id];
    // For cashbooks, try to find their branch override (we don't have branch_id here, so fall back to company)
    return config.enabled;
  }

  const overrideCount =
    Object.keys(config.branch_overrides).length +
    Object.keys(config.cashbook_overrides).length;

  return (
    <div className="space-y-4">
      {/* Company-wide master toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Company-Wide Setting
          </CardTitle>
          <CardDescription>
            Master toggle for all cashbooks. Branch and cashbook overrides take precedence over this setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Require denomination count</Label>
              <p className="text-xs text-muted-foreground">
                Default for all branches and cashbooks unless overridden below
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saving === "company" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={config.enabled}
                onCheckedChange={handleCompanyToggle}
                disabled={!canEdit || saving !== null}
              />
            </div>
          </div>
          {!canEdit && (
            <p className="text-xs text-muted-foreground mt-3">
              Only owners and administrators can change this setting.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Branch-level overrides */}
      {branches.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setBranchesOpen((o) => !o)}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Branch Overrides
                {Object.keys(config.branch_overrides).length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {Object.keys(config.branch_overrides).length} override{Object.keys(config.branch_overrides).length !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
              {branchesOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
            <CardDescription>
              Override denomination requirement for specific branches
            </CardDescription>
          </CardHeader>
          {branchesOpen && (
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium text-xs">Branch</th>
                      <th className="text-center px-4 py-2 font-medium text-xs">Effective</th>
                      <th className="text-right px-4 py-2 font-medium text-xs">Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => {
                      const override = overrideFromConfig(config.branch_overrides, branch.id);
                      const effective = effectiveBranchSetting(branch.id);
                      const isSaving = saving === `branch-${branch.id}`;
                      return (
                        <tr key={branch.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium">{branch.name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                effective
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                            >
                              {effective ? "Required" : "Not required"}
                              {override === "inherit" && (
                                <span className="ml-1 opacity-60">(inherited)</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                              <Select
                                value={override}
                                onValueChange={(v) => handleBranchOverride(branch.id, v as OverrideValue)}
                                disabled={!canEdit || saving !== null}
                              >
                                <SelectTrigger className="h-8 w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherit" className="text-xs">Follow company</SelectItem>
                                  <SelectItem value="on" className="text-xs">Always require</SelectItem>
                                  <SelectItem value="off" className="text-xs">Never require</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Cashbook-level overrides */}
      {cashbooks.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setCashbooksOpen((o) => !o)}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                Cashbook Overrides
                {Object.keys(config.cashbook_overrides).length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {Object.keys(config.cashbook_overrides).length} override{Object.keys(config.cashbook_overrides).length !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
              {cashbooksOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
            <CardDescription>
              Override denomination requirement for individual cashbooks (highest priority)
            </CardDescription>
          </CardHeader>
          {cashbooksOpen && (
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium text-xs">Cashbook</th>
                      <th className="text-center px-4 py-2 font-medium text-xs w-20">Type</th>
                      <th className="text-center px-4 py-2 font-medium text-xs">Effective</th>
                      <th className="text-right px-4 py-2 font-medium text-xs">Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashbooks.map((cashbook) => {
                      const override = overrideFromConfig(config.cashbook_overrides, cashbook.id);
                      const effective = effectiveCashbookSetting(cashbook);
                      const isSaving = saving === `cashbook-${cashbook.id}`;
                      return (
                        <tr key={cashbook.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium">{cashbook.name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-xs capitalize text-muted-foreground">
                              {cashbook.type === "main" ? "Cash" : cashbook.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                effective
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                            >
                              {effective ? "Required" : "Not required"}
                              {override === "inherit" && (
                                <span className="ml-1 opacity-60">(inherited)</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                              <Select
                                value={override}
                                onValueChange={(v) => handleCashbookOverride(cashbook.id, v as OverrideValue)}
                                disabled={!canEdit || saving !== null}
                              >
                                <SelectTrigger className="h-8 w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherit" className="text-xs">Follow company</SelectItem>
                                  <SelectItem value="on" className="text-xs">Always require</SelectItem>
                                  <SelectItem value="off" className="text-xs">Never require</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Cashbook overrides take the highest priority, followed by branch overrides, then the company-wide setting.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Summary */}
      {overrideCount > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {overrideCount} override{overrideCount !== 1 ? "s" : ""} active. Overridden items ignore the company-wide setting.
        </p>
      )}
    </div>
  );
}
