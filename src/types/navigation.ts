import { type LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: string | null; // null = visible to all authenticated users
}

export interface NavSection {
  label: string;
  items: NavItem[];
}
