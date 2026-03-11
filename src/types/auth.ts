export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAssignment {
  id: string;
  user_id: string;
  role_id: string;
  group_id: string;
  company_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  assigned_at: string;
  role: {
    id: string;
    name: string;
    description: string | null;
    hierarchy_level: number;
  };
}

export interface AuthContextType {
  user: UserProfile | null;
  assignments: UserAssignment[];
  permissions: Set<string>;
  isLoading: boolean;
  minHierarchyLevel: number;
}

export interface ScopeContextType {
  groupId: string | null;
  companyId: string | null;
  branchId: string | null;
  companies: CompanyOption[];
  branches: BranchOption[];
  setCompanyId: (id: string | null) => void;
  setBranchId: (id: string | null) => void;
}

export interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
  company_id: string;
}
