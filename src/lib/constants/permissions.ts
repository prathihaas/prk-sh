// Permission strings in format "module:action"
// These match the seed data in migration 015

export const PERMISSIONS = {
  // Cashbook
  CASHBOOK_CREATE: "cashbook:create",
  CASHBOOK_READ: "cashbook:read",
  CASHBOOK_READ_ALL: "cashbook:read_all_company",
  CASHBOOK_CREATE_TXN: "cashbook:create_transaction",
  CASHBOOK_VOID_TXN: "cashbook:void_transaction",
  CASHBOOK_CLOSE_DAY: "cashbook:close_day",
  CASHBOOK_REOPEN_DAY: "cashbook:reopen_day",
  CASHBOOK_APPROVE_VARIANCE: "cashbook:approve_variance",

  // Customer
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_READ: "customer:read",
  CUSTOMER_UPDATE: "customer:update",

  // Invoice
  INVOICE_CREATE: "invoice:create",
  INVOICE_READ: "invoice:read",
  INVOICE_APPROVE_ACCOUNTS: "invoice:approve_accounts",
  INVOICE_APPROVE_MANAGER: "invoice:approve_manager",
  INVOICE_ALLOW_DELIVERY: "invoice:allow_delivery",
  INVOICE_CANCEL: "invoice:cancel",

  // Expense
  EXPENSE_SUBMIT: "expense:submit",
  EXPENSE_PAY_DIRECT: "expense:pay_direct",
  EXPENSE_APPROVE_BRANCH: "expense:approve_branch",
  EXPENSE_APPROVE_ACCOUNTS: "expense:approve_accounts",
  EXPENSE_APPROVE_OWNER: "expense:approve_owner",

  // HR
  HR_MANAGE_EMPLOYEES: "hr:manage_employees",
  HR_MARK_ATTENDANCE: "hr:mark_attendance",
  HR_CLOSE_ATTENDANCE: "hr:close_attendance",
  HR_VIEW_OWN_PAYSLIP: "hr:view_own_payslip",

  // Payroll
  PAYROLL_PROCESS: "payroll:process",
  PAYROLL_LOCK: "payroll:lock",
  PAYROLL_REOPEN: "payroll:reopen",
  PAYROLL_EXPORT: "payroll:export",

  // Admin
  ADMIN_MANAGE_COMPANIES: "admin:manage_companies",
  ADMIN_MANAGE_BRANCHES: "admin:manage_branches",
  ADMIN_MANAGE_USERS: "admin:manage_users",
  ADMIN_MANAGE_CUSTOM_FIELDS: "admin:manage_custom_fields",
  ADMIN_VIEW_AUDIT_LOG: "admin:view_audit_log",
  ADMIN_VIEW_FRAUD_FLAGS: "admin:view_fraud_flags",
  ADMIN_LOCK_FY: "admin:lock_financial_year",
  ADMIN_CONFIGURE_APPROVAL: "admin:configure_approval_matrix",

  // Receipt
  RECEIPT_BACKDATE: "receipt:backdate",
  RECEIPT_DELETE: "receipt:delete",

  // Bank
  BANK_READ: "bank:read",
  BANK_CREATE: "bank:create",
  BANK_CLOSE: "bank:close",
  BANK_REOPEN: "bank:reopen",

  // Reporting
  REPORTING_GROUP: "reporting:group_reports",
  REPORTING_COMPANY: "reporting:company_reports",
  REPORTING_BRANCH: "reporting:branch_reports",

  // Purchases
  PURCHASE_VIEW: "purchase:view",
  PURCHASE_CREATE: "purchase:create",
  PURCHASE_IMPORT: "purchase:import",

  // Transfers (branch goods transfers)
  TRANSFER_VIEW: "transfer:view",
  TRANSFER_CREATE: "transfer:create",
  TRANSFER_RECEIVE: "transfer:receive",
  TRANSFER_CHALLAN: "transfer:challan",

  // Cashbook Transfers (internal money transfers between cashbooks)
  CASHBOOK_TRANSFER_CREATE: "cashbook_transfer:create",
  CASHBOOK_TRANSFER_VIEW: "cashbook_transfer:view",
  CASHBOOK_TRANSFER_APPROVE: "cashbook_transfer:approve",
} as const;
