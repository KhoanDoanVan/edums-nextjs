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

const toArray = <TItem>(value: unknown): TItem[] => {
  if (Array.isArray(value)) {
    return value as TItem[];
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
  guardianId: number,
  studentId: number,
  authorization: string,
): Promise<AttendanceResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/guardians/${guardianId}/students/${studentId}/attendances`,
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
