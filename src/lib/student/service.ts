import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AttendanceResponse,
  ChangePasswordRequest,
  CourseRegistrationRequest,
  CourseRegistrationResponse,
  CourseSectionResponse,
  GradeReportResponse,
  ProfileResponse,
  UpdateProfileRequest,
} from "@/lib/student/types";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const unwrapApiData = <TData>(response: unknown): TData => {
  if (isObject(response) && "data" in response) {
    return response.data as TData;
  }

  return response as TData;
};

const toProfile = (value: unknown): ProfileResponse => {
  if (!isObject(value)) {
    return {};
  }

  return value as ProfileResponse;
};

const toArray = <TItem>(value: unknown): TItem[] => {
  if (Array.isArray(value)) {
    return value as TItem[];
  }

  return [];
};

export const getMyProfile = async (
  authorization: string,
): Promise<ProfileResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/profile/me",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toProfile(unwrapApiData<unknown>(response));
};

export const updateMyProfile = async (
  payload: UpdateProfileRequest,
  authorization: string,
): Promise<ProfileResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/profile/me",
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );

  return toProfile(unwrapApiData<unknown>(response));
};

export const changeMyPassword = async (
  payload: ChangePasswordRequest,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown> | unknown>("/api/v1/profile/password", {
    method: "PUT",
    body: payload,
    accessToken: authorization,
  });
};

export const getMyGradeReports = async (
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

export const getMyAttendance = async (
  studentId: number,
  authorization: string,
): Promise<AttendanceResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/students/${studentId}/attendances`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<AttendanceResponse>(unwrapApiData<unknown>(response));
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

export const registerCourseSection = async (
  payload: CourseRegistrationRequest,
  authorization: string,
): Promise<CourseRegistrationResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/course-registrations",
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );

  return unwrapApiData<CourseRegistrationResponse>(response);
};
