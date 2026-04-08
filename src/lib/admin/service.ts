import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AccountCreatePayload,
  AttendanceBatchPayload,
  AttendanceItem,
  AttendanceUpdatePayload,
  AdmissionCampaignCreatePayload,
  AdmissionBenchmarkBulkPayload,
  AdmissionBenchmarkUpsertPayload,
  AdmissionBlockUpsertPayload,
  AdmissionBulkReviewPayload,
  AdmissionApplicationSearchFilter,
  AdmissionPeriodUpsertPayload,
  AdmissionReviewPayload,
  AdmissionSelectionOptions,
  AccountListItem,
  AccountResetPasswordPayload,
  AccountSearchFilter,
  AccountStatus,
  AccountUpdatePayload,
  ApplicationListItem,
  BenchmarkListItem,
  BlockListItem,
  CourseSectionListItem,
  DynamicRow,
  GradeReportItem,
  GradeReportUpsertPayload,
  PagedRows,
  PeriodListItem,
  RoleListItem,
  RoleUpsertPayload,
} from "@/lib/admin/types";

const toArray = <TItem>(value: unknown): TItem[] => {
  if (Array.isArray(value)) {
    return value as TItem[];
  }

  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: TItem[] }).data;
  }

  return [];
};

const toPagedRows = <TItem>(value: unknown): PagedRows<TItem> => {
  if (Array.isArray(value)) {
    return { rows: value as TItem[] };
  }

  if (value && typeof value === "object") {
    const root = value as {
      page?: number;
      pageNumber?: number;
      number?: number;
      size?: number;
      pageSize?: number;
      totalElements?: number;
      totalItems?: number;
      total?: number;
      totalPages?: number;
      data?: unknown;
      content?: unknown;
      items?: unknown;
      rows?: unknown;
    };

    const nested =
      root.data && typeof root.data === "object"
        ? (root.data as {
            page?: number;
            pageNumber?: number;
            number?: number;
            size?: number;
            pageSize?: number;
            totalElements?: number;
            totalItems?: number;
            total?: number;
            totalPages?: number;
            data?: unknown;
            content?: unknown;
            items?: unknown;
            rows?: unknown;
          })
        : null;

    const rowsFromRootData = toArray<TItem>(root.data);
    const rowsFromRootContent = toArray<TItem>(root.content);
    const rowsFromRootItems = toArray<TItem>(root.items);
    const rowsFromRootRows = toArray<TItem>(root.rows);
    const rowsFromNestedData = nested ? toArray<TItem>(nested.data) : [];
    const rowsFromNestedContent = nested ? toArray<TItem>(nested.content) : [];
    const rowsFromNestedItems = nested ? toArray<TItem>(nested.items) : [];
    const rowsFromNestedRows = nested ? toArray<TItem>(nested.rows) : [];

    const rows =
      rowsFromRootData.length > 0
        ? rowsFromRootData
        : rowsFromRootContent.length > 0
          ? rowsFromRootContent
          : rowsFromRootItems.length > 0
            ? rowsFromRootItems
            : rowsFromRootRows.length > 0
              ? rowsFromRootRows
              : rowsFromNestedData.length > 0
                ? rowsFromNestedData
                : rowsFromNestedContent.length > 0
                  ? rowsFromNestedContent
                  : rowsFromNestedItems.length > 0
                    ? rowsFromNestedItems
                    : rowsFromNestedRows;

    const page =
      root.page ??
      root.pageNumber ??
      root.number ??
      nested?.page ??
      nested?.pageNumber ??
      nested?.number;
    const size = root.size ?? root.pageSize ?? nested?.size ?? nested?.pageSize;
    const totalElements =
      root.totalElements ??
      root.totalItems ??
      root.total ??
      nested?.totalElements ??
      nested?.totalItems ??
      nested?.total;
    const totalPages = root.totalPages ?? nested?.totalPages;

    return {
      page,
      size,
      totalElements,
      totalPages,
      rows,
    };
  }

  return { rows: [] };
};

const toDynamicPagedRows = (value: unknown): PagedRows<DynamicRow> => {
  if (Array.isArray(value)) {
    return { rows: value as DynamicRow[] };
  }

  if (value && typeof value === "object") {
    const payload = value as {
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
      content?: unknown;
      data?: unknown;
      items?: unknown;
    };

    const contentRows = toArray<DynamicRow>(payload.content);
    const dataRows = toArray<DynamicRow>(payload.data);
    const itemRows = toArray<DynamicRow>(payload.items);
    const rows =
      contentRows.length > 0
        ? contentRows
        : dataRows.length > 0
          ? dataRows
          : itemRows;

    return {
      page: payload.page,
      size: payload.size,
      totalElements: payload.totalElements,
      totalPages: payload.totalPages,
      rows,
    };
  }

  return { rows: [] };
};

const buildQueryString = (params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    query.set(key, String(value));
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

const getRequest = async <TData>(
  path: string,
  authorization: string,
): Promise<TData> => {
  const response = await apiRequest<ApiResponse<TData>>(path, {
    method: "GET",
    accessToken: authorization,
  });

  return response.data;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object";
};

const toDynamicRow = (value: unknown): DynamicRow => {
  return isObject(value) ? (value as DynamicRow) : {};
};

const normalizePeriodStatusText = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
};

const normalizePeriodListItem = (value: unknown): PeriodListItem => {
  const row = isObject(value) ? value : {};
  const idCandidate = Number(row.id ?? row.periodId ?? row.value ?? 0);
  const id = Number.isInteger(idCandidate) && idCandidate > 0 ? idCandidate : 0;

  const periodName =
    (typeof row.periodName === "string" && row.periodName.trim()) ||
    (typeof row.period_name === "string" && row.period_name.trim()) ||
    (typeof row.name === "string" && row.name.trim()) ||
    undefined;

  const startTime =
    (typeof row.startTime === "string" && row.startTime.trim()) ||
    (typeof row.start_time === "string" && row.start_time.trim()) ||
    (typeof row.startDate === "string" && row.startDate.trim()) ||
    (typeof row.start_date === "string" && row.start_date.trim()) ||
    undefined;

  const endTime =
    (typeof row.endTime === "string" && row.endTime.trim()) ||
    (typeof row.end_time === "string" && row.end_time.trim()) ||
    (typeof row.endDate === "string" && row.endDate.trim()) ||
    (typeof row.end_date === "string" && row.end_date.trim()) ||
    undefined;

  const status = normalizePeriodStatusText(
    row.status ?? row.periodStatus ?? row.period_status ?? row.state,
  );

  const totalApplicationsCandidate = Number(
    row.totalApplications ?? row.total_applications ?? row.total,
  );
  const approvedApplicationsCandidate = Number(
    row.approvedApplications ?? row.approved_applications ?? row.approved,
  );

  return {
    id,
    periodName,
    startTime,
    endTime,
    status,
    totalApplications: Number.isFinite(totalApplicationsCandidate)
      ? totalApplicationsCandidate
      : undefined,
    approvedApplications: Number.isFinite(approvedApplicationsCandidate)
      ? approvedApplicationsCandidate
      : undefined,
  };
};

export const getAccounts = async (
  authorization: string,
  filter: AccountSearchFilter = {},
): Promise<PagedRows<AccountListItem>> => {
  const data = await getRequest<unknown>(
    `/api/v1/accounts${buildQueryString({
      keyword: filter.keyword,
      roleId: filter.roleId,
      status: filter.status,
      page: filter.page ?? 0,
      size: filter.size ?? 20,
      sortBy: filter.sortBy ?? "createdAt",
    })}`,
    authorization,
  );

  return toPagedRows<AccountListItem>(data);
};

export const getDynamicListByPath = async (
  path: string,
  authorization: string,
  queryParams?: Record<string, string | number | undefined>,
): Promise<PagedRows<DynamicRow>> => {
  const fullPath = `${path}${buildQueryString(queryParams || {})}`;
  const data = await getRequest<unknown>(fullPath, authorization);
  return toDynamicPagedRows(data);
};

export const getDynamicByPath = async (
  path: string,
  authorization: string,
): Promise<DynamicRow> => {
  const data = await getRequest<unknown>(path, authorization);
  return toDynamicRow(data);
};

export const createDynamicByPath = async (
  path: string,
  payload: Record<string, unknown>,
  authorization: string,
): Promise<DynamicRow> => {
  const response = await apiRequest<ApiResponse<unknown>>(path, {
    method: "POST",
    body: payload,
    accessToken: authorization,
  });

  return toDynamicRow(response.data);
};

export const updateDynamicByPath = async (
  path: string,
  payload: Record<string, unknown>,
  authorization: string,
): Promise<DynamicRow> => {
  const response = await apiRequest<ApiResponse<unknown>>(path, {
    method: "PUT",
    body: payload,
    accessToken: authorization,
  });

  return toDynamicRow(response.data);
};

export const patchDynamicByPath = async (
  path: string,
  payload: Record<string, unknown>,
  authorization: string,
): Promise<DynamicRow> => {
  const response = await apiRequest<ApiResponse<unknown>>(path, {
    method: "PATCH",
    body: payload,
    accessToken: authorization,
  });

  return toDynamicRow(response.data);
};

export const deleteDynamicByPath = async (
  path: string,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(path, {
    method: "DELETE",
    accessToken: authorization,
  });
};

export const getAccountById = async (
  accountId: number,
  authorization: string,
): Promise<AccountListItem> => {
  const data = await getRequest<unknown>(`/api/v1/accounts/${accountId}`, authorization);
  return data as AccountListItem;
};

export const createAccount = async (
  payload: AccountCreatePayload,
  authorization: string,
): Promise<AccountListItem> => {
  const response = await apiRequest<ApiResponse<AccountListItem>>("/api/v1/accounts", {
    method: "POST",
    body: payload,
    accessToken: authorization,
  });

  return response.data;
};

export const updateAccount = async (
  accountId: number,
  payload: AccountUpdatePayload,
  authorization: string,
): Promise<AccountListItem> => {
  const response = await apiRequest<ApiResponse<AccountListItem>>(
    `/api/v1/accounts/${accountId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );

  return response.data;
};

export const updateAccountStatus = async (
  accountId: number,
  status: AccountStatus,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(`/api/v1/accounts/${accountId}/status`, {
    method: "PATCH",
    body: { status },
    accessToken: authorization,
  });
};

export const resetAccountPassword = async (
  accountId: number,
  payload: AccountResetPasswordPayload,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    `/api/v1/accounts/${accountId}/reset-password`,
    {
      method: "PATCH",
      body: payload,
      accessToken: authorization,
    },
  );
};

export const getRoles = async (authorization: string): Promise<RoleListItem[]> => {
  const data = await getRequest<unknown>("/api/v1/roles", authorization);
  return toArray<RoleListItem>(data);
};

export const getRoleById = async (
  roleId: number,
  authorization: string,
): Promise<RoleListItem> => {
  const data = await getRequest<unknown>(`/api/v1/roles/${roleId}`, authorization);
  return data as RoleListItem;
};

export const createRole = async (
  payload: RoleUpsertPayload,
  authorization: string,
): Promise<RoleListItem> => {
  const response = await apiRequest<ApiResponse<RoleListItem>>("/api/v1/roles", {
    method: "POST",
    body: payload,
    accessToken: authorization,
  });

  return response.data;
};

export const updateRole = async (
  roleId: number,
  payload: RoleUpsertPayload,
  authorization: string,
): Promise<RoleListItem> => {
  const response = await apiRequest<ApiResponse<RoleListItem>>(
    `/api/v1/roles/${roleId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );

  return response.data;
};

export const deleteRole = async (
  roleId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(`/api/v1/roles/${roleId}`, {
    method: "DELETE",
    accessToken: authorization,
  });
};

export const getRolePermissions = async (
  authorization: string,
): Promise<string[]> => {
  const data = await getRequest<unknown>("/api/v1/roles/permissions", authorization);
  return toArray<string>(data);
};

export const getStudents = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  const data = await getRequest<unknown>(
    `/api/v1/students${buildQueryString({
      page: 0,
      size: 20,
    })}`,
    authorization,
  );

  return toDynamicPagedRows(data);
};

export const getLecturers = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  const data = await getRequest<unknown>(
    `/api/v1/lecturers${buildQueryString({
      page: 0,
      size: 20,
    })}`,
    authorization,
  );

  return toDynamicPagedRows(data);
};

export const getGuardians = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  const data = await getRequest<unknown>(
    `/api/v1/guardians${buildQueryString({
      page: 0,
      size: 20,
    })}`,
    authorization,
  );

  return toDynamicPagedRows(data);
};

const getSimpleDynamicList = async (
  path: string,
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  const data = await getRequest<unknown>(path, authorization);
  return toDynamicPagedRows(data);
};

export const getFaculties = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/faculties", authorization);
};

export const getMajors = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/majors", authorization);
};

export const getMajorsByFaculty = async (
  facultyId: number,
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList(`/api/v1/majors/faculty/${facultyId}`, authorization);
};

export const getSpecializations = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/specializations", authorization);
};

export const getSpecializationsByMajor = async (
  majorId: number,
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList(`/api/v1/specializations/major/${majorId}`, authorization);
};

export const getCohorts = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/cohorts", authorization);
};

export const getCourses = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/courses", authorization);
};

export const getCoursesByFaculty = async (
  facultyId: number,
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList(`/api/v1/courses/faculty/${facultyId}`, authorization);
};

export const getClassrooms = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/classrooms", authorization);
};

export const getAdministrativeClasses = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/administrative-classes", authorization);
};

export const getSectionGradeReports = async (
  sectionId: number,
  authorization: string,
): Promise<DynamicRow[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/course-sections/${sectionId}/grade-reports`,
    authorization,
  );
  return toArray<DynamicRow>(data);
};

export const getStudentGradeReports = async (
  studentId: number,
  authorization: string,
): Promise<DynamicRow[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/students/${studentId}/grade-reports`,
    authorization,
  );
  return toArray<DynamicRow>(data);
};

export const getStudentAttendances = async (
  studentId: number,
  authorization: string,
): Promise<DynamicRow[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/students/${studentId}/attendances`,
    authorization,
  );
  return toArray<DynamicRow>(data);
};

export const getGuardianStudentAttendances = async (
  guardianId: number,
  studentId: number,
  authorization: string,
): Promise<AttendanceItem[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/guardians/${guardianId}/students/${studentId}/attendances`,
    authorization,
  );
  return toArray<AttendanceItem>(data);
};

export const getCourseSections = async (
  authorization: string,
): Promise<CourseSectionListItem[]> => {
  const data = await getRequest<unknown>("/api/v1/course-sections", authorization);
  return toArray<CourseSectionListItem>(data);
};

export const getCourseSectionsByCourse = async (
  courseId: number,
  authorization: string,
): Promise<CourseSectionListItem[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/course-sections/course/${courseId}`,
    authorization,
  );
  return toArray<CourseSectionListItem>(data);
};

export const getCourseSectionsBySemester = async (
  semesterId: number,
  authorization: string,
): Promise<CourseSectionListItem[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/course-sections/semester/${semesterId}`,
    authorization,
  );
  return toArray<CourseSectionListItem>(data);
};

export const getGradeComponentsByCourse = async (
  courseId: number,
  authorization: string,
): Promise<DynamicRow[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/courses/${courseId}/grade-components`,
    authorization,
  );
  return toArray<DynamicRow>(data);
};

export const getRecurringScheduleById = async (
  scheduleId: number,
  authorization: string,
): Promise<DynamicRow> => {
  const data = await getRequest<unknown>(
    `/api/v1/recurring-schedules/${scheduleId}`,
    authorization,
  );
  return toDynamicRow(data);
};

export const getAdmissionPeriods = async (
  authorization: string,
): Promise<PagedRows<PeriodListItem>> => {
  const data = await getRequest<unknown>(
    `/api/v1/admin/admissions/config/periods${buildQueryString({
      page: 0,
      size: 20,
    })}`,
    authorization,
  );

  const paged = toPagedRows<PeriodListItem>(data);
  return {
    ...paged,
    rows: paged.rows.map((row) => normalizePeriodListItem(row)),
  };
};

export const getAdmissionPeriodById = async (
  periodId: number,
  authorization: string,
): Promise<PeriodListItem> => {
  const data = await getRequest<unknown>(
    `/api/v1/admin/admissions/config/periods/${periodId}`,
    authorization,
  );
  return normalizePeriodListItem(data);
};

export const getAdmissionBlocks = async (
  authorization: string,
): Promise<BlockListItem[]> => {
  const data = await getRequest<unknown>(
    "/api/v1/admin/admissions/config/blocks",
    authorization,
  );
  return toArray<BlockListItem>(data);
};

export const getAdmissionBenchmarks = async (
  authorization: string,
): Promise<PagedRows<BenchmarkListItem>> => {
  const data = await getRequest<unknown>(
    `/api/v1/admin/admissions/config/benchmarks${buildQueryString({
      page: 0,
      size: 20,
    })}`,
    authorization,
  );

  return toPagedRows<BenchmarkListItem>(data);
};

export const getAdmissionApplications = async (
  authorization: string,
  filter: AdmissionApplicationSearchFilter = {},
): Promise<PagedRows<ApplicationListItem>> => {
  const data = await getRequest<unknown>(
    `/api/v1/admin/admissions/applications${buildQueryString({
      keyword: filter.keyword,
      periodId: filter.periodId,
      majorId: filter.majorId,
      status: filter.status,
      page: filter.page ?? 0,
      size: filter.size ?? 20,
      sortBy: filter.sortBy,
      sortDirection: filter.sortDirection,
    })}`,
    authorization,
  );

  return toPagedRows<ApplicationListItem>(data);
};

export const getAdmissionApplicationById = async (
  applicationId: number,
  authorization: string,
): Promise<ApplicationListItem> => {
  const data = await getRequest<unknown>(
    `/api/v1/admin/admissions/applications/${applicationId}`,
    authorization,
  );
  return (data || {}) as ApplicationListItem;
};

export const reviewAdmissionApplication = async (
  applicationId: number,
  payload: AdmissionReviewPayload,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/applications/${applicationId}/review`,
    {
      method: "PATCH",
      body: payload,
      accessToken: authorization,
    },
  );
};

export const reviewAdmissionApplicationsBulk = async (
  payload: AdmissionBulkReviewPayload,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    "/api/v1/admin/admissions/applications/bulk-review",
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );
};

export const autoScreenAdmissionApplications = async (
  periodId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/applications/auto-screen/${periodId}`,
    {
      method: "POST",
      accessToken: authorization,
    },
  );
};

export const processAdmissionOnboarding = async (
  periodId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/applications/onboard/${periodId}`,
    {
      method: "POST",
      accessToken: authorization,
    },
  );
};

export const getAdmissionFormOptions = async (
  authorization: string,
): Promise<AdmissionSelectionOptions> => {
  const optionPaths = [
    "/api/v1/admin/admissions/config/form-options",
    "/api/v1/admin/admissions/config/periods/form-options",
  ];

  let data: unknown = null;
  let lastError: unknown;

  for (const optionPath of optionPaths) {
    try {
      data = await getRequest<unknown>(optionPath, authorization);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (error instanceof Error) {
        const normalizedMessage = error.message.toLowerCase();
        const isUnsupportedEndpoint =
          normalizedMessage.includes("[api 404]") ||
          normalizedMessage.includes("[api 400]") ||
          normalizedMessage.includes("for input string: \"form-options\"") ||
          normalizedMessage.includes("methodargumenttypemismatchexception");

        if (isUnsupportedEndpoint) {
          continue;
        }
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  const payload = (isObject(data) ? data : {}) as {
    majors?: unknown;
    blocks?: unknown;
    periods?: unknown;
  };

  return {
    majors: toArray(payload.majors),
    blocks: toArray(payload.blocks),
    periods: toArray(payload.periods),
  };
};

export const createAdmissionPeriod = async (
  payload: AdmissionPeriodUpsertPayload,
  authorization: string,
): Promise<PeriodListItem> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    "/api/v1/admin/admissions/config/periods",
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );
  return normalizePeriodListItem(response.data || {});
};

export const createAdmissionCampaign = async (
  payload: AdmissionCampaignCreatePayload,
  authorization: string,
): Promise<PeriodListItem | null> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    "/api/v1/admin/admissions/config/periods/campaign",
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );

  const data = response?.data;
  if (!isObject(data)) {
    return null;
  }

  const periodId = Number(data.id);
  if (!Number.isInteger(periodId) || periodId <= 0) {
    return null;
  }

  return normalizePeriodListItem(data);
};

export const updateAdmissionPeriod = async (
  periodId: number,
  payload: AdmissionPeriodUpsertPayload,
  authorization: string,
): Promise<PeriodListItem> => {
  const periodStatusOrdinalMap: Record<string, number> = {
    UPCOMING: 0,
    PAUSED: 1,
    OPEN: 2,
    CLOSED: 3,
  };
  const statusToken =
    typeof payload.status === "string" ? payload.status.trim().toUpperCase() : "";
  const statusOrdinal = periodStatusOrdinalMap[statusToken];

  const bodyVariants: Array<Record<string, unknown>> = [
    {
      ...payload,
      periodStatus: payload.status,
    },
    {
      ...payload,
    },
  ];
  if (Number.isInteger(statusOrdinal)) {
    bodyVariants.push({
      ...payload,
      status: statusOrdinal,
      periodStatus: statusOrdinal,
    });
    bodyVariants.push({
      ...payload,
      status: statusOrdinal,
    });
  }

  const requestOptions = [
    {
      method: "PUT" as const,
      path: `/api/v1/admin/admissions/config/periods/${periodId}`,
    },
    {
      method: "PATCH" as const,
      path: `/api/v1/admin/admissions/config/periods/${periodId}`,
    },
  ];

  let lastError: unknown;

  for (const option of requestOptions) {
    for (const body of bodyVariants) {
      try {
        const response = await apiRequest<ApiResponse<unknown>>(option.path, {
          method: option.method,
          body,
          accessToken: authorization,
        });

        return normalizePeriodListItem(response.data || {});
      } catch (error) {
        lastError = error;

        if (error instanceof Error) {
          const normalizedMessage = error.message.toLowerCase();
          const isUnsupportedEndpoint =
            normalizedMessage.includes("[api 404]") ||
            normalizedMessage.includes("[api 405]") ||
            normalizedMessage.includes("method not allowed") ||
            normalizedMessage.includes("request method 'put' is not supported") ||
            normalizedMessage.includes("request method 'patch' is not supported");
          const isPayloadShapeMismatch =
            normalizedMessage.includes("unrecognized field") ||
            normalizedMessage.includes("cannot deserialize value") ||
            normalizedMessage.includes("failed to read request") ||
            normalizedMessage.includes("json parse error");

          if (isUnsupportedEndpoint) {
            break;
          }

          if (isPayloadShapeMismatch) {
            continue;
          }
        }

        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Không thể cập nhật kỳ tuyển sinh do endpoint backend không tương thích.");
};

export const deleteAdmissionPeriod = async (
  periodId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/config/periods/${periodId}`,
    {
      method: "DELETE",
      accessToken: authorization,
    },
  );
};

export const createAdmissionBlock = async (
  payload: AdmissionBlockUpsertPayload,
  authorization: string,
): Promise<BlockListItem> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    "/api/v1/admin/admissions/config/blocks",
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );
  return (response.data || {}) as BlockListItem;
};

export const updateAdmissionBlock = async (
  blockId: number,
  payload: AdmissionBlockUpsertPayload,
  authorization: string,
): Promise<BlockListItem> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/config/blocks/${blockId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );
  return (response.data || {}) as BlockListItem;
};

export const deleteAdmissionBlock = async (
  blockId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/config/blocks/${blockId}`,
    {
      method: "DELETE",
      accessToken: authorization,
    },
  );
};

export const updateAdmissionBenchmark = async (
  benchmarkId: number,
  payload: AdmissionBenchmarkUpsertPayload,
  authorization: string,
): Promise<BenchmarkListItem> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/config/benchmarks/${benchmarkId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );
  return (response.data || {}) as BenchmarkListItem;
};

export const deleteAdmissionBenchmark = async (
  benchmarkId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    `/api/v1/admin/admissions/config/benchmarks/${benchmarkId}`,
    {
      method: "DELETE",
      accessToken: authorization,
    },
  );
};

export const saveAdmissionBenchmarksBulk = async (
  payload: AdmissionBenchmarkBulkPayload,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(
    "/api/v1/admin/admissions/config/benchmarks/bulk",
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );
};

export const createGradeReport = async (
  payload: GradeReportUpsertPayload,
  authorization: string,
): Promise<GradeReportItem> => {
  const response = await apiRequest<ApiResponse<unknown>>("/api/v1/grade-reports", {
    method: "POST",
    body: payload,
    accessToken: authorization,
  });
  return (response.data || {}) as GradeReportItem;
};

export const getGradeReportById = async (
  gradeReportId: number,
  authorization: string,
): Promise<GradeReportItem> => {
  const data = await getRequest<unknown>(`/api/v1/grade-reports/${gradeReportId}`, authorization);
  return (data || {}) as GradeReportItem;
};

export const updateGradeReport = async (
  gradeReportId: number,
  payload: GradeReportUpsertPayload,
  authorization: string,
): Promise<GradeReportItem> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    `/api/v1/grade-reports/${gradeReportId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );
  return (response.data || {}) as GradeReportItem;
};

export const deleteGradeReport = async (
  gradeReportId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(`/api/v1/grade-reports/${gradeReportId}`, {
    method: "DELETE",
    accessToken: authorization,
  });
};

export const getAttendancesBySession = async (
  sessionId: number,
  authorization: string,
): Promise<AttendanceItem[]> => {
  const data = await getRequest<unknown>(
    `/api/v1/class-sessions/${sessionId}/attendances`,
    authorization,
  );
  return toArray<AttendanceItem>(data);
};

export const createAttendancesBatch = async (
  sessionId: number,
  payload: AttendanceBatchPayload,
  authorization: string,
): Promise<AttendanceItem[]> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    `/api/v1/class-sessions/${sessionId}/attendances/batch`,
    {
      method: "POST",
      body: payload,
      accessToken: authorization,
    },
  );
  return toArray<AttendanceItem>(response.data);
};

export const updateAttendance = async (
  attendanceId: number,
  payload: AttendanceUpdatePayload,
  authorization: string,
): Promise<AttendanceItem> => {
  const response = await apiRequest<ApiResponse<unknown>>(
    `/api/v1/attendances/${attendanceId}`,
    {
      method: "PUT",
      body: payload,
      accessToken: authorization,
    },
  );
  return (response.data || {}) as AttendanceItem;
};

export const deleteAttendance = async (
  attendanceId: number,
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(`/api/v1/attendances/${attendanceId}`, {
    method: "DELETE",
    accessToken: authorization,
  });
};
