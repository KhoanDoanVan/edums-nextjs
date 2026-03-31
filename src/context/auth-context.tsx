"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAccountById,
  loginRequest,
  registerAccountRequest,
} from "@/lib/auth/service";
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
} from "@/lib/auth/storage";
import { normalizeRole } from "@/lib/auth/role";
import type {
  AccountResponse,
  AuthResponse,
  AuthSession,
  AuthStatus,
  LoginCredentials,
  RegisterAccountPayload,
} from "@/lib/auth/types";

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  registerAccount: (payload: RegisterAccountPayload) => Promise<AccountResponse>;
  refreshCurrentAccount: () => Promise<void>;
  logout: () => void;
  hasRole: (roles: string | string[]) => boolean;
  hasPermission: (permissions: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeTokenType = (tokenType?: string | null): string => {
  const trimmedTokenType = tokenType?.trim();
  return trimmedTokenType || "Bearer";
};

const buildAuthorization = (token: string, tokenType?: string | null): string => {
  const normalizedTokenType = normalizeTokenType(tokenType);
  if (token.startsWith(`${normalizedTokenType} `)) {
    return token;
  }

  return `${normalizedTokenType} ${token}`;
};

const toSession = (
  authData: AuthResponse,
  accountData?: AccountResponse,
): AuthSession => {
  const tokenType = normalizeTokenType(authData.type);
  const authorization = buildAuthorization(authData.token, tokenType);

  return {
    token: authData.token,
    tokenType,
    authorization,
    accountId: accountData?.id ?? authData.accountId,
    username: accountData?.username ?? authData.username,
    role: accountData?.roleName ?? authData.role,
    roleId: accountData?.roleId,
    permissions: accountData?.permissions ?? [],
    accountStatus: accountData?.status,
    avatarUrl: accountData?.avatarUrl,
  };
};

const mergeSessionWithAccount = (
  currentSession: AuthSession,
  accountData: AccountResponse,
): AuthSession => {
  return {
    ...currentSession,
    accountId: accountData.id,
    username: accountData.username,
    role: accountData.roleName,
    roleId: accountData.roleId,
    permissions: accountData.permissions ?? [],
    accountStatus: accountData.status,
    avatarUrl: accountData.avatarUrl,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  const persistSession = useCallback((nextSession: AuthSession | null) => {
    setSession(nextSession);

    if (nextSession) {
      setStoredAuthSession(nextSession);
      setStatus("authenticated");
      return;
    }

    clearStoredAuthSession();
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const storedSession = getStoredAuthSession();

      if (storedSession) {
        setSession(storedSession);
        setStatus("authenticated");
        return;
      }

      setStatus("unauthenticated");
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      const authData = await loginRequest(credentials);
      const authorization = buildAuthorization(authData.token, authData.type);

      let accountData: AccountResponse | undefined;
      try {
        accountData = await getAccountById(authData.accountId, authorization);
      } catch {
        accountData = undefined;
      }

      persistSession(toSession(authData, accountData));
    },
    [persistSession],
  );

  const registerAccount = useCallback(
    async (payload: RegisterAccountPayload): Promise<AccountResponse> => {
      if (!session?.authorization) {
        throw new Error("Chức năng tạo tài khoản yêu cầu đăng nhập quản trị viên.");
      }

      return registerAccountRequest(payload, session?.authorization);
    },
    [session?.authorization],
  );

  const refreshCurrentAccount = useCallback(async (): Promise<void> => {
    if (!session) {
      return;
    }

    const accountData = await getAccountById(session.accountId, session.authorization);
    persistSession(mergeSessionWithAccount(session, accountData));
  }, [persistSession, session]);

  const logout = useCallback((): void => {
    persistSession(null);
  }, [persistSession]);

  const hasRole = useCallback(
    (roles: string | string[]): boolean => {
      if (!session) {
        return false;
      }

      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      const currentRole = normalizeRole(session.role);

      return requiredRoles.some((role) => normalizeRole(role) === currentRole);
    },
    [session],
  );

  const hasPermission = useCallback(
    (permissions: string | string[]): boolean => {
      if (!session) {
        return false;
      }

      const requiredPermissions = Array.isArray(permissions)
        ? permissions
        : [permissions];
      const ownedPermissions = new Set(
        session.permissions.map((permission) => permission.toUpperCase()),
      );

      return requiredPermissions.every((permission) =>
        ownedPermissions.has(permission.toUpperCase()),
      );
    },
    [session],
  );

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      isAuthenticated: status === "authenticated" && session !== null,
      login,
      registerAccount,
      refreshCurrentAccount,
      logout,
      hasRole,
      hasPermission,
    }),
    [
      hasPermission,
      hasRole,
      login,
      logout,
      refreshCurrentAccount,
      registerAccount,
      session,
      status,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const contextValue = useContext(AuthContext);
  if (!contextValue) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return contextValue;
};
