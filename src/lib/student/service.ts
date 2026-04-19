import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AdministrativeClassResponse,
  AvailableCourseSectionResponse,
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
  GradeOverviewResponse,
  GradeReportResponse,
  GradeSemesterSummaryResponse,
  LecturerResponse,
  MajorResponse,
  ProfileResponse,
  RecurringScheduleResponse,
  ScheduleSemesterOptionResponse,
  SemesterResponse,
  SpecializationResponse,
  CourseRegistrationSwitchRequest,
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

const toPositiveInteger = (raw: unknown): number | undefined => {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return raw;
  }

  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
};

const toNullableNumber = (raw: unknown): number | null | undefined => {
  if (raw === null) {
    return null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const getString = (raw: unknown): string | undefined => {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
};

const toGradeStatus = (raw: unknown): GradeReportResponse["status"] | undefined => {
  const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (normalized === "DRAFT" || normalized === "PUBLISHED" || normalized === "LOCKED") {
    return normalized;
  }

  return undefined;
};

const toGradeDetails = (value: unknown): GradeReportResponse["gradeDetails"] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => {
      const componentId =
        toPositiveInteger(item.componentId) ||
        toPositiveInteger(item.gradeComponentId) ||
        toPositiveInteger(item.id);

      if (!componentId) {
        return null;
      }

      return {
        id: toPositiveInteger(item.id),
        componentId,
        componentName: getString(item.componentName) || getString(item.name),
        weightPercentage: toNullableNumber(item.weightPercentage) ?? undefined,
        score: toNullableNumber(item.score) ?? undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

const toGradeReport = (value: unknown): GradeReportResponse | null => {
  if (!isObject(value)) {
    return null;
  }

  const item = value;
  const nestedReport = isObject(item.gradeReport) ? item.gradeReport : undefined;
  const nestedStudent = isObject(item.student) ? item.student : undefined;
  const nestedRegistration =
    (isObject(item.courseRegistration) ? item.courseRegistration : undefined) ||
    (isObject(item.registration) ? item.registration : undefined);
  const nestedSection =
    (isObject(item.courseSection) ? item.courseSection : undefined) ||
    (nestedRegistration && isObject(nestedRegistration.courseSection)
      ? nestedRegistration.courseSection
      : undefined);
  const nestedCourse =
    (isObject(item.course) ? item.course : undefined) ||
    (nestedSection && isObject(nestedSection.course) ? nestedSection.course : undefined);

  const registrationId =
    toPositiveInteger(item.registrationId) ||
    toPositiveInteger(item.courseRegistrationId) ||
    (nestedRegistration
      ? toPositiveInteger(nestedRegistration.id) ||
        toPositiveInteger(nestedRegistration.registrationId) ||
        toPositiveInteger(nestedRegistration.courseRegistrationId)
      : undefined);

  const persistedGradeReportId =
    toPositiveInteger(item.gradeReportId) ||
    toPositiveInteger(item.id) ||
    (nestedReport
      ? toPositiveInteger(nestedReport.id) || toPositiveInteger(nestedReport.gradeReportId)
      : undefined);

  const syntheticId = registrationId ? -registrationId : undefined;
  const rowId = persistedGradeReportId || syntheticId;

  if (!rowId) {
    return null;
  }

  const detailRows = Array.isArray(item.gradeDetails)
    ? item.gradeDetails
    : nestedReport && Array.isArray(nestedReport.gradeDetails)
      ? nestedReport.gradeDetails
      : [];

  return {
    id: rowId,
    gradeReportId: persistedGradeReportId ?? null,
    registrationId,
    studentId:
      toPositiveInteger(item.studentId) ||
      (nestedStudent ? toPositiveInteger(nestedStudent.id) : undefined),
    studentName:
      getString(item.studentName) ||
      (nestedStudent
        ? getString(nestedStudent.fullName) || getString(nestedStudent.studentName)
        : undefined),
    studentCode:
      getString(item.studentCode) ||
      (nestedStudent ? getString(nestedStudent.studentCode) : undefined),
    sectionId:
      toPositiveInteger(item.sectionId) ||
      toPositiveInteger(item.courseSectionId) ||
      (nestedSection
        ? toPositiveInteger(nestedSection.id) || toPositiveInteger(nestedSection.sectionId)
        : undefined),
    sectionCode:
      getString(item.sectionCode) ||
      (nestedSection ? getString(nestedSection.sectionCode) : undefined),
    semesterId:
      toPositiveInteger(item.semesterId) ||
      (nestedSection ? toPositiveInteger(nestedSection.semesterId) : undefined),
    semesterNumber:
      toPositiveInteger(item.semesterNumber) ||
      (nestedSection ? toPositiveInteger(nestedSection.semesterNumber) : undefined),
    academicYear:
      getString(item.academicYear) ||
      (nestedSection ? getString(nestedSection.academicYear) : undefined),
    courseCode:
      getString(item.courseCode) ||
      (nestedSection
        ? getString(nestedSection.courseCode) || getString(nestedSection.subjectCode)
        : undefined) ||
      (nestedCourse
        ? getString(nestedCourse.courseCode) || getString(nestedCourse.subjectCode)
        : undefined),
    credits:
      toNullableNumber(item.credits) ??
      (nestedSection ? toNullableNumber(nestedSection.credits) : undefined) ??
      (nestedCourse ? toNullableNumber(nestedCourse.credits) : undefined) ??
      undefined,
    courseName:
      getString(item.courseName) ||
      (nestedSection
        ? getString(nestedSection.courseName) || getString(nestedSection.subjectName)
        : undefined) ||
      (nestedCourse
        ? getString(nestedCourse.courseName) || getString(nestedCourse.name)
        : undefined),
    finalScore:
      toNullableNumber(item.finalScore) ??
      toNullableNumber(item.score) ??
      (nestedReport
        ? toNullableNumber(nestedReport.finalScore) ?? toNullableNumber(nestedReport.score)
        : undefined) ??
      undefined,
    letterGrade:
      getString(item.letterGrade) ||
      getString(item.gradeLetter) ||
      (nestedReport
        ? getString(nestedReport.letterGrade) || getString(nestedReport.gradeLetter)
        : undefined),
    status:
      toGradeStatus(item.status) ||
      toGradeStatus(item.gradeStatus) ||
      (nestedReport ? toGradeStatus(nestedReport.status) : undefined),
    createdAt:
      getString(item.createdAt) ||
      (nestedReport ? getString(nestedReport.createdAt) : undefined),
    gradeDetails: toGradeDetails(detailRows),
  };
};

const toGradeReportList = (value: unknown): GradeReportResponse[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toGradeReport(item))
      .filter((item): item is GradeReportResponse => item !== null);
  }

  if (isObject(value)) {
    const rows = Array.isArray(value.items)
      ? value.items
      : Array.isArray(value.content)
        ? value.content
        : Array.isArray(value.rows)
          ? value.rows
          : Array.isArray(value.data)
            ? value.data
            : null;

    if (rows) {
      return rows
        .map((item) => toGradeReport(item))
        .filter((item): item is GradeReportResponse => item !== null);
    }

    const single = toGradeReport(value);
    return single ? [single] : [];
  }

  return [];
};

const toGradeSemesterSummary = (
  value: unknown,
): GradeSemesterSummaryResponse | null => {
  if (!isObject(value)) {
    return null;
  }

  return {
    semesterId: toPositiveInteger(value.semesterId),
    semesterNumber: toNullableNumber(value.semesterNumber) ?? null,
    academicYear: getString(value.academicYear) ?? null,
    semesterAverage10: toNullableNumber(value.semesterAverage10) ?? null,
    semesterEarnedCredits: toNullableNumber(value.semesterEarnedCredits) ?? null,
  };
};

const toGradeSemesterSummaryList = (
  value: unknown,
): GradeSemesterSummaryResponse[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toGradeSemesterSummary(item))
      .filter((item): item is GradeSemesterSummaryResponse => item !== null);
  }

  if (isObject(value)) {
    const rows = Array.isArray(value.items)
      ? value.items
      : Array.isArray(value.content)
        ? value.content
        : Array.isArray(value.rows)
          ? value.rows
          : Array.isArray(value.data)
            ? value.data
            : null;

    if (rows) {
      return rows
        .map((item) => toGradeSemesterSummary(item))
        .filter((item): item is GradeSemesterSummaryResponse => item !== null);
    }

    const single = toGradeSemesterSummary(value);
    return single ? [single] : [];
  }

  return [];
};

const toGradeOverview = (value: unknown): GradeOverviewResponse => {
  if (!isObject(value)) {
    return {
      reports: [],
      semesterSummaries: [],
      cumulativeAverage10: null,
      cumulativeEarnedCredits: null,
    };
  }

  return {
    reports: toGradeReportList(value.reports),
    semesterSummaries: toGradeSemesterSummaryList(value.semesterSummaries),
    cumulativeAverage10: toNullableNumber(value.cumulativeAverage10) ?? null,
    cumulativeEarnedCredits: toNullableNumber(value.cumulativeEarnedCredits) ?? null,
  };
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

export const getMyStudentProfile = async (
  authorization: string,
): Promise<ProfileResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/students/me",
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
  authorization: string,
): Promise<GradeReportResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/students/me/grade-reports",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toGradeReportList(unwrapApiData<unknown>(response));
};

export const getMyGradeOverview = async (
  authorization: string,
): Promise<GradeOverviewResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/students/me/grade-reports/overview",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toGradeOverview(unwrapApiData<unknown>(response));
};

export const getGradeReportById = async (
  gradeReportId: number,
  authorization: string,
): Promise<GradeReportResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/students/me/grade-reports/${gradeReportId}`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  const parsed = toGradeReport(unwrapApiData<unknown>(response));

  return (
    parsed || {
      id: gradeReportId,
      gradeReportId,
    }
  );
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
  authorization: string,
): Promise<AttendanceResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/students/me/attendances",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<AttendanceResponse>(unwrapApiData<unknown>(response));
};

export const getSemesters = async (
  authorization: string,
): Promise<SemesterResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/semesters",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<SemesterResponse>(unwrapApiData<unknown>(response));
};

export const getMyScheduleSemesterOptions = async (
  authorization: string,
): Promise<ScheduleSemesterOptionResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/schedules/students/me/semester-options",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<ScheduleSemesterOptionResponse>(unwrapApiData<unknown>(response));
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

export const getAvailableCourseSections = async (
  authorization: string,
  filters: {
    facultyId?: number;
    courseId?: number;
    semesterId?: number;
    keyword?: string;
  } = {},
): Promise<AvailableCourseSectionResponse[]> => {
  const query = new URLSearchParams();

  if (typeof filters.facultyId === "number" && Number.isFinite(filters.facultyId)) {
    query.set("facultyId", String(filters.facultyId));
  }

  if (typeof filters.courseId === "number" && Number.isFinite(filters.courseId)) {
    query.set("courseId", String(filters.courseId));
  }

  if (typeof filters.semesterId === "number" && Number.isFinite(filters.semesterId)) {
    query.set("semesterId", String(filters.semesterId));
  }

  if (filters.keyword?.trim()) {
    query.set("keyword", filters.keyword.trim());
  }

  const queryString = query.toString();
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
      `/api/v1/course-registrations/available-sections${
      queryString ? `?${queryString}` : ""
    }`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<AvailableCourseSectionResponse>(unwrapApiData<unknown>(response));
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

export const cancelCourseRegistration = async (
  registrationId: number,
  authorization: string,
): Promise<CourseRegistrationResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-registrations/${registrationId}/cancel`,
    {
      method: "PATCH",
      accessToken: authorization,
    },
  );

  return unwrapApiData<CourseRegistrationResponse>(response);
};

export const switchCourseRegistration = async (
  registrationId: number,
  payload: CourseRegistrationSwitchRequest,
  authorization: string,
): Promise<CourseRegistrationResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-registrations/${registrationId}/switch`,
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
