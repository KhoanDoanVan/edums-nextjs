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

const toPublicSelectRows = (value: unknown): Record<string, unknown>[] => {
  return toObjectRows(unwrapApiData<unknown>(value));
};

const toActivePeriodOptions = (value: unknown): PublicSelectOption[] => {
  const rows = toPublicSelectRows(value);

  return rows
    .map((row) => {
      const id = resolveOptionId(row, ["id", "periodId", "value"]);
      if (!id) {
        return null;
      }

      const periodName =
        typeof row.periodName === "string" && row.periodName.trim()
          ? row.periodName.trim()
          : typeof row.name === "string" && row.name.trim()
            ? row.name.trim()
            : `Kỳ #${id}`;

      return {
        id,
        label: periodName,
        raw: row,
      };
    })
    .filter((item): item is PublicSelectOption => item !== null);
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
  const rows = toObjectRows(unwrapApiData<unknown>(value));

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

export const getPublicAdmissionActivePeriods = async (): Promise<PublicSelectOption[]> => {
  const response = await apiRequest<unknown>("/api/v1/public/admissions/active-periods", {
    method: "GET",
  });

  return toActivePeriodOptions(response);
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
