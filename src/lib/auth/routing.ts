import type { AuthSession } from "@/lib/auth/types";
import { isAdminRole } from "@/lib/auth/role";

export const getDefaultHomePath = (
  session?: Pick<AuthSession, "role"> | null,
): string => {
  if (isAdminRole(session?.role)) {
    return "/admin/dashboard";
  }

  return "/dashboard";
};

export const canAccessPathByRole = (
  session: Pick<AuthSession, "role"> | null | undefined,
  path: string,
): boolean => {
  const admin = isAdminRole(session?.role);

  if (path.startsWith("/admin")) {
    return admin;
  }

  if (path.startsWith("/dashboard")) {
    return !admin;
  }

  return true;
};

export const getPostLoginPath = (
  session?: Pick<AuthSession, "role"> | null,
  requestedPath?: string | null,
): string => {
  if (requestedPath && canAccessPathByRole(session, requestedPath)) {
    return requestedPath;
  }

  return getDefaultHomePath(session);
};
