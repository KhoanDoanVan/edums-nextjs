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

export interface GradeDetailResponse {
  id?: number;
  componentId?: number;
  componentName?: string;
  weightPercentage?: number;
  score?: number;
}

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
  status?: "DRAFT" | "PUBLISHED" | "LOCKED";
  createdAt?: string;
  gradeDetails?: GradeDetailResponse[];
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
  classroomId?: number;
  classroomName?: string;
  recurringScheduleId?: number;
  sessionDate?: string;
  startPeriod?: number;
  endPeriod?: number;
  lessonContent?: string;
  status?: "NORMAL" | "CANCELLED" | "RESCHEDULED";
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceResponse {
  id: number;
  sessionId?: number;
  sessionDate?: string;
  courseRegistrationId?: number;
  studentId?: number;
  studentName?: string;
  studentCode?: string;
  status?: AttendanceStatus;
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
