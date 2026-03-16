"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, ShieldCheck, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  updateInsuranceCompanies,
  updateFinanceCompanies,
} from "@/lib/queries/company-configs";

interface CompanyPartnersFormProps {
  companyId: string;
  insuranceCompanies: string[];
  financeCompanies: string[];
  canEdit: boolean;
}

export function CompanyPartnersForm({
  companyId,
  insuranceCompanies: initInsurance,
  financeCompanies: initFinance,
  canEdit,
}: CompanyPartnersFormProps) {
  const [insurance, setInsurance] = useState<string[]>(initInsurance);
  const [finance, setFinance] = useState<string[]>(initFinance);
  const [newInsurance, setNewInsurance] = useState("");
  const [newFinance, setNewFinance] = useState("");
  const [isPending, startTransition] = useTransition();

  function addInsurance() {
    const trimmed = newInsurance.trim();
    if (!trimmed) return;
    if (insurance.includes(trimmed)) {
      toast.error("This insurance company is already in the list.");
      return;
    }
    const updated = [...insurance, trimmed];
    startTransition(async () => {
      const result = await updateInsuranceCompanies(companyId, updated);
      if (result.error) {
        toast.error(result.error);
      } else {
        setInsurance(updated);
        setNewInsurance("");
        toast.success(`"${trimmed}" added to insurance companies.`);
      }
    });
  }

  function removeInsurance(name: string) {
    const updated = insurance.filter((c) => c !== name);
    startTransition(async () => {
      const result = await updateInsuranceCompanies(companyId, updated);
      if (result.error) {
        toast.error(result.error);
      } else {
        setInsurance(updated);
        toast.success(`"${name}" removed.`);
      }
    });
  }

  function addFinance() {
    const trimmed = newFinance.trim();
    if (!trimmed) return;
    if (finance.includes(trimmed)) {
      toast.error("This finance company is already in the list.");
      return;
    }
    const updated = [...finance, trimmed];
    startTransition(async () => {
      const result = await updateFinanceCompanies(companyId, updated);
      if (result.error) {
        toast.error(result.error);
      } else {
        setFinance(updated);
        setNewFinance("");
        toast.success(`"${trimmed}" added to finance companies.`);
      }
    });
  }

  function removeFinance(name: string) {
    const updated = finance.filter((c) => c !== name);
    startTransition(async () => {
      const result = await updateFinanceCompanies(companyId, updated);
      if (result.error) {
        toast.error(result.error);
      } else {
        setFinance(updated);
        toast.success(`"${name}" removed.`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Insurance Companies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Insurance Companies</CardTitle>
          </div>
          <CardDescription>
            These names appear as options in the &quot;Insurance Company&quot; dropdown when
            creating a service sales receipt with insurance due.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current list */}
          {insurance.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No insurance companies added yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {insurance.map((name) => (
                <Badge key={name} variant="secondary" className="text-sm gap-1.5 pr-1">
                  {name}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeInsurance(name)}
                      disabled={isPending}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}

          {/* Add new */}
          {canEdit && (
            <div className="flex gap-2">
              <Input
                placeholder="e.g. LIC, HDFC ERGO, Bajaj Allianz"
                value={newInsurance}
                onChange={(e) => setNewInsurance(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInsurance())}
                className="max-w-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={addInsurance}
                disabled={!newInsurance.trim() || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finance Companies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Finance Companies</CardTitle>
          </div>
          <CardDescription>
            These names appear as options in the &quot;Finance Company&quot; dropdown when
            creating a vehicle sales receipt with finance/loan due.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current list */}
          {finance.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No finance companies added yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {finance.map((name) => (
                <Badge key={name} variant="secondary" className="text-sm gap-1.5 pr-1">
                  {name}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeFinance(name)}
                      disabled={isPending}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}

          {/* Add new */}
          {canEdit && (
            <div className="flex gap-2">
              <Input
                placeholder="e.g. SBI, HDFC Bank, Mahindra Finance"
                value={newFinance}
                onChange={(e) => setNewFinance(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFinance())}
                className="max-w-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={addFinance}
                disabled={!newFinance.trim() || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Only Owner and Admin users can add or remove partner company names.
        </p>
      )}
    </div>
  );
}
