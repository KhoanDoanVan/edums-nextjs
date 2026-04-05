export interface GuardianFeatureEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

export interface GuardianFeatureTab {
  key: "profile" | "attendance" | "grades";
  label: string;
  description: string;
  endpoints: GuardianFeatureEndpoint[];
}

export interface GuardianStudentItem {
  id?: number;
  studentCode?: string;
  fullName?: string;
  className?: string;
  majorName?: string;
}

export interface GuardianProfileResponse {
  id?: number;
  fullName?: string;
  phone?: string;
  relationship?: string;
  address?: string;
  students: GuardianStudentItem[];
  raw: Record<string, unknown>;
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
