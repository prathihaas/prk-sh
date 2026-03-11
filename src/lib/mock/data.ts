// Mock data for local development without Supabase
// This file provides realistic stub data for all modules

export const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";
export const MOCK_GROUP_ID = "00000000-0000-0000-0000-100000000001";
export const MOCK_COMPANY_ID = "00000000-0000-0000-0000-200000000001";
export const MOCK_COMPANY_2_ID = "00000000-0000-0000-0000-200000000002";
export const MOCK_BRANCH_ID = "00000000-0000-0000-0000-300000000001";
export const MOCK_BRANCH_2_ID = "00000000-0000-0000-0000-300000000002";
export const MOCK_BRANCH_3_ID = "00000000-0000-0000-0000-300000000003";
export const MOCK_FY_ID = "00000000-0000-0000-0000-400000000001";
export const MOCK_ROLE_ID = "00000000-0000-0000-0000-500000000001";

// ─── User Profile ─────────────────────────────
export const mockUserProfile = {
  id: MOCK_USER_ID,
  email: "admin@prk.sh",
  full_name: "Pratham Admin",
  phone: "+91 98765 43210",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

// ─── Roles ────────────────────────────────────
export const mockRoles = [
  { id: MOCK_ROLE_ID, name: "Group Owner", description: "Full system access", hierarchy_level: 1 },
  { id: "00000000-0000-0000-0000-500000000002", name: "Company Admin", description: "Company-level admin", hierarchy_level: 2 },
  { id: "00000000-0000-0000-0000-500000000003", name: "Branch Manager", description: "Branch-level management", hierarchy_level: 3 },
  { id: "00000000-0000-0000-0000-500000000004", name: "Accountant", description: "Financial operations", hierarchy_level: 4 },
  { id: "00000000-0000-0000-0000-500000000005", name: "Cashier", description: "Cash handling", hierarchy_level: 5 },
  { id: "00000000-0000-0000-0000-500000000006", name: "HR Manager", description: "HR operations", hierarchy_level: 4 },
];

// ─── User Assignments ─────────────────────────
export const mockAssignments = [
  {
    id: "00000000-0000-0000-0000-600000000001",
    user_id: MOCK_USER_ID,
    role_id: MOCK_ROLE_ID,
    group_id: MOCK_GROUP_ID,
    company_id: null, // wildcard — access to all
    branch_id: null,
    is_active: true,
    assigned_at: "2025-01-01T00:00:00Z",
    role: mockRoles[0],
  },
];

// ─── All Permissions (Group Owner gets everything) ────
export const mockPermissions = [
  "cashbook:create", "cashbook:read", "cashbook:read_all_company",
  "cashbook:create_transaction", "cashbook:void_transaction",
  "cashbook:close_day", "cashbook:reopen_day", "cashbook:approve_variance",
  "invoice:create", "invoice:read", "invoice:approve_accounts",
  "invoice:approve_manager", "invoice:allow_delivery", "invoice:cancel",
  "expense:submit", "expense:approve_branch", "expense:approve_accounts", "expense:approve_owner",
  "hr:manage_employees", "hr:mark_attendance", "hr:close_attendance", "hr:view_own_payslip",
  "payroll:process", "payroll:lock", "payroll:reopen", "payroll:export",
  "admin:manage_companies", "admin:manage_branches", "admin:manage_users",
  "admin:manage_custom_fields", "admin:view_audit_log", "admin:view_fraud_flags",
  "admin:lock_financial_year", "admin:configure_approval_matrix",
  "reporting:group_reports", "reporting:company_reports", "reporting:branch_reports",
];

// ─── Organizations ────────────────────────────
export const mockCompanies = [
  { id: MOCK_COMPANY_ID, name: "Prk Motors Pvt Ltd", code: "PRKMOT", group_id: MOCK_GROUP_ID, is_active: true, gst_number: "29AABCP1234H1Z5", pan_number: "AABCP1234H", address: "MG Road, Bangalore", created_at: "2025-01-01T00:00:00Z" },
  { id: MOCK_COMPANY_2_ID, name: "Prk Agri Solutions", code: "PRKAGR", group_id: MOCK_GROUP_ID, is_active: true, gst_number: "29AABCP5678K2Z3", pan_number: "AABCP5678K", address: "Hubli, Karnataka", created_at: "2025-01-01T00:00:00Z" },
];

export const mockBranches = [
  { id: MOCK_BRANCH_ID, name: "MG Road Showroom", code: "MGRD", company_id: MOCK_COMPANY_ID, is_active: true, address: "100 MG Road, Bangalore 560001", phone: "+91 80 1234 5678", created_at: "2025-01-01T00:00:00Z" },
  { id: MOCK_BRANCH_2_ID, name: "Whitefield Service Center", code: "WTFD", company_id: MOCK_COMPANY_ID, is_active: true, address: "50 ITPL Road, Whitefield 560066", phone: "+91 80 9876 5432", created_at: "2025-01-01T00:00:00Z" },
  { id: MOCK_BRANCH_3_ID, name: "Hubli Tractor Depot", code: "HBTD", company_id: MOCK_COMPANY_2_ID, is_active: true, address: "Station Road, Hubli 580020", phone: "+91 836 234 5678", created_at: "2025-01-01T00:00:00Z" },
];

export const mockFinancialYears = [
  { id: MOCK_FY_ID, company_id: MOCK_COMPANY_ID, label: "FY 2025-26", start_date: "2025-04-01", end_date: "2026-03-31", is_active: true, is_locked: false, created_at: "2025-04-01T00:00:00Z" },
  { id: "00000000-0000-0000-0000-400000000002", company_id: MOCK_COMPANY_ID, label: "FY 2024-25", start_date: "2024-04-01", end_date: "2025-03-31", is_active: false, is_locked: true, created_at: "2024-04-01T00:00:00Z" },
];

// ─── Users ────────────────────────────────────
export const mockUsers = [
  { ...mockUserProfile, user_assignments: mockAssignments },
  { id: "00000000-0000-0000-0000-000000000002", email: "manager@prk.sh", full_name: "Ravi Kumar", phone: "+91 98765 11111", is_active: true, created_at: "2025-02-01T00:00:00Z", updated_at: "2025-02-01T00:00:00Z" },
  { id: "00000000-0000-0000-0000-000000000003", email: "cashier@prk.sh", full_name: "Meena S", phone: "+91 98765 22222", is_active: true, created_at: "2025-02-15T00:00:00Z", updated_at: "2025-02-15T00:00:00Z" },
  { id: "00000000-0000-0000-0000-000000000004", email: "hr@prk.sh", full_name: "Suresh Rao", phone: "+91 98765 33333", is_active: true, created_at: "2025-03-01T00:00:00Z", updated_at: "2025-03-01T00:00:00Z" },
];

// ─── Cashbooks ────────────────────────────────
export const mockCashbooks = [
  { id: "cb-001", name: "Main Cash Counter", type: "cash", cashbook_type: "cash", opening_balance: 50000, company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, is_active: true, created_at: "2025-04-01T00:00:00Z" },
  { id: "cb-002", name: "Petty Cash", type: "petty_cash", cashbook_type: "petty_cash", opening_balance: 5000, company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, is_active: true, created_at: "2025-04-01T00:00:00Z" },
  { id: "cb-003", name: "Bank - HDFC Current", type: "bank", cashbook_type: "bank", opening_balance: 500000, company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, is_active: true, created_at: "2025-04-01T00:00:00Z" },
];

// Helper: today's date in YYYY-MM-DD format for mock open day
const MOCK_TODAY = new Date().toISOString().split("T")[0];

export const mockCashbookDays = [
  { id: "cbd-001", cashbook_id: "cb-001", date: "2025-12-20", opening_balance: 50000, system_closing: 73500, closing_balance: 73500, physical_count: 73500, total_receipts: 35000, total_payments: 11500, variance: 0, status: "closed", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, closed_by: MOCK_USER_ID, closed_at: "2025-12-20T18:00:00Z", cashbook: { name: "Main Cash Counter" } },
  { id: "cbd-002", cashbook_id: "cb-001", date: "2025-12-21", opening_balance: 73500, system_closing: 87500, closing_balance: null, physical_count: null, total_receipts: 22000, total_payments: 8000, variance: null, status: "open", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, closed_by: null, closed_at: null, cashbook: { name: "Main Cash Counter" } },
  { id: "cbd-003", cashbook_id: "cb-002", date: "2025-12-20", opening_balance: 5000, system_closing: 3200, closing_balance: 3200, physical_count: 3200, total_receipts: 0, total_payments: 1800, variance: 0, status: "closed", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, closed_by: MOCK_USER_ID, closed_at: "2025-12-20T17:30:00Z", cashbook: { name: "Petty Cash" } },
  // Today's open day — so new receipts / expense payments can be created for today
  { id: "cbd-004", cashbook_id: "cb-001", date: MOCK_TODAY, opening_balance: 87500, system_closing: 87500, closing_balance: null, physical_count: null, total_receipts: 0, total_payments: 0, variance: null, status: "open", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, closed_by: null, closed_at: null, cashbook: { name: "Main Cash Counter" } },
  { id: "cbd-005", cashbook_id: "cb-002", date: MOCK_TODAY, opening_balance: 3200, system_closing: 3200, closing_balance: null, physical_count: null, total_receipts: 0, total_payments: 0, variance: null, status: "open", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, closed_by: null, closed_at: null, cashbook: { name: "Petty Cash" } },
];

export const mockCashbookTransactions = [
  { id: "cbt-001", cashbook_id: "cb-001", cashbook_day_id: "cbd-002", txn_type: "receipt", type: "receipt", amount: 15000, running_balance: 88500, narration: "Vehicle service payment - KA01AB1234", receipt_number: "RCP-2025-001", receipt_hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2", voucher_number: "V-001", party_name: "Rajesh Sharma", payment_mode: "cash", is_voided: false, status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_by: MOCK_USER_ID, created_at: "2025-12-21T10:30:00Z" },
  { id: "cbt-002", cashbook_id: "cb-001", cashbook_day_id: "cbd-002", txn_type: "receipt", type: "receipt", amount: 7000, running_balance: 95500, narration: "Spare parts sale - oil filters and brake pads", receipt_number: "RCP-2025-002", receipt_hash: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3", voucher_number: "V-002", party_name: "Kiran Auto Parts", payment_mode: "cash", is_voided: false, status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_by: MOCK_USER_ID, created_at: "2025-12-21T11:45:00Z" },
  { id: "cbt-003", cashbook_id: "cb-001", cashbook_day_id: "cbd-002", txn_type: "payment", type: "payment", amount: 4500, running_balance: 91000, narration: "Expense Payment: Office Supplies - Printer cartridges and paper", receipt_number: "PAY-2025-001", receipt_hash: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4", voucher_number: "V-003", party_name: "Office Supplies", payment_mode: "cash", is_voided: false, status: "active", source_type: "expense", source_id: "exp-001", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_by: MOCK_USER_ID, created_at: "2025-12-21T14:00:00Z" },
  { id: "cbt-004", cashbook_id: "cb-001", cashbook_day_id: "cbd-002", txn_type: "payment", type: "payment", amount: 3000, running_balance: 87500, narration: "Staff advance - Ravi", receipt_number: "PAY-2025-002", receipt_hash: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5", voucher_number: "V-004", party_name: "Ravi Kumar", payment_mode: "cash", is_voided: false, status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_by: MOCK_USER_ID, created_at: "2025-12-21T15:30:00Z" },
  { id: "cbt-005", cashbook_id: "cb-001", cashbook_day_id: "cbd-001", txn_type: "receipt", type: "receipt", amount: 25000, running_balance: 75000, narration: "Tractor annual servicing - KA25CD5678", receipt_number: "RCP-2025-003", receipt_hash: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6", voucher_number: "V-005", party_name: "Mahesh Kumar", payment_mode: "upi", is_voided: false, status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_by: MOCK_USER_ID, created_at: "2025-12-20T11:00:00Z" },
  { id: "cbt-006", cashbook_id: "cb-003", cashbook_day_id: "cbd-002", txn_type: "receipt", type: "receipt", amount: 50000, running_balance: 550000, narration: "Insurance claim settlement - Claim #IC-2025-789", receipt_number: "RCP-2025-004", receipt_hash: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7", voucher_number: "V-006", party_name: "United India Insurance", payment_mode: "bank_transfer", is_voided: false, status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_by: MOCK_USER_ID, created_at: "2025-12-21T09:15:00Z" },
  { id: "cbt-007", cashbook_id: "cb-001", cashbook_day_id: "cbd-001", txn_type: "receipt", type: "receipt", amount: 3500, running_balance: 53500, narration: "Battery replacement - Maruti Alto", receipt_number: "RCP-2025-005", receipt_hash: "a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8", voucher_number: "V-007", party_name: "Priya Desai", payment_mode: "card", is_voided: true, void_reason: "Duplicate entry - customer paid via UPI instead", voided_at: "2025-12-20T16:00:00Z", voided_by: MOCK_USER_ID, status: "voided", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_by: MOCK_USER_ID, created_at: "2025-12-20T14:30:00Z" },
];

// ─── Invoices ─────────────────────────────────
export const mockInvoices = [
  { id: "inv-001", invoice_number: "INV-2025-001", dms_invoice_number: "DMS-001", invoice_type: "vehicle_sale", customer_name: "Suresh Motors", customer_gstin: "29AABCS1234M1Z2", invoice_date: "2025-12-15", due_date: "2026-01-15", subtotal: 250000, discount_amount: 5000, tax_amount: 44100, total_amount: 289100, grand_total: 289100, amount_paid: 100000, balance_due: 189100, status: "approved", approval_status: "approved", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2025-12-15T00:00:00Z" },
  { id: "inv-002", invoice_number: "INV-2025-002", dms_invoice_number: "DMS-002", invoice_type: "spare_parts", customer_name: "Anjali Enterprises", customer_gstin: "29AABCA5678N2Z4", invoice_date: "2025-12-18", due_date: "2026-01-18", subtotal: 75000, discount_amount: 0, tax_amount: 13500, total_amount: 88500, grand_total: 88500, amount_paid: 88500, balance_due: 0, status: "paid", approval_status: "approved", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2025-12-18T00:00:00Z" },
  { id: "inv-003", invoice_number: "INV-2025-003", dms_invoice_number: "DMS-003", invoice_type: "service", customer_name: "Farm Fresh Co", customer_gstin: null, invoice_date: "2025-12-20", due_date: "2026-01-20", subtotal: 120000, discount_amount: 2000, tax_amount: 21240, total_amount: 139240, grand_total: 139240, amount_paid: 0, balance_due: 139240, status: "draft", approval_status: "pending", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2025-12-20T00:00:00Z" },
];

export const mockInvoicePayments = [
  { id: "ip-001", invoice_id: "inv-001", amount: 100000, payment_date: "2025-12-20", payment_mode: "bank_transfer", reference_number: "NEFT12345", notes: "Partial payment", created_at: "2025-12-20T00:00:00Z" },
  { id: "ip-002", invoice_id: "inv-002", amount: 88500, payment_date: "2025-12-19", payment_mode: "cheque", reference_number: "CHQ-78901", notes: "Full payment", created_at: "2025-12-19T00:00:00Z" },
];

// ─── Expenses ─────────────────────────────────
export const mockExpenseCategories = [
  { id: "ec-001", name: "Office Supplies", description: "Stationery and office items", company_id: MOCK_COMPANY_ID, is_active: true },
  { id: "ec-002", name: "Travel & Conveyance", description: "Employee travel expenses", company_id: MOCK_COMPANY_ID, is_active: true },
  { id: "ec-003", name: "Repairs & Maintenance", description: "Equipment and facility repairs", company_id: MOCK_COMPANY_ID, is_active: true },
  { id: "ec-004", name: "Utilities", description: "Electricity, water, internet", company_id: MOCK_COMPANY_ID, is_active: true },
];

export const mockExpenses = [
  { id: "exp-001", category_id: "ec-001", expense_date: "2025-12-18", amount: 4500, description: "Printer cartridges and paper", bill_reference: "BILL-1234", approval_status: "owner_approved", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, submitted_by: MOCK_USER_ID, category: { name: "Office Supplies" }, payment_date: "2025-12-21", paid_via_cashbook_id: "cb-001", payment_mode: "cash", paid_by: MOCK_USER_ID, created_at: "2025-12-18T00:00:00Z" },
  { id: "exp-002", category_id: "ec-002", expense_date: "2025-12-19", amount: 12000, description: "Client visit travel - Mumbai round trip", bill_reference: "BILL-1235", approval_status: "submitted", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, submitted_by: "00000000-0000-0000-0000-000000000002", category: { name: "Travel & Conveyance" }, payment_date: null, paid_via_cashbook_id: null, payment_mode: null, paid_by: null, created_at: "2025-12-19T00:00:00Z" },
  { id: "exp-003", category_id: "ec-003", expense_date: "2025-12-20", amount: 8500, description: "AC compressor repair - showroom", bill_reference: "BILL-1236", approval_status: "branch_approved", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, submitted_by: "00000000-0000-0000-0000-000000000003", category: { name: "Repairs & Maintenance" }, payment_date: null, paid_via_cashbook_id: null, payment_mode: null, paid_by: null, created_at: "2025-12-20T00:00:00Z" },
  { id: "exp-004", category_id: "ec-004", expense_date: "2025-12-20", amount: 15200, description: "Monthly electricity bill - December", bill_reference: "EB-DEC-2025", approval_status: "draft", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, submitted_by: MOCK_USER_ID, category: { name: "Utilities" }, payment_date: null, paid_via_cashbook_id: null, payment_mode: null, paid_by: null, created_at: "2025-12-20T00:00:00Z" },
  // Fully approved and unpaid — ready to pay via cashbook
  { id: "exp-005", category_id: "ec-003", expense_date: "2025-12-21", amount: 6000, description: "Generator diesel refill", bill_reference: "BILL-1240", approval_status: "owner_approved", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, submitted_by: MOCK_USER_ID, category: { name: "Repairs & Maintenance" }, payment_date: null, paid_via_cashbook_id: null, payment_mode: null, paid_by: null, created_at: "2025-12-21T00:00:00Z" },
];

// ─── Employees ────────────────────────────────
export const mockEmployees = [
  { id: "emp-001", employee_code: "PRK-001", full_name: "Ramesh Babu", email: "ramesh@prk.sh", phone: "+91 98765 44444", designation: "Senior Mechanic", department: "Service", date_of_joining: "2020-01-15", basic_salary: 25000, hra: 10000, da: 5000, other_allowances: 3000, pf_number: "KA/BLR/12345", esi_number: "5100012345", pan_number: "ABCDR1234E", aadhar_number: "1234 5678 9012", bank_name: "HDFC Bank", bank_account_number: "50100123456789", bank_ifsc: "HDFC0001234", status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2020-01-15T00:00:00Z" },
  { id: "emp-002", employee_code: "PRK-002", full_name: "Lakshmi Devi", email: "lakshmi@prk.sh", phone: "+91 98765 55555", designation: "Receptionist", department: "Front Office", date_of_joining: "2021-06-01", basic_salary: 18000, hra: 7200, da: 3600, other_allowances: 2000, pf_number: "KA/BLR/12346", esi_number: "5100012346", pan_number: "ABCDL5678F", aadhar_number: "2345 6789 0123", bank_name: "SBI", bank_account_number: "30100987654321", bank_ifsc: "SBIN0001234", status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2021-06-01T00:00:00Z" },
  { id: "emp-003", employee_code: "PRK-003", full_name: "Venkatesh Prasad", email: "venky@prk.sh", phone: "+91 98765 66666", designation: "Sales Executive", department: "Sales", date_of_joining: "2022-03-10", basic_salary: 22000, hra: 8800, da: 4400, other_allowances: 5000, pf_number: "KA/BLR/12347", esi_number: "5100012347", pan_number: "ABCDV9012G", aadhar_number: "3456 7890 1234", bank_name: "ICICI Bank", bank_account_number: "10100567890123", bank_ifsc: "ICIC0001234", status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2022-03-10T00:00:00Z" },
  { id: "emp-004", employee_code: "PRK-004", full_name: "Savitha M", email: "savitha@prk.sh", phone: "+91 98765 77777", designation: "Accounts Clerk", department: "Accounts", date_of_joining: "2023-08-20", basic_salary: 20000, hra: 8000, da: 4000, other_allowances: 2500, pf_number: "KA/BLR/12348", esi_number: "5100012348", pan_number: "ABCDS3456H", aadhar_number: "4567 8901 2345", bank_name: "Axis Bank", bank_account_number: "91700234567890", bank_ifsc: "UTIB0001234", status: "active", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2023-08-20T00:00:00Z" },
];

// ─── Attendance ───────────────────────────────
export const mockAttendancePeriods = [
  { id: "ap-001", month: 12, year: 2025, status: "open", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2025-12-01T00:00:00Z" },
  { id: "ap-002", month: 11, year: 2025, status: "closed", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2025-11-01T00:00:00Z" },
];

export const mockAttendanceRecords = [
  { id: "ar-001", period_id: "ap-001", employee_id: "emp-001", date: "2025-12-01", status: "present" },
  { id: "ar-002", period_id: "ap-001", employee_id: "emp-001", date: "2025-12-02", status: "present" },
  { id: "ar-003", period_id: "ap-001", employee_id: "emp-001", date: "2025-12-03", status: "absent" },
  { id: "ar-004", period_id: "ap-001", employee_id: "emp-002", date: "2025-12-01", status: "present" },
  { id: "ar-005", period_id: "ap-001", employee_id: "emp-002", date: "2025-12-02", status: "half_day" },
];

// ─── Payroll ──────────────────────────────────
export const mockPayrollRuns = [
  { id: "pr-001", month: 11, year: 2025, total_gross: 286200, total_deductions: 42930, total_net: 243270, status: "locked", employee_count: 4, company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2025-12-05T00:00:00Z" },
  { id: "pr-002", month: 12, year: 2025, total_gross: 286200, total_deductions: 42930, total_net: 243270, status: "draft", employee_count: 4, company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, created_at: "2025-12-28T00:00:00Z" },
];

export const mockPayrollEntries = [
  { id: "pe-001", run_id: "pr-001", employee_id: "emp-001", basic_salary: 25000, hra: 10000, da: 5000, other_allowances: 3000, gross_salary: 43000, pf_deduction: 3000, esi_deduction: 322, pt_deduction: 200, other_deductions: 0, total_deductions: 3522, net_salary: 39478, employee: { full_name: "Ramesh Babu", employee_code: "PRK-001" } },
  { id: "pe-002", run_id: "pr-001", employee_id: "emp-002", basic_salary: 18000, hra: 7200, da: 3600, other_allowances: 2000, gross_salary: 30800, pf_deduction: 2160, esi_deduction: 231, pt_deduction: 200, other_deductions: 0, total_deductions: 2591, net_salary: 28209, employee: { full_name: "Lakshmi Devi", employee_code: "PRK-002" } },
  { id: "pe-003", run_id: "pr-001", employee_id: "emp-003", basic_salary: 22000, hra: 8800, da: 4400, other_allowances: 5000, gross_salary: 40200, pf_deduction: 2640, esi_deduction: 301, pt_deduction: 200, other_deductions: 0, total_deductions: 3141, net_salary: 37059, employee: { full_name: "Venkatesh Prasad", employee_code: "PRK-003" } },
  { id: "pe-004", run_id: "pr-001", employee_id: "emp-004", basic_salary: 20000, hra: 8000, da: 4000, other_allowances: 2500, gross_salary: 34500, pf_deduction: 2400, esi_deduction: 258, pt_deduction: 200, other_deductions: 0, total_deductions: 2858, net_salary: 31642, employee: { full_name: "Savitha M", employee_code: "PRK-004" } },
];

// ─── Approval Requests ────────────────────────
export const mockApprovalRequests = [
  { id: "ar-req-001", request_type: "expense", reference_id: "exp-002", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, requested_by: "00000000-0000-0000-0000-000000000002", current_step: 1, overall_status: "pending", created_at: "2025-12-19T10:00:00Z", steps: [
    { id: "as-001", request_id: "ar-req-001", step_order: 1, approver_role_id: MOCK_ROLE_ID, assigned_to: null, status: "pending", comments: null, acted_at: null, approver: null },
    { id: "as-002", request_id: "ar-req-001", step_order: 2, approver_role_id: "00000000-0000-0000-0000-500000000002", assigned_to: null, status: "pending", comments: null, acted_at: null, approver: null },
  ]},
  { id: "ar-req-002", request_type: "expense", reference_id: "exp-001", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, requested_by: MOCK_USER_ID, current_step: 3, overall_status: "approved", created_at: "2025-12-18T09:00:00Z", steps: [
    { id: "as-003", request_id: "ar-req-002", step_order: 1, approver_role_id: "00000000-0000-0000-0000-500000000003", assigned_to: "00000000-0000-0000-0000-000000000002", status: "approved", comments: "Looks good", acted_at: "2025-12-18T10:00:00Z", approver: { full_name: "Ravi Kumar" } },
    { id: "as-004", request_id: "ar-req-002", step_order: 2, approver_role_id: "00000000-0000-0000-0000-500000000002", assigned_to: MOCK_USER_ID, status: "approved", comments: "Approved", acted_at: "2025-12-18T11:00:00Z", approver: { full_name: "Pratham Admin" } },
  ]},
];

// ─── Audit Log ────────────────────────────────
export const mockAuditLogs = [
  { id: "al-001", table_name: "cashbook_transactions", record_id: "cbt-001", action: "INSERT", old_data: null, new_data: { amount: 15000, type: "receipt" }, changed_by: MOCK_USER_ID, company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, ip_address: "192.168.1.100", created_at: "2025-12-21T10:30:00Z", actor: { full_name: "Pratham Admin" } },
  { id: "al-002", table_name: "expenses", record_id: "exp-002", action: "UPDATE", old_data: { approval_status: "draft" }, new_data: { approval_status: "submitted" }, changed_by: "00000000-0000-0000-0000-000000000002", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, ip_address: "192.168.1.101", created_at: "2025-12-19T10:00:00Z", actor: { full_name: "Ravi Kumar" } },
  { id: "al-003", table_name: "employees", record_id: "emp-004", action: "INSERT", old_data: null, new_data: { full_name: "Savitha M", designation: "Accounts Clerk" }, changed_by: "00000000-0000-0000-0000-000000000004", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, ip_address: "192.168.1.102", created_at: "2023-08-20T09:00:00Z", actor: { full_name: "Suresh Rao" } },
  { id: "al-004", table_name: "invoices", record_id: "inv-001", action: "INSERT", old_data: null, new_data: { invoice_number: "INV-2025-001", total_amount: 289100 }, changed_by: MOCK_USER_ID, company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, ip_address: "192.168.1.100", created_at: "2025-12-15T14:00:00Z", actor: { full_name: "Pratham Admin" } },
];

// ─── Fraud Flags ──────────────────────────────
export const mockFraudFlags = [
  { id: "ff-001", flag_type: "unusual_amount", severity: "high", description: "Transaction amount 15,000 exceeds daily average of 5,000 by 200%", table_name: "cashbook_transactions", record_id: "cbt-001", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, flagged_by: "system", resolution_status: "open", resolved_by: null, resolution_notes: null, flagged_at: "2025-12-21T10:31:00Z", resolved_at: null, flagged_by_user: { full_name: "System" } },
  { id: "ff-002", flag_type: "after_hours_activity", severity: "medium", description: "Cashbook transaction created outside business hours (22:45 IST)", table_name: "cashbook_transactions", record_id: "cbt-003", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, flagged_by: "system", resolution_status: "resolved", resolved_by: MOCK_USER_ID, resolution_notes: "Verified - manager was doing month-end reconciliation", flagged_at: "2025-12-20T22:46:00Z", resolved_at: "2025-12-21T09:00:00Z", flagged_by_user: { full_name: "System" }, resolved_by_user: { full_name: "Pratham Admin" } },
  { id: "ff-003", flag_type: "duplicate_entry", severity: "critical", description: "Possible duplicate invoice - same customer, same amount within 24 hours", table_name: "invoices", record_id: "inv-003", company_id: MOCK_COMPANY_ID, branch_id: MOCK_BRANCH_ID, flagged_by: "system", resolution_status: "investigating", resolved_by: null, resolution_notes: null, flagged_at: "2025-12-20T12:00:00Z", resolved_at: null, flagged_by_user: { full_name: "System" } },
];

// ─── Approval Matrix ─────────────────────────
export const mockApprovalMatrix = [
  { id: "am-001", company_id: MOCK_COMPANY_ID, request_type: "expense", step_order: 1, approver_role_id: "00000000-0000-0000-0000-500000000003", is_active: true, created_at: "2025-01-01T00:00:00Z", role: { name: "Branch Manager" } },
  { id: "am-002", company_id: MOCK_COMPANY_ID, request_type: "expense", step_order: 2, approver_role_id: "00000000-0000-0000-0000-500000000004", is_active: true, created_at: "2025-01-01T00:00:00Z", role: { name: "Accountant" } },
  { id: "am-003", company_id: MOCK_COMPANY_ID, request_type: "expense", step_order: 3, approver_role_id: MOCK_ROLE_ID, is_active: true, created_at: "2025-01-01T00:00:00Z", role: { name: "Group Owner" } },
  { id: "am-004", company_id: MOCK_COMPANY_ID, request_type: "invoice", step_order: 1, approver_role_id: "00000000-0000-0000-0000-500000000004", is_active: true, created_at: "2025-01-01T00:00:00Z", role: { name: "Accountant" } },
];

// ─── Custom Fields ────────────────────────────
export const mockCustomFields = [
  { id: "cf-001", company_id: MOCK_COMPANY_ID, table_name: "employees", field_name: "Blood Group", field_type: "select", field_options: { options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] }, is_required: false, is_active: true, display_order: 1 },
  { id: "cf-002", company_id: MOCK_COMPANY_ID, table_name: "expenses", field_name: "Project Code", field_type: "text", field_options: null, is_required: false, is_active: true, display_order: 1 },
  { id: "cf-003", company_id: MOCK_COMPANY_ID, table_name: "invoices", field_name: "Delivery Note Number", field_type: "text", field_options: null, is_required: true, is_active: true, display_order: 1 },
];

// ─── Company Configs ─────────────────────────
export const mockCompanyConfigs = [
  { id: "cc-001", company_id: MOCK_COMPANY_ID, config_key: "default_currency", config_value: "INR", updated_at: "2025-01-01T00:00:00Z" },
  { id: "cc-002", company_id: MOCK_COMPANY_ID, config_key: "fiscal_year_start_month", config_value: 4, updated_at: "2025-01-01T00:00:00Z" },
  { id: "cc-003", company_id: MOCK_COMPANY_ID, config_key: "auto_approve_expenses_below", config_value: 1000, updated_at: "2025-01-01T00:00:00Z" },
];

// ─── Leave Balances ───────────────────────────
export const mockLeaveBalances = [
  { id: "lb-001", employee_id: "emp-001", financial_year_id: MOCK_FY_ID, leave_type: "earned_leave", opening_balance: 15, earned: 2, used: 3, leave_balance: 14 },
  { id: "lb-002", employee_id: "emp-001", financial_year_id: MOCK_FY_ID, leave_type: "sick_leave", opening_balance: 7, earned: 0, used: 1, leave_balance: 6 },
  { id: "lb-003", employee_id: "emp-001", financial_year_id: MOCK_FY_ID, leave_type: "casual_leave", opening_balance: 10, earned: 0, used: 4, leave_balance: 6 },
];
