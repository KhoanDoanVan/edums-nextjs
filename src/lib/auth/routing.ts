import type { AuthSession } from "@/lib/auth/types";
import { isAdminRole, isGuardianRole, isLecturerRole } from "@/lib/auth/role";

export const getDefaultHomePath = (
  session?: Pick<AuthSession, "role"> | null,
): string => {
  if (isAdminRole(session?.role)) {
    return "/admin/dashboard";
  }

  if (isLecturerRole(session?.role)) {
    return "/lecturer/dashboard";
  }

  if (isGuardianRole(session?.role)) {
    return "/guardian/dashboard";
  }

  return "/dashboard";
};

export const canAccessPathByRole = (
  session: Pick<AuthSession, "role"> | null | undefined,
  path: string,
): boolean => {
  const admin = isAdminRole(session?.role);
  const lecturer = isLecturerRole(session?.role);
  const guardian = isGuardianRole(session?.role);

  if (path.startsWith("/admin")) {
    return admin;
  }

  if (path.startsWith("/lecturer")) {
    return lecturer;
  }

  if (path.startsWith("/guardian")) {
    return guardian;
  }

  if (path.startsWith("/dashboard")) {
    return !admin && !lecturer && !guardian;
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
