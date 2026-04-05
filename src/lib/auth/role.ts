export const normalizeRole = (role?: string | null): string => {
  const normalized = role?.trim().toUpperCase() || "";
  if (normalized.startsWith("ROLE_")) {
    return normalized.slice(5);
  }

  return normalized;
};

export const isAdminRole = (role?: string | null): boolean => {
  return normalizeRole(role) === "ADMIN";
};

export const isLecturerRole = (role?: string | null): boolean => {
  return normalizeRole(role) === "LECTURER";
};

export const isGuardianRole = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  return normalized === "GUARDIAN" || normalized === "PARENT";
};
