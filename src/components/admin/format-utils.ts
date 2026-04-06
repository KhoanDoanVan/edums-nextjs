const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object";
};

const isCodeToken = (value: string): boolean => {
  return /^[A-Z][A-Z0-9_]+$/.test(value.trim());
};

const normalizeCodeMessage = (code: string): string | null => {
  switch (code) {
    case "ALREADY_EXISTS":
      return "Dữ liệu đã tồn tại.";
    case "NOT_FOUND":
      return "Không tìm thấy dữ liệu.";
    case "FORBIDDEN":
      return "Bạn không có quyền thực hiện thao tác này.";
    case "UNAUTHORIZED":
      return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
    case "VALIDATION_ERROR":
      return "Dữ liệu không hợp lệ.";
    case "SCHEDULE_CONFLICT_SECTION":
      return "Lớp học phần này đã có lịch học trùng ngày và tiết.";
    default:
      return null;
  }
};

const isGenericValidationMessage = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return [
    "validation failed",
    "request validation failed",
    "bad request",
    "invalid request",
    "invalid input",
    "dữ liệu không hợp lệ.",
    "dữ liệu không hợp lệ",
  ].includes(normalized);
};

const extractSpringDefaultMessage = (value: string): string | null => {
  const matches = [...value.matchAll(/default message \[([^\]]+)\]/gi)];
  if (matches.length === 0) {
    return null;
  }

  const candidates = matches
    .map((match) => match[1]?.trim() || "")
    .filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  const preferred = [...candidates]
    .reverse()
    .find((item) => /\s|[\u00C0-\u024F]/.test(item));

  return preferred || candidates[candidates.length - 1];
};

const normalizeMessageValue = (messageValue: string): string | null => {
  const normalized = messageValue.trim();
  if (!normalized) {
    return null;
  }

  if (isCodeToken(normalized)) {
    // Unknown error codes should not be shown directly to users.
    return normalizeCodeMessage(normalized);
  }

  const springDefaultMessage = extractSpringDefaultMessage(normalized);
  if (springDefaultMessage) {
    return springDefaultMessage;
  }

  return normalized;
};

const findSpecificMessage = (value: unknown, depth = 0): string | null => {
  if (depth > 6) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = normalizeMessageValue(value);
    if (!normalized) {
      return null;
    }

    if (isGenericValidationMessage(normalized)) {
      return null;
    }

    if (normalized.startsWith("/")) {
      return null;
    }

    return normalized;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findSpecificMessage(item, depth + 1);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (!isObject(value)) {
    return null;
  }

  const priorityKeys = [
    "defaultMessage",
    "userMessage",
    "detail",
    "details",
    "reason",
    "error",
    "errors",
    "fieldErrors",
    "violations",
    "data",
    "message",
  ] as const;

  for (const key of priorityKeys) {
    if (!(key in value)) {
      continue;
    }

    const candidate = findSpecificMessage(value[key], depth + 1);
    if (candidate) {
      return candidate;
    }
  }

  for (const [key, item] of Object.entries(value)) {
    if (priorityKeys.includes(key as (typeof priorityKeys)[number])) {
      continue;
    }

    if (["timestamp", "path", "status", "exception", "trace"].includes(key)) {
      continue;
    }

    const candidate = findSpecificMessage(item, depth + 1);
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const parseApiJsonMessage = (rawMessage: string): string | null => {
  const jsonStart = rawMessage.indexOf("{");
  const jsonEnd = rawMessage.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return null;
  }

  const jsonPart = rawMessage.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonPart) as unknown;
    if (!isObject(parsed)) {
      return null;
    }

    const specificMessage = findSpecificMessage(parsed);
    if (specificMessage) {
      return specificMessage;
    }

    const messageValue = typeof parsed.message === "string" ? parsed.message : "";
    const normalizedMessage = normalizeMessageValue(messageValue);
    if (normalizedMessage) {
      if (isGenericValidationMessage(normalizedMessage)) {
        return "Dữ liệu không hợp lệ.";
      }

      return normalizedMessage;
    }

    const detailsValue = typeof parsed.details === "string" ? parsed.details : "";
    const normalizedDetails = normalizeMessageValue(detailsValue);
    if (normalizedDetails) {
      return normalizedDetails;
    }

    if (Array.isArray(parsed.errors)) {
      const firstText = parsed.errors
        .map((item) => {
          if (!isObject(item)) {
            return "";
          }

          const defaultMessage =
            typeof item.defaultMessage === "string" ? item.defaultMessage : "";
          const message = typeof item.message === "string" ? item.message : "";
          return defaultMessage || message;
        })
        .find((item) => item.trim().length > 0);

      const normalizedError = firstText ? normalizeMessageValue(firstText) : null;
      if (normalizedError) {
        return normalizedError;
      }
    }

    const pathValue = typeof parsed.path === "string" ? parsed.path.trim() : "";
    if (pathValue && !pathValue.startsWith("/")) {
      const normalizedPath = normalizeMessageValue(pathValue);
      if (normalizedPath) {
        return normalizedPath;
      }
    }

    return null;
  } catch {
    return null;
  }
};

const extractApiSuffixMessage = (rawMessage: string): string | null => {
  const separator = " - ";
  const idx = rawMessage.indexOf(separator);
  if (idx < 0) {
    return null;
  }

  const suffix = rawMessage.slice(idx + separator.length).trim();
  if (!suffix) {
    return null;
  }

  const normalized = normalizeMessageValue(suffix);
  if (normalized) {
    if (isGenericValidationMessage(normalized)) {
      return "Dữ liệu không hợp lệ.";
    }
    return normalized;
  }

  return null;
};

export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    const normalizedMessage = parseApiJsonMessage(error.message);
    if (normalizedMessage) {
      return normalizedMessage;
    }

    const springDefaultMessage = extractSpringDefaultMessage(error.message);
    if (springDefaultMessage) {
      return springDefaultMessage;
    }

    const suffixMessage = extractApiSuffixMessage(error.message);
    if (suffixMessage) {
      return suffixMessage;
    }

    const directMessage = error.message.trim();
    if (isCodeToken(directMessage)) {
      return normalizeCodeMessage(directMessage) || "Thao tác thất bại. Vui lòng thử lại.";
    }

    if (/^\[API\s+\d{3}\]/.test(directMessage)) {
      return "Thao tác thất bại. Vui lòng thử lại.";
    }

    return error.message;
  }

  return "Thao tác thất bại. Vui lòng thử lại.";
};

export const formatDateTime = (value?: string): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN");
};
