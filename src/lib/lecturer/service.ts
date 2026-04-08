import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AttendanceBatchRequest,
  AttendanceUpdateRequest,
  AttendanceResponse,
  ClassSessionResponse,
  CourseSectionResponse,
  GradeReportResponse,
  LecturerScheduleRow,
  RecurringScheduleResponse,
} from "@/lib/lecturer/types";

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

const toScheduleRows = (value: unknown): LecturerScheduleRow[] => {
  const payload = unwrapApiData<unknown>(value);

  if (Array.isArray(payload)) {
    return payload.filter((item): item is LecturerScheduleRow => isObject(item));
  }

  if (isObject(payload)) {
    if (Array.isArray(payload.items)) {
      return payload.items.filter((item): item is LecturerScheduleRow => isObject(item));
    }
    if (Array.isArray(payload.content)) {
      return payload.content.filter((item): item is LecturerScheduleRow => isObject(item));
    }
    if (Array.isArray(payload.data)) {
      return payload.data.filter((item): item is LecturerScheduleRow => isObject(item));
    }

    return [payload];
  }

  return [];
};

export const getMyLecturerSchedule = async (
  startDate: string,
  endDate: string,
  authorization: string,
): Promise<LecturerScheduleRow[]> => {
  const query = new URLSearchParams({
    startDate,
    endDate,
  });

  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/schedules/lecturers/me?${query.toString()}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toScheduleRows(response);
};

export const getCourseSections = async (
  authorization: string,
): Promise<CourseSectionResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/course-sections",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<CourseSectionResponse>(unwrapApiData<unknown>(response));
};

export const getGradeReportsBySection = async (
  sectionId: number,
  authorization: string,
): Promise<GradeReportResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-sections/${sectionId}/grade-reports`,
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

export const getRecurringSchedulesBySection = async (
  sectionId: number,
  authorization: string,
): Promise<RecurringScheduleResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/recurring-schedules/section/${sectionId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<RecurringScheduleResponse>(unwrapApiData<unknown>(response));
};

export const getRecurringScheduleSessions = async (
  recurringScheduleId: number,
  authorization: string,
): Promise<ClassSessionResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/recurring-schedules/${recurringScheduleId}/sessions`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<ClassSessionResponse>(unwrapApiData<unknown>(response));
};

export const getAttendancesBySession = async (
  sessionId: number,
  authorization: string,
): Promise<AttendanceResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/class-sessions/${sessionId}/attendances`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<AttendanceResponse>(unwrapApiData<unknown>(response));
};

export const saveAttendancesBySession = async (
  sessionId: number,
  payload: AttendanceBatchRequest,
  authorization: string,
): Promise<AttendanceResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/class-sessions/${sessionId}/attendances/batch`,
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );

  return toArray<AttendanceResponse>(unwrapApiData<unknown>(response));
};

export const updateAttendance = async (
  attendanceId: number,
  payload: AttendanceUpdateRequest,
  authorization: string,
): Promise<AttendanceResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/attendances/${attendanceId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );

  return unwrapApiData<AttendanceResponse>(response);
};
