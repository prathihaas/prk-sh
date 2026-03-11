"use client";

import { Building2 } from "lucide-react";
import { useScopeContext } from "@/components/providers/scope-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CompanySelector() {
  const { companyId, companies, setCompanyId } = useScopeContext();

  if (companies.length <= 1) {
    // Single company — show as text, no selector
    return companies.length === 1 ? (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="font-medium text-foreground">
          {companies[0].name}
        </span>
      </div>
    ) : null;
  }

  return (
    <Select value={companyId || ""} onValueChange={setCompanyId}>
      <SelectTrigger className="h-9 w-[200px]">
        <Building2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
