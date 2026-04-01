# Enterprise Financial Control & HR Platform — System Architecture

## Document Version: 1.0
## Classification: Internal — Architecture Specification

---

## TABLE OF CONTENTS

1. System Overview & Design Principles
2. Organizational Hierarchy & Data Isolation
3. Database Schema Design
4. Role-Permission Matrix & RLS Strategy
5. Financial Modules
6. Invoice Recording Module
7. Custom Field Engine
8. HR Module
9. Workflow & Approval Engine
10. Fraud Control & Immutable Audit System
11. Locking Mechanisms
12. Fraud Detection & Flagging
13. Configurability System
14. Scalability Considerations

---

## 1. SYSTEM OVERVIEW & DESIGN PRINCIPLES

### Core Principles

| Principle | Implementation |
|-----------|---------------|
| Zero Trust | Every query filtered by tenant context via RLS |
| Immutability | Financial records append-only; no physical deletes |
| Auditability | Every state change recorded with user, timestamp, IP, reason |
| Isolation | Company data isolated at database level, not application level |
| Least Privilege | Users get minimum permissions required for their role |
| Defense in Depth | Application logic + DB constraints + RLS + triggers |

### Technology Stack

- **Database**: PostgreSQL 15+ (via Supabase)
- **Row-Level Security**: PostgreSQL RLS policies
- **Authentication**: Supabase Auth (JWT-based)
- **Audit**: PostgreSQL trigger functions
- **Hashing**: pgcrypto for receipt verification hashes

---

## 2. ORGANIZATIONAL HIERARCHY & DATA ISOLATION

### Hierarchy Model

```
Group (Tenant Root)
  └── Company (1..N)
        └── Branch (1..N)
              ├── Cashbook (1..N)
              ├── Users (1..N)
              └── Employees (1..N)
```

### Isolation Strategy

Every transactional table carries `company_id` and `branch_id` as foreign keys.
RLS policies enforce that a user can ONLY access rows matching their assigned
company/branch scope. Group-level users (Owner, Group Finance Controller)
get cross-company access within their group.

### Key Design Decision: Single Database, Schema-Level Isolation

Using a single PostgreSQL database with RLS rather than separate schemas per
company. Reasons:
- Easier consolidated reporting at group level
- Simpler migration and maintenance
- RLS provides equivalent isolation with less operational overhead
- Supabase manages connection pooling across tenants

The `group_id` column on the `companies` table acts as the top-level tenant
discriminator. All downstream tables inherit isolation through company_id FK.

---

## 3. DATABASE SCHEMA DESIGN

### 3.1 Organizational Tables

```
┌─────────────────────────────────────────────────────┐
│ groups                                              │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ name            TEXT NOT NULL                       │
│ code            TEXT NOT NULL UNIQUE                │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ companies                                           │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ group_id        UUID FK → groups(id) NOT NULL       │
│ name            TEXT NOT NULL                       │
│ code            TEXT NOT NULL                       │
│ legal_name      TEXT                                │
│ gstin           TEXT                                │
│ pan             TEXT                                │
│ address         JSONB                               │
│ logo_url        TEXT                                │
│ config          JSONB DEFAULT '{}'                  │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(group_id, code)                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ branches                                            │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ name            TEXT NOT NULL                       │
│ code            TEXT NOT NULL                       │
│ address         JSONB                               │
│ manager_user_id UUID FK → user_profiles(id)         │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(company_id, code)                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ financial_years                                     │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ label           TEXT NOT NULL (e.g., "2025-26")     │
│ start_date      DATE NOT NULL                       │
│ end_date        DATE NOT NULL                       │
│ is_locked       BOOLEAN DEFAULT FALSE               │
│ locked_by       UUID FK → user_profiles(id)         │
│ locked_at       TIMESTAMPTZ                         │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(company_id, label)                           │
│ CHECK(start_date < end_date)                        │
└─────────────────────────────────────────────────────┘
```

### 3.2 User & Access Control Tables

```
┌─────────────────────────────────────────────────────┐
│ user_profiles                                       │
├─────────────────────────────────────────────────────┤
│ id              UUID PK (= auth.users.id)           │
│ email           TEXT NOT NULL UNIQUE                 │
│ full_name       TEXT NOT NULL                       │
│ phone           TEXT                                │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ roles                                               │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ name            TEXT NOT NULL UNIQUE                 │
│ description     TEXT                                │
│ hierarchy_level SMALLINT NOT NULL                   │
│   (1=Owner, 2=GroupFC, 3=CompanyAcct,               │
│    4=BranchMgr, 5=Cashier, 6=HRMgr, 7=Employee)   │
│ is_system       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ permissions                                         │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ module          TEXT NOT NULL                       │
│   (e.g., 'cashbook', 'invoice', 'payroll')         │
│ action          TEXT NOT NULL                       │
│   (e.g., 'create', 'read', 'update', 'approve',   │
│    'close', 'reopen', 'export')                    │
│ description     TEXT                                │
│ UNIQUE(module, action)                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ role_permissions                                    │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ role_id         UUID FK → roles(id) NOT NULL        │
│ permission_id   UUID FK → permissions(id) NOT NULL  │
│ UNIQUE(role_id, permission_id)                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ user_assignments                                    │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ user_id         UUID FK → user_profiles(id) NOT NULL│
│ role_id         UUID FK → roles(id) NOT NULL        │
│ group_id        UUID FK → groups(id) NOT NULL       │
│ company_id      UUID FK → companies(id)  — nullable │
│   (NULL = all companies in group)                   │
│ branch_id       UUID FK → branches(id)   — nullable │
│   (NULL = all branches in company)                  │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ assigned_by     UUID FK → user_profiles(id)         │
│ assigned_at     TIMESTAMPTZ DEFAULT now()           │
│ revoked_at      TIMESTAMPTZ                         │
│ UNIQUE(user_id, role_id, group_id,                  │
│        company_id, branch_id)                       │
│   WHERE is_active = TRUE                            │
└─────────────────────────────────────────────────────┘
```

**Scope Resolution Logic:**
- `company_id IS NULL` → user has access to ALL companies in the group
- `branch_id IS NULL` → user has access to ALL branches in the company
- Both populated → user scoped to that specific branch

### 3.3 Financial Module Tables

```
┌─────────────────────────────────────────────────────┐
│ cashbooks                                           │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ name            TEXT NOT NULL (e.g., "Main Cash")   │
│ type            TEXT NOT NULL                       │
│   CHECK(type IN ('main','petty','bank'))            │
│ opening_balance NUMERIC(18,2) DEFAULT 0             │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(branch_id, name)                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ cashbook_days                                       │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ cashbook_id     UUID FK → cashbooks(id) NOT NULL    │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ date            DATE NOT NULL                       │
│ opening_balance NUMERIC(18,2) NOT NULL              │
│ system_closing  NUMERIC(18,2)                       │
│   — auto-calculated from transactions               │
│ physical_count  NUMERIC(18,2)                       │
│ variance        NUMERIC(18,2)                       │
│   — GENERATED ALWAYS AS                             │
│     (physical_count - system_closing) STORED        │
│ variance_approved BOOLEAN DEFAULT FALSE             │
│ variance_approved_by UUID FK → user_profiles(id)    │
│ variance_reason TEXT                                 │
│ status          TEXT NOT NULL DEFAULT 'open'         │
│   CHECK(status IN ('open','closing','closed',       │
│                     'reopened'))                     │
│ closed_by       UUID FK → user_profiles(id)         │
│ closed_at       TIMESTAMPTZ                         │
│ reopened_by     UUID FK → user_profiles(id)         │
│ reopened_at     TIMESTAMPTZ                         │
│ reopen_reason   TEXT                                │
│ reopen_approved_by UUID FK → user_profiles(id)      │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(cashbook_id, date)                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ cashbook_transactions                               │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ cashbook_id     UUID FK → cashbooks(id) NOT NULL    │
│ cashbook_day_id UUID FK → cashbook_days(id) NOT NULL│
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ financial_year_id UUID FK → financial_years(id)     │
│ txn_type        TEXT NOT NULL                       │
│   CHECK(txn_type IN ('receipt','payment'))          │
│ amount          NUMERIC(18,2) NOT NULL              │
│   CHECK(amount > 0)                                 │
│ payment_mode    TEXT NOT NULL                       │
│   CHECK(payment_mode IN ('cash','cheque','upi',    │
│     'bank_transfer','card','finance'))              │
│ narration       TEXT NOT NULL                       │
│ reference_type  TEXT                                │
│   (e.g., 'invoice','expense','salary','other')     │
│ reference_id    UUID                                │
│ receipt_number  TEXT NOT NULL                       │
│ receipt_hash    TEXT NOT NULL                       │
│   — SHA-256 of (receipt_number + amount + date      │
│     + cashbook_id + company_id)                     │
│ contra_cashbook_id UUID FK → cashbooks(id)          │
│ is_voided       BOOLEAN DEFAULT FALSE               │
│ void_reason     TEXT                                │
│ voided_by       UUID FK → user_profiles(id)         │
│ voided_at       TIMESTAMPTZ                         │
│ created_by      UUID FK → user_profiles(id) NOT NULL│
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ version         INTEGER DEFAULT 1                   │
│ UNIQUE(company_id, receipt_number)                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ transaction_revisions                               │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ transaction_id  UUID FK → cashbook_transactions(id) │
│ revision_number INTEGER NOT NULL                    │
│ field_changed   TEXT NOT NULL                       │
│ old_value       TEXT                                │
│ new_value       TEXT                                │
│ change_reason   TEXT NOT NULL                       │
│ changed_by      UUID FK → user_profiles(id) NOT NULL│
│ changed_at      TIMESTAMPTZ DEFAULT now()           │
│ ip_address      INET                                │
│ user_agent      TEXT                                │
│ approval_status TEXT DEFAULT 'pending'              │
│   CHECK(approval_status IN                          │
│     ('pending','approved','rejected'))              │
│ approved_by     UUID FK → user_profiles(id)         │
│ approved_at     TIMESTAMPTZ                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ receipt_number_series                               │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ financial_year_id UUID FK → financial_years(id)     │
│ prefix          TEXT NOT NULL                       │
│ current_number  BIGINT DEFAULT 0                    │
│ UNIQUE(branch_id, financial_year_id, prefix)        │
└─────────────────────────────────────────────────────┘
```

### 3.4 Invoice Recording Tables

```
┌─────────────────────────────────────────────────────┐
│ invoices                                            │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ financial_year_id UUID FK → financial_years(id)     │
│ invoice_type    TEXT NOT NULL                       │
│   CHECK(invoice_type IN ('automobile_sale',         │
│     'tractor_agri_sale','service'))                 │
│ dms_invoice_number TEXT NOT NULL                    │
│ invoice_date    DATE NOT NULL                       │
│ customer_name   TEXT NOT NULL                       │
│ customer_phone  TEXT                                │
│ customer_gstin  TEXT                                │
│                                                     │
│ — Automobile Sale Fields                            │
│ vehicle_sale_value   NUMERIC(18,2)                  │
│ insurance_amount     NUMERIC(18,2)                  │
│ accessories_amount   NUMERIC(18,2)                  │
│ tr_charges           NUMERIC(18,2)                  │
│ registration_charges NUMERIC(18,2)                  │
│ other_charges        NUMERIC(18,2)                  │
│                                                     │
│ — Tractor/Agri Sale Fields                          │
│ machine_value        NUMERIC(18,2)                  │
│ implements_amount    NUMERIC(18,2)                  │
│ finance_subsidy      NUMERIC(18,2)                  │
│                                                     │
│ — Service Invoice Fields                            │
│ parts_amount         NUMERIC(18,2)                  │
│ labour_amount        NUMERIC(18,2)                  │
│ discount_amount      NUMERIC(18,2)                  │
│                                                     │
│ — Common Tax Fields                                 │
│ tax_breakup          JSONB DEFAULT '{}'             │
│   — { "cgst": 0, "sgst": 0, "igst": 0,            │
│       "cess": 0, "tcs": 0 }                        │
│ total_tax            NUMERIC(18,2) DEFAULT 0        │
│ grand_total          NUMERIC(18,2) NOT NULL         │
│ total_received       NUMERIC(18,2) DEFAULT 0        │
│ balance_due          NUMERIC(18,2)                  │
│   — GENERATED ALWAYS AS                             │
│     (grand_total - total_received) STORED           │
│                                                     │
│ — Approval & Delivery                               │
│ approval_status TEXT DEFAULT 'pending'              │
│   CHECK(approval_status IN                          │
│     ('pending','accounts_approved',                 │
│      'manager_approved','rejected'))                │
│ accounts_approved_by UUID FK → user_profiles(id)    │
│ accounts_approved_at TIMESTAMPTZ                    │
│ manager_approved_by  UUID FK → user_profiles(id)    │
│ manager_approved_at  TIMESTAMPTZ                    │
│ is_delivery_allowed  BOOLEAN DEFAULT FALSE          │
│ delivered_at         TIMESTAMPTZ                    │
│                                                     │
│ notes           TEXT                                │
│ is_cancelled    BOOLEAN DEFAULT FALSE               │
│ cancelled_by    UUID FK → user_profiles(id)         │
│ cancelled_at    TIMESTAMPTZ                         │
│ cancel_reason   TEXT                                │
│ created_by      UUID FK → user_profiles(id) NOT NULL│
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ version         INTEGER DEFAULT 1                   │
│ UNIQUE(company_id, dms_invoice_number)              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ invoice_payments                                    │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ invoice_id      UUID FK → invoices(id) NOT NULL     │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ transaction_id  UUID FK → cashbook_transactions(id) │
│ payment_mode    TEXT NOT NULL                       │
│ amount          NUMERIC(18,2) NOT NULL              │
│ reference_number TEXT                               │
│   — cheque no, UTR, finance ref, etc.              │
│ payment_date    DATE NOT NULL                       │
│ notes           TEXT                                │
│ created_by      UUID FK → user_profiles(id) NOT NULL│
│ created_at      TIMESTAMPTZ DEFAULT now()           │
└─────────────────────────────────────────────────────┘
```

### 3.5 Expense Module Tables

```
┌─────────────────────────────────────────────────────┐
│ expense_categories                                  │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ name            TEXT NOT NULL                       │
│ budget_limit    NUMERIC(18,2)                       │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ UNIQUE(company_id, name)                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ expenses                                            │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ financial_year_id UUID FK → financial_years(id)     │
│ category_id     UUID FK → expense_categories(id)    │
│ expense_date    DATE NOT NULL                       │
│ amount          NUMERIC(18,2) NOT NULL              │
│ description     TEXT NOT NULL                       │
│ bill_url        TEXT                                │
│ bill_file_path  TEXT                                │
│ ledger_ref_id   TEXT                                │
│ submitted_by    UUID FK → user_profiles(id) NOT NULL│
│ submitted_at    TIMESTAMPTZ DEFAULT now()           │
│                                                     │
│ — Approval chain                                    │
│ approval_status TEXT DEFAULT 'submitted'            │
│   CHECK(approval_status IN                          │
│     ('draft','submitted','branch_approved',         │
│      'accounts_approved','owner_approved',          │
│      'rejected'))                                   │
│ branch_approved_by  UUID FK → user_profiles(id)     │
│ branch_approved_at  TIMESTAMPTZ                     │
│ accounts_approved_by UUID FK → user_profiles(id)    │
│ accounts_approved_at TIMESTAMPTZ                    │
│ owner_approved_by   UUID FK → user_profiles(id)     │
│ owner_approved_at   TIMESTAMPTZ                     │
│ rejection_reason    TEXT                             │
│                                                     │
│ — Posting                                           │
│ is_posted       BOOLEAN DEFAULT FALSE               │
│ posted_txn_id   UUID FK → cashbook_transactions(id) │
│ posted_at       TIMESTAMPTZ                         │
│                                                     │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ version         INTEGER DEFAULT 1                   │
└─────────────────────────────────────────────────────┘
```

### 3.6 Custom Field Engine Tables

```
┌─────────────────────────────────────────────────────┐
│ custom_field_definitions                            │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ entity_type     TEXT NOT NULL                       │
│   CHECK(entity_type IN ('cashbook','receipt',       │
│     'payment','invoice','expense'))                 │
│ field_name      TEXT NOT NULL                       │
│ field_label     TEXT NOT NULL                       │
│ field_type      TEXT NOT NULL                       │
│   CHECK(field_type IN ('text','number',             │
│     'dropdown','date','boolean'))                   │
│ dropdown_options JSONB                              │
│   — ["Option A","Option B","Option C"]             │
│ is_mandatory    BOOLEAN DEFAULT FALSE               │
│ display_order   INTEGER DEFAULT 0                   │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_by      UUID FK → user_profiles(id)         │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(company_id, entity_type, field_name)         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ custom_field_values                                 │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ field_id        UUID FK →                           │
│                   custom_field_definitions(id)      │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ entity_type     TEXT NOT NULL                       │
│ entity_id       UUID NOT NULL                       │
│   — polymorphic FK to the actual record             │
│ value_text      TEXT                                │
│ value_numeric   NUMERIC(18,4)                       │
│ value_date      DATE                                │
│ value_boolean   BOOLEAN                             │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(field_id, entity_id)                         │
└─────────────────────────────────────────────────────┘
```

**Design Note:** Custom field values are stored in typed columns rather than a
single TEXT column. This preserves type safety at the database level and enables
proper indexing, range queries on dates/numbers, and constraint validation.

### 3.7 HR Module Tables

```
┌─────────────────────────────────────────────────────┐
│ employees                                           │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ user_id         UUID FK → user_profiles(id)         │
│   — nullable; not all employees are system users    │
│ employee_code   TEXT NOT NULL                       │
│ full_name       TEXT NOT NULL                       │
│ phone           TEXT                                │
│ email           TEXT                                │
│ designation     TEXT                                │
│ department      TEXT                                │
│ ctc_annual      NUMERIC(18,2) NOT NULL              │
│ basic_salary    NUMERIC(18,2) NOT NULL              │
│ hra             NUMERIC(18,2) DEFAULT 0             │
│ other_allowances NUMERIC(18,2) DEFAULT 0            │
│ pf_applicable   BOOLEAN DEFAULT TRUE                │
│ esi_applicable  BOOLEAN DEFAULT FALSE               │
│ pt_applicable   BOOLEAN DEFAULT TRUE                │
│ bank_name       TEXT                                │
│ bank_account_no TEXT                                │
│ bank_ifsc       TEXT                                │
│ joining_date    DATE NOT NULL                       │
│ exit_date       DATE                                │
│ status          TEXT DEFAULT 'active'               │
│   CHECK(status IN ('active','on_notice',            │
│     'exited','terminated','suspended'))             │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(company_id, employee_code)                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ attendance_periods                                  │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ month           INTEGER NOT NULL CHECK(1..12)       │
│ year            INTEGER NOT NULL                    │
│ status          TEXT DEFAULT 'open'                 │
│   CHECK(status IN ('open','closing','closed'))      │
│ closed_by       UUID FK → user_profiles(id)         │
│ closed_at       TIMESTAMPTZ                         │
│ approved_by     UUID FK → user_profiles(id)         │
│ approved_at     TIMESTAMPTZ                         │
│ UNIQUE(company_id, branch_id, month, year)          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ attendance_records                                  │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ employee_id     UUID FK → employees(id) NOT NULL    │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ period_id       UUID FK → attendance_periods(id)    │
│ date            DATE NOT NULL                       │
│ status          TEXT NOT NULL                       │
│   CHECK(status IN ('present','absent','half_day',   │
│     'leave','holiday','weekly_off'))                │
│ is_late         BOOLEAN DEFAULT FALSE               │
│ check_in_time   TIME                                │
│ check_out_time  TIME                                │
│ remarks         TEXT                                │
│ marked_by       UUID FK → user_profiles(id) NOT NULL│
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ updated_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(employee_id, date)                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ leave_balances                                      │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ employee_id     UUID FK → employees(id) NOT NULL    │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ financial_year_id UUID FK → financial_years(id)     │
│ leave_type      TEXT NOT NULL                       │
│   CHECK(leave_type IN ('casual','sick','earned',    │
│     'maternity','paternity','unpaid'))              │
│ total_days      NUMERIC(4,1) NOT NULL               │
│ used_days       NUMERIC(4,1) DEFAULT 0              │
│ balance_days    NUMERIC(4,1)                        │
│   — GENERATED ALWAYS AS                             │
│     (total_days - used_days) STORED                 │
│ UNIQUE(employee_id, financial_year_id, leave_type)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ payroll_runs                                        │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ month           INTEGER NOT NULL                    │
│ year            INTEGER NOT NULL                    │
│ status          TEXT DEFAULT 'draft'                │
│   CHECK(status IN ('draft','processing',            │
│     'processed','locked','reopened'))               │
│ total_gross     NUMERIC(18,2)                       │
│ total_deductions NUMERIC(18,2)                      │
│ total_net       NUMERIC(18,2)                       │
│ processed_by    UUID FK → user_profiles(id)         │
│ processed_at    TIMESTAMPTZ                         │
│ locked_by       UUID FK → user_profiles(id)         │
│ locked_at       TIMESTAMPTZ                         │
│ reopened_by     UUID FK → user_profiles(id)         │
│ reopened_at     TIMESTAMPTZ                         │
│ reopen_reason   TEXT                                │
│ reopen_approved_by UUID FK → user_profiles(id)      │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(company_id, branch_id, month, year)          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ payroll_entries                                     │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ payroll_run_id  UUID FK → payroll_runs(id) NOT NULL │
│ employee_id     UUID FK → employees(id) NOT NULL    │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ days_present    NUMERIC(4,1) NOT NULL               │
│ days_absent     NUMERIC(4,1) NOT NULL               │
│ late_days       INTEGER DEFAULT 0                   │
│                                                     │
│ — Earnings                                          │
│ basic_earned    NUMERIC(18,2) NOT NULL              │
│ hra_earned      NUMERIC(18,2) DEFAULT 0             │
│ allowances_earned NUMERIC(18,2) DEFAULT 0           │
│ overtime_amount NUMERIC(18,2) DEFAULT 0             │
│ bonus_amount    NUMERIC(18,2) DEFAULT 0             │
│ gross_salary    NUMERIC(18,2) NOT NULL              │
│                                                     │
│ — Deductions                                        │
│ pf_employee     NUMERIC(18,2) DEFAULT 0             │
│ pf_employer     NUMERIC(18,2) DEFAULT 0             │
│ esi_employee    NUMERIC(18,2) DEFAULT 0             │
│ esi_employer    NUMERIC(18,2) DEFAULT 0             │
│ pt_amount       NUMERIC(18,2) DEFAULT 0             │
│ tds_amount      NUMERIC(18,2) DEFAULT 0             │
│ other_deductions NUMERIC(18,2) DEFAULT 0            │
│ total_deductions NUMERIC(18,2) NOT NULL             │
│                                                     │
│ net_salary      NUMERIC(18,2) NOT NULL              │
│   — GENERATED ALWAYS AS                             │
│     (gross_salary - total_deductions) STORED        │
│                                                     │
│ payslip_url     TEXT                                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(payroll_run_id, employee_id)                 │
└─────────────────────────────────────────────────────┘
```

### 3.8 Workflow & Approval Engine Tables

```
┌─────────────────────────────────────────────────────┐
│ approval_matrix                                     │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id)              │
│   — NULL = company-wide rule                        │
│ entity_type     TEXT NOT NULL                       │
│   CHECK(entity_type IN ('invoice','expense',        │
│     'cashbook_reopen','payment_mode_change',        │
│     'high_value_txn','refund','payroll_reopen',     │
│     'attendance_close','variance_approval',         │
│     'void_transaction'))                            │
│ threshold_amount NUMERIC(18,2)                      │
│   — NULL = applies to all amounts                   │
│ step_order      INTEGER NOT NULL                    │
│ approver_role_id UUID FK → roles(id) NOT NULL       │
│ is_active       BOOLEAN DEFAULT TRUE                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│ UNIQUE(company_id, branch_id, entity_type,          │
│        step_order)                                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ approval_requests                                   │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id) NOT NULL     │
│ entity_type     TEXT NOT NULL                       │
│ entity_id       UUID NOT NULL                       │
│ current_step    INTEGER NOT NULL DEFAULT 1          │
│ total_steps     INTEGER NOT NULL                    │
│ status          TEXT DEFAULT 'pending'              │
│   CHECK(status IN ('pending','in_progress',         │
│     'approved','rejected','cancelled'))             │
│ requested_by    UUID FK → user_profiles(id) NOT NULL│
│ requested_at    TIMESTAMPTZ DEFAULT now()           │
│ completed_at    TIMESTAMPTZ                         │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ approval_steps                                      │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ request_id      UUID FK → approval_requests(id)     │
│ step_order      INTEGER NOT NULL                    │
│ approver_role_id UUID FK → roles(id) NOT NULL       │
│ approved_by     UUID FK → user_profiles(id)         │
│ status          TEXT DEFAULT 'pending'              │
│   CHECK(status IN ('pending','approved','rejected'))│
│ comments        TEXT                                │
│ acted_at        TIMESTAMPTZ                         │
│ UNIQUE(request_id, step_order)                      │
└─────────────────────────────────────────────────────┘
```

### 3.9 Audit & Security Tables

```
┌─────────────────────────────────────────────────────┐
│ audit_log                                           │
├─────────────────────────────────────────────────────┤
│ id              BIGSERIAL PK                        │
│   — BIGSERIAL for performance on append-only table  │
│ company_id      UUID NOT NULL                       │
│ branch_id       UUID                                │
│ user_id         UUID NOT NULL                       │
│ action          TEXT NOT NULL                       │
│   ('INSERT','UPDATE','VOID','CLOSE','REOPEN',      │
│    'APPROVE','REJECT','LOGIN','EXPORT')             │
│ entity_type     TEXT NOT NULL                       │
│ entity_id       UUID NOT NULL                       │
│ old_values      JSONB                               │
│ new_values      JSONB                               │
│ change_reason   TEXT                                │
│ ip_address      INET                                │
│ user_agent      TEXT                                │
│ session_id      TEXT                                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
│                                                     │
│ — NO UPDATE OR DELETE ALLOWED ON THIS TABLE         │
│ — Enforced via trigger + RLS                        │
└─────────────────────────────────────────────────────┘
  → Partitioned by created_at (monthly)
  → Index on (company_id, entity_type, entity_id)
  → Index on (user_id, created_at)

┌─────────────────────────────────────────────────────┐
│ fraud_flags                                         │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ branch_id       UUID FK → branches(id)              │
│ flag_type       TEXT NOT NULL                       │
│   CHECK(flag_type IN (                              │
│     'repeated_receipt_edit',                        │
│     'high_cash_variance',                           │
│     'backdated_entry',                              │
│     'manual_override',                              │
│     'unusual_void_pattern',                         │
│     'threshold_breach',                             │
│     'off_hours_activity',                           │
│     'rapid_transactions'))                          │
│ severity        TEXT NOT NULL                       │
│   CHECK(severity IN ('low','medium','high',         │
│     'critical'))                                    │
│ entity_type     TEXT NOT NULL                       │
│ entity_id       UUID NOT NULL                       │
│ user_id         UUID NOT NULL                       │
│ description     TEXT NOT NULL                       │
│ metadata        JSONB                               │
│ is_reviewed     BOOLEAN DEFAULT FALSE               │
│ reviewed_by     UUID FK → user_profiles(id)         │
│ reviewed_at     TIMESTAMPTZ                         │
│ review_notes    TEXT                                │
│ created_at      TIMESTAMPTZ DEFAULT now()           │
└─────────────────────────────────────────────────────┘
```

### 3.10 Configuration Tables

```
┌─────────────────────────────────────────────────────┐
│ company_configs                                     │
├─────────────────────────────────────────────────────┤
│ id              UUID PK DEFAULT gen_random_uuid()   │
│ company_id      UUID FK → companies(id) NOT NULL    │
│ config_key      TEXT NOT NULL                       │
│ config_value    JSONB NOT NULL                      │
│ UNIQUE(company_id, config_key)                      │
│                                                     │
│ Example keys:                                       │
│   'receipt_format' → { template, fields, footer }   │
│   'expense_threshold' → { branch_mgr: 10000,       │
│                           accounts: 50000 }         │
│   'payroll_config' → { pf_rate: 12,                 │
│                        esi_threshold: 21000 }       │
│   'fraud_rules' → { max_edits_per_receipt: 3,      │
│                      variance_alert_pct: 5 }        │
└─────────────────────────────────────────────────────┘
```

---

## 4. ROLE-PERMISSION MATRIX

### 4.1 Role Hierarchy

```
Level 1: Owner
  └── Level 2: Group Finance Controller
        └── Level 3: Company Accountant
              └── Level 4: Branch Manager
                    ├── Level 5: Cashier
                    └── Level 6: HR Manager
                          └── Level 7: Employee
```

### 4.2 Permission Matrix

| Permission                  | Owner | Grp FC | Co Acct | Br Mgr | Cashier | HR Mgr | Employee |
|-----------------------------|:-----:|:------:|:-------:|:------:|:-------:|:------:|:--------:|
| **Cashbook**                |       |        |         |        |         |        |          |
| Create cashbook             |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| View cashbook (own branch)  |  ✓    |   ✓    |    ✓    |   ✓    |    ✓    |   —    |    —     |
| View cashbook (all company) |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| Create transaction          |  ✓    |   —    |    ✓    |   ✓    |    ✓    |   —    |    —     |
| Void transaction            |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| Close day                   |  ✓    |   ✓    |    ✓    |   ✓    |    ✓    |   —    |    —     |
| Reopen closed day           |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| Approve variance            |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| **Invoice**                 |       |        |         |        |         |        |          |
| Create invoice record       |  ✓    |   —    |    ✓    |   ✓    |    ✓    |   —    |    —     |
| Approve (accounts)          |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| Approve (manager)           |  ✓    |   ✓    |    —    |   ✓    |    —    |   —    |    —     |
| Allow delivery              |  ✓    |   ✓    |    ✓    |   ✓    |    —    |   —    |    —     |
| Cancel invoice              |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| **Expense**                 |       |        |         |        |         |        |          |
| Submit expense              |  ✓    |   ✓    |    ✓    |   ✓    |    ✓    |   ✓    |    ✓     |
| Approve (branch level)      |  ✓    |   ✓    |    —    |   ✓    |    —    |   —    |    —     |
| Approve (accounts level)    |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| Approve (owner level)       |  ✓    |   —    |    —    |   —    |    —    |   —    |    —     |
| **HR & Payroll**            |       |        |         |        |         |        |          |
| Manage employees            |  ✓    |   —    |    —    |   —    |    —    |   ✓    |    —     |
| Mark attendance             |  ✓    |   —    |    —    |   ✓    |    —    |   ✓    |    —     |
| Close attendance period     |  ✓    |   —    |    —    |   ✓    |    —    |   ✓    |    —     |
| Process payroll             |  ✓    |   ✓    |    ✓    |   —    |    —    |   ✓    |    —     |
| Lock payroll                |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| Reopen payroll              |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| View own payslip            |  ✓    |   ✓    |    ✓    |   ✓    |    ✓    |   ✓    |    ✓     |
| Export salary sheet          |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| **Admin**                   |       |        |         |        |         |        |          |
| Manage companies            |  ✓    |   —    |    —    |   —    |    —    |   —    |    —     |
| Manage branches             |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| Manage users & roles        |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| Manage custom fields        |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| View audit log              |  ✓    |   ✓    |    ✓    |   ✓*   |    —    |   —    |    —     |
| View fraud flags            |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| Lock financial year         |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| Configure approval matrix   |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| **Reporting**               |       |        |         |        |         |        |          |
| Group consolidated reports  |  ✓    |   ✓    |    —    |   —    |    —    |   —    |    —     |
| Company reports             |  ✓    |   ✓    |    ✓    |   —    |    —    |   —    |    —     |
| Branch reports              |  ✓    |   ✓    |    ✓    |   ✓    |    —    |   —    |    —     |

*Branch Manager sees audit log only for their own branch.

### 4.3 RLS Enforcement Strategy

RLS policies are resolved using a helper function that extracts user scope:

```
Function: get_user_accessible_companies(user_id UUID)
  → Returns UUID[] of company IDs the user can access

Function: get_user_accessible_branches(user_id UUID)
  → Returns UUID[] of branch IDs the user can access

Function: user_has_permission(user_id UUID, module TEXT, action TEXT)
  → Returns BOOLEAN
```

Every table with `company_id` gets an RLS policy:
```
Policy: "tenant_isolation"
  USING (company_id = ANY(get_user_accessible_companies(auth.uid())))
```

Branch-scoped tables add:
```
Policy: "branch_isolation"
  USING (branch_id = ANY(get_user_accessible_branches(auth.uid())))
```

---

## 5. FRAUD CONTROL MECHANISMS

### 5.1 Immutable Transaction Log

1. **No physical DELETE** on any financial table — enforced by trigger:
   ```
   BEFORE DELETE ON cashbook_transactions → RAISE EXCEPTION
   ```
2. **Void instead of delete** — sets `is_voided = TRUE` with reason, user, timestamp
3. **Version column** — incremented on every update; application must pass current
   version (optimistic locking)
4. **Revision trail** — every UPDATE on a financial record inserts a row into
   `transaction_revisions` via trigger

### 5.2 Receipt Integrity

- Receipt number auto-generated from `receipt_number_series` using
  `nextval()` equivalent with advisory lock
- Receipt hash = `SHA-256(receipt_number || amount || date || cashbook_id || salt)`
- QR code on printed receipt encodes: `{receipt_hash, receipt_number, amount, date}`
- Verification endpoint: given a QR payload, looks up transaction and confirms match

### 5.3 Day Closing Controls

```
State Machine: cashbook_day.status

  open → closing → closed
                      ↓ (requires higher-level approval)
                   reopened → open
```

Rules enforced by triggers:
- Cannot INSERT into `cashbook_transactions` where `cashbook_day.status != 'open'`
- Cannot UPDATE `cashbook_day.status` to 'closed' unless `physical_count IS NOT NULL`
- If `ABS(variance) > threshold` → auto-creates approval_request
- Reopen requires approval_request to be fulfilled first

### 5.4 Payment Mode Lock

- Once a transaction is saved, `payment_mode` cannot be changed without:
  1. Creating a `transaction_revision` record
  2. Submitting an `approval_request` of type `payment_mode_change`
  3. Approval by Company Accountant or above
- Trigger prevents direct UPDATE on `payment_mode` column

### 5.5 Backdated Entry Detection

- Trigger on `cashbook_transactions` INSERT:
  - If `transaction_date < CURRENT_DATE - interval '1 day'` → auto-creates fraud_flag
    with type `backdated_entry`
  - If `cashbook_day.status = 'closed'` for that date → RAISE EXCEPTION (blocked)

### 5.6 Financial Year Lock

- When `financial_years.is_locked = TRUE`:
  - No INSERT/UPDATE on any financial table where `financial_year_id` matches
  - Enforced by trigger checking FK to financial_years

---

## 6. WORKFLOW ENGINE DESIGN

### 6.1 Architecture

The workflow engine is table-driven and generic. It does NOT use hardcoded
if-else chains.

**Flow:**
```
1. Action triggers workflow check
2. System looks up approval_matrix for (company, branch, entity_type, amount)
3. Creates approval_request with N steps
4. Each step targets a role (not a specific user)
5. Any user with that role + matching scope can approve
6. Steps execute sequentially (step 1 must complete before step 2)
7. On final approval → callback updates the source entity
8. On any rejection → entire request marked rejected
```

### 6.2 Threshold-Based Routing

The `approval_matrix.threshold_amount` enables amount-based routing:

- Expense ≤ 10,000 → Branch Manager only
- Expense ≤ 50,000 → Branch Manager → Company Accountant
- Expense > 50,000 → Branch Manager → Company Accountant → Owner

Multiple rows in `approval_matrix` with the same `entity_type` but different
`threshold_amount` values handle this. The system picks the row set where the
amount falls within range.

### 6.3 Callback Mechanism

When an approval_request reaches `approved` status, a trigger on `approval_steps`
fires a function that:
1. Checks if all steps for the request are approved
2. If yes, updates `approval_requests.status = 'approved'`
3. Based on `entity_type`, executes the corresponding action:
   - `invoice` → sets `approval_status` on invoice
   - `expense` → sets `approval_status` on expense
   - `cashbook_reopen` → sets `cashbook_day.status = 'reopened'`
   - etc.

---

## 7. LOCKING MECHANISMS SUMMARY

| Lock Type | Scope | Who Can Lock | Who Can Unlock | Audit |
|-----------|-------|-------------|----------------|-------|
| Day Close | Cashbook Day | Cashier, Branch Mgr, Accountant | Group FC, Owner (via approval) | Full |
| Financial Year Lock | Company | Owner, Group FC | Owner only | Full |
| Attendance Month Close | Branch | Branch Mgr, HR Mgr | Owner, Group FC (via approval) | Full |
| Payroll Lock | Branch + Month | Accountant, Group FC | Owner, Group FC (via approval) | Full |
| Transaction Void | Single Txn | Accountant+ | N/A (irreversible) | Full |
| Invoice Cancel | Single Invoice | Group FC, Owner | N/A (irreversible) | Full |

All locks use the approval workflow engine. Every lock/unlock event is
recorded in `audit_log`.

---

## 8. FRAUD DETECTION FLAGGING RULES

### Automated Detection (via triggers and scheduled functions)

| Flag Type | Detection Logic | Severity |
|-----------|----------------|----------|
| `repeated_receipt_edit` | >3 revisions on same transaction within 24h | HIGH |
| `high_cash_variance` | ABS(variance) > 5% of system balance OR > configurable absolute amount | HIGH |
| `backdated_entry` | Transaction date > 1 day before entry date | MEDIUM |
| `manual_override` | Any field changed after approval was granted | HIGH |
| `unusual_void_pattern` | >2 voids by same user in same day | CRITICAL |
| `threshold_breach` | Transaction amount exceeds configurable threshold | MEDIUM |
| `off_hours_activity` | Transaction created outside business hours (configurable) | LOW |
| `rapid_transactions` | >10 transactions by same user within 30 minutes | MEDIUM |

### Flag Resolution Workflow
1. Flag auto-created by trigger/scheduled function
2. Appears on fraud dashboard for Owner + Group FC
3. Reviewer opens flag, investigates, adds notes
4. Marks as reviewed with resolution
5. All flag reviews are themselves audit-logged

---

## 9. ENTITY RELATIONSHIP DIAGRAM (Conceptual)

```
groups
  │1:N
  ▼
companies ──1:N──► branches
  │                   │
  │                   ├──1:N──► cashbooks
  │                   │            │1:N
  │                   │            ▼
  │                   │         cashbook_days
  │                   │            │1:N
  │                   │            ▼
  │                   │         cashbook_transactions
  │                   │            │1:N
  │                   │            ▼
  │                   │         transaction_revisions
  │                   │
  │                   ├──1:N──► invoices
  │                   │            │1:N
  │                   │            ▼
  │                   │         invoice_payments ──► cashbook_transactions
  │                   │
  │                   ├──1:N──► expenses
  │                   │
  │                   ├──1:N──► employees
  │                   │            │
  │                   │            ├──► attendance_records
  │                   │            └──► payroll_entries
  │                   │
  │                   └──1:N──► attendance_periods
  │                                  │1:N
  │                                  ▼
  │                               payroll_runs
  │
  ├──1:N──► financial_years
  ├──1:N──► expense_categories
  ├──1:N──► custom_field_definitions
  ├──1:N──► approval_matrix
  └──1:N──► company_configs

user_profiles
  │
  ├──► user_assignments (role + scope)
  │        │
  │        ▼
  │      roles ◄──► permissions (via role_permissions)
  │
  └──► audit_log (immutable, append-only)

approval_requests ──1:N──► approval_steps

fraud_flags (auto-generated)

custom_field_values ──► custom_field_definitions
  (polymorphic: entity_type + entity_id)
```

---

## 10. SCALABILITY CONSIDERATIONS

### Database Level
- **audit_log**: Partitioned by `created_at` (monthly). This table will grow
  fastest. Partitioning enables efficient cleanup/archival of old partitions.
- **Indexes**: Composite indexes on (company_id, branch_id, date) for all
  transactional tables.
- **Connection Pooling**: Supabase pgBouncer in transaction mode.
- **RLS function caching**: `get_user_accessible_companies()` should use
  `STABLE` volatility and be designed to work with PostgreSQL's plan caching.

### Application Level
- Receipt number generation uses `pg_advisory_xact_lock` to prevent
  race conditions under concurrent access.
- Payroll processing should be done in batches per branch to avoid
  long-running transactions.
- Audit log writes should use `AFTER` triggers (not `BEFORE`) to avoid
  blocking the main transaction.

### Volume Projections (100 branches, 10,000 employees)
- ~100 cashbook_days/day → 36,500/year
- ~5,000 transactions/day → 1.8M/year
- ~10,000 attendance records/day → 3.6M/year
- ~10,000 payroll entries/month → 120K/year
- audit_log: Estimated 10-50M rows/year → partitioning essential

---

## 11. WHAT STEP 2 WILL DELIVER

Upon approval of this architecture, Step 2 will produce:

1. **Complete SQL DDL** — All CREATE TABLE statements with constraints,
   indexes, and partitioning
2. **Supabase RLS Policies** — Per-table policies for all 7 roles
3. **Trigger Functions** — Audit logging, fraud detection, immutability
   enforcement, day-close validation, version increment, receipt hash
   generation
4. **Helper Functions** — Scope resolution, permission checking, receipt
   number generation, payroll calculation
5. **Seed Data** — Default roles, permissions, role_permissions mapping
6. **Migration-ready format** — Numbered migration files

---

## END OF ARCHITECTURE DOCUMENT
