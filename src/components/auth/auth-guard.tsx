"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermissions?: string[];
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export const AuthGuard = ({
  children,
  allowedRoles,
  requiredPermissions,
  redirectTo = "/login",
  fallback = null,
}: AuthGuardProps) => {
  const { status, isAuthenticated, hasRole, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const roleMatched =
    !allowedRoles || allowedRoles.length === 0 || hasRole(allowedRoles);
  const permissionMatched =
    !requiredPermissions ||
    requiredPermissions.length === 0 ||
    hasPermission(requiredPermissions);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!isAuthenticated) {
      const nextQuery = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`${redirectTo}${nextQuery}`);
      return;
    }

    if (!roleMatched || !permissionMatched) {
      router.replace("/forbidden");
    }
  }, [
    isAuthenticated,
    pathname,
    permissionMatched,
    redirectTo,
    roleMatched,
    router,
    status,
  ]);

  if (status === "loading") {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!isAuthenticated || !roleMatched || !permissionMatched) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
