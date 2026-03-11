"use client";

import { useRouter, usePathname } from "next/navigation";
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
  code: string;
}

interface ReportScopeSelectorProps {
  branches: Branch[];
  selectedBranch: string;
}

export function ReportScopeSelector({
  branches,
  selectedBranch,
}: ReportScopeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(value: string) {
    router.push(`${pathname}?branch=${value}`);
  }

  return (
    <Select value={selectedBranch} onValueChange={handleChange}>
      <SelectTrigger className="w-52 h-8 text-sm">
        <SelectValue placeholder="Select scope" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="consolidated">
          <span className="font-medium">All Branches (Consolidated)</span>
        </SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
            <span className="ml-1 text-xs text-muted-foreground">({b.code})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
