import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AttendanceRosterResponse,
  AttendanceBatchRequest,
  AttendanceResponse,
  ClassSessionResponse,
  CourseSectionResponse,
  GradeEntryComponentResponse,
  GradeEntryRosterResponse,
  GradeEntryRosterRowResponse,
  GradeReportStatus,
  GradeReportUpsertRequest,
  GradeReportResponse,
  LecturerSemesterOptionResponse,
  LecturerScheduleRow,
  RecurringScheduleResponse,
  SectionRosterResponse,
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

const toCourseSections = (value: unknown): CourseSectionResponse[] => {
  const payload = unwrapApiData<unknown>(value);

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

  const getString = (raw: unknown): string | undefined => {
    return typeof raw === "string" && raw.trim() ? raw : undefined;
  };

  const mapSection = (item: Record<string, unknown>): CourseSectionResponse | null => {
    const semesterObject =
      (isObject(item.semester) ? item.semester : undefined) ||
      (isObject(item.semesterInfo) ? item.semesterInfo : undefined) ||
      (isObject(item.semesterResponse) ? item.semesterResponse : undefined);

    const id =
      toPositiveInteger(item.id) ||
      toPositiveInteger(item.sectionId) ||
      toPositiveInteger(item.courseSectionId);
    if (!id) {
      return null;
    }

    return {
      id,
      sectionCode: getString(item.sectionCode) || getString(item.sectionName),
      displayName: getString(item.displayName) || getString(item.sectionDisplayName),
      courseId: toPositiveInteger(item.courseId),
      courseName:
        getString(item.courseName) ||
        getString(item.subjectName) ||
        getString(item.courseDisplayName),
      courseCode: getString(item.courseCode) || getString(item.subjectCode),
      lecturerId: toPositiveInteger(item.lecturerId) || toPositiveInteger(item.teacherId),
      lecturerName: getString(item.lecturerName) || getString(item.teacherName),
      semesterId:
        toPositiveInteger(item.semesterId) ||
        toPositiveInteger(item.semester_id) ||
        toPositiveInteger(item.semesterID) ||
        (semesterObject
          ? toPositiveInteger(semesterObject.id) ||
            toPositiveInteger(semesterObject.semesterId) ||
            toPositiveInteger(semesterObject.semester_id)
          : undefined),
      semesterNumber:
        toPositiveInteger(item.semesterNumber) ||
        (semesterObject ? toPositiveInteger(semesterObject.semesterNumber) : undefined),
      academicYear:
        getString(item.academicYear) ||
        (semesterObject ? getString(semesterObject.academicYear) : undefined),
      maxCapacity: toPositiveInteger(item.maxCapacity) || toPositiveInteger(item.capacity),
      status: getString(item.status) as
        | "DRAFT"
        | "OPEN"
        | "ONGOING"
        | "FINISHED"
        | "CANCELLED"
        | undefined,
      createdAt: getString(item.createdAt),
    };
  };

  const normalizeSectionList = (rows: unknown[]): CourseSectionResponse[] => {
    return rows
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item) => mapSection(item))
      .filter((item): item is CourseSectionResponse => item !== null);
  };

  if (Array.isArray(payload)) {
    return normalizeSectionList(payload);
  }

  if (isObject(payload)) {
    if (Array.isArray(payload.items)) {
      return normalizeSectionList(payload.items);
    }
    if (Array.isArray(payload.content)) {
      return normalizeSectionList(payload.content);
    }
    if (Array.isArray(payload.rows)) {
      return normalizeSectionList(payload.rows);
    }
    if (Array.isArray(payload.data)) {
      return normalizeSectionList(payload.data);
    }
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

const toGradeStatus = (raw: unknown): GradeReportStatus | null | undefined => {
  if (raw === null) {
    return null;
  }

  const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (normalized === "DRAFT" || normalized === "PUBLISHED" || normalized === "LOCKED") {
    return normalized;
  }

  return undefined;
};

const mapGradeEntryComponent = (
  item: Record<string, unknown>,
): GradeEntryComponentResponse | null => {
  const componentId =
    toPositiveInteger(item.componentId) ||
    toPositiveInteger(item.id) ||
    toPositiveInteger(item.gradeComponentId);
  if (!componentId) {
    return null;
  }

  return {
    componentId,
    componentName: getString(item.componentName) || getString(item.name),
    weightPercentage: toNullableNumber(item.weightPercentage) ?? undefined,
  } satisfies GradeEntryComponentResponse;
};

const toGradeComponents = (value: unknown): GradeEntryComponentResponse[] => {
  const payload = unwrapApiData<unknown>(value);
  const source = isObject(payload) ? payload : {};

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(source.items)
      ? source.items
      : Array.isArray(source.rows)
        ? source.rows
        : Array.isArray(source.content)
          ? source.content
          : Array.isArray(source.data)
            ? source.data
            : [];

  return rows
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => mapGradeEntryComponent(item))
    .filter((item): item is GradeEntryComponentResponse => item !== null);
};

const toGradeEntryRoster = (value: unknown): GradeEntryRosterResponse => {
  const payload = unwrapApiData<unknown>(value);
  const directSource = isObject(payload) ? payload : {};

  const source =
    isObject(directSource.data) &&
    (Array.isArray(directSource.data.components) || Array.isArray(directSource.data.rows))
      ? (directSource.data as Record<string, unknown>)
      : directSource;

  const componentRows = Array.isArray(source.components) ? source.components : [];
  const rosterRows = Array.isArray(source.rows)
    ? source.rows
    : Array.isArray((source as Record<string, unknown>).items)
      ? ((source as Record<string, unknown>).items as unknown[])
      : [];

  const components: GradeEntryComponentResponse[] = componentRows
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => mapGradeEntryComponent(item))
    .filter((item): item is GradeEntryComponentResponse => item !== null);

  const rows: GradeEntryRosterRowResponse[] = rosterRows
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => {
      const nestedReport = isObject(item.gradeReport) ? item.gradeReport : undefined;
      const nestedStudent = isObject(item.student) ? item.student : undefined;

      const registrationId =
        toPositiveInteger(item.registrationId) ||
        toPositiveInteger(item.courseRegistrationId) ||
        toPositiveInteger(item.registration_id);

      if (!registrationId) {
        return null;
      }

      const detailRows = Array.isArray(item.gradeDetails)
        ? item.gradeDetails
        : nestedReport && Array.isArray(nestedReport.gradeDetails)
          ? nestedReport.gradeDetails
          : [];

      const gradeDetails = detailRows
        .filter((detail): detail is Record<string, unknown> => isObject(detail))
        .map((detail) => {
          const componentId =
            toPositiveInteger(detail.componentId) ||
            toPositiveInteger(detail.id) ||
            toPositiveInteger(detail.gradeComponentId);

          if (!componentId) {
            return null;
          }

          return {
            id: toPositiveInteger(detail.id),
            componentId,
            componentName:
              getString(detail.componentName) ||
              getString(detail.name) ||
              undefined,
            weightPercentage: toNullableNumber(detail.weightPercentage) ?? undefined,
            score: toNullableNumber(detail.score) ?? undefined,
          };
        })
        .filter((detail): detail is NonNullable<typeof detail> => detail !== null);

      return {
        registrationId,
        studentId:
          toPositiveInteger(item.studentId) ||
          (nestedStudent ? toPositiveInteger(nestedStudent.id) : undefined),
        studentCode:
          getString(item.studentCode) ||
          (nestedStudent ? getString(nestedStudent.studentCode) : undefined),
        studentName:
          getString(item.studentName) ||
          (nestedStudent ? getString(nestedStudent.fullName) || getString(nestedStudent.studentName) : undefined),
        gradeReportId:
          toNullableNumber(item.gradeReportId) ??
          (nestedReport ? toNullableNumber(nestedReport.id) : undefined),
        finalScore:
          toNullableNumber(item.finalScore) ??
          (nestedReport ? toNullableNumber(nestedReport.finalScore) : undefined),
        letterGrade:
          getString(item.letterGrade) ||
          (nestedReport ? getString(nestedReport.letterGrade) : undefined) ||
          null,
        status:
          toGradeStatus(item.status) ??
          toGradeStatus(item.gradeStatus) ??
          (nestedReport ? toGradeStatus(nestedReport.status) : undefined) ??
          null,
        gradeDetails,
      } satisfies GradeEntryRosterRowResponse;
    })
    .filter((item): item is GradeEntryRosterRowResponse => item !== null);

  return {
    sectionId: toPositiveInteger(source.sectionId),
    sectionCode: getString(source.sectionCode),
    courseId: toPositiveInteger(source.courseId),
    courseCode: getString(source.courseCode),
    courseName: getString(source.courseName),
    components,
    rows,
  };
};

export const getMyLecturerSchedule = async (
  semesterId: number,
  authorization: string,
): Promise<LecturerScheduleRow[]> => {
  const query = new URLSearchParams({
    semesterId: String(semesterId),
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
    "/api/v1/lecturers/me/course-sections",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toCourseSections(response);
};

export const getLecturerSemesterOptions = async (
  authorization: string,
): Promise<LecturerSemesterOptionResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/semesters",
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  const semesters = toArray<Record<string, unknown>>(unwrapApiData<unknown>(response));

  return semesters
    .map((semester) => {
      const semesterId = Number(semester.id);
      if (!Number.isInteger(semesterId) || semesterId <= 0) {
        return null;
      }

      return {
        semesterId,
        semesterNumber:
          typeof semester.semesterNumber === "number"
            ? semester.semesterNumber
            : undefined,
        academicYear:
          typeof semester.academicYear === "string" ? semester.academicYear : undefined,
        displayName:
          typeof semester.displayName === "string" ? semester.displayName : undefined,
        startDate: typeof semester.startDate === "string" ? semester.startDate : undefined,
        endDate: typeof semester.endDate === "string" ? semester.endDate : undefined,
        totalWeeks:
          typeof semester.totalWeeks === "number" ? semester.totalWeeks : undefined,
        semesterStatus:
          typeof semester.status === "string"
            ? (semester.status as
                | "PLANNING"
                | "REGISTRATION_OPEN"
                | "ONGOING"
                | "FINISHED")
            : undefined,
      } satisfies LecturerSemesterOptionResponse;
    })
    .filter((item): item is LecturerSemesterOptionResponse => item !== null);
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

export const getGradeEntryRosterBySection = async (
  sectionId: number,
  authorization: string,
): Promise<GradeEntryRosterResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-sections/${sectionId}/grade-entry-roster`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toGradeEntryRoster(response);
};

export const getGradeComponentsByCourse = async (
  courseId: number,
  authorization: string,
): Promise<GradeEntryComponentResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/courses/${courseId}/grade-components`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toGradeComponents(response);
};

export const createGradeReport = async (
  payload: GradeReportUpsertRequest,
  authorization: string,
): Promise<GradeReportResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    "/api/v1/grade-reports",
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );

  return unwrapApiData<GradeReportResponse>(response);
};

export const updateGradeReport = async (
  gradeReportId: number,
  payload: GradeReportUpsertRequest,
  authorization: string,
): Promise<GradeReportResponse> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/grade-reports/${gradeReportId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );

  return unwrapApiData<GradeReportResponse>(response);
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

export const getSectionRoster = async (
  sectionId: number,
  authorization: string,
): Promise<SectionRosterResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-sections/${sectionId}/roster`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<SectionRosterResponse>(unwrapApiData<unknown>(response));
};

export const syncSectionRoster = async (
  sectionId: number,
  authorization: string,
): Promise<SectionRosterResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/course-sections/${sectionId}/roster/sync`,
    {
      method: "POST",
      accessToken: authorization,
    },
  );

  return toArray<SectionRosterResponse>(unwrapApiData<unknown>(response));
};

export const getAttendanceRosterBySession = async (
  sessionId: number,
  authorization: string,
): Promise<AttendanceRosterResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/class-sessions/${sessionId}/attendance-roster`,
    {
      method: "GET",
      accessToken: authorization,
    },
  );

  return toArray<AttendanceRosterResponse>(unwrapApiData<unknown>(response));
};

export const syncAttendancesBySession = async (
  sessionId: number,
  authorization: string,
): Promise<AttendanceResponse[]> => {
  const response = await apiRequest<ApiResponse<unknown> | unknown>(
    `/api/v1/class-sessions/${sessionId}/attendances/sync`,
    {
      method: "POST",
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

