import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AttendanceResponse,
  GradeReportResponse,
} from "@/lib/guardian/types";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const unwrapApiData = <TData>(value: unknown): TData => {
  if (isObject(value) && "data" in value) {
    return value.data as TData;
  }

  return value as TData;
};

const buildQueryString = (params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

const toArray = <TItem>(value: unknown): TItem[] => {
  if (Array.isArray(value)) {
    return value as TItem[];
  }

  if (isObject(value)) {
    if (Array.isArray(value.data)) {
      return value.data as TItem[];
    }

    if (Array.isArray(value.content)) {
      return value.content as TItem[];
    }

    if (Array.isArray(value.items)) {
      return value.items as TItem[];
    }

    if (isObject(value.data)) {
      const nested = value.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) {
        return nested.data as TItem[];
      }
      if (Array.isArray(nested.content)) {
        return nested.content as TItem[];
      }
      if (Array.isArray(nested.items)) {
        return nested.items as TItem[];
      }
    }
  }

  return [];
};

export const getMyProfile = async (
  authorization: string,
): Promise<Record<string, unknown>> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/profile/me",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  const payload = unwrapApiData<unknown>(response);
  return isObject(payload) ? payload : {};
};

export const getGuardianById = async (
  guardianId: number,
  authorization: string,
): Promise<Record<string, unknown>> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/guardians/${guardianId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  const payload = unwrapApiData<unknown>(response);
  return isObject(payload) ? payload : {};
};

export const getGuardians = async (
  authorization: string,
  filter: {
    keyword?: string;
    page?: number;
    size?: number;
  } = {},
): Promise<Record<string, unknown>[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/guardians${buildQueryString({
      keyword: filter.keyword?.trim(),
      page: filter.page ?? 0,
      size: filter.size ?? 50,
    })}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<Record<string, unknown>>(unwrapApiData<unknown>(response)).filter(
    (item) => isObject(item),
  );
};

export const getStudentById = async (
  studentId: number,
  authorization: string,
): Promise<Record<string, unknown>> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/students/${studentId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  const payload = unwrapApiData<unknown>(response);
  return isObject(payload) ? payload : {};
};

export const getGuardianStudentAttendances = async (
  studentId: number,
  authorization: string,
): Promise<AttendanceResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/guardians/me/students/${studentId}/attendances`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<AttendanceResponse>(unwrapApiData<unknown>(response));
};

export const getStudentGradeReports = async (
  studentId: number,
  authorization: string,
): Promise<GradeReportResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/students/${studentId}/grade-reports`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<GradeReportResponse>(unwrapApiData<unknown>(response));
};

export const getGradeReportById = async (
  gradeReportId: number,
  authorization: string,
): Promise<GradeReportResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/grade-reports/${gradeReportId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<GradeReportResponse>(response);
};
