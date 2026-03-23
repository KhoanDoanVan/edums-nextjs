const normalizeUrl = (url: string) => url.replace(/\/+$/, "");
const parseNumber = (value?: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
};

const fallbackApiUrl = "http://localhost:8080";
const fallbackSeedAuthToken =
  "eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTc3NDI4NTUyMSwiZXhwIjoxNzc0MzcxOTIxfQ.DCrrevz8wV5Qpy20k4LxhBJuEQfdRy4oE7C5-nLEnQemzQade3g4st9JUiQgxoIg";
const parseBoolean = (value?: string): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
};

const fallbackSeedBypass = process.env.NODE_ENV !== "production";
const parsedSeedBypass = parseBoolean(process.env.NEXT_PUBLIC_ENABLE_SEED_BYPASS);
const parsedSeedStudentId = parseNumber(process.env.NEXT_PUBLIC_SEED_STUDENT_ID);

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "EduMS Frontend",
  apiBaseUrl: normalizeUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || fallbackApiUrl,
  ),
  enableSeedBypass: parsedSeedBypass ?? fallbackSeedBypass,
  seedAuthToken:
    process.env.NEXT_PUBLIC_SEED_AUTH_TOKEN?.trim() || fallbackSeedAuthToken,
  seedStudentId: parsedSeedStudentId && parsedSeedStudentId > 0
    ? Math.trunc(parsedSeedStudentId)
    : 1,
};
