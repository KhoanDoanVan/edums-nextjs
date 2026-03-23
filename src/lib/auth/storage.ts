import type { AuthSession } from "@/lib/auth/types";

const AUTH_STORAGE_KEY = "edums.auth.session.v1";

const isAuthSession = (value: unknown): value is AuthSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return (
    typeof session.token === "string" &&
    typeof session.tokenType === "string" &&
    typeof session.authorization === "string" &&
    typeof session.accountId === "number" &&
    typeof session.username === "string" &&
    typeof session.role === "string" &&
    Array.isArray(session.permissions)
  );
};

export const getStoredAuthSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!isAuthSession(parsedValue)) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
};

export const setStoredAuthSession = (session: AuthSession): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredAuthSession = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};
