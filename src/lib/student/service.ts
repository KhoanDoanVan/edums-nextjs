import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AdministrativeClassResponse,
  AttendanceResponse,
  ClassSessionResponse,
  ChangePasswordRequest,
  ClassroomResponse,
  CohortResponse,
  CourseResponse,
  CourseRegistrationRequest,
  CourseRegistrationResponse,
  CourseSectionResponse,
  FacultyResponse,
  GradeComponentResponse,
  GradeReportResponse,
  LecturerResponse,
  MajorResponse,
  ProfileResponse,
  RecurringScheduleResponse,
  SpecializationResponse,
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

export const getStudentById = async (
  studentId: number,
  authorization: string,
): Promise<ProfileResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/students/${studentId}`,
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

export const getGradeComponentsByCourse = async (
  courseId: number,
  authorization: string,
): Promise<GradeComponentResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/courses/${courseId}/grade-components`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<GradeComponentResponse>(unwrapApiData<unknown>(response));
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

export const getFaculties = async (
  authorization: string,
): Promise<FacultyResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/faculties",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<FacultyResponse>(unwrapApiData<unknown>(response));
};

export const getFacultyById = async (
  facultyId: number,
  authorization: string,
): Promise<FacultyResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/faculties/${facultyId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<FacultyResponse>(response);
};

export const getCourses = async (
  authorization: string,
): Promise<CourseResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/courses",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<CourseResponse>(unwrapApiData<unknown>(response));
};

export const getCoursesByFaculty = async (
  facultyId: number,
  authorization: string,
): Promise<CourseResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/courses/faculty/${facultyId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<CourseResponse>(unwrapApiData<unknown>(response));
};

export const getMajors = async (
  authorization: string,
): Promise<MajorResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/majors",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<MajorResponse>(unwrapApiData<unknown>(response));
};

export const getMajorById = async (
  majorId: number,
  authorization: string,
): Promise<MajorResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/majors/${majorId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<MajorResponse>(response);
};

export const getLecturerById = async (
  lecturerId: number,
  authorization: string,
): Promise<LecturerResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/lecturers/${lecturerId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<LecturerResponse>(response);
};

export const getMajorsByFaculty = async (
  facultyId: number,
  authorization: string,
): Promise<MajorResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/majors/faculty/${facultyId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<MajorResponse>(unwrapApiData<unknown>(response));
};

export const getSpecializations = async (
  authorization: string,
): Promise<SpecializationResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/specializations",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<SpecializationResponse>(unwrapApiData<unknown>(response));
};

export const getSpecializationsByMajor = async (
  majorId: number,
  authorization: string,
): Promise<SpecializationResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/specializations/major/${majorId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<SpecializationResponse>(unwrapApiData<unknown>(response));
};

export const getAdministrativeClasses = async (
  authorization: string,
): Promise<AdministrativeClassResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/administrative-classes",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<AdministrativeClassResponse>(unwrapApiData<unknown>(response));
};

export const getAdministrativeClassById = async (
  classId: number,
  authorization: string,
): Promise<AdministrativeClassResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/administrative-classes/${classId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<AdministrativeClassResponse>(response);
};

export const getCohorts = async (
  authorization: string,
): Promise<CohortResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/cohorts",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<CohortResponse>(unwrapApiData<unknown>(response));
};

export const getCohortById = async (
  cohortId: number,
  authorization: string,
): Promise<CohortResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/cohorts/${cohortId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<CohortResponse>(response);
};

export const getClassrooms = async (
  authorization: string,
): Promise<ClassroomResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/classrooms",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<ClassroomResponse>(unwrapApiData<unknown>(response));
};

export const getClassroomById = async (
  classroomId: number,
  authorization: string,
): Promise<ClassroomResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/classrooms/${classroomId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<ClassroomResponse>(response);
};

export const getCourseById = async (
  courseId: number,
  authorization: string,
): Promise<CourseResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/courses/${courseId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<CourseResponse>(response);
};

export const getCourseSectionById = async (
  sectionId: number,
  authorization: string,
): Promise<CourseSectionResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-sections/${sectionId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<CourseSectionResponse>(response);
};

export const getCourseSectionsByCourse = async (
  courseId: number,
  authorization: string,
): Promise<CourseSectionResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-sections/course/${courseId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<CourseSectionResponse>(unwrapApiData<unknown>(response));
};

export const getCourseSectionsBySemester = async (
  semesterId: number,
  authorization: string,
): Promise<CourseSectionResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-sections/semester/${semesterId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<CourseSectionResponse>(unwrapApiData<unknown>(response));
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

export const getRecurringScheduleById = async (
  recurringScheduleId: number,
  authorization: string,
): Promise<RecurringScheduleResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/recurring-schedules/${recurringScheduleId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return unwrapApiData<RecurringScheduleResponse>(response);
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

export const getMyCourseRegistrations = async (
  authorization: string,
  semesterId?: number,
): Promise<CourseRegistrationResponse[]> => {
  const query = typeof semesterId === "number" ? `?semesterId=${semesterId}` : "";
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-registrations/me${query}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<CourseRegistrationResponse>(unwrapApiData<unknown>(response));
};
