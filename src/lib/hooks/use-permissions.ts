"use client";

import { useCallback } from "react";
import { useAuthContext } from "@/components/providers/auth-provider";

export function usePermissions() {
  const { permissions, minHierarchyLevel } = useAuthContext();

  const hasPermission = useCallback(
    (permission: string): boolean => {
      return permissions.has(permission);
    },
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]): boolean => {
      return perms.some((p) => permissions.has(p));
    },
    [permissions]
  );

  const hasAllPermissions = useCallback(
    (...perms: string[]): boolean => {
      return perms.every((p) => permissions.has(p));
    },
    [permissions]
  );

  const isAtLeastLevel = useCallback(
    (level: number): boolean => {
      return minHierarchyLevel <= level;
    },
    [minHierarchyLevel]
  );

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAtLeastLevel,
    permissions,
    minHierarchyLevel,
  };
}
