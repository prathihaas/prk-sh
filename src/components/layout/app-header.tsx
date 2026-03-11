"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { CompanySelector } from "./company-selector";
import { BranchSelector } from "./branch-selector";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <BreadcrumbNav />

      <div className="ml-auto flex items-center gap-2">
        <CompanySelector />
        <BranchSelector />
        <Separator orientation="vertical" className="h-4" />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
