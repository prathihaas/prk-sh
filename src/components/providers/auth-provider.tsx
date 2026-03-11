"use client";

import React, { createContext, useContext, useMemo } from "react";
import type {
  AuthContextType,
  UserProfile,
  UserAssignment,
} from "@/types/auth";

const AuthContext = createContext<AuthContextType>({
  user: null,
  assignments: [],
  permissions: new Set(),
  isLoading: false,
  minHierarchyLevel: 99,
});

interface AuthProviderProps {
  children: React.ReactNode;
  user: UserProfile | null;
  assignments: UserAssignment[];
  permissions: string[]; // Serialized from Set (can't pass Set via Server → Client)
}

export function AuthProvider({
  children,
  user,
  assignments,
  permissions,
}: AuthProviderProps) {
  const value = useMemo<AuthContextType>(() => {
    const permSet = new Set(permissions);
    const minLevel =
      assignments.length > 0
        ? Math.min(...assignments.map((a) => a.role.hierarchy_level))
        : 99;

    return {
      user,
      assignments,
      permissions: permSet,
      isLoading: false,
      minHierarchyLevel: minLevel,
    };
  }, [user, assignments, permissions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
