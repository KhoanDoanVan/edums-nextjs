import { apiRequest } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type {
  AccountListItem,
  ApplicationListItem,
  BenchmarkListItem,
  BlockListItem,
  CourseSectionListItem,
  DynamicRow,
  PagedRows,
  PeriodListItem,
  RoleListItem,
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
  if (value && typeof value === "object") {
    const payload = value as {
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
      data?: unknown;
    };

    return {
      page: payload.page,
      size: payload.size,
      totalElements: payload.totalElements,
      totalPages: payload.totalPages,
      rows: toArray<TItem>(payload.data),
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

export const getAccounts = async (
  authorization: string,
): Promise<PagedRows<AccountListItem>> => {
  const data = await getRequest<unknown>(
    `/api/v1/accounts${buildQueryString({
      page: 0,
      size: 20,
      sortBy: "createdAt",
    })}`,
    authorization,
  );

  return toPagedRows<AccountListItem>(data);
};

export const updateAccountStatus = async (
  accountId: number,
  status: "ACTIVE" | "INACTIVE" | "LOCKED",
  authorization: string,
): Promise<void> => {
  await apiRequest<ApiResponse<unknown>>(`/api/v1/accounts/${accountId}/status`, {
    method: "PATCH",
    body: { status },
    accessToken: authorization,
  });
};

export const getRoles = async (authorization: string): Promise<RoleListItem[]> => {
  const data = await getRequest<unknown>("/api/v1/roles", authorization);
  return toArray<RoleListItem>(data);
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

export const getSpecializations = async (
  authorization: string,
): Promise<PagedRows<DynamicRow>> => {
  return getSimpleDynamicList("/api/v1/specializations", authorization);
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

export const getCourseSections = async (
  authorization: string,
): Promise<CourseSectionListItem[]> => {
  const data = await getRequest<unknown>("/api/v1/course-sections", authorization);
  return toArray<CourseSectionListItem>(data);
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

  return toPagedRows<PeriodListItem>(data);
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
): Promise<PagedRows<ApplicationListItem>> => {
  const data = await getRequest<unknown>(
    `/api/v1/admin/admissions/applications${buildQueryString({
      page: 0,
      size: 20,
    })}`,
    authorization,
  );

  return toPagedRows<ApplicationListItem>(data);
};
