"use client";

import { GitBranch } from "lucide-react";
import { useScopeContext } from "@/components/providers/scope-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BranchSelector() {
  const { branchId, branches, setBranchId } = useScopeContext();

  if (branches.length === 0) return null;

  return (
    <Select
      value={branchId || "all"}
      onValueChange={(val) => setBranchId(val === "all" ? null : val)}
    >
      <SelectTrigger className="h-9 w-[180px]">
        <GitBranch className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="All branches" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Branches</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
