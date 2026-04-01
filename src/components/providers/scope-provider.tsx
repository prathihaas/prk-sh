"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type {
  ScopeContextType,
  CompanyOption,
  BranchOption,
} from "@/types/auth";

const ScopeContext = createContext<ScopeContextType | null>(null);

interface ScopeProviderProps {
  children: React.ReactNode;
  groupId: string | null;
  initialCompanyId: string | null;
  initialBranchId: string | null;
  companies: CompanyOption[];
  allBranches: BranchOption[]; // All branches across all accessible companies
}

export function ScopeProvider({
  children,
  groupId,
  initialCompanyId,
  initialBranchId,
  companies,
  allBranches,
}: ScopeProviderProps) {
  const [companyId, setCompanyIdState] = useState<string | null>(
    initialCompanyId
  );
  const [branchId, setBranchIdState] = useState<string | null>(
    initialBranchId
  );

  // Filter branches based on selected company
  const branches = useMemo(
    () =>
      companyId
        ? allBranches.filter((b) => b.company_id === companyId)
        : [],
    [companyId, allBranches]
  );

  const setCompanyId = useCallback(
    (id: string | null) => {
      setCompanyIdState(id);
      setBranchIdState(null); // Reset branch when company changes

      // Persist to cookie for SSR access
      if (id) {
        document.cookie = `scope_company_id=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      } else {
        document.cookie =
          "scope_company_id=; path=/; max-age=0; SameSite=Lax";
      }
      document.cookie =
        "scope_branch_id=; path=/; max-age=0; SameSite=Lax";
    },
    []
  );

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id);
    if (id) {
      document.cookie = `scope_branch_id=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } else {
      document.cookie =
        "scope_branch_id=; path=/; max-age=0; SameSite=Lax";
    }
  }, []);

  // On mount: sync initial scope state → cookie.
  // The layout derives initialCompanyId from cookies OR falls back to companies[0].
  // When it's a fallback (no cookie yet), the cookie is never written because
  // setCompanyId is only called on explicit changes. This effect writes the cookie
  // once on mount so that server-rendered pages see it on the next navigation.
  useEffect(() => {
    if (companyId) {
      document.cookie = `scope_company_id=${companyId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    if (branchId) {
      document.cookie = `scope_branch_id=${branchId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to sync initial state → cookie

  // Auto-select first company if none selected
  useEffect(() => {
    if (!companyId && companies.length > 0) {
      setCompanyId(companies[0].id);
    }
  }, [companyId, companies, setCompanyId]);

  const value = useMemo<ScopeContextType>(
    () => ({
      groupId,
      companyId,
      branchId,
      companies,
      branches,
      setCompanyId,
      setBranchId,
    }),
    [groupId, companyId, branchId, companies, branches, setCompanyId, setBranchId]
  );

  return (
    <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
  );
}

export function useScopeContext() {
  const context = useContext(ScopeContext);
  if (!context) {
    throw new Error("useScopeContext must be used within a ScopeProvider");
  }
  return context;
}
