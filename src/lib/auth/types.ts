export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  type?: string | null;
  accountId: number;
  username: string;
  role: string;
}

export interface RegisterAccountPayload {
  username: string;
  password: string;
  roleId: number;
  avatarUrl?: string;
}

export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export interface AccountResponse {
  id: number;
  username: string;
  status: AccountStatus;
  avatarUrl?: string;
  createdAt?: string;
  roleId: number;
  roleName: string;
  permissions: string[];
}

export interface RoleResponse {
  id: number;
  roleName: string;
  functionCodes: string[];
}

export interface AuthSession {
  token: string;
  tokenType: string;
  authorization: string;
  accountId: number;
  username: string;
  role: string;
  roleId?: number;
  permissions: string[];
  accountStatus?: AccountStatus;
  avatarUrl?: string;
  isSeedAccount?: boolean;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
