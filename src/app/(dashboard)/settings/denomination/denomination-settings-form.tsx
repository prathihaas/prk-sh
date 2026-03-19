"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateDenominationSetting } from "@/lib/queries/company-configs";
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

interface DenominationSettingsFormProps {
  companyId: string;
  enabled: boolean;
  canEdit: boolean;
}

export function DenominationSettingsForm({
  companyId,
  enabled,
  canEdit,
}: DenominationSettingsFormProps) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle(value: boolean) {
    if (!canEdit) return;
    setIsEnabled(value);
    setIsSaving(true);
    try {
      const result = await updateDenominationSetting(companyId, value);
      if (result.error) {
        toast.error(result.error);
        setIsEnabled(!value); // revert
      } else {
        toast.success(
          value
            ? "Denomination counting enabled for all cashbooks"
            : "Denomination counting disabled"
        );
      }
    } catch {
      toast.error("Failed to save setting");
      setIsEnabled(!value);
    } finally {
      setIsSaving(false);
    }
  }

  const DENOMINATIONS = [
    { value: 500, label: "₹500 Notes" },
    { value: 200, label: "₹200 Notes" },
    { value: 100, label: "₹100 Notes" },
    { value: 50, label: "₹50 Notes" },
    { value: 20, label: "₹20 Notes" },
    { value: 10, label: "₹10 Notes / Coins" },
    { value: 5, label: "₹5 Coins" },
    { value: 2, label: "₹2 Coins" },
    { value: 1, label: "₹1 Coins" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Denomination Count on Day Close</CardTitle>
          <CardDescription>
            When enabled, cashiers must count cash by denomination (note-wise and
            coin-wise) before closing each day. The system will auto-calculate the
            physical count total from the denomination entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Require denomination count
              </Label>
              <p className="text-xs text-muted-foreground">
                Applies to all cashbooks across all branches for this company
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={!canEdit || isSaving}
              />
            </div>
          </div>

          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Only owners and administrators can change this setting.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview of denomination table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Denomination Table Preview</CardTitle>
          <CardDescription>
            This is what cashiers will see when closing a cashbook day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Denomination</th>
                  <th className="text-center px-4 py-2 font-medium">Count</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {DENOMINATIONS.map((d) => (
                  <tr key={d.value} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{d.label}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-block w-20 h-7 rounded border bg-background" />
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">—</td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-4 py-2" colSpan={2}>Total Physical Cash</td>
                  <td className="px-4 py-2 text-right">₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
