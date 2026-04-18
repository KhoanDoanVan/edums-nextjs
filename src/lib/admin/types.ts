export interface AdminFeatureEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export type AdminTabKey =
  | "home"
  | "accounts"
  | "semesters"
  | "registration-periods"
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
  | "admissions"
  | "admissions-onboarding";

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
  majorId?: number;
  blockName?: string;
  blockId?: number;
  periodName?: string;
  periodId?: number;
}

export interface ApplicationListItem {
  id: number;
  fullName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  address?: string;
  totalScore?: number;
  status?: string;
  approvalDate?: string;
  periodId?: number;
  majorName?: string;
  majorId?: number;
  blockName?: string;
  blockId?: number;
  periodName?: string;
}

export type AdmissionApplicationStatus =
  | "PENDING"
  | "APPROVED"
  | "ENROLLED"
  | "REJECTED";

export interface AdmissionApplicationSearchFilter {
  keyword?: string;
  periodId?: number;
  majorId?: number;
  status?: AdmissionApplicationStatus;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: "ASC" | "DESC";
}

export type AdmissionPeriodStatus = "UPCOMING" | "PAUSED" | "OPEN" | "CLOSED";

export interface AdmissionReviewPayload {
  status: AdmissionApplicationStatus;
  note?: string;
}

export interface AdmissionBulkReviewPayload {
  applicationIds: number[];
  status: AdmissionApplicationStatus;
  note?: string;
}

export interface AdmissionOnboardingPayload {
  periodId: number;
  cohortId: number;
}

export interface AdmissionCampaignCreatePayload {
  periodName: string;
  startTime: string;
  endTime: string;
  benchmarks: AdmissionBenchmarkItem[];
}

export interface AdmissionPeriodUpsertPayload {
  periodName: string;
  startTime: string;
  endTime: string;
  status: AdmissionPeriodStatus;
}

export interface AdmissionBlockUpsertPayload {
  blockName: string;
  description?: string;
}

export interface AdmissionBenchmarkUpsertPayload {
  majorId: number;
  blockId: number;
  periodId: number;
  score: number;
}

export interface AdmissionBenchmarkItem {
  majorId: number;
  blockId: number;
  score: number;
}

export interface AdmissionBenchmarkBulkPayload {
  periodId: number;
  benchmarks: AdmissionBenchmarkItem[];
}

export interface AdmissionSelectionOption {
  id?: number;
  code?: string;
  name?: string;
  label?: string;
  [key: string]: unknown;
}

export interface AdmissionSelectionOptions {
  majors: AdmissionSelectionOption[];
  blocks: AdmissionSelectionOption[];
  periods: AdmissionSelectionOption[];
}

export type GradeReportStatus = "DRAFT" | "PUBLISHED" | "LOCKED";

export interface GradeDetailPayload {
  componentId: number;
  score: number;
}

export interface GradeReportUpsertPayload {
  registrationId: number;
  gradeDetails: GradeDetailPayload[];
  status?: GradeReportStatus;
}

export interface GradeReportItem {
  id?: number;
  registrationId?: number;
  studentId?: number;
  studentName?: string;
  studentCode?: string;
  sectionId?: number;
  courseName?: string;
  finalScore?: number;
  letterGrade?: string;
  status?: GradeReportStatus | string;
  createdAt?: string;
  gradeDetails?: Array<Record<string, unknown>>;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceBatchItemPayload {
  courseRegistrationId: number;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceBatchPayload {
  items: AttendanceBatchItemPayload[];
}

export interface AttendanceUpdatePayload {
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceItem {
  id?: number;
  sessionId?: number;
  sessionDate?: string;
  courseRegistrationId?: number;
  studentId?: number;
  studentName?: string;
  studentCode?: string;
  status?: AttendanceStatus | string;
  note?: string;
}

export type DynamicRow = Record<string, unknown>;
