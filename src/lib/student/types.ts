export interface StudentFeatureEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

export interface StudentFeatureTab {
  key:
    | "home"
    | "profile"
    | "course-registration"
    | "schedule"
    | "grades"
    | "attendance"
    | "password";
  label: string;
  description: string;
  endpoints: StudentFeatureEndpoint[];
}

export interface ProfileResponse {
  username?: string;
  role?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  address?: string;
  dateOfBirth?: string;
  studentCode?: string;
  majorName?: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
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
}

export interface AttendanceResponse {
  id: number;
  sessionId?: number;
  sessionDate?: string;
  courseRegistrationId?: number;
  studentId?: number;
  studentName?: string;
  studentCode?: string;
  status?: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note?: string;
}

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

export interface CourseRegistrationRequest {
  courseSectionId: number;
  studentId?: number;
}

export interface CourseRegistrationResponse {
  id: number;
  studentId?: number;
  courseSectionId?: number;
  registrationPeriodId?: number;
  registrationTime?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "DROPPED";
}
