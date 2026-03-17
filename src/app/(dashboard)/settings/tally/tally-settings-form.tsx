"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TallySettings } from "@/lib/utils/tally-xml-generator";
import { saveTallySettings } from "@/lib/actions/tally-settings-actions";

interface Cashbook {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
}

interface Props {
  companyId: string;
  cashbooks: Cashbook[];
  categories: Category[];
  initialSettings: TallySettings;
}

const CASHBOOK_TYPE_HINT: Record<string, string> = {
  main: "Cash-in-Hand → e.g. \"Cash\"",
  petty: "Cash-in-Hand → e.g. \"Petty Cash\"",
  bank: "Bank Accounts → e.g. \"HDFC Bank A/c\"",
};

export function TallySettingsForm({ companyId, cashbooks, categories, initialSettings }: Props) {
  const [settings, setSettings] = useState<TallySettings>({ ...initialSettings });
  const [saving, setSaving] = useState(false);

  function updateCashbookLedger(cashbookId: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      cashbook_ledger_map: { ...prev.cashbook_ledger_map, [cashbookId]: value },
    }));
  }

  function updateCategoryLedger(categoryId: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      expense_category_ledger_map: {
        ...prev.expense_category_ledger_map,
        [categoryId]: value,
      },
    }));
  }

  async function handleSave() {
    if (!settings.company_name.trim()) {
      toast.error("Company name in Tally is required");
      return;
    }
    setSaving(true);
    try {
      const result = await saveTallySettings(companyId, settings);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Tally settings saved successfully");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const unmappedCashbooks = cashbooks.filter(
    (cb) => !settings.cashbook_ledger_map[cb.id]
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* How-to banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-semibold">How to set up Tally Prime integration:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
            <li>Enter the <strong>exact company name</strong> as it appears in Tally Prime (case-sensitive).</li>
            <li>Map each cashbook to the corresponding Tally ledger name.</li>
            <li>Optionally map expense categories to specific Tally expense ledgers.</li>
            <li>Go to <strong>Reports → Tally Export</strong> to download your XML.</li>
            <li>In Tally: <strong>Gateway of Tally → Import Data → Vouchers</strong> → select the XML file.</li>
          </ol>
        </div>
      </div>

      {unmappedCashbooks.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">{unmappedCashbooks.length} cashbook(s) not yet mapped:</p>
            <p className="mt-1">
              {unmappedCashbooks.map((cb) => cb.name).join(", ")}
            </p>
            <p className="mt-1 text-amber-600 dark:text-amber-400">
              Unmapped cashbooks will use the cashbook name as the Tally ledger name — verify these match your Tally setup.
            </p>
          </div>
        </div>
      )}

      {/* ── Company Name ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tally Company Name</CardTitle>
          <CardDescription>
            Must match exactly how the company is named inside Tally Prime (including case and punctuation).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name in Tally *</Label>
            <Input
              id="company_name"
              value={settings.company_name}
              onChange={(e) => setSettings((p) => ({ ...p, company_name: e.target.value }))}
              placeholder="e.g. ABC Motors Pvt. Ltd."
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              This goes into the <code>&lt;SVCURRENTCOMPANY&gt;</code> field of the XML. Any mismatch will prevent import.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Default Ledgers ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Ledger Names</CardTitle>
          <CardDescription>
            Used when a transaction has no party name and no category-specific mapping.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default_income_ledger">Default Income Ledger</Label>
            <Input
              id="default_income_ledger"
              value={settings.default_income_ledger}
              onChange={(e) => setSettings((p) => ({ ...p, default_income_ledger: e.target.value }))}
              placeholder="Sales"
            />
            <p className="text-xs text-muted-foreground">
              Credited on Receipt vouchers when party name is blank.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_expense_ledger">Default Expense Ledger</Label>
            <Input
              id="default_expense_ledger"
              value={settings.default_expense_ledger}
              onChange={(e) => setSettings((p) => ({ ...p, default_expense_ledger: e.target.value }))}
              placeholder="Sundry Creditors"
            />
            <p className="text-xs text-muted-foreground">
              Debited on Payment vouchers when party name is blank.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Cashbook → Tally Ledger Mapping ──────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cashbook → Tally Ledger Mapping</CardTitle>
          <CardDescription>
            Enter the Tally ledger name for each cashbook. For cash cashbooks use a ledger
            under <em>Cash-in-Hand</em>; for bank cashbooks use a ledger under <em>Bank Accounts</em>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cashbooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active cashbooks found.</p>
          ) : (
            <div className="space-y-3">
              {cashbooks.map((cb) => {
                const mapped = !!settings.cashbook_ledger_map[cb.id];
                return (
                  <div key={cb.id} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{cb.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">{cb.type}</Badge>
                        {mapped ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {CASHBOOK_TYPE_HINT[cb.type] || "Set a matching Tally ledger name"}
                      </p>
                    </div>
                    <div className="flex-1">
                      <Input
                        value={settings.cashbook_ledger_map[cb.id] || ""}
                        onChange={(e) => updateCashbookLedger(cb.id, e.target.value)}
                        placeholder={cb.name}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Expense Category → Tally Ledger Mapping ──────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Category → Tally Ledger Mapping</CardTitle>
          <CardDescription>
            Optional. If left blank, the party name on the payment transaction is used,
            or the default expense ledger as a final fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active expense categories found.</p>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{cat.name}</span>
                  <div className="flex-1">
                    <Input
                      value={settings.expense_category_ledger_map[cat.id] || ""}
                      onChange={(e) => updateCategoryLedger(cat.id, e.target.value)}
                      placeholder={`e.g. ${cat.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Save ─────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
