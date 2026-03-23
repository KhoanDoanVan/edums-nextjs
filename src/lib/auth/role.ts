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
