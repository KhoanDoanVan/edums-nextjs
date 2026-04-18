export interface LecturerFeatureEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

export interface LecturerFeatureTab {
  key: "schedule" | "grades" | "attendance";
  label: string;
  description: string;
  endpoints: LecturerFeatureEndpoint[];
}

export type LecturerScheduleRow = Record<string, unknown>;

export interface CourseSectionResponse {
  id: number;
  sectionCode?: string;
  displayName?: string;
  courseId?: number;
  courseName?: string;
  courseCode?: string;
  lecturerId?: number;
  lecturerName?: string;
  semesterId?: number;
  semesterNumber?: number;
  academicYear?: string;
  maxCapacity?: number;
  status?: "DRAFT" | "OPEN" | "ONGOING" | "FINISHED" | "CANCELLED";
  createdAt?: string;
}

export interface LecturerSemesterOptionResponse {
  semesterId: number;
  semesterNumber?: number;
  academicYear?: string;
  displayName?: string;
  startDate?: string;
  endDate?: string;
  totalWeeks?: number;
  semesterStatus?: "PLANNING" | "REGISTRATION_OPEN" | "ONGOING" | "FINISHED";
}

export interface GradeDetailResponse {
  id?: number;
  componentId?: number;
  componentName?: string;
  weightPercentage?: number;
  score?: number;
}

export type GradeReportStatus = "DRAFT" | "PUBLISHED" | "LOCKED";

export interface GradeReportResponse {
  id: number;
  registrationId?: number;
  studentId?: number;
  studentName?: string;
  studentCode?: string;
  sectionId?: number;
  courseName?: string;
  finalScore?: number;
  letterGrade?: string;
  status?: GradeReportStatus;
  createdAt?: string;
  gradeDetails?: GradeDetailResponse[];
}

export interface GradeEntryComponentResponse {
  componentId: number;
  componentName?: string;
  weightPercentage?: number;
}

export interface GradeEntryRosterRowResponse {
  registrationId: number;
  studentId?: number;
  studentCode?: string;
  studentName?: string;
  gradeReportId?: number | null;
  finalScore?: number | null;
  letterGrade?: string | null;
  status?: GradeReportStatus | null;
  gradeDetails?: GradeDetailResponse[];
}

export interface GradeEntryRosterResponse {
  sectionId?: number;
  sectionCode?: string;
  courseId?: number;
  courseCode?: string;
  courseName?: string;
  components: GradeEntryComponentResponse[];
  rows: GradeEntryRosterRowResponse[];
}

export interface GradeDetailUpsertRequest {
  componentId: number;
  score: number;
}

export interface GradeReportUpsertRequest {
  registrationId: number;
  status: GradeReportStatus;
  gradeDetails: GradeDetailUpsertRequest[];
}

export interface RecurringScheduleResponse {
  id: number;
  sectionId?: number;
  sectionCode?: string;
  sectionDisplayName?: string;
  classroomId?: number;
  classroomName?: string;
  dayOfWeek?: number;
  dayOfWeekName?: string;
  startPeriod?: number;
  startPeriodTime?: string;
  endPeriod?: number;
  endPeriodTime?: string;
  createdAt?: string;
}

export interface ClassSessionResponse {
  id: number;
  sectionId?: number;
  sectionCode?: string;
  courseCode?: string;
  courseName?: string;
  classroomId?: number;
  classroomName?: string;
  recurringScheduleId?: number;
  sessionDate?: string;
  startPeriod?: number;
  endPeriod?: number;
  lessonContent?: string;
  status?: "NORMAL" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type AttendanceRosterStatus = AttendanceStatus | "NOT_MARKED";

export type SectionRosterStatus = "ACTIVE" | "REMOVED";

export interface SectionRosterResponse {
  id: number;
  sectionId: number;
  studentId: number;
  studentCode?: string;
  studentName?: string;
  courseRegistrationId?: number;
  sourceRegistrationPeriodId?: number;
  status?: SectionRosterStatus;
  lockedAt?: string;
}

export interface AttendanceRosterResponse {
  rosterId: number;
  sectionId?: number;
  sessionId?: number;
  sessionDate?: string;
  studentId?: number;
  studentCode?: string;
  studentName?: string;
  courseRegistrationId?: number;
  attendanceId?: number | null;
  attendanceStatus?: AttendanceRosterStatus | null;
  note?: string | null;
  rosterStatus?: SectionRosterStatus;
}

export interface AttendanceResponse {
  id: number;
  sessionId?: number;
  sessionDate?: string;
  courseRegistrationId?: number;
  studentId?: number;
  studentName?: string;
  studentCode?: string;
  status?: AttendanceRosterStatus;
  note?: string;
}

export interface AttendanceItemRequest {
  courseRegistrationId: number;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceBatchRequest {
  items: AttendanceItemRequest[];
}
