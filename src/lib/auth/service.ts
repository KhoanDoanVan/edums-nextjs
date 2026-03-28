import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AccountResponse,
  AuthResponse,
  LoginCredentials,
  RegisterAccountPayload,
  RoleResponse,
} from "@/lib/auth/types";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const unwrapApiData = <TData>(response: unknown): TData => {
  if (isObject(response) && "data" in response) {
    return response.data as TData;
  }

  return response as TData;
};

const normalizeAuthResponse = (response: unknown): AuthResponse => {
  const rawAuth = unwrapApiData<Record<string, unknown>>(response);
  const rawToken = rawAuth.token ?? rawAuth.accessToken;
  const token = typeof rawToken === "string" ? rawToken.trim() : rawToken;

  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Không nhận được token từ API đăng nhập.");
  }

  const rawAccountId = rawAuth.accountId ?? rawAuth.id;
  const accountId = Number(rawAccountId);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error("API đăng nhập không trả về accountId hợp lệ.");
  }

  const username =
    typeof rawAuth.username === "string" && rawAuth.username.trim()
      ? rawAuth.username
      : "admin";
  const role =
    typeof rawAuth.role === "string" && rawAuth.role.trim()
      ? rawAuth.role
      : "ADMIN";

  return {
    token,
    type:
      typeof rawAuth.type === "string" && rawAuth.type.trim()
        ? rawAuth.type
        : typeof rawAuth.tokenType === "string" && rawAuth.tokenType.trim()
          ? rawAuth.tokenType
          : "Bearer",
    accountId,
    username,
    role,
  };
};

export const loginRequest = async (
  credentials: LoginCredentials,
): Promise<AuthResponse> => {
  const response = await apiRequest<unknown>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: credentials,
    },
  );

  return normalizeAuthResponse(response);
};

export const registerAccountRequest = async (
  payload: RegisterAccountPayload,
  accessToken?: string,
): Promise<AccountResponse> => {
  const response = await apiRequest<ApiResponse<AccountResponse> | AccountResponse>(
    "/api/v1/accounts",
    {
      method: "POST",
      body: payload,
      accessToken,
    },
  );

  return unwrapApiData<AccountResponse>(response);
};

export const getAccountById = async (
  accountId: number,
  accessToken: string,
): Promise<AccountResponse> => {
  const response = await apiRequest<ApiResponse<AccountResponse> | AccountResponse>(
    `/api/v1/accounts/${accountId}`,
    {
      method: "GET",
      accessToken,
    },
  );

  return unwrapApiData<AccountResponse>(response);
};

export const getRoles = async (
  accessToken?: string,
): Promise<RoleResponse[]> => {
  const response = await apiRequest<ApiResponse<RoleResponse[]> | RoleResponse[]>(
    "/api/v1/roles",
    {
      method: "GET",
      accessToken,
    },
  );

  return unwrapApiData<RoleResponse[]>(response);
};
