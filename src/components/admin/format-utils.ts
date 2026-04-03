const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object";
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
    default:
      return null;
  }
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

    const pathValue = typeof parsed.path === "string" ? parsed.path.trim() : "";
    if (pathValue && !pathValue.startsWith("/")) {
      return pathValue;
    }

    const messageValue =
      typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (messageValue) {
      if (/^[A-Z0-9_]+$/.test(messageValue)) {
        return normalizeCodeMessage(messageValue) || messageValue;
      }
      return messageValue;
    }

    return null;
  } catch {
    return null;
  }
};

export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    const normalizedMessage = parseApiJsonMessage(error.message);
    return normalizedMessage || error.message;
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
