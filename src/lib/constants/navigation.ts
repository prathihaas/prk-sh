import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Calendar,
  Users,
  Shield,
  Wallet,
  HandCoins,
  FileText,
  Receipt,
  FolderOpen,
  Landmark,
  BookOpen,
  ClipboardCheck,
  ShieldAlert,
  ScrollText,
  BarChart3,
  Settings,
  AlertTriangle,
  Upload,
  Webhook,
  UserCog,
  ShoppingCart,
  Truck,
  Users2,
  ArrowLeftRight,
} from "lucide-react";
import { PERMISSIONS } from "./permissions";
import type { NavSection } from "@/types/navigation";

export const navigationItems: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: null,
      },
    ],
  },
  {
    label: "Organization",
    items: [
      {
        title: "Companies",
        href: "/org/companies",
        icon: Building2,
        permission: PERMISSIONS.ADMIN_MANAGE_COMPANIES,
      },
      {
        title: "Branches",
        href: "/org/branches",
        icon: GitBranch,
        permission: PERMISSIONS.ADMIN_MANAGE_BRANCHES,
      },
      {
        title: "Financial Years",
        href: "/org/financial-years",
        icon: Calendar,
        permission: PERMISSIONS.ADMIN_LOCK_FY,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users",
        href: "/admin/users",
        icon: Users,
        permission: PERMISSIONS.ADMIN_MANAGE_USERS,
      },
      {
        title: "Roles",
        href: "/admin/roles",
        icon: Shield,
        permission: PERMISSIONS.ADMIN_MANAGE_USERS,
      },
    ],
  },
  {
    label: "Cash Management",
    items: [
      {
        title: "Cashbooks",
        href: "/cash/cashbooks",
        icon: Wallet,
        permission: PERMISSIONS.CASHBOOK_READ,
      },
      {
        title: "Receipts",
        href: "/cash/receipts",
        icon: HandCoins,
        permission: PERMISSIONS.CASHBOOK_READ,
      },
    ],
  },
  {
    label: "Bank Accounts",
    items: [
      {
        title: "Bank Books",
        href: "/banks/accounts",
        icon: Landmark,
        permission: PERMISSIONS.CASHBOOK_READ,
      },
      {
        title: "Bank Statements",
        href: "/banks/statements",
        icon: BookOpen,
        permission: PERMISSIONS.CASHBOOK_READ,
      },
    ],
  },
  {
    label: "Invoices",
    items: [
      {
        title: "Invoices",
        href: "/invoices",
        icon: FileText,
        permission: PERMISSIONS.INVOICE_READ,
      },
    ],
  },
  {
    label: "Expenses",
    items: [
      {
        title: "All Expenses",
        href: "/expenses",
        icon: Receipt,
        permission: PERMISSIONS.EXPENSE_SUBMIT,
      },
      {
        title: "Categories",
        href: "/expenses/categories",
        icon: FolderOpen,
        permission: PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS,
      },
      {
        title: "Unapproved Payments",
        href: "/expenses/unapproved-payments",
        icon: AlertTriangle,
        permission: PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS,
      },
    ],
  },
  {
    label: "Workflow",
    items: [
      {
        title: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        permission: null,
      },
    ],
  },
  {
    label: "Audit & Reports",
    items: [
      {
        title: "Audit Log",
        href: "/audit/log",
        icon: ScrollText,
        permission: PERMISSIONS.ADMIN_VIEW_AUDIT_LOG,
      },
      {
        title: "Fraud Flags",
        href: "/audit/fraud-flags",
        icon: ShieldAlert,
        permission: PERMISSIONS.ADMIN_VIEW_FRAUD_FLAGS,
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        permission: PERMISSIONS.REPORTING_BRANCH,
      },
    ],
  },
  {
    label: "Purchases",
    items: [
      {
        title: "All Purchases",
        href: "/purchases",
        icon: ShoppingCart,
        permission: PERMISSIONS.PURCHASE_VIEW,
      },
      {
        title: "Dues to Pay",
        href: "/purchases/dues",
        icon: AlertTriangle,
        permission: PERMISSIONS.PURCHASE_VIEW,
      },
      {
        title: "Suppliers",
        href: "/purchases/suppliers",
        icon: Users2,
        permission: PERMISSIONS.PURCHASE_VIEW,
      },
    ],
  },
  {
    label: "Transfers",
    items: [
      {
        title: "All Transfers",
        href: "/transfers",
        icon: ArrowLeftRight,
        permission: PERMISSIONS.TRANSFER_VIEW,
      },
      {
        title: "New Transfer",
        href: "/transfers/new",
        icon: Truck,
        permission: PERMISSIONS.TRANSFER_CREATE,
      },
    ],
  },
  {
    label: "Data Import",
    items: [
      {
        title: "Excel Import",
        href: "/import",
        icon: Upload,
        permission: PERMISSIONS.ADMIN_MANAGE_COMPANIES,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "Configuration",
        href: "/settings",
        icon: Settings,
        permission: PERMISSIONS.ADMIN_CONFIGURE_APPROVAL,
      },
      {
        title: "User Access Controls",
        href: "/settings/user-access",
        icon: UserCog,
        permission: PERMISSIONS.ADMIN_MANAGE_USERS,
      },
      {
        title: "API & Webhooks",
        href: "/settings/api-webhooks",
        icon: Webhook,
        permission: PERMISSIONS.ADMIN_MANAGE_COMPANIES,
      },
    ],
  },
];
