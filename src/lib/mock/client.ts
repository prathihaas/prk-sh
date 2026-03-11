/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock Supabase client for local development without a real Supabase instance.
// Returns realistic stub data for all queries and supports mutations.

import {
  mockUserProfile,
  mockCompanies,
  mockBranches,
  mockFinancialYears,
  mockUsers,
  mockRoles,
  mockCashbooks,
  mockCashbookDays,
  mockCashbookTransactions,
  mockInvoices,
  mockInvoicePayments,
  mockExpenses,
  mockExpenseCategories,
  mockEmployees,
  mockAttendancePeriods,
  mockAttendanceRecords,
  mockPayrollRuns,
  mockPayrollEntries,
  mockApprovalRequests,
  mockAuditLogs,
  mockFraudFlags,
  mockApprovalMatrix,
  mockCustomFields,
  mockCompanyConfigs,
  mockLeaveBalances,
  mockAssignments,
  MOCK_USER_ID,
} from "./data";

// Table data registry — mutable arrays so inserts/updates persist during session
const tables: Record<string, any[]> = {
  user_profiles: mockUsers,
  companies: mockCompanies,
  branches: mockBranches,
  financial_years: mockFinancialYears,
  roles: mockRoles,
  user_assignments: mockAssignments,
  cashbooks: mockCashbooks,
  cashbook_days: mockCashbookDays,
  cashbook_transactions: mockCashbookTransactions,
  invoices: mockInvoices,
  invoice_payments: mockInvoicePayments,
  expenses: mockExpenses,
  expense_categories: mockExpenseCategories,
  employees: mockEmployees,
  attendance_periods: mockAttendancePeriods,
  attendance_records: mockAttendanceRecords,
  payroll_runs: mockPayrollRuns,
  payroll_entries: mockPayrollEntries,
  approval_requests: mockApprovalRequests,
  approval_steps: [],
  audit_log: mockAuditLogs,
  fraud_flags: mockFraudFlags,
  approval_matrix: mockApprovalMatrix,
  custom_field_definitions: mockCustomFields,
  custom_field_values: [],
  company_configs: mockCompanyConfigs,
  leave_balances: mockLeaveBalances,
  transaction_revisions: [],
  receipt_number_series: [],
};

let autoIncrement = 1000;
function nextId() {
  autoIncrement++;
  return `mock-${autoIncrement}`;
}

// Build a chainable query builder that filters mock data
function createQueryBuilder(tableName: string) {
  let dataset = [...(tables[tableName] || [])];
  let isSingle = false;
  let isCount = false;
  let isHead = false;
  let sortField: string | null = null;
  let sortAsc = true;
  let limitN = 0;
  let pendingInsert: any = null;
  let pendingUpdate: any = null;
  let isDelete = false;

  const builder: any = {
    select(columns?: string, opts?: { count?: string; head?: boolean }) {
      if (opts?.head) isHead = true;
      if (opts?.count) isCount = true;
      return builder;
    },
    eq(col: string, val: any) {
      dataset = dataset.filter((row) => row[col] === val);
      return builder;
    },
    neq(col: string, val: any) {
      dataset = dataset.filter((row) => row[col] !== val);
      return builder;
    },
    in(col: string, vals: any[]) {
      dataset = dataset.filter((row) => vals.includes(row[col]));
      return builder;
    },
    gte(col: string, val: any) {
      dataset = dataset.filter((row) => row[col] >= val);
      return builder;
    },
    lte(col: string, val: any) {
      dataset = dataset.filter((row) => row[col] <= val);
      return builder;
    },
    like(col: string, val: string) {
      const pattern = val.replace(/%/g, ".*");
      const re = new RegExp(pattern, "i");
      dataset = dataset.filter((row) => re.test(String(row[col] || "")));
      return builder;
    },
    ilike(col: string, val: string) {
      return builder.like(col, val);
    },
    is(col: string, val: any) {
      dataset = dataset.filter((row) => row[col] === val);
      return builder;
    },
    or(expr: string) {
      // Basic OR support — parse patterns like "col.eq.val,col2.eq.val2"
      // Just return all data for now as a safe fallback
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      sortField = col;
      sortAsc = opts?.ascending !== false;
      return builder;
    },
    limit(n: number) {
      limitN = n;
      return builder;
    },
    single() {
      isSingle = true;
      return builder;
    },
    maybeSingle() {
      isSingle = true;
      return builder;
    },
    insert(data: any) {
      // Add to the in-memory table and return through .then()
      const rows = Array.isArray(data) ? data : [data];
      const inserted = rows.map((row) => ({
        id: row.id || nextId(),
        ...row,
        created_at: row.created_at || new Date().toISOString(),
      }));
      // Persist into the table array
      const tableArr = tables[tableName];
      if (tableArr) {
        inserted.forEach((r) => tableArr.push(r));
      }
      pendingInsert = inserted;
      return builder;
    },
    update(data: any) {
      // Apply update to matching rows in dataset (filtered by subsequent .eq calls)
      pendingUpdate = data;
      return builder;
    },
    upsert(data: any) {
      const rows = Array.isArray(data) ? data : [data];
      const tableArr = tables[tableName];
      if (tableArr) {
        rows.forEach((row) => {
          const idx = tableArr.findIndex((r) => r.id === row.id);
          if (idx >= 0) {
            Object.assign(tableArr[idx], row);
          } else {
            tableArr.push({ id: row.id || nextId(), ...row });
          }
        });
      }
      pendingInsert = rows;
      return builder;
    },
    delete() {
      isDelete = true;
      return builder;
    },
    // Terminal: resolve to { data, error, count }
    then(resolve: (val: any) => void) {
      // Handle insert
      if (pendingInsert) {
        return resolve({ data: pendingInsert, error: null });
      }

      // Handle update — apply to the source table
      if (pendingUpdate) {
        const tableArr = tables[tableName];
        if (tableArr) {
          dataset.forEach((matchedRow) => {
            const idx = tableArr.findIndex((r) => r.id === matchedRow.id);
            if (idx >= 0) {
              Object.assign(tableArr[idx], pendingUpdate);
            }
          });
        }
        return resolve({ data: dataset, error: null });
      }

      // Handle delete
      if (isDelete) {
        const tableArr = tables[tableName];
        if (tableArr) {
          const idsToDelete = new Set(dataset.map((r) => r.id));
          const remaining = tableArr.filter((r) => !idsToDelete.has(r.id));
          tables[tableName] = remaining;
        }
        return resolve({ data: dataset, error: null });
      }

      // Apply sort
      if (sortField) {
        const f = sortField;
        dataset.sort((a, b) => {
          const va = a[f];
          const vb = b[f];
          if (va < vb) return sortAsc ? -1 : 1;
          if (va > vb) return sortAsc ? 1 : -1;
          return 0;
        });
      }
      // Apply limit
      if (limitN > 0) dataset = dataset.slice(0, limitN);

      if (isHead && isCount) {
        return resolve({ data: null, error: null, count: dataset.length });
      }
      if (isSingle) {
        return resolve({ data: dataset[0] || null, error: null });
      }
      return resolve({ data: dataset, error: null, count: dataset.length });
    },
  };

  return builder;
}

// The mock Supabase client
export function createMockSupabaseClient() {
  return {
    auth: {
      getUser() {
        return Promise.resolve({
          data: {
            user: {
              id: MOCK_USER_ID,
              email: mockUserProfile.email,
              app_metadata: {},
              user_metadata: { full_name: mockUserProfile.full_name },
              aud: "authenticated",
              created_at: mockUserProfile.created_at,
            },
          },
          error: null,
        });
      },
      signInWithPassword({ email }: { email: string; password: string }) {
        void email;
        return Promise.resolve({ data: { user: { id: MOCK_USER_ID } }, error: null });
      },
      signOut() {
        return Promise.resolve({ error: null });
      },
      getSession() {
        return Promise.resolve({
          data: {
            session: {
              access_token: "mock-token",
              refresh_token: "mock-refresh",
              user: { id: MOCK_USER_ID, email: mockUserProfile.email },
            },
          },
          error: null,
        });
      },
    },
    from(table: string) {
      return createQueryBuilder(table);
    },
    rpc(fn: string, params?: any) {
      void fn;
      void params;
      return Promise.resolve({ data: null, error: null });
    },
  };
}
