"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  org: "Organization",
  companies: "Companies",
  branches: "Branches",
  "financial-years": "Financial Years",
  admin: "Administration",
  users: "Users",
  roles: "Roles",
  cash: "Cash Management",
  cashbooks: "Cashbooks",
  invoices: "Invoices",
  expenses: "Expenses",
  hr: "HR & Payroll",
  employees: "Employees",
  approvals: "Approvals",
  audit: "Audit",
  "fraud-flags": "Fraud Flags",
  reports: "Reports",
  settings: "Settings",
  new: "New",
  edit: "Edit",
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  // Build breadcrumb items with paths
  const items = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label =
      SEGMENT_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === segments.length - 1;

    // Skip UUID-like segments in display
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment
      );

    return { href, label: isUuid ? "..." : label, isLast, isUuid };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={item.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
