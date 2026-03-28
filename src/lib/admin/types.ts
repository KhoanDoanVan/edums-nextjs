export interface AdminFeatureEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export type AdminTabKey =
  | "home"
  | "accounts"
  | "roles"
  | "faculties"
  | "majors"
  | "specializations"
  | "cohorts"
  | "courses"
  | "grade-components"
  | "classrooms"
  | "administrative-classes"
  | "students"
  | "lecturers"
  | "guardians"
  | "course-sections"
  | "recurring-schedules"
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
  status?: AccountStatus;
  roleName?: string;
  roleId?: number;
  createdAt?: string;
  avatarUrl?: string;
}

export interface AccountSearchFilter {
  keyword?: string;
  roleId?: number;
  status?: AccountStatus;
  page?: number;
  size?: number;
  sortBy?: string;
}

export interface AccountCreatePayload {
  username: string;
  password: string;
  roleId: number;
  avatarUrl?: string;
}

export interface AccountUpdatePayload {
  username: string;
  roleId: number;
  avatarUrl?: string;
}

export interface AccountResetPasswordPayload {
  newPassword: string;
  confirmPassword: string;
}

export interface RoleListItem {
  id: number;
  roleName?: string;
  functionCodes?: string[];
}

export interface RoleUpsertPayload {
  roleName: string;
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
