export interface AdminFeatureEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

export type AdminTabKey =
  | "home"
  | "accounts"
  | "roles"
  | "faculties"
  | "majors"
  | "specializations"
  | "cohorts"
  | "courses"
  | "classrooms"
  | "administrative-classes"
  | "students"
  | "lecturers"
  | "guardians"
  | "course-sections"
  | "grade-management"
  | "attendance-management"
  | "admissions";

export interface AdminFeatureTab {
  key: AdminTabKey;
  label: string;
  description: string;
  endpoints: AdminFeatureEndpoint[];
}

export interface PageMeta {
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

export interface PagedRows<TItem> extends PageMeta {
  rows: TItem[];
}

export interface AccountListItem {
  id: number;
  username?: string;
  status?: string;
  roleName?: string;
  createdAt?: string;
  avatarUrl?: string;
}

export interface RoleListItem {
  id: number;
  roleName?: string;
  functionCodes?: string[];
}

export interface CourseSectionListItem {
  id: number;
  sectionCode?: string;
  displayName?: string;
  courseName?: string;
  lecturerName?: string;
  status?: string;
}

export interface PeriodListItem {
  id: number;
  periodName?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  totalApplications?: number;
  approvedApplications?: number;
}

export interface BlockListItem {
  id: number;
  blockName?: string;
  description?: string;
}

export interface BenchmarkListItem {
  id: number;
  score?: number;
  majorName?: string;
  blockName?: string;
  periodName?: string;
}

export interface ApplicationListItem {
  id: number;
  fullName?: string;
  totalScore?: number;
  status?: string;
  majorName?: string;
  blockName?: string;
  periodName?: string;
}

export type DynamicRow = Record<string, unknown>;
