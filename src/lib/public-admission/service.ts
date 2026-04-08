import { apiRequest } from "@/lib/api/client";
import type {
  PublicAdmissionApplyPayload,
  PublicLookupResult,
  PublicSelectOption,
} from "@/lib/public-admission/types";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const unwrapApiData = <TData>(value: unknown): TData => {
  if (isObject(value) && "data" in value) {
    return value.data as TData;
  }

  return value as TData;
};

const toObjectRows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => isObject(item));
};

const extractRowsFromObject = (value: Record<string, unknown>): Record<string, unknown>[] => {
  const prioritizedKeys = [
    "rows",
    "items",
    "content",
    "periods",
    "majors",
    "blocks",
    "list",
    "results",
  ];

  for (const key of prioritizedKeys) {
    const candidateRows = toObjectRows(value[key]);
    if (candidateRows.length > 0) {
      return candidateRows;
    }
  }

  for (const candidate of Object.values(value)) {
    const candidateRows = toObjectRows(candidate);
    if (candidateRows.length > 0) {
      return candidateRows;
    }
  }

  return [];
};

const resolveOptionId = (
  row: Record<string, unknown>,
  candidates: string[],
): number | null => {
  for (const key of candidates) {
    const parsed = Number(row[key]);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

type PublicPeriodStatus = "UPCOMING" | "PAUSED" | "OPEN" | "CLOSED";

const publicPeriodStatusByOrdinal: Record<number, PublicPeriodStatus> = {
  0: "UPCOMING",
  1: "PAUSED",
  2: "OPEN",
  3: "CLOSED",
};

const normalizeStatusToken = (value: string): string => {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
};

const toPublicPeriodStatus = (value: unknown): PublicPeriodStatus | undefined => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return publicPeriodStatusByOrdinal[value];
  }

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized in publicPeriodStatusByOrdinal) {
    return publicPeriodStatusByOrdinal[Number(normalized)];
  }

  if (
    normalized === "OPEN" ||
    normalized === "UPCOMING" ||
    normalized === "PAUSED" ||
    normalized === "CLOSED"
  ) {
    return normalized;
  }

  const token = normalizeStatusToken(value);
  if (token === "DANG_MO" || token === "MO") {
    return "OPEN";
  }
  if (token === "SAP_MO") {
    return "UPCOMING";
  }
  if (token === "TAM_DUNG") {
    return "PAUSED";
  }
  if (token === "DA_DONG") {
    return "CLOSED";
  }

  return undefined;
};

const toPublicPeriodStatusLabel = (status?: PublicPeriodStatus): string => {
  switch (status) {
    case "UPCOMING":
      return "Sắp mở";
    case "OPEN":
      return "Đang mở";
    case "PAUSED":
      return "Tạm dừng";
    case "CLOSED":
      return "Đã đóng";
    default:
      return "";
  }
};

const toPublicSelectRows = (value: unknown): Record<string, unknown>[] => {
  const unwrapped = unwrapApiData<unknown>(value);
  if (Array.isArray(unwrapped)) {
    return toObjectRows(unwrapped);
  }

  if (isObject(unwrapped)) {
    return extractRowsFromObject(unwrapped);
  }

  return [];
};

const toActivePeriodOptions = (value: unknown): PublicSelectOption[] => {
  const rows = toPublicSelectRows(value);
  const options = rows
    .map((row) => {
      const id = resolveOptionId(row, ["id", "periodId", "value"]);
      if (!id) {
        return null;
      }

      const periodName =
        typeof row.periodName === "string" && row.periodName.trim()
          ? row.periodName.trim()
          : typeof row.period_name === "string" && row.period_name.trim()
            ? row.period_name.trim()
          : typeof row.name === "string" && row.name.trim()
            ? row.name.trim()
            : `Kỳ #${id}`;
      const status = toPublicPeriodStatus(
        row.status ?? row.periodStatus ?? row.period_status ?? row.state,
      );
      if (status && !["OPEN", "UPCOMING"].includes(status)) {
        return null;
      }

      const statusLabel = toPublicPeriodStatusLabel(status);
      const label = statusLabel ? `${periodName} (${statusLabel})` : periodName;

      return {
        id,
        label,
        raw: row,
      };
    })
    .filter((item): item is PublicSelectOption => item !== null);

  const deduped = new Map<number, PublicSelectOption>();
  options.forEach((item) => {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  });

  return [...deduped.values()];
};

const toMajorOptions = (value: unknown): PublicSelectOption[] => {
  const rows = toPublicSelectRows(value);

  return rows
    .map((row) => {
      const id = resolveOptionId(row, ["id", "majorId", "value"]);
      if (!id) {
        return null;
      }

      const majorName =
        typeof row.majorName === "string" && row.majorName.trim()
          ? row.majorName.trim()
          : typeof row.name === "string" && row.name.trim()
            ? row.name.trim()
            : `Ngành #${id}`;
      const majorCode =
        typeof row.majorCode === "string" && row.majorCode.trim()
          ? row.majorCode.trim()
          : typeof row.code === "string" && row.code.trim()
            ? row.code.trim()
            : "";

      return {
        id,
        label: majorCode ? `${majorName} - ${majorCode}` : majorName,
        raw: row,
      };
    })
    .filter((item): item is PublicSelectOption => item !== null);
};

const toBlockOptions = (value: unknown): PublicSelectOption[] => {
  const rows = toPublicSelectRows(value);

  return rows
    .map((row) => {
      const id = resolveOptionId(row, ["id", "blockId", "value"]);
      if (!id) {
        return null;
      }

      const blockName =
        typeof row.blockName === "string" && row.blockName.trim()
          ? row.blockName.trim()
          : typeof row.name === "string" && row.name.trim()
            ? row.name.trim()
            : `Khối #${id}`;

      return {
        id,
        label: blockName,
        raw: row,
      };
    })
    .filter((item): item is PublicSelectOption => item !== null);
};

const mergePublicSelectOptions = (
  ...groups: PublicSelectOption[][]
): PublicSelectOption[] => {
  const merged = new Map<number, PublicSelectOption>();
  groups.forEach((group) => {
    group.forEach((item) => {
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    });
  });

  return [...merged.values()];
};

export const getPublicAdmissionActivePeriods = async (): Promise<PublicSelectOption[]> => {
  const primaryPaths = [
    "/api/v1/public/admissions/periods",
    "/api/v1/public/admissions/active-periods",
    "/api/v1/public/admissions/periods/active",
  ];
  const secondaryPaths = [
    "/api/v1/public/admissions/periods/upcoming",
    "/api/v1/public/admissions/upcoming-periods",
  ];

  let primaryOptions: PublicSelectOption[] = [];

  for (const optionPath of primaryPaths) {
    try {
      const data = await apiRequest<unknown>(optionPath, {
        method: "GET",
      });
      const options = toActivePeriodOptions(data);
      if (options.length > 0) {
        primaryOptions = options;
        break;
      }
    } catch (error) {
      if (error instanceof Error) {
        const normalizedMessage = error.message.toLowerCase();
        const isRecoverableApiError =
          normalizedMessage.includes("[api 404]") ||
          normalizedMessage.includes("[api 400]") ||
          normalizedMessage.includes("[api 405]") ||
          normalizedMessage.includes("[api 500]") ||
          normalizedMessage.includes("[api 503]") ||
          normalizedMessage.includes("methodargumenttypemismatchexception");

        if (isRecoverableApiError) {
          continue;
        }

        const isRecoverableTransportError =
          normalizedMessage.includes("failed to fetch") ||
          normalizedMessage.includes("backend api không phản hồi") ||
          normalizedMessage.includes("không thể kết nối đến backend api");
        if (isRecoverableTransportError) {
          continue;
        }
      }
      continue;
    }
  }

  const secondaryOptionsGroup: PublicSelectOption[][] = [];
  for (const optionPath of secondaryPaths) {
    try {
      const data = await apiRequest<unknown>(optionPath, {
        method: "GET",
      });
      const options = toActivePeriodOptions(data);
      if (options.length > 0) {
        secondaryOptionsGroup.push(options);
      }
    } catch {
      // optional endpoint; ignore errors to keep apply page available
    }
  }

  return mergePublicSelectOptions(primaryOptions, ...secondaryOptionsGroup);
};

export const getPublicAdmissionMajorsByPeriod = async (
  periodId: number,
): Promise<PublicSelectOption[]> => {
  const response = await apiRequest<unknown>(
    `/api/v1/public/admissions/periods/${periodId}/majors`,
    {
      method: "GET",
    },
  );

  return toMajorOptions(response);
};

export const getPublicAdmissionBlocksByPeriodMajor = async (
  periodId: number,
  majorId: number,
): Promise<PublicSelectOption[]> => {
  const response = await apiRequest<unknown>(
    `/api/v1/public/admissions/periods/${periodId}/majors/${majorId}/blocks`,
    {
      method: "GET",
    },
  );

  return toBlockOptions(response);
};

export const lookupPublicAdmissions = async (
  nationalId: string,
  phone: string,
): Promise<PublicLookupResult[]> => {
  const query = new URLSearchParams({
    nationalId,
    phone,
  });

  const response = await apiRequest<unknown>(
    `/api/v1/public/admissions/lookup?${query.toString()}`,
    {
      method: "GET",
    },
  );

  const rows = unwrapApiData<unknown>(response);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((item) => (isObject(item) ? item : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      fullName: typeof item.fullName === "string" ? item.fullName : undefined,
      nationalId: typeof item.nationalId === "string" ? item.nationalId : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
      periodName: typeof item.periodName === "string" ? item.periodName : undefined,
      majorName: typeof item.majorName === "string" ? item.majorName : undefined,
      blockName: typeof item.blockName === "string" ? item.blockName : undefined,
      totalScore:
        typeof item.totalScore === "number"
          ? item.totalScore
          : Number.isFinite(Number(item.totalScore))
            ? Number(item.totalScore)
            : undefined,
    }));
};

export const submitPublicAdmissionApplication = async (
  payload: PublicAdmissionApplyPayload,
): Promise<void> => {
  await apiRequest<unknown>("/api/v1/public/admissions/apply", {
    method: "POST",
    body: payload,
  });
};
