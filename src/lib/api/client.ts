import { env } from "@/config/env";
import type { ApiMethod } from "@/lib/api/types";

interface ApiRequestOptions
  extends Omit<RequestInit, "body" | "method" | "headers"> {
  method?: ApiMethod;
  body?: unknown;
  headers?: HeadersInit;
  accessToken?: string;
}

const clientProxyPrefix = "/api/proxy";

const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    return `${clientProxyPrefix}${normalizedPath}`;
  }

  return `${env.apiBaseUrl}${normalizedPath}`;
};

export async function apiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TData> {
  const { method = "GET", body, accessToken, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);
  const hasBody = body !== undefined && body !== null;
  const isFormData = body instanceof FormData;

  if (accessToken) {
    const authorizationValue = accessToken.includes(" ")
      ? accessToken
      : `Bearer ${accessToken}`;
    requestHeaders.set("Authorization", authorizationValue);
  }

  if (hasBody && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    method,
    headers: requestHeaders,
    body: !hasBody
      ? undefined
      : isFormData
        ? (body as FormData)
        : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[API ${response.status}] ${response.statusText} - ${errorText}`,
    );
  }

  if (response.status === 204) {
    return undefined as TData;
  }

  return (await response.json()) as TData;
}
