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
  id?: number;
  username?: string;
  role?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  address?: string;
  dateOfBirth?: string;
  studentCode?: string;
  classId?: number;
  className?: string;
  facultyId?: number;
  facultyName?: string;
  majorId?: number;
  majorName?: string;
  specializationId?: number;
  specializationName?: string;
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

export interface GradeComponentResponse {
  id: number;
  componentName?: string;
  weightPercentage?: number;
  courseId?: number;
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

export interface SemesterResponse {
  id: number;
  semesterNumber?: number;
  academicYear?: string;
  displayName?: string;
  startDate?: string;
  endDate?: string;
  totalWeeks?: number;
  status?: "PLANNING" | "REGISTRATION_OPEN" | "ONGOING" | "FINISHED";
}

export interface ScheduleSemesterOptionResponse {
  semesterId: number;
  semesterNumber?: number;
  academicYear?: string;
  displayName?: string;
  startDate?: string;
  endDate?: string;
  totalWeeks?: number;
  semesterStatus?: "PLANNING" | "REGISTRATION_OPEN" | "ONGOING" | "FINISHED";
  selectableForSchedule?: boolean;
  registrationOpen?: boolean;
  registrationPeriodId?: number | null;
  registrationPeriodName?: string | null;
  registrationPeriodStatus?: "UPCOMING" | "PAUSED" | "OPEN" | "CLOSED" | null;
  registrationStartTime?: string | null;
  registrationEndTime?: string | null;
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

export interface FacultyResponse {
  id: number;
  facultyName?: string;
  facultyCode?: string;
}

export interface AvailableSectionScheduleResponse {
  roomId?: number;
  roomName?: string;
  dayOfWeek?: number;
  startPeriod?: number;
  endPeriod?: number;
  startWeek?: number;
  endWeek?: number;
  startDate?: string;
  endDate?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
}

export interface AvailableCourseSectionResponse {
  courseSectionId: number;
  sectionCode?: string;
  displayName?: string;
  courseId?: number;
  courseCode?: string;
  courseName?: string;
  credits?: number;
  facultyId?: number;
  facultyName?: string;
  prerequisiteCourseId?: number;
  prerequisiteCourseCode?: string;
  prerequisiteCourseName?: string;
  lecturerId?: number;
  lecturerName?: string;
  semesterId?: number;
  semesterNumber?: number;
  academicYear?: string;
  registrationPeriodId?: number;
  registrationPeriodName?: string;
  registrationStartTime?: string;
  registrationEndTime?: string;
  maxCapacity?: number;
  registeredCount?: number;
  remainingCapacity?: number;
  status?: "DRAFT" | "OPEN" | "ONGOING" | "FINISHED" | "CANCELLED";
  schedules?: AvailableSectionScheduleResponse[];
}

export interface CourseResponse {
  id: number;
  courseCode?: string;
  courseName?: string;
  credits?: number;
  facultyId?: number;
  facultyName?: string;
  prerequisiteCourseId?: number;
  prerequisiteCourseName?: string;
  status?: string;
}

export interface MajorResponse {
  id: number;
  facultyId?: number;
  facultyName?: string;
  majorName?: string;
  majorCode?: string;
}

export interface SpecializationResponse {
  id: number;
  majorId?: number;
  majorName?: string;
  specializationName?: string;
}

export interface AdministrativeClassResponse {
  id: number;
  className?: string;
  maxCapacity?: number;
  headLecturerId?: number;
  headLecturerName?: string;
  cohortId?: number;
  cohortName?: string;
  majorId?: number;
  majorName?: string;
}

export interface CohortResponse {
  id: number;
  cohortName?: string;
  startYear?: number;
  endYear?: number;
  status?: "ACTIVE" | "GRADUATED";
}

export interface LecturerResponse {
  id?: number;
  fullName?: string;
  email?: string;
  phone?: string;
  academicDegree?: string;
}

export interface ClassroomResponse {
  id: number;
  roomName?: string;
  capacity?: number;
  roomType?: string;
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
  startDate?: string;
  endDate?: string;
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

export interface CourseRegistrationRequest {
  courseSectionId: number;
  studentId?: number;
}

export interface CourseRegistrationSwitchRequest {
  newCourseSectionId: number;
}

export interface CourseRegistrationResponse {
  id: number;
  studentId?: number;
  studentCode?: string;
  courseSectionId?: number;
  sectionCode?: string;
  courseId?: number;
  courseCode?: string;
  courseName?: string;
  semesterId?: number;
  registrationPeriodId?: number;
  registrationTime?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "DROPPED";
}
