"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/context/toast-context";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  getAdministrativeClassById,
  getAdministrativeClasses,
  changeMyPassword,
  getCohortById,
  getCohorts,
  getClassroomById,
  getClassrooms,
  getAvailableCourseSections,
  getCourses,
  getCoursesByFaculty,
  getCourseSectionById,
  getFaculties,
  getFacultyById,
  getGradeReportById,
  getGradeComponentsByCourse,
  getLecturerById,
  getMajorById,
  getMajors,
  getMajorsByFaculty,
  getMyAttendance,
  cancelCourseRegistration,
  getMyCourseRegistrations,
  getMyGradeReports,
  getMyScheduleSemesterOptions,
  getMyStudentProfile,
  getRecurringScheduleById,
  getRecurringScheduleSessions,
  getRecurringSchedulesBySection,
  getSpecializations,
  getSpecializationsByMajor,
  registerCourseSection,
  switchCourseRegistration,
  updateMyProfile,
} from "@/lib/student/service";
import {
  studentFeatureTabs,
  studentTopHeaderTabs,
} from "@/lib/student/tabs";
import { toErrorMessage as toSharedErrorMessage } from "@/components/admin/format-utils";
import type {
  AdministrativeClassResponse,
  AvailableCourseSectionResponse,
  AttendanceResponse,
  ClassroomResponse,
  CohortResponse,
  CourseResponse,
  CourseRegistrationResponse,
  CourseSectionResponse,
  FacultyResponse,
  GradeComponentResponse,
  GradeDetailResponse,
  GradeReportResponse,
  LecturerResponse,
  MajorResponse,
  ProfileResponse,
  RecurringScheduleResponse,
  ScheduleSemesterOptionResponse,
  SpecializationResponse,
  StudentFeatureTab,
} from "@/lib/student/types";

const getApiStatusFromError = (error: unknown): number | null => {
  if (!(error instanceof Error) || !error.message) {
    return null;
  }

  const matched = error.message.match(/^\[API\s+(\d{3})\]/);
  if (!matched) {
    return null;
  }

  const statusCode = Number(matched[1]);
  return Number.isInteger(statusCode) ? statusCode : null;
};

const toErrorMessage = (error: unknown): string => {
  const statusCode = getApiStatusFromError(error);
  if (statusCode === 401) {
    return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
  }

  if (statusCode === 403) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  if (statusCode === 404) {
    return "Không tìm thấy dữ liệu.";
  }

  return toSharedErrorMessage(error);
};

const isForbiddenOrNotFoundError = (errorMessage: string): boolean => {
  const normalized = errorMessage.toLowerCase();
  return (
    errorMessage.includes("[API 403]") ||
    errorMessage.includes("[API 404]") ||
    normalized.includes("không có quyền") ||
    normalized.includes("khong co quyen") ||
    normalized.includes("không tìm thấy") ||
    normalized.includes("khong tim thay")
  );
};

const formatDate = (value?: string): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("vi-VN");
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN");
};

const formatScore = (value?: number): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(2);
};

const pickReportNumber = (
  source: Record<string, unknown>,
  keys: string[],
): number | null => {
  for (const key of keys) {
    const rawValue = source[key];

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return rawValue;
    }

    if (typeof rawValue === "string" && rawValue.trim()) {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const pickReportText = (
  source: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const rawValue = source[key];

    if (typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim();
    }
  }

  return null;
};

const getGradeScore10FromReport = (report: GradeReportResponse): number | null => {
  if (typeof report.finalScore === "number" && Number.isFinite(report.finalScore)) {
    return report.finalScore;
  }

  return pickReportNumber(report as unknown as Record<string, unknown>, [
    "finalScore10",
    "score10",
    "totalScore10",
  ]);
};

const getGradeScore4FromReport = (report: GradeReportResponse): number | null => {
  return pickReportNumber(report as unknown as Record<string, unknown>, [
    "finalScore4",
    "score4",
    "totalScore4",
    "gpa4",
    "gradePoint",
  ]);
};

const getGradeLetterFromReport = (report: GradeReportResponse): string => {
  if (typeof report.letterGrade === "string" && report.letterGrade.trim()) {
    return report.letterGrade.trim();
  }

  const fallback = pickReportText(report as unknown as Record<string, unknown>, [
    "finalLetterGrade",
    "gradeLetter",
    "scoreLetter",
  ]);

  return fallback || "-";
};

const getGradeResultMetaFromReport = (
  report: GradeReportResponse,
): { label: string; passed: boolean | null } => {
  const rawReport = report as unknown as Record<string, unknown>;

  const passFlag = ["passed", "isPassed", "pass", "resultPassed"]
    .map((key) => rawReport[key])
    .find((value) => typeof value === "boolean");

  if (typeof passFlag === "boolean") {
    return {
      label: passFlag ? "Đạt" : "Không đạt",
      passed: passFlag,
    };
  }

  const resultLabel = pickReportText(rawReport, [
    "result",
    "finalResult",
    "resultLabel",
    "outcome",
  ]);

  if (resultLabel) {
    const normalized = resultLabel.toLowerCase();
    if (normalized.includes("đạt") || normalized.includes("pass")) {
      return { label: resultLabel, passed: true };
    }

    if (
      normalized.includes("không đạt") ||
      normalized.includes("khong dat") ||
      normalized.includes("fail")
    ) {
      return { label: resultLabel, passed: false };
    }

    return {
      label: resultLabel,
      passed: null,
    };
  }

  return {
    label: "-",
    passed: null,
  };
};

const getAcademicYearStart = (academicYear?: string): number => {
  const matched = String(academicYear || "").trim().match(/^(\d{4})/);
  return matched ? Number(matched[1]) : 0;
};

const normalizeTextValue = (value?: string): string => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizePhoneValue = (value?: string): string => {
  return String(value || "").replace(/[^\d]/g, "");
};

const toDateOnlyValue = (value?: string): string => {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return toLocalIsoDate(date);
};

const toLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDateLocal = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
};

const getMondayOfWeek = (date: Date): Date => {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
};

const getIsoWeekNumber = (value: Date): number => {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const formatDateShort = (value: string): string => {
  const date = parseIsoDateLocal(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
};

const buildScheduleWeekOption = (startDate: string): ScheduleWeekOption => {
  const start = parseIsoDateLocal(startDate);
  const end = addDays(start, 6);
  const endDate = toLocalIsoDate(end);
  const weekNumber = getIsoWeekNumber(start);

  return {
    key: startDate,
    weekNumber,
    startDate,
    endDate,
    label: `Tuần ${weekNumber} [từ ngày ${formatDateShort(
      startDate,
    )} đến ngày ${formatDateShort(endDate)}]`,
  };
};

interface RegistrationNotice {
  title: string;
  message: string;
  detail?: string;
}

interface RegisteredCourseItem {
  registrationId: number;
  courseSectionId?: number;
  courseId?: number;
  courseCode?: string;
  courseName?: string;
  sectionCode?: string;
  semesterId?: number;
  registrationTime?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "DROPPED";
  availableSection?: AvailableCourseSectionResponse | null;
}

interface ScheduleRegisteredSectionItem {
  registrationId: number;
  registrationTime?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "DROPPED";
  section: CourseSectionResponse;
}

interface RegistrationSwitchTarget {
  item: RegisteredCourseItem;
  nextSectionId: string;
}

interface FacultyFilterOption {
  facultyId: number;
  facultyName: string;
  facultyCode?: string;
}

interface MajorFilterOption {
  majorId: number;
  majorName: string;
  majorCode?: string;
  facultyId?: number;
  facultyName?: string;
}

interface SpecializationFilterOption {
  specializationId: number;
  specializationName: string;
  majorId?: number;
  majorName?: string;
}

interface SemesterFilterOption {
  semesterId: number;
  semesterNumber?: number;
  academicYear?: string;
  label: string;
  startDate?: string;
  endDate?: string;
  semesterStatus?: "PLANNING" | "REGISTRATION_OPEN" | "ONGOING" | "FINISHED";
}

interface WeeklyScheduleBlock {
  key: string;
  sectionId: number;
  recurringScheduleId?: number;
  classroomId?: number;
  lecturerId?: number;
  courseName: string;
  courseCode?: string;
  sectionCode?: string;
  lecturerName?: string;
  classroomName?: string;
  startPeriod: number;
  endPeriod: number;
  dayIndex: number;
  sessionDate?: string;
  status?: string;
  semesterId?: number;
  semesterNumber?: number;
  academicYear?: string;
}

interface ScheduleWeekOption {
  key: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  label: string;
}

type GradeDetailItem = GradeDetailResponse;

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

const periodStartTimeMap: Record<number, string> = {
  1: "07:00",
  2: "07:50",
  3: "09:00",
  4: "09:50",
  5: "10:40",
  6: "13:00",
  7: "13:50",
  8: "15:00",
  9: "15:50",
  10: "16:40",
  11: "17:40",
  12: "18:30",
  13: "19:20",
  14: "20:10",
};

const periodEndTimeMap: Record<number, string> = {
  1: "07:50",
  2: "08:40",
  3: "09:50",
  4: "10:40",
  5: "11:30",
  6: "13:50",
  7: "14:40",
  8: "15:50",
  9: "16:40",
  10: "17:30",
  11: "18:30",
  12: "19:20",
  13: "20:10",
  14: "21:00",
};

const scheduleDayLabels = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
] as const;

const getCourseDisplayName = (section: CourseSectionResponse): string => {
  return section.courseName || section.courseCode || "Chưa cập nhật";
};

const getGroupLabel = (section: CourseSectionResponse): string => {
  const matched = section.sectionCode?.match(/(\d+)$/);
  return matched?.[1] || "-";
};

const getAvailableSectionDisplayName = (
  section: AvailableCourseSectionResponse,
): string => {
  return section.displayName || section.sectionCode || `Lớp ${section.courseSectionId}`;
};

const getAvailableSectionCourseName = (
  section: AvailableCourseSectionResponse,
): string => {
  return section.courseName || section.courseCode || "Chưa cập nhật";
};

const getAvailableSectionGroupLabel = (
  section?: AvailableCourseSectionResponse | null,
): string => {
  if (!section?.sectionCode) {
    return "-";
  }

  const matched = section.sectionCode.match(/(\d+)$/);
  return matched?.[1] || section.sectionCode;
};

const getScheduleDateRangeLabel = (
  startDate?: string,
  endDate?: string,
): string | null => {
  const startLabel = formatDate(startDate);
  const endLabel = formatDate(endDate);

  if (startLabel !== "-" && endLabel !== "-") {
    return `Từ ${startLabel} đến ${endLabel}`;
  }

  if (startLabel !== "-") {
    return `Từ ${startLabel}`;
  }

  if (endLabel !== "-") {
    return `Đến ${endLabel}`;
  }

  return null;
};

const getAvailableScheduleSummaryLines = (
  schedules?: AvailableCourseSectionResponse["schedules"] | null,
): string[] => {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return [];
  }

  return [...schedules]
    .sort((first, second) => {
      const firstDay = normalizeDayIndex(first.dayOfWeek) ?? 99;
      const secondDay = normalizeDayIndex(second.dayOfWeek) ?? 99;

      if (firstDay === secondDay) {
        return (first.startPeriod ?? 99) - (second.startPeriod ?? 99);
      }

      return firstDay - secondDay;
    })
    .map((schedule) => {
      const effectiveStartDate = schedule.startDate || schedule.effectiveStartDate;
      const effectiveEndDate = schedule.endDate || schedule.effectiveEndDate;
      const dateRangeLabel = getScheduleDateRangeLabel(
        effectiveStartDate,
        effectiveEndDate,
      );

      return [
        normalizeDayIndex(schedule.dayOfWeek) !== null
          ? scheduleDayLabels[normalizeDayIndex(schedule.dayOfWeek) || 0]
          : "Chưa rõ thứ",
        getPeriodRangeLabel(schedule.startPeriod, schedule.endPeriod),
        dateRangeLabel,
        schedule.roomName ? `Phòng ${schedule.roomName}` : null,
        schedule.startWeek && schedule.endWeek
          ? `Tuần ${schedule.startWeek}-${schedule.endWeek}`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
    });
};

const getSemesterDisplayLabel = (
  semesterNumber?: number,
  academicYear?: string,
): string => {
  const term = semesterNumber ? `Học kỳ ${semesterNumber}` : "Học kỳ";
  return [term, academicYear].filter(Boolean).join(" - ");
};

const getGradeSemesterFilterValue = (
  section?: CourseSectionResponse,
): string => {
  if (!section) {
    return "";
  }

  if (typeof section.semesterId === "number" && Number.isInteger(section.semesterId)) {
    return `semester:${section.semesterId}`;
  }

  const label = getSemesterDisplayLabel(section.semesterNumber, section.academicYear);
  return label ? `label:${label}` : "";
};

const getGradeCourseFilterValue = (
  report: GradeReportResponse,
  section?: CourseSectionResponse,
): string => {
  if (section && typeof section.courseId === "number" && Number.isInteger(section.courseId)) {
    return `course:${section.courseId}`;
  }

  const fallbackName = report.courseName?.trim();
  return fallbackName ? `name:${fallbackName}` : "";
};

const parsePositiveInteger = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const getPeriodRangeLabel = (startPeriod?: number, endPeriod?: number): string => {
  if (
    Number.isInteger(startPeriod) &&
    Number.isInteger(endPeriod) &&
    startPeriod &&
    endPeriod
  ) {
    return `Tiết ${startPeriod} - ${endPeriod}`;
  }

  return "-";
};

const getPeriodStartLabel = (startPeriod?: number): string => {
  if (Number.isInteger(startPeriod) && startPeriod) {
    return periodStartTimeMap[startPeriod] || `Tiết ${startPeriod}`;
  }

  return "-";
};

const getPeriodEndLabel = (endPeriod?: number): string => {
  if (Number.isInteger(endPeriod) && endPeriod) {
    return periodEndTimeMap[endPeriod] || `Tiết ${endPeriod}`;
  }

  return "-";
};

const getPeriodClockRange = (startPeriod: number, endPeriod: number): string => {
  const start = periodStartTimeMap[startPeriod] || `Tiết ${startPeriod}`;
  const end = periodEndTimeMap[endPeriod] || `Tiết ${endPeriod}`;
  return `${start} -> ${end}`;
};

const normalizeDayIndex = (
  dayOfWeek?: number,
  dayOfWeekName?: string,
): number | null => {
  const normalizedName = dayOfWeekName?.trim().toLowerCase();
  if (normalizedName) {
    if (
      normalizedName.includes("chủ nhật") ||
      normalizedName.includes("chu nhat") ||
      normalizedName.includes("sunday")
    ) {
      return 6;
    }

    const mappingByName: Array<{ key: string; dayIndex: number }> = [
      { key: "thứ 2", dayIndex: 0 },
      { key: "thu 2", dayIndex: 0 },
      { key: "monday", dayIndex: 0 },
      { key: "thứ 3", dayIndex: 1 },
      { key: "thu 3", dayIndex: 1 },
      { key: "tuesday", dayIndex: 1 },
      { key: "thứ 4", dayIndex: 2 },
      { key: "thu 4", dayIndex: 2 },
      { key: "wednesday", dayIndex: 2 },
      { key: "thứ 5", dayIndex: 3 },
      { key: "thu 5", dayIndex: 3 },
      { key: "thursday", dayIndex: 3 },
      { key: "thứ 6", dayIndex: 4 },
      { key: "thu 6", dayIndex: 4 },
      { key: "friday", dayIndex: 4 },
      { key: "thứ 7", dayIndex: 5 },
      { key: "thu 7", dayIndex: 5 },
      { key: "saturday", dayIndex: 5 },
    ];

    const matched = mappingByName.find((item) =>
      normalizedName.includes(item.key),
    );
    if (matched) {
      return matched.dayIndex;
    }
  }

  const numericDay = typeof dayOfWeek === "number" ? dayOfWeek : NaN;
  if (!Number.isInteger(numericDay)) {
    return null;
  }

  if (numericDay === 0 || numericDay === 7 || numericDay === 8) {
    return 6;
  }

  if (numericDay >= 1 && numericDay <= 6) {
    return numericDay - 1;
  }

  return null;
};

const getDayIndexFromSessionDate = (sessionDate?: string): number | null => {
  if (!sessionDate) {
    return null;
  }

  const date = parseIsoDateLocal(sessionDate);
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

const getScheduleCardClassName = (
  status?: string,
  courseCode?: string,
): string => {
  if (status === "CANCELLED") {
    return "border-[#df8e8e] bg-[#fff1f1] text-[#8f2f2f]";
  }

  if (status === "RESCHEDULED") {
    return "border-[#e6b074] bg-[#fff7ea] text-[#8a5200]";
  }

  const colorPalettes = [
    "border-[#86abd8] bg-[#dce9fb] text-[#1c3552]",
    "border-[#93b6e3] bg-[#d8e7fb] text-[#1d3651]",
    "border-[#97abd1] bg-[#dfe8f8] text-[#20334d]",
    "border-[#9fb3d8] bg-[#dbe7fb] text-[#1f3552]",
  ];

  const token = courseCode || "course";
  const hash = token
    .split("")
    .reduce((current, char) => current + char.charCodeAt(0), 0);
  return colorPalettes[hash % colorPalettes.length];
};

const getRegistrationStatusLabel = (status?: string): string => {
  switch (status) {
    case "OPEN":
      return "Đang mở";
    case "ONGOING":
      return "Đang diễn ra";
    case "FINISHED":
      return "Đã kết thúc";
    case "CANCELLED":
      return "Đã hủy";
    case "PENDING":
      return "Chờ xác nhận";
    case "CONFIRMED":
      return "Đã xác nhận";
    case "DROPPED":
      return "Đã hủy đăng ký";
    default:
      return status || "-";
  }
};

const getRegistrationStatusClass = (status?: string): string => {
  switch (status) {
    case "OPEN":
    case "CONFIRMED":
      return "bg-[#eef8f1] text-[#1d7a46]";
    case "PENDING":
    case "ONGOING":
      return "bg-[#fff7e8] text-[#a16a00]";
    case "CANCELLED":
    case "DROPPED":
      return "bg-[#fff0f0] text-[#bf4e4e]";
    default:
      return "bg-[#eef4f8] text-[#47677e]";
  }
};

const isRegistrationWindowOpen = (
  semester: ScheduleSemesterOptionResponse,
): boolean => {
  return (
    semester.registrationOpen === true ||
    semester.registrationPeriodStatus === "OPEN"
  );
};

const getGradeStatusLabel = (status?: string): string => {
  switch (status) {
    case "PUBLISHED":
      return "Đã công bố";
    case "LOCKED":
      return "Đã chốt";
    case "DRAFT":
      return "Nháp";
    default:
      return status || "-";
  }
};

const getGradeStatusClass = (status?: string): string => {
  switch (status) {
    case "PUBLISHED":
      return "bg-[#eef8f1] text-[#1d7a46]";
    case "LOCKED":
      return "bg-[#eef4fb] text-[#1f4f84]";
    case "DRAFT":
      return "bg-[#fff7e8] text-[#a16a00]";
    default:
      return "bg-[#eef4f8] text-[#47677e]";
  }
};

const getAttendanceStatusLabel = (status?: string): string => {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "LATE":
      return "Đi muộn";
    case "EXCUSED":
      return "Có phép";
    case "ABSENT":
      return "Vắng";
    default:
      return status || "-";
  }
};

const getAttendanceStatusClass = (status?: string): string => {
  switch (status) {
    case "PRESENT":
      return "bg-[#eef8f1] text-[#1d7a46]";
    case "LATE":
      return "bg-[#fff7e8] text-[#a16a00]";
    case "EXCUSED":
      return "bg-[#eef4fb] text-[#1f4f84]";
    case "ABSENT":
      return "bg-[#fff0f0] text-[#bf4e4e]";
    default:
      return "bg-[#eef4f8] text-[#47677e]";
  }
};

const getTopHeaderDisplayLabel = (label: string): string => {
  if (label === "Thông báo") {
    return "Thông báo";
  }

  if (label === "Quy dinh - quy che") {
    return "Quy định - quy chế";
  }

  if (label === "Thông tin cập nhật") {
    return "Thông tin cập nhật";
  }

  return label;
};

const getStudentTabDisplayLabel = (
  item: Pick<StudentFeatureTab, "key" | "label">,
): string => {
  if (item.key === "course-registration") {
    return "Đăng ký môn học";
  }

  return item.label;
};

const getStudentTabDescription = (
  item: Pick<StudentFeatureTab, "key" | "description">,
): string => {
  if (item.key === "course-registration") {
    return "Tra cứu lớp học phần đủ điều kiện đăng ký theo học kỳ, khoa và môn học; sau đó đăng ký, hủy hoặc đổi nhóm ngay trên trang này.";
  }

  return item.description;
};

const parseRegistrationError = (error: unknown): RegistrationNotice => {
  const fallback: RegistrationNotice = {
    title: "Không thể đăng ký học phần",
    message: "Đăng ký học phần thất bại. Vui lòng thử lại.",
  };

  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const separatorIndex = error.message.indexOf(" - ");
  if (separatorIndex >= 0) {
    const payloadText = error.message.slice(separatorIndex + 3).trim();

    try {
      const payload = JSON.parse(payloadText) as {
        status?: number;
        message?: string;
        path?: string;
        data?: string;
      };
      const businessMessage =
        typeof payload.message === "string" &&
        payload.message.trim() &&
        !["INVALID_DATA", "NOT_FOUND", "BAD_REQUEST"].includes(
          payload.message.trim().toUpperCase(),
        )
          ? payload.message.trim()
          : "";
      const backendDetailCandidates = [payload.data, payload.path]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value && !value.startsWith("/api/"));
      const backendDetail = businessMessage || backendDetailCandidates[0] || "";

      if (
        payload.status === 400 &&
        backendDetail.includes("schedule conflicts with section")
      ) {
        const matched = backendDetail.match(/section\s+([A-Za-z0-9_-]+)/i);

        return {
          title: "Không thể đăng ký học phần",
          message: matched
            ? `Lớp học phần bạn chọn bị trùng lịch với lớp ${matched[1]} đã đăng ký. Vui lòng chọn lớp khác hoặc hủy lớp đang bị trùng trước khi đăng ký lại.`
            : "Lớp học phần bạn chọn đang bị trùng lịch với một lớp đã đăng ký. Vui lòng kiểm tra lại thời khóa biểu trước khi đăng ký.",
        };
      }

      if (
        payload.status === 400 &&
        backendDetail.toLowerCase().includes(
          "student has already registered for this course section",
        )
      ) {
        return {
          title: "Không thể đăng ký học phần",
          message: "Bạn đã đăng ký lớp học phần này rồi.",
        };
      }

      if (backendDetail) {
        return {
          title: fallback.title,
          message: backendDetail,
        };
      }

      if (payload.status === 403) {
        return {
          title: fallback.title,
          message: "Bạn không có quyền thực hiện thao tác này.",
        };
      }

      if (payload.status === 404) {
        return {
          title: fallback.title,
          message: "Không tìm thấy dữ liệu.",
        };
      }
    } catch {
      return {
        title: fallback.title,
        message: toErrorMessage(error),
      };
    }
  }

  return {
    title: fallback.title,
    message: toErrorMessage(error),
  };
};

const isActiveCourseRegistration = (
  registration: CourseRegistrationResponse,
): boolean => {
  return (
    registration.status !== "CANCELLED" &&
    registration.status !== "DROPPED" &&
    typeof registration.courseSectionId === "number" &&
    Number.isInteger(registration.courseSectionId) &&
    registration.courseSectionId > 0
  );
};

export default function DashboardPage() {
  const { session, logout } = useAuth();
  const toast = useToast();

  const [activeTabKey, setActiveTabKey] =
    useState<StudentFeatureTab["key"]>("home");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [tabError, setTabError] = useState("");
  const [tabMessage, setTabMessage] = useState("");
  useToastFeedback({
    errorMessage: tabError,
    errorTitle: "Thao tác sinh viên thất bại",
  });

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    dateOfBirth: "",
  });
  const [profileFormError, setProfileFormError] = useState("");
  const [profileLastLoadedAt, setProfileLastLoadedAt] = useState<string>("");
  const [majorCatalog, setMajorCatalog] = useState<MajorResponse[]>([]);
  const [majorsBySelectedProfileFaculty, setMajorsBySelectedProfileFaculty] =
    useState<MajorResponse[]>([]);
  const [specializationCatalog, setSpecializationCatalog] = useState<
    SpecializationResponse[]
  >([]);
  const [
    specializationsBySelectedProfileMajor,
    setSpecializationsBySelectedProfileMajor,
  ] = useState<SpecializationResponse[]>([]);
  const [administrativeClassCatalog, setAdministrativeClassCatalog] = useState<
    AdministrativeClassResponse[]
  >([]);
  const [administrativeClassDetailsById, setAdministrativeClassDetailsById] =
    useState<Record<number, AdministrativeClassResponse | null>>({});
  const [cohortCatalog, setCohortCatalog] = useState<CohortResponse[]>([]);
  const [cohortDetailsById, setCohortDetailsById] = useState<
    Record<number, CohortResponse | null>
  >({});
  const [selectedProfileFacultyId, setSelectedProfileFacultyId] = useState("");
  const [selectedProfileMajorId, setSelectedProfileMajorId] = useState("");
  const [selectedProfileSpecializationId, setSelectedProfileSpecializationId] =
    useState("");
  const [selectedProfileClassId, setSelectedProfileClassId] = useState("");
  const [isProfileMajorContextLoading, setIsProfileMajorContextLoading] =
    useState(false);
  const [
    isProfileSpecializationContextLoading,
    setIsProfileSpecializationContextLoading,
  ] = useState(false);
  const [isProfileClassContextLoading, setIsProfileClassContextLoading] =
    useState(false);
  const [loadingProfileClassDetailId, setLoadingProfileClassDetailId] = useState<
    number | null
  >(null);
  const [loadingProfileCohortDetailId, setLoadingProfileCohortDetailId] =
    useState<number | null>(null);

  const [gradeReports, setGradeReports] = useState<GradeReportResponse[]>([]);
  const [hasLoadedGrades, setHasLoadedGrades] = useState(false);
  const [gradeLastLoadedAt, setGradeLastLoadedAt] = useState("");
  const [gradeKeyword, setGradeKeyword] = useState("");
  const [gradeStatusFilter, setGradeStatusFilter] = useState("");
  const [gradeSemesterFilter, setGradeSemesterFilter] = useState("");
  const [gradeCourseFilter, setGradeCourseFilter] = useState("");
  const [selectedGradeReportId, setSelectedGradeReportId] = useState<
    number | null
  >(null);
  const [isGradeDetailModalOpen, setIsGradeDetailModalOpen] = useState(false);
  const [gradeReportDetailsById, setGradeReportDetailsById] = useState<
    Record<number, GradeReportResponse | null>
  >({});
  const [loadingGradeReportId, setLoadingGradeReportId] = useState<number | null>(
    null,
  );
  const [gradeSectionsById, setGradeSectionsById] = useState<
    Record<number, CourseSectionResponse>
  >({});
  const [isGradeContextLoading, setIsGradeContextLoading] = useState(false);
  const [gradeComponentsByCourseId, setGradeComponentsByCourseId] = useState<
    Record<number, GradeComponentResponse[]>
  >({});
  const [loadingGradeComponentCourseId, setLoadingGradeComponentCourseId] =
    useState<number | null>(null);
  const [attendanceItems, setAttendanceItems] = useState<AttendanceResponse[]>([]);
  const [hasLoadedAttendance, setHasLoadedAttendance] = useState(false);
  const [attendanceLastLoadedAt, setAttendanceLastLoadedAt] = useState("");
  const [attendanceKeyword, setAttendanceKeyword] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("");
  const [attendanceDateFrom, setAttendanceDateFrom] = useState("");
  const [attendanceDateTo, setAttendanceDateTo] = useState("");
  const [courseSections, setCourseSections] = useState<
    AvailableCourseSectionResponse[]
  >([]);
  const [registrationSectionsBySemester, setRegistrationSectionsBySemester] =
    useState<Record<number, AvailableCourseSectionResponse>>({});
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [courseKeyword, setCourseKeyword] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [facultyCatalog, setFacultyCatalog] = useState<FacultyResponse[]>([]);
  const [allCoursesCatalog, setAllCoursesCatalog] = useState<CourseResponse[]>([]);
  const [coursesBySelectedFaculty, setCoursesBySelectedFaculty] = useState<
    CourseResponse[]
  >([]);
  const [registrationNotice, setRegistrationNotice] =
    useState<RegistrationNotice | null>(null);
  const [isRegistrationAccessChecked, setIsRegistrationAccessChecked] =
    useState(false);
  const [isRegistrationPeriodOpen, setIsRegistrationPeriodOpen] = useState(true);
  const [registrationDeleteTarget, setRegistrationDeleteTarget] =
    useState<RegisteredCourseItem | null>(null);
  const [registrationSwitchTarget, setRegistrationSwitchTarget] =
    useState<RegistrationSwitchTarget | null>(null);
  const [registeredSections, setRegisteredSections] = useState<
    RegisteredCourseItem[]
  >([]);
  const [myScheduleBlocks, setMyScheduleBlocks] = useState<WeeklyScheduleBlock[]>(
    [],
  );
  const [classroomCatalog, setClassroomCatalog] = useState<ClassroomResponse[]>([]);
  const [selectedScheduleBlockKey, setSelectedScheduleBlockKey] = useState("");
  const [recurringScheduleDetailsById, setRecurringScheduleDetailsById] =
    useState<Record<number, RecurringScheduleResponse | null>>({});
  const [classroomDetailsById, setClassroomDetailsById] = useState<
    Record<number, ClassroomResponse | null>
  >({});
  const [lecturerDetailsById, setLecturerDetailsById] = useState<
    Record<number, LecturerResponse | null>
  >({});
  const [loadingRecurringScheduleId, setLoadingRecurringScheduleId] = useState<
    number | null
  >(null);
  const [loadingClassroomDetailId, setLoadingClassroomDetailId] = useState<
    number | null
  >(null);
  const [loadingLecturerDetailId, setLoadingLecturerDetailId] = useState<
    number | null
  >(null);
  const [selectedScheduleSemesterId, setSelectedScheduleSemesterId] =
    useState("");
  const [scheduleSemesterCatalog, setScheduleSemesterCatalog] = useState<
    ScheduleSemesterOptionResponse[]
  >([]);
  const [selectedScheduleWeekKey, setSelectedScheduleWeekKey] = useState("");
  const [scheduleViewType, setScheduleViewType] = useState("personal");
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [isWorking, setIsWorking] = useState(false);

  const isCourseRegistrationBlocked =
    isRegistrationAccessChecked && !isRegistrationPeriodOpen;

  useEffect(() => {
    if (!session?.authorization) {
      return;
    }

    let cancelled = false;

    const preloadStudentProfile = async () => {
      try {
        const myProfile = await getMyStudentProfile(session.authorization);

        if (cancelled) {
          return;
        }

        setProfile((current) => current || myProfile);

        if (
          typeof myProfile.id === "number" &&
          Number.isInteger(myProfile.id) &&
          myProfile.id > 0
        ) {
          setStudentIdInput((current) => {
            const currentValue = current.trim();
            const accountIdValue = String(session.accountId);

            if (!currentValue || currentValue === accountIdValue) {
              return String(myProfile.id);
            }

            return current;
          });
        }
      } catch {
        // Leave the field untouched if the profile API is unavailable.
      }
    };

    void preloadStudentProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.accountId, session?.authorization]);

  const activeTab = useMemo(
    () =>
      studentFeatureTabs.find((item) => item.key === activeTabKey) ||
      studentFeatureTabs[0],
    [activeTabKey],
  );

  const normalizedProfileForm = useMemo(() => {
    return {
      fullName: normalizeTextValue(profileForm.fullName),
      phone: normalizePhoneValue(profileForm.phone),
      address: normalizeTextValue(profileForm.address),
      dateOfBirth: toDateOnlyValue(profileForm.dateOfBirth),
    };
  }, [profileForm.address, profileForm.dateOfBirth, profileForm.fullName, profileForm.phone]);

  const normalizedProfileSnapshot = useMemo(() => {
    return {
      fullName: normalizeTextValue(profile?.fullName),
      phone: normalizePhoneValue(profile?.phone),
      address: normalizeTextValue(profile?.address),
      dateOfBirth: toDateOnlyValue(profile?.dateOfBirth),
    };
  }, [profile?.address, profile?.dateOfBirth, profile?.fullName, profile?.phone]);

  const isProfileFormDirty = useMemo(() => {
    return (
      normalizedProfileForm.fullName !== normalizedProfileSnapshot.fullName ||
      normalizedProfileForm.phone !== normalizedProfileSnapshot.phone ||
      normalizedProfileForm.address !== normalizedProfileSnapshot.address ||
      normalizedProfileForm.dateOfBirth !== normalizedProfileSnapshot.dateOfBirth
    );
  }, [normalizedProfileForm, normalizedProfileSnapshot]);

  const facultyFilterOptions = useMemo<FacultyFilterOption[]>(() => {
    return facultyCatalog
      .map((item) => ({
        facultyId: item.id,
        facultyName: item.facultyName || `Khoa ${item.id}`,
        facultyCode: item.facultyCode,
      }))
      .sort((a, b) => a.facultyName.localeCompare(b.facultyName, "vi"));
  }, [facultyCatalog]);

  const profileMajorOptions = useMemo<MajorFilterOption[]>(() => {
    const source = selectedProfileFacultyId
      ? majorsBySelectedProfileFaculty
      : majorCatalog;

    return source
      .map((item) => ({
        majorId: item.id,
        majorName: item.majorName || `Ngành ${item.id}`,
        majorCode: item.majorCode,
        facultyId: item.facultyId,
        facultyName: item.facultyName,
      }))
      .sort((a, b) => a.majorName.localeCompare(b.majorName, "vi"));
  }, [majorCatalog, majorsBySelectedProfileFaculty, selectedProfileFacultyId]);

  const selectedProfileMajorResolved = useMemo(() => {
    const majorId = parsePositiveInteger(selectedProfileMajorId);
    if (!majorId) {
      return null;
    }

    return (
      profileMajorOptions.find((item) => item.majorId === majorId) ||
      majorCatalog.find((item) => item.id === majorId) ||
      null
    );
  }, [majorCatalog, profileMajorOptions, selectedProfileMajorId]);

  const profileSpecializationOptions = useMemo<SpecializationFilterOption[]>(() => {
    const source = selectedProfileMajorId
      ? specializationsBySelectedProfileMajor
      : specializationCatalog;

    return source
      .map((item) => ({
        specializationId: item.id,
        specializationName: item.specializationName || `Chuyên ngành ${item.id}`,
        majorId: item.majorId,
        majorName: item.majorName,
      }))
      .sort((a, b) =>
        a.specializationName.localeCompare(b.specializationName, "vi"),
      );
  }, [
    selectedProfileMajorId,
    specializationCatalog,
    specializationsBySelectedProfileMajor,
  ]);

  const selectedProfileSpecializationResolved = useMemo(() => {
    const specializationId = parsePositiveInteger(selectedProfileSpecializationId);
    if (!specializationId) {
      return null;
    }

    return (
      profileSpecializationOptions.find(
        (item) => item.specializationId === specializationId,
      ) ||
      specializationCatalog.find((item) => item.id === specializationId) ||
      null
    );
  }, [
    profileSpecializationOptions,
    selectedProfileSpecializationId,
    specializationCatalog,
  ]);

  const selectedProfileClassResolved = useMemo(() => {
    const classId = parsePositiveInteger(selectedProfileClassId);
    if (!classId) {
      return null;
    }

    return (
      administrativeClassDetailsById[classId] ||
      administrativeClassCatalog.find((item) => item.id === classId) ||
      null
    );
  }, [administrativeClassCatalog, administrativeClassDetailsById, selectedProfileClassId]);

  const selectedProfileClassIdValue = parsePositiveInteger(selectedProfileClassId);

  const isLoadingSelectedProfileClassDetail =
    selectedProfileClassIdValue !== null &&
    loadingProfileClassDetailId === selectedProfileClassIdValue;

  const selectedProfileCohortIdValue =
    selectedProfileClassResolved?.cohortId &&
    Number.isInteger(selectedProfileClassResolved.cohortId) &&
    selectedProfileClassResolved.cohortId > 0
      ? selectedProfileClassResolved.cohortId
      : null;

  const selectedProfileCohortResolved = useMemo(() => {
    if (!selectedProfileCohortIdValue) {
      return null;
    }

    return (
      cohortDetailsById[selectedProfileCohortIdValue] ||
      cohortCatalog.find((item) => item.id === selectedProfileCohortIdValue) ||
      null
    );
  }, [cohortCatalog, cohortDetailsById, selectedProfileCohortIdValue]);

  const isLoadingSelectedProfileCohortDetail =
    selectedProfileCohortIdValue !== null &&
    loadingProfileCohortDetailId === selectedProfileCohortIdValue;

  const isProfileReferenceLoading =
    isProfileMajorContextLoading ||
    isProfileSpecializationContextLoading ||
    isProfileClassContextLoading;

  const availableCourseCatalog = useMemo(() => {
    if (selectedFacultyId) {
      return coursesBySelectedFaculty;
    }

    return allCoursesCatalog;
  }, [allCoursesCatalog, coursesBySelectedFaculty, selectedFacultyId]);

  const courseCatalogById = useMemo(() => {
    const entries = new Map<number, CourseResponse>();

    [...allCoursesCatalog, ...coursesBySelectedFaculty].forEach((course) => {
      if (Number.isInteger(course.id) && course.id > 0 && !entries.has(course.id)) {
        entries.set(course.id, course);
      }
    });

    return entries;
  }, [allCoursesCatalog, coursesBySelectedFaculty]);

  const courseFilterOptions = useMemo(() => {
    return availableCourseCatalog
      .map((course) => ({
        courseId: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName || course.courseCode || `Môn học ${course.id}`,
      }))
      .sort((a, b) =>
      a.courseName.localeCompare(b.courseName, "vi"),
      );
  }, [availableCourseCatalog]);

  const filteredSections = useMemo(() => {
    const normalizedKeyword = courseKeyword.trim().toLowerCase();

    return courseSections.filter((section) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [
          section.courseCode,
          getAvailableSectionCourseName(section),
          getAvailableSectionDisplayName(section),
          section.sectionCode,
          section.lecturerName,
          section.facultyName,
          section.prerequisiteCourseName,
          section.registrationPeriodName,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedKeyword),
          );

      return matchesKeyword;
    });
  }, [courseKeyword, courseSections]);

  const registrationAvailableSectionsById = useMemo(() => {
    const entries = new Map<number, AvailableCourseSectionResponse>();

    [...courseSections, ...Object.values(registrationSectionsBySemester)].forEach(
      (section) => {
        if (!section || !Number.isInteger(section.courseSectionId)) {
          return;
        }

        entries.set(section.courseSectionId, section);
      },
    );

    return entries;
  }, [courseSections, registrationSectionsBySemester]);

  const selectedRegistrationSection = useMemo(() => {
    const sectionId = parsePositiveInteger(selectedSectionId);
    if (!sectionId) {
      return null;
    }

    return (
      filteredSections.find((section) => section.courseSectionId === sectionId) || null
    );
  }, [filteredSections, selectedSectionId]);

  const registeredCredits = useMemo(() => {
    return registeredSections.reduce((total, item) => {
      const credits =
        item.availableSection?.credits ||
        (item.courseId ? courseCatalogById.get(item.courseId)?.credits : undefined);
      return total + (typeof credits === "number" ? credits : 0);
    }, 0);
  }, [courseCatalogById, registeredSections]);

  const switchableSectionOptionsByRegistrationId = useMemo(() => {
    const entries = new Map<number, AvailableCourseSectionResponse[]>();

    registeredSections.forEach((item) => {
      if (!item.registrationId) {
        entries.set(item.registrationId, []);
        return;
      }

      const currentSection = item.availableSection;
      const targetCourseId = currentSection?.courseId || item.courseId;
      const targetSemesterId = currentSection?.semesterId || item.semesterId;

      if (!targetCourseId || !targetSemesterId) {
        entries.set(item.registrationId, []);
        return;
      }

      const candidates = Array.from(registrationAvailableSectionsById.values())
        .filter((section) => {
          if (section.courseSectionId === item.courseSectionId) {
            return false;
          }

          return (
            section.courseId === targetCourseId &&
            section.semesterId === targetSemesterId
          );
        })
        .sort((first, second) => {
          const firstCode = first.sectionCode || first.displayName || "";
          const secondCode = second.sectionCode || second.displayName || "";
          return firstCode.localeCompare(secondCode, "vi");
        });

      entries.set(item.registrationId, candidates);
    });

    return entries;
  }, [registeredSections, registrationAvailableSectionsById]);

  const scheduleSemesterOptions = useMemo(() => {
    return scheduleSemesterCatalog
      .filter(
        (semester) =>
          semester.selectableForSchedule !== false &&
          semester.semesterStatus === "REGISTRATION_OPEN",
      )
      .map((semester) => ({
        semesterId: semester.semesterId,
        semesterNumber: semester.semesterNumber,
        academicYear: semester.academicYear,
        label:
          semester.displayName ||
          getSemesterDisplayLabel(semester.semesterNumber, semester.academicYear),
        startDate: semester.startDate,
        endDate: semester.endDate,
        semesterStatus: semester.semesterStatus,
      }))
      .sort((a, b) => {
      if ((a.semesterNumber ?? 0) === (b.semesterNumber ?? 0)) {
        return (a.academicYear || "").localeCompare(b.academicYear || "", "vi");
      }

      return (a.semesterNumber ?? 0) - (b.semesterNumber ?? 0);
    });
  }, [scheduleSemesterCatalog]);

  const scheduleBlocksBySemester = useMemo(() => {
    const allowedSemesterIds = new Set(
      scheduleSemesterOptions.map((item) => item.semesterId),
    );

    const fallbackSemesterId =
      scheduleSemesterOptions[scheduleSemesterOptions.length - 1]?.semesterId;
    const semesterId =
      parsePositiveInteger(selectedScheduleSemesterId) || fallbackSemesterId || null;

    if (!semesterId) {
      return [];
    }

    return myScheduleBlocks.filter(
      (block) =>
        block.semesterId === semesterId && allowedSemesterIds.has(semesterId),
    );
  }, [myScheduleBlocks, scheduleSemesterOptions, selectedScheduleSemesterId]);

  const selectedScheduleSemesterDetail = useMemo(() => {
    const semesterId = parsePositiveInteger(selectedScheduleSemesterId);
    if (!semesterId) {
      return null;
    }

    return (
      scheduleSemesterOptions.find((item) => item.semesterId === semesterId) || null
    );
  }, [scheduleSemesterOptions, selectedScheduleSemesterId]);

  const scheduleWeekOptions = useMemo<ScheduleWeekOption[]>(() => {
    const semesterStartDate = selectedScheduleSemesterDetail?.startDate;
    const semesterEndDate = selectedScheduleSemesterDetail?.endDate;

    if (semesterStartDate && semesterEndDate) {
      const startDate = parseIsoDateLocal(semesterStartDate);
      const endDate = parseIsoDateLocal(semesterEndDate);

      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        const startMonday = getMondayOfWeek(startDate);
        const weekKeys: string[] = [];

        for (
          let cursor = startMonday;
          cursor.getTime() <= endDate.getTime();
          cursor = addDays(cursor, 7)
        ) {
          weekKeys.push(toLocalIsoDate(cursor));
        }

        if (weekKeys.length > 0) {
          return weekKeys.map((startDateKey) => buildScheduleWeekOption(startDateKey));
        }
      }
    }

    const weekStarts = new Set<string>();

    scheduleBlocksBySemester.forEach((block) => {
      if (!block.sessionDate) {
        return;
      }

      const monday = getMondayOfWeek(parseIsoDateLocal(block.sessionDate));
      weekStarts.add(toLocalIsoDate(monday));
    });

    if (weekStarts.size === 0) {
      weekStarts.add(toLocalIsoDate(getMondayOfWeek(new Date())));
    }

    return Array.from(weekStarts.values())
      .sort((a, b) => parseIsoDateLocal(a).getTime() - parseIsoDateLocal(b).getTime())
      .map((startDate) => buildScheduleWeekOption(startDate));
  }, [scheduleBlocksBySemester, selectedScheduleSemesterDetail?.endDate, selectedScheduleSemesterDetail?.startDate]);

  const selectedScheduleWeekStartKey = useMemo(() => {
    if (
      selectedScheduleWeekKey &&
      scheduleWeekOptions.some((item) => item.key === selectedScheduleWeekKey)
    ) {
      return selectedScheduleWeekKey;
    }

    if (scheduleWeekOptions.length > 0) {
      return scheduleWeekOptions[0].key;
    }

    return toLocalIsoDate(getMondayOfWeek(new Date()));
  }, [scheduleWeekOptions, selectedScheduleWeekKey]);

  const selectedScheduleWeek = useMemo(() => {
    return (
      scheduleWeekOptions.find((item) => item.key === selectedScheduleWeekStartKey) ||
      buildScheduleWeekOption(selectedScheduleWeekStartKey)
    );
  }, [scheduleWeekOptions, selectedScheduleWeekStartKey]);

  const scheduleWeekSelectOptions = useMemo(() => {
    if (
      selectedScheduleSemesterDetail?.startDate &&
      selectedScheduleSemesterDetail?.endDate &&
      scheduleWeekOptions.length > 0
    ) {
      return scheduleWeekOptions;
    }

    const optionMap = new Map<string, ScheduleWeekOption>();

    scheduleWeekOptions.forEach((item) => {
      optionMap.set(item.key, item);
    });

    const centerWeek = parseIsoDateLocal(selectedScheduleWeekStartKey);
    for (let offset = -4; offset <= 4; offset += 1) {
      const weekKey = toLocalIsoDate(addDays(centerWeek, offset * 7));
      if (!optionMap.has(weekKey)) {
        optionMap.set(weekKey, buildScheduleWeekOption(weekKey));
      }
    }

    return Array.from(optionMap.values()).sort(
      (first, second) =>
        parseIsoDateLocal(first.startDate).getTime() -
        parseIsoDateLocal(second.startDate).getTime(),
    );
  }, [scheduleWeekOptions, selectedScheduleSemesterDetail?.endDate, selectedScheduleSemesterDetail?.startDate, selectedScheduleWeekStartKey]);

  const scheduleWeekDates = useMemo(() => {
    const startDate = parseIsoDateLocal(selectedScheduleWeek.startDate);
    return Array.from({ length: 7 }, (_, index) =>
      toLocalIsoDate(addDays(startDate, index)),
    );
  }, [selectedScheduleWeek]);

  const selectedScheduleSemesterLabel = useMemo(() => {
    const selectedSemester = scheduleSemesterOptions.find(
      (item) => String(item.semesterId) === selectedScheduleSemesterId,
    );

    return selectedSemester?.label || "Chưa có học kỳ mở";
  }, [scheduleSemesterOptions, selectedScheduleSemesterId]);

  const scheduleVisibleBlocks = useMemo(() => {
    const weekStart = parseIsoDateLocal(selectedScheduleWeek.startDate).getTime();
    const weekEnd = parseIsoDateLocal(selectedScheduleWeek.endDate).getTime();
    const currentWeekStart = parseIsoDateLocal(selectedScheduleWeek.startDate);

    return scheduleBlocksBySemester
      .map((block) => {
        const safeStart = Math.max(1, Math.min(14, block.startPeriod));
        const safeEnd = Math.max(safeStart, Math.min(14, block.endPeriod));
        return {
          ...block,
          startPeriod: safeStart,
          endPeriod: safeEnd,
        };
      })
      .flatMap((block) => {
        if (block.sessionDate) {
          const sessionTime = parseIsoDateLocal(block.sessionDate).getTime();
          if (sessionTime < weekStart || sessionTime > weekEnd) {
            return [];
          }

          const sessionDayIndex = getDayIndexFromSessionDate(block.sessionDate);
          if (sessionDayIndex === null) {
            return [];
          }

          return [{ ...block, dayIndex: sessionDayIndex }];
        }

        if (block.dayIndex < 0 || block.dayIndex > 6) {
          return [];
        }

        return [
          {
            ...block,
            sessionDate: toLocalIsoDate(addDays(currentWeekStart, block.dayIndex)),
          },
        ];
      });
  }, [scheduleBlocksBySemester, selectedScheduleWeek]);

  const scheduleBlocksByDay = useMemo(() => {
    const buckets: WeeklyScheduleBlock[][] = Array.from({ length: 7 }, () => []);

    scheduleVisibleBlocks.forEach((block) => {
      if (block.dayIndex < 0 || block.dayIndex > 6) {
        return;
      }
      buckets[block.dayIndex].push(block);
    });

    buckets.forEach((dayBlocks) => {
      dayBlocks.sort((first, second) => {
        if (first.startPeriod === second.startPeriod) {
          return first.endPeriod - second.endPeriod;
        }
        return first.startPeriod - second.startPeriod;
      });
    });

    return buckets;
  }, [scheduleVisibleBlocks]);

  const selectedScheduleBlock = useMemo(() => {
    if (!selectedScheduleBlockKey) {
      return null;
    }

    return (
      scheduleVisibleBlocks.find((block) => block.key === selectedScheduleBlockKey) ||
      null
    );
  }, [scheduleVisibleBlocks, selectedScheduleBlockKey]);

  const selectedRecurringScheduleDetail = useMemo(() => {
    const recurringScheduleId = selectedScheduleBlock?.recurringScheduleId;
    if (!recurringScheduleId) {
      return null;
    }

    return recurringScheduleDetailsById[recurringScheduleId] || null;
  }, [recurringScheduleDetailsById, selectedScheduleBlock]);

  const classroomCatalogById = useMemo(() => {
    const byId = new Map<number, ClassroomResponse>();

    classroomCatalog.forEach((classroom) => {
      if (typeof classroom.id !== "number" || !Number.isInteger(classroom.id)) {
        return;
      }
      byId.set(classroom.id, classroom);
    });

    return byId;
  }, [classroomCatalog]);

  const selectedScheduleClassroomId = useMemo(() => {
    if (
      typeof selectedRecurringScheduleDetail?.classroomId === "number" &&
      Number.isInteger(selectedRecurringScheduleDetail.classroomId) &&
      selectedRecurringScheduleDetail.classroomId > 0
    ) {
      return selectedRecurringScheduleDetail.classroomId;
    }

    if (
      typeof selectedScheduleBlock?.classroomId === "number" &&
      Number.isInteger(selectedScheduleBlock.classroomId) &&
      selectedScheduleBlock.classroomId > 0
    ) {
      return selectedScheduleBlock.classroomId;
    }

    return null;
  }, [selectedRecurringScheduleDetail, selectedScheduleBlock]);

  const selectedScheduleClassroomDetail = useMemo(() => {
    if (!selectedScheduleClassroomId) {
      return null;
    }

    return (
      classroomDetailsById[selectedScheduleClassroomId] ||
      classroomCatalogById.get(selectedScheduleClassroomId) ||
      null
    );
  }, [classroomCatalogById, classroomDetailsById, selectedScheduleClassroomId]);

  const selectedScheduleLecturerId = useMemo(() => {
    if (
      typeof selectedScheduleBlock?.lecturerId === "number" &&
      Number.isInteger(selectedScheduleBlock.lecturerId) &&
      selectedScheduleBlock.lecturerId > 0
    ) {
      return selectedScheduleBlock.lecturerId;
    }

    return null;
  }, [selectedScheduleBlock]);

  const selectedScheduleLecturerDetail = useMemo(() => {
    if (!selectedScheduleLecturerId) {
      return null;
    }

    return lecturerDetailsById[selectedScheduleLecturerId] || null;
  }, [lecturerDetailsById, selectedScheduleLecturerId]);

  const isLoadingSelectedRecurringScheduleDetail =
    typeof selectedScheduleBlock?.recurringScheduleId === "number" &&
    loadingRecurringScheduleId === selectedScheduleBlock.recurringScheduleId;

  const isLoadingSelectedClassroomDetail =
    selectedScheduleClassroomId !== null &&
    loadingClassroomDetailId === selectedScheduleClassroomId;

  const isLoadingSelectedLecturerDetail =
    selectedScheduleLecturerId !== null &&
    loadingLecturerDetailId === selectedScheduleLecturerId;

  const gradeSemesterOptions = useMemo(() => {
    const optionsMap = new Map<string, { value: string; label: string }>();

    gradeReports.forEach((report) => {
      if (!report.sectionId) {
        return;
      }

      const section = gradeSectionsById[report.sectionId];
      if (!section) {
        return;
      }

      const value = getGradeSemesterFilterValue(section);
      if (!value || optionsMap.has(value)) {
        return;
      }

      optionsMap.set(value, {
        value,
        label: getSemesterDisplayLabel(section.semesterNumber, section.academicYear),
      });
    });

    return Array.from(optionsMap.values()).sort((first, second) =>
      first.label.localeCompare(second.label, "vi"),
    );
  }, [gradeReports, gradeSectionsById]);

  const gradeCourseOptions = useMemo(() => {
    const optionsMap = new Map<string, { value: string; label: string }>();

    gradeReports.forEach((report) => {
      const section = report.sectionId ? gradeSectionsById[report.sectionId] : undefined;
      const value = getGradeCourseFilterValue(report, section);

      if (!value || optionsMap.has(value)) {
        return;
      }

      const sectionCourseName = section ? getCourseDisplayName(section) : "";
      const label = section
        ? [section.courseCode, sectionCourseName].filter(Boolean).join(" - ")
        : report.courseName || value;

      optionsMap.set(value, {
        value,
        label,
      });
    });

    return Array.from(optionsMap.values()).sort((first, second) =>
      first.label.localeCompare(second.label, "vi"),
    );
  }, [gradeReports, gradeSectionsById]);

  const filteredGradeReports = useMemo(() => {
    const normalizedKeyword = gradeKeyword.trim().toLowerCase();

    return gradeReports.filter((item) => {
      const statusMatched = !gradeStatusFilter || item.status === gradeStatusFilter;

      const sectionInfo = item.sectionId
        ? gradeSectionsById[item.sectionId]
        : undefined;
      const semesterMatched =
        !gradeSemesterFilter ||
        getGradeSemesterFilterValue(sectionInfo) === gradeSemesterFilter;
      const courseMatched =
        !gradeCourseFilter ||
        getGradeCourseFilterValue(item, sectionInfo) === gradeCourseFilter;
      const semesterLabel = getSemesterDisplayLabel(
        sectionInfo?.semesterNumber,
        sectionInfo?.academicYear,
      );
      const keywordMatched =
        !normalizedKeyword ||
        [
          item.courseName,
          item.letterGrade,
          item.status,
          typeof item.finalScore === "number"
            ? String(item.finalScore)
            : undefined,
          sectionInfo?.sectionCode,
          sectionInfo?.courseCode,
          semesterLabel,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedKeyword),
          );

      return statusMatched && semesterMatched && courseMatched && keywordMatched;
    });
  }, [
    gradeCourseFilter,
    gradeKeyword,
    gradeReports,
    gradeSectionsById,
    gradeSemesterFilter,
    gradeStatusFilter,
  ]);

  const gradeGroupedRows = useMemo(() => {
    const rows = filteredGradeReports
      .map((report) => {
        const section = report.sectionId ? gradeSectionsById[report.sectionId] : undefined;
        const sectionCredits = (section as { credits?: unknown } | undefined)?.credits;
        const courseCredits =
          typeof sectionCredits === "number" && Number.isFinite(sectionCredits)
            ? sectionCredits
            : typeof section?.courseId === "number" &&
                typeof courseCatalogById.get(section.courseId)?.credits === "number"
              ? courseCatalogById.get(section.courseId)?.credits || null
              : null;
        const score10 = getGradeScore10FromReport(report);
        const score4 = getGradeScore4FromReport(report);
        const letterGrade = getGradeLetterFromReport(report);
        const resultMeta = getGradeResultMetaFromReport(report);

        return {
          report,
          section: section || null,
          semesterNumber: section?.semesterNumber,
          academicYear: section?.academicYear || "",
          semesterLabel: getSemesterDisplayLabel(
            section?.semesterNumber,
            section?.academicYear,
          ),
          courseCode: section?.courseCode || "-",
          sectionCode: section?.sectionCode || "-",
          courseName: report.courseName || section?.courseName || "-",
          credits: courseCredits,
          score10,
          score4,
          letterGrade,
          resultLabel: resultMeta.label,
          passed: resultMeta.passed,
        };
      })
      .sort((first, second) => {
        const firstYear = getAcademicYearStart(first.academicYear);
        const secondYear = getAcademicYearStart(second.academicYear);

        if (firstYear !== secondYear) {
          return secondYear - firstYear;
        }

        const firstSemester = first.semesterNumber || 0;
        const secondSemester = second.semesterNumber || 0;

        if (firstSemester !== secondSemester) {
          return secondSemester - firstSemester;
        }

        if (first.courseCode !== second.courseCode) {
          return first.courseCode.localeCompare(second.courseCode, "vi");
        }

        return first.sectionCode.localeCompare(second.sectionCode, "vi");
      });

    const allScoreRows = rows.filter((item) => item.score10 !== null);
    const allScore4Rows = rows.filter((item) => item.score4 !== null);
    const cumulativeAverage10 =
      allScoreRows.length > 0
        ? allScoreRows.reduce((sum, item) => sum + (item.score10 || 0), 0) /
          allScoreRows.length
        : null;
    const cumulativeAverage4 =
      allScore4Rows.length > 0
        ? allScore4Rows.reduce((sum, item) => sum + (item.score4 || 0), 0) /
          allScore4Rows.length
        : null;
    const hasCumulativePassFlag = rows.some((item) => item.passed !== null);
    const cumulativeEarnedCredits = hasCumulativePassFlag
      ? rows.reduce((sum, item) => {
          if (item.passed !== true || typeof item.credits !== "number") {
            return sum;
          }

          return sum + item.credits;
        }, 0)
      : null;

    const buckets = new Map<string, typeof rows>();

    rows.forEach((item) => {
      const semesterLabel = item.semesterLabel || "Học kỳ chưa xác định";
      if (!buckets.has(semesterLabel)) {
        buckets.set(semesterLabel, []);
      }

      buckets.get(semesterLabel)?.push(item);
    });

    return Array.from(buckets.entries()).map(([semesterLabel, items]) => {
      const semesterScoreRows = items.filter((item) => item.score10 !== null);
      const semesterScore4Rows = items.filter((item) => item.score4 !== null);
      const semesterAverage10 =
        semesterScoreRows.length > 0
          ? semesterScoreRows.reduce((sum, item) => sum + (item.score10 || 0), 0) /
            semesterScoreRows.length
          : null;
      const semesterAverage4 =
        semesterScore4Rows.length > 0
          ? semesterScore4Rows.reduce((sum, item) => sum + (item.score4 || 0), 0) /
            semesterScore4Rows.length
          : null;
      const hasSemesterPassFlag = items.some((item) => item.passed !== null);
      const semesterEarnedCredits = hasSemesterPassFlag
        ? items.reduce((sum, item) => {
            if (item.passed !== true || typeof item.credits !== "number") {
              return sum;
            }

            return sum + item.credits;
          }, 0)
        : null;

      const first = items[0];

      return {
        key: `${first.semesterNumber || 0}-${first.academicYear || "na"}`,
        semesterLabel,
        semesterNumber: first.semesterNumber,
        academicYear: first.academicYear,
        items,
        semesterAverage10,
        semesterAverage4,
        semesterEarnedCredits,
        cumulativeAverage10,
        cumulativeAverage4,
        cumulativeEarnedCredits,
      };
    });
  }, [courseCatalogById, filteredGradeReports, gradeSectionsById]);

  const gradeSummary = useMemo(() => {
    const validScores = gradeReports
      .map((item) => item.finalScore)
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      );

    const publishedCount = gradeReports.filter(
      (item) => item.status === "PUBLISHED",
    ).length;
    const lockedCount = gradeReports.filter((item) => item.status === "LOCKED").length;

    const averageScore =
      validScores.length > 0
        ? validScores.reduce((sum, value) => sum + value, 0) / validScores.length
        : null;

    return {
      total: gradeReports.length,
      publishedCount,
      lockedCount,
      averageScore,
    };
  }, [gradeReports]);

  const attendanceStatusOptions = useMemo(() => {
    const statusPriority: Record<string, number> = {
      PRESENT: 1,
      LATE: 2,
      EXCUSED: 3,
      ABSENT: 4,
    };

    return Array.from(
      new Set(attendanceItems.map((item) => item.status).filter(Boolean)),
    )
      .map((status) => String(status))
      .sort((first, second) => {
        const firstPriority = statusPriority[first] ?? Number.MAX_SAFE_INTEGER;
        const secondPriority = statusPriority[second] ?? Number.MAX_SAFE_INTEGER;

        if (firstPriority === secondPriority) {
          return first.localeCompare(second, "vi");
        }

        return firstPriority - secondPriority;
      });
  }, [attendanceItems]);

  const filteredAttendanceItems = useMemo(() => {
    const normalizedKeyword = attendanceKeyword.trim().toLowerCase();
    const normalizedDateFrom = attendanceDateFrom.trim();
    const normalizedDateTo = attendanceDateTo.trim();
    if (
      normalizedDateFrom !== "" &&
      normalizedDateTo !== "" &&
      normalizedDateFrom > normalizedDateTo
    ) {
      return [] as AttendanceResponse[];
    }

    return attendanceItems
      .filter((item) => {
        const statusMatched =
          !attendanceStatusFilter || item.status === attendanceStatusFilter;
        const sessionDateIso = item.sessionDate
          ? toLocalIsoDate(parseIsoDateLocal(item.sessionDate))
          : "";
        const dateFromMatched =
          !normalizedDateFrom ||
          (sessionDateIso !== "" && sessionDateIso >= normalizedDateFrom);
        const dateToMatched =
          !normalizedDateTo ||
          (sessionDateIso !== "" && sessionDateIso <= normalizedDateTo);
        const keywordMatched =
          !normalizedKeyword ||
          [
            item.status ? getAttendanceStatusLabel(item.status) : undefined,
            item.note,
            item.sessionDate ? formatDate(item.sessionDate) : undefined,
            item.sessionId ? String(item.sessionId) : undefined,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(normalizedKeyword),
            );

        return statusMatched && dateFromMatched && dateToMatched && keywordMatched;
      })
      .sort((first, second) => {
        const firstTime = first.sessionDate
          ? parseIsoDateLocal(first.sessionDate).getTime()
          : 0;
        const secondTime = second.sessionDate
          ? parseIsoDateLocal(second.sessionDate).getTime()
          : 0;

        if (firstTime === secondTime) {
          return (second.id ?? 0) - (first.id ?? 0);
        }

        return secondTime - firstTime;
      });
  }, [
    attendanceDateFrom,
    attendanceDateTo,
    attendanceItems,
    attendanceKeyword,
    attendanceStatusFilter,
  ]);

  const attendanceSummary = useMemo(() => {
    const total = filteredAttendanceItems.length;
    const presentCount = filteredAttendanceItems.filter(
      (item) => item.status === "PRESENT",
    ).length;
    const lateCount = filteredAttendanceItems.filter(
      (item) => item.status === "LATE",
    ).length;
    const excusedCount = filteredAttendanceItems.filter(
      (item) => item.status === "EXCUSED",
    ).length;
    const absentCount = filteredAttendanceItems.filter(
      (item) => item.status === "ABSENT",
    ).length;
    const participatedCount = presentCount + lateCount + excusedCount;

    return {
      total,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      participationRate:
        total > 0 ? (participatedCount / total) * 100 : null,
    };
  }, [filteredAttendanceItems]);

  const isAttendanceDateRangeInvalid =
    attendanceDateFrom !== "" &&
    attendanceDateTo !== "" &&
    attendanceDateFrom > attendanceDateTo;

  const selectedGradeReport = useMemo(() => {
    if (selectedGradeReportId === null) {
      return filteredGradeReports[0] || gradeReports[0] || null;
    }

    return (
      filteredGradeReports.find((item) => item.id === selectedGradeReportId) ||
      gradeReports.find((item) => item.id === selectedGradeReportId) ||
      null
    );
  }, [filteredGradeReports, gradeReports, selectedGradeReportId]);

  const selectedGradeReportResolved = useMemo(() => {
    if (!selectedGradeReport) {
      return null;
    }

    const detail = gradeReportDetailsById[selectedGradeReport.id];
    return detail || selectedGradeReport;
  }, [gradeReportDetailsById, selectedGradeReport]);

  const isLoadingSelectedGradeReportDetail =
    selectedGradeReport !== null &&
    loadingGradeReportId === selectedGradeReport.id;

  const selectedGradeSection = useMemo(() => {
    if (!selectedGradeReportResolved?.sectionId) {
      return null;
    }

    return gradeSectionsById[selectedGradeReportResolved.sectionId] || null;
  }, [gradeSectionsById, selectedGradeReportResolved]);

  const selectedGradeDetails = useMemo<GradeDetailItem[]>(() => {
    if (!selectedGradeReportResolved) {
      return [];
    }

    const details = selectedGradeReportResolved.gradeDetails;
    if (!Array.isArray(details)) {
      return [];
    }

    return details;
  }, [selectedGradeReportResolved]);

  const selectedGradeCourseId = selectedGradeSection?.courseId || null;

  const selectedGradeComponents = useMemo(() => {
    if (!selectedGradeCourseId) {
      return [] as GradeComponentResponse[];
    }

    return gradeComponentsByCourseId[selectedGradeCourseId] || [];
  }, [gradeComponentsByCourseId, selectedGradeCourseId]);

  const selectedGradeComponentRows = useMemo(() => {
    if (selectedGradeComponents.length === 0) {
      return selectedGradeDetails;
    }

    const detailByComponentId = new Map<number, GradeDetailItem>();
    selectedGradeDetails.forEach((detail) => {
      if (typeof detail.componentId !== "number") {
        return;
      }
      detailByComponentId.set(detail.componentId, detail);
    });

    const mergedRows = selectedGradeComponents.map((component) => {
      const matchedDetail =
        typeof component.id === "number"
          ? detailByComponentId.get(component.id)
          : undefined;

      return {
        id: matchedDetail?.id,
        componentId: component.id,
        componentName: component.componentName || matchedDetail?.componentName,
        weightPercentage:
          typeof component.weightPercentage === "number"
            ? component.weightPercentage
            : matchedDetail?.weightPercentage,
        score: matchedDetail?.score,
      } satisfies GradeDetailItem;
    });

    const extraDetails = selectedGradeDetails.filter((detail) => {
      if (typeof detail.componentId !== "number") {
        return true;
      }

      return !selectedGradeComponents.some(
        (component) => component.id === detail.componentId,
      );
    });

    return [...mergedRows, ...extraDetails];
  }, [selectedGradeComponents, selectedGradeDetails]);

  const selectedGradeComponentStats = useMemo(() => {
    const totalWeight = selectedGradeComponentRows.reduce((sum, item) => {
      if (typeof item.weightPercentage !== "number") {
        return sum;
      }
      return sum + item.weightPercentage;
    }, 0);

    const gradedWeight = selectedGradeComponentRows.reduce((sum, item) => {
      if (
        typeof item.weightPercentage !== "number" ||
        typeof item.score !== "number"
      ) {
        return sum;
      }
      return sum + item.weightPercentage;
    }, 0);

    const weightedScore = selectedGradeComponentRows.reduce((sum, item) => {
      if (
        typeof item.weightPercentage !== "number" ||
        typeof item.score !== "number"
      ) {
        return sum;
      }
      return sum + (item.score * item.weightPercentage) / 100;
    }, 0);

    return {
      totalWeight,
      gradedWeight,
      weightedScore,
    };
  }, [selectedGradeComponentRows]);

  const isLoadingSelectedGradeComponents =
    selectedGradeCourseId !== null &&
    loadingGradeComponentCourseId === selectedGradeCourseId;

  const hasSelectedGradeWeight = selectedGradeComponentRows.some(
    (item) => typeof item.weightPercentage === "number",
  );
  const isSelectedGradeWeightBalanced =
    hasSelectedGradeWeight &&
    Math.abs(selectedGradeComponentStats.totalWeight - 100) <= 0.01;

  useEffect(() => {
    if (scheduleSemesterOptions.length === 0) {
      if (selectedScheduleSemesterId) {
        setSelectedScheduleSemesterId("");
      }
      return;
    }

    const stillValid = scheduleSemesterOptions.some(
      (item) => String(item.semesterId) === selectedScheduleSemesterId,
    );

    if (!stillValid) {
      const defaultOption = scheduleSemesterOptions[scheduleSemesterOptions.length - 1];
      setSelectedScheduleSemesterId(String(defaultOption.semesterId));
    }
  }, [scheduleSemesterOptions, selectedScheduleSemesterId]);

  useEffect(() => {
    if (selectedScheduleWeekKey) {
      return;
    }

    const currentWeekKey = toLocalIsoDate(getMondayOfWeek(new Date()));
    const defaultOption =
      scheduleWeekOptions.find((item) => item.key === currentWeekKey) ||
      scheduleWeekOptions[0] ||
      buildScheduleWeekOption(currentWeekKey);

    setSelectedScheduleWeekKey(defaultOption.key);
  }, [scheduleWeekOptions, selectedScheduleWeekKey]);

  useEffect(() => {
    if (!selectedScheduleBlockKey) {
      return;
    }

    const stillVisible = scheduleVisibleBlocks.some(
      (block) => block.key === selectedScheduleBlockKey,
    );

    if (!stillVisible) {
      setSelectedScheduleBlockKey("");
    }
  }, [scheduleVisibleBlocks, selectedScheduleBlockKey]);

  useEffect(() => {
    if (activeTabKey !== "schedule") {
      return;
    }

    const authorization = session?.authorization;
    const recurringScheduleId = selectedScheduleBlock?.recurringScheduleId;

    if (!authorization || !recurringScheduleId) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        recurringScheduleDetailsById,
        recurringScheduleId,
      )
    ) {
      return;
    }

    let cancelled = false;
    setLoadingRecurringScheduleId(recurringScheduleId);

    const loadRecurringScheduleDetail = async () => {
      try {
        const detail = await getRecurringScheduleById(
          recurringScheduleId,
          authorization,
        );

        if (cancelled) {
          return;
        }

        setRecurringScheduleDetailsById((current) => ({
          ...current,
          [recurringScheduleId]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setRecurringScheduleDetailsById((current) => ({
          ...current,
          [recurringScheduleId]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingRecurringScheduleId((current) =>
            current === recurringScheduleId ? null : current,
          );
        }
      }
    };

    void loadRecurringScheduleDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    recurringScheduleDetailsById,
    selectedScheduleBlock,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "schedule") {
      return;
    }

    const authorization = session?.authorization;
    if (!authorization || !selectedScheduleClassroomId) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        classroomDetailsById,
        selectedScheduleClassroomId,
      )
    ) {
      return;
    }

    let cancelled = false;
    setLoadingClassroomDetailId(selectedScheduleClassroomId);

    const loadClassroomDetail = async () => {
      try {
        const detail = await getClassroomById(selectedScheduleClassroomId, authorization);

        if (cancelled) {
          return;
        }

        setClassroomDetailsById((current) => ({
          ...current,
          [selectedScheduleClassroomId]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setClassroomDetailsById((current) => ({
          ...current,
          [selectedScheduleClassroomId]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingClassroomDetailId((current) =>
            current === selectedScheduleClassroomId ? null : current,
          );
        }
      }
    };

    void loadClassroomDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    classroomDetailsById,
    selectedScheduleClassroomId,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "schedule") {
      return;
    }

    const authorization = session?.authorization;
    if (!authorization || !selectedScheduleLecturerId) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        lecturerDetailsById,
        selectedScheduleLecturerId,
      )
    ) {
      return;
    }

    let cancelled = false;
    setLoadingLecturerDetailId(selectedScheduleLecturerId);

    const loadLecturerDetail = async () => {
      try {
        const detail = await getLecturerById(selectedScheduleLecturerId, authorization);

        if (cancelled) {
          return;
        }

        setLecturerDetailsById((current) => ({
          ...current,
          [selectedScheduleLecturerId]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setLecturerDetailsById((current) => ({
          ...current,
          [selectedScheduleLecturerId]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingLecturerDetailId((current) =>
            current === selectedScheduleLecturerId ? null : current,
          );
        }
      }
    };

    void loadLecturerDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    lecturerDetailsById,
    selectedScheduleLecturerId,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "grades") {
      return;
    }

    const authorization = session?.authorization;
    const reportId = selectedGradeReport?.id;

    if (!authorization || !reportId) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        gradeReportDetailsById,
        reportId,
      )
    ) {
      return;
    }

    let cancelled = false;
    setLoadingGradeReportId(reportId);

    const loadSelectedGradeReportDetail = async () => {
      try {
        const detail = await getGradeReportById(reportId, authorization);

        if (cancelled) {
          return;
        }

        setGradeReportDetailsById((current) => ({
          ...current,
          [reportId]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setGradeReportDetailsById((current) => ({
          ...current,
          [reportId]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingGradeReportId((current) =>
            current === reportId ? null : current,
          );
        }
      }
    };

    void loadSelectedGradeReportDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    gradeReportDetailsById,
    selectedGradeReport,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "grades") {
      return;
    }

    const authorization = session?.authorization;
    if (!authorization || !selectedGradeCourseId) {
      return;
    }

    if (gradeComponentsByCourseId[selectedGradeCourseId]) {
      return;
    }

    let cancelled = false;
    setLoadingGradeComponentCourseId(selectedGradeCourseId);

    const loadGradeComponents = async () => {
      try {
        const components = await getGradeComponentsByCourse(
          selectedGradeCourseId,
          authorization,
        );

        if (cancelled) {
          return;
        }

        setGradeComponentsByCourseId((current) => ({
          ...current,
          [selectedGradeCourseId]: components,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setGradeComponentsByCourseId((current) => ({
          ...current,
          [selectedGradeCourseId]: [],
        }));
      } finally {
        if (!cancelled) {
          setLoadingGradeComponentCourseId(null);
        }
      }
    };

    void loadGradeComponents();

    return () => {
      cancelled = true;
    };
  }, [activeTabKey, gradeComponentsByCourseId, selectedGradeCourseId, session?.authorization]);

  useEffect(() => {
    if (!attendanceStatusFilter) {
      return;
    }

    if (!attendanceStatusOptions.includes(attendanceStatusFilter)) {
      setAttendanceStatusFilter("");
    }
  }, [attendanceStatusFilter, attendanceStatusOptions]);

  useEffect(() => {
    if (activeTabKey !== "profile") {
      return;
    }

    const authorization = session?.authorization;
    if (!authorization || !selectedProfileClassIdValue) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        administrativeClassDetailsById,
        selectedProfileClassIdValue,
      )
    ) {
      return;
    }

    let cancelled = false;
    setLoadingProfileClassDetailId(selectedProfileClassIdValue);

    const loadAdministrativeClassDetail = async () => {
      try {
        const detail = await getAdministrativeClassById(
          selectedProfileClassIdValue,
          authorization,
        );

        if (cancelled) {
          return;
        }

        setAdministrativeClassDetailsById((current) => ({
          ...current,
          [selectedProfileClassIdValue]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setAdministrativeClassDetailsById((current) => ({
          ...current,
          [selectedProfileClassIdValue]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingProfileClassDetailId((current) =>
            current === selectedProfileClassIdValue ? null : current,
          );
        }
      }
    };

    void loadAdministrativeClassDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    administrativeClassDetailsById,
    selectedProfileClassIdValue,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "profile") {
      return;
    }

    const authorization = session?.authorization;
    if (!authorization || !selectedProfileCohortIdValue) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(cohortDetailsById, selectedProfileCohortIdValue)) {
      return;
    }

    let cancelled = false;
    setLoadingProfileCohortDetailId(selectedProfileCohortIdValue);

    const loadSelectedCohortDetail = async () => {
      try {
        const detail = await getCohortById(selectedProfileCohortIdValue, authorization);

        if (cancelled) {
          return;
        }

        setCohortDetailsById((current) => ({
          ...current,
          [selectedProfileCohortIdValue]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setCohortDetailsById((current) => ({
          ...current,
          [selectedProfileCohortIdValue]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingProfileCohortDetailId((current) =>
            current === selectedProfileCohortIdValue ? null : current,
          );
        }
      }
    };

    void loadSelectedCohortDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    cohortDetailsById,
    selectedProfileCohortIdValue,
    session?.authorization,
  ]);

  const requireSession = (): string | null => {
    if (!session?.authorization) {
      setTabError("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return null;
    }

    return session.authorization;
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      setIsWorking(true);
      setTabError("");
      setTabMessage("");
      await action();
    } catch (error) {
      setTabError(toErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const resolveRegisteredSectionItems = async (
    registrations: CourseRegistrationResponse[],
    authorization: string,
  ): Promise<ScheduleRegisteredSectionItem[]> => {
    const sortedRegistrations = registrations
      .filter(isActiveCourseRegistration)
      .sort((first, second) => {
        const firstTime = first.registrationTime
          ? new Date(first.registrationTime).getTime()
          : 0;
        const secondTime = second.registrationTime
          ? new Date(second.registrationTime).getTime()
          : 0;

        if (firstTime === secondTime) {
          return second.id - first.id;
        }

        return secondTime - firstTime;
      });

    const registrationsBySectionId = new Map<number, CourseRegistrationResponse>();
    sortedRegistrations.forEach((registration) => {
      const sectionId = registration.courseSectionId;
      if (!sectionId || registrationsBySectionId.has(sectionId)) {
        return;
      }

      registrationsBySectionId.set(sectionId, registration);
    });

    const sectionIds = Array.from(registrationsBySectionId.keys());
    if (sectionIds.length === 0) {
      return [];
    }

    const sectionResponses = await Promise.all(
      sectionIds.map((sectionId) =>
        getCourseSectionById(sectionId, authorization).catch(() => null),
      ),
    );

    const sectionById = new Map<number, CourseSectionResponse>();
    sectionResponses.forEach((section) => {
      if (!section || !Number.isInteger(section.id) || section.id <= 0) {
        return;
      }

      sectionById.set(section.id, section);
    });

    return Array.from(registrationsBySectionId.values()).flatMap((registration) => {
      const sectionId = registration.courseSectionId;
      if (!sectionId) {
        return [];
      }

      const section = sectionById.get(sectionId);
      if (!section) {
        return [];
      }

      return [
        {
          registrationId: registration.id,
          registrationTime: registration.registrationTime,
          status: registration.status,
          section: {
            ...section,
            sectionCode: registration.sectionCode || section.sectionCode,
            courseId: registration.courseId || section.courseId,
            courseCode: registration.courseCode || section.courseCode,
            courseName: registration.courseName || section.courseName,
            semesterId: registration.semesterId || section.semesterId,
          },
        },
      ];
    });
  };

  const resolveRegistrationTabItems = (
    registrations: CourseRegistrationResponse[],
    availableSectionMap: Map<number, AvailableCourseSectionResponse>,
  ): RegisteredCourseItem[] => {
    return registrations
      .filter(isActiveCourseRegistration)
      .sort((first, second) => {
        const firstTime = first.registrationTime
          ? new Date(first.registrationTime).getTime()
          : 0;
        const secondTime = second.registrationTime
          ? new Date(second.registrationTime).getTime()
          : 0;

        if (firstTime === secondTime) {
          return second.id - first.id;
        }

        return secondTime - firstTime;
      })
      .map((registration) => ({
        registrationId: registration.id,
        courseSectionId: registration.courseSectionId,
        courseId: registration.courseId,
        courseCode: registration.courseCode,
        courseName: registration.courseName,
        sectionCode: registration.sectionCode,
        semesterId: registration.semesterId,
        registrationTime: registration.registrationTime,
        status: registration.status,
        availableSection:
          (registration.courseSectionId
            ? availableSectionMap.get(registration.courseSectionId)
            : null) || null,
      }));
  };

  const loadMyRegisteredSections = async (
    authorization: string,
    availableSectionMap: Map<number, AvailableCourseSectionResponse>,
    semesterId?: number,
  ): Promise<RegisteredCourseItem[]> => {
    const registrations = await getMyCourseRegistrations(authorization, semesterId);
    const items = resolveRegistrationTabItems(registrations, availableSectionMap);
    setRegisteredSections(items);
    return items;
  };

  const buildFallbackProfile = (): ProfileResponse => {
    const parsedStudentId = parsePositiveInteger(studentIdInput);

    return {
      id: parsedStudentId || undefined,
      username: session?.username,
      role: session?.role,
      studentCode: studentIdInput || undefined,
    };
  };

  const syncProfileMajorReferenceContext = async (
    profileData: ProfileResponse,
    authorization: string,
  ) => {
    setIsProfileMajorContextLoading(true);
    setIsProfileSpecializationContextLoading(true);
    setIsProfileClassContextLoading(true);

    try {
      const [faculties, majors, specializations, administrativeClasses, cohorts] =
        await Promise.all([
          getFaculties(authorization).catch(() => []),
          getMajors(authorization).catch(() => []),
          getSpecializations(authorization).catch(() => []),
          getAdministrativeClasses(authorization).catch(() => []),
          getCohorts(authorization).catch(() => []),
        ]);

      let resolvedFacultyCatalog = faculties;
      let resolvedMajorCatalog = majors;

      setSpecializationCatalog(specializations);
      setAdministrativeClassCatalog(administrativeClasses);
      setCohortCatalog(cohorts);

      const preferredMajorId =
        typeof profileData.majorId === "number" &&
        Number.isInteger(profileData.majorId) &&
        profileData.majorId > 0
          ? profileData.majorId
          : null;
      const preferredSpecializationId =
        typeof profileData.specializationId === "number" &&
        Number.isInteger(profileData.specializationId) &&
        profileData.specializationId > 0
          ? profileData.specializationId
          : null;
      const preferredClassId =
        typeof profileData.classId === "number" &&
        Number.isInteger(profileData.classId) &&
        profileData.classId > 0
          ? profileData.classId
          : null;

      const normalizedMajorName = normalizeTextValue(profileData.majorName).toLowerCase();
      const normalizedSpecializationName = normalizeTextValue(
        profileData.specializationName,
      ).toLowerCase();
      const normalizedClassName = normalizeTextValue(profileData.className).toLowerCase();

      const matchedSpecializationById =
        preferredSpecializationId !== null
          ? specializations.find((item) => item.id === preferredSpecializationId) || null
          : null;
      const matchedSpecializationByNameAll =
        normalizedSpecializationName !== ""
          ? specializations.find(
              (item) =>
                normalizeTextValue(item.specializationName).toLowerCase() ===
                normalizedSpecializationName,
            ) ||
            specializations.find((item) => {
              const specializationName = normalizeTextValue(
                item.specializationName,
              ).toLowerCase();
              return (
                specializationName !== "" &&
                (specializationName.includes(normalizedSpecializationName) ||
                  normalizedSpecializationName.includes(specializationName))
              );
            }) ||
            null
          : null;
      const matchedClassById =
        preferredClassId !== null
          ? administrativeClasses.find((item) => item.id === preferredClassId) || null
          : null;
      const matchedClassByNameAll =
        normalizedClassName !== ""
          ? administrativeClasses.find(
              (item) =>
                normalizeTextValue(item.className).toLowerCase() === normalizedClassName,
            ) ||
            administrativeClasses.find((item) => {
              const className = normalizeTextValue(item.className).toLowerCase();
              return (
                className !== "" &&
                (className.includes(normalizedClassName) ||
                  normalizedClassName.includes(className))
              );
            }) ||
            null
          : null;

      let matchedMajor =
        (preferredMajorId !== null
          ? resolvedMajorCatalog.find((major) => major.id === preferredMajorId) || null
          : null) ||
        (matchedSpecializationById?.majorId
          ? resolvedMajorCatalog.find(
              (major) => major.id === matchedSpecializationById.majorId,
            ) || null
          : null);

      if (!matchedMajor && normalizedMajorName) {
        matchedMajor =
          resolvedMajorCatalog.find(
            (major) =>
              normalizeTextValue(major.majorName).toLowerCase() === normalizedMajorName,
          ) ||
          resolvedMajorCatalog.find((major) => {
            const majorName = normalizeTextValue(major.majorName).toLowerCase();
            return (
              majorName !== "" &&
              (majorName.includes(normalizedMajorName) ||
                normalizedMajorName.includes(majorName))
            );
          }) ||
          null;
      }

      if (!matchedMajor && normalizedSpecializationName) {
        if (matchedSpecializationByNameAll?.majorId) {
          matchedMajor =
            resolvedMajorCatalog.find(
              (major) => major.id === matchedSpecializationByNameAll.majorId,
            ) || null;
        }
      }

      if (!matchedMajor && preferredMajorId !== null) {
        const majorFromDetail = await getMajorById(
          preferredMajorId,
          authorization,
        ).catch(() => null);

        if (majorFromDetail?.id && Number.isInteger(majorFromDetail.id) && majorFromDetail.id > 0) {
          matchedMajor = majorFromDetail;

          if (!resolvedMajorCatalog.some((item) => item.id === majorFromDetail.id)) {
            resolvedMajorCatalog = [...resolvedMajorCatalog, majorFromDetail];
          }
        }
      }

      if (
        matchedMajor?.facultyId &&
        Number.isInteger(matchedMajor.facultyId) &&
        matchedMajor.facultyId > 0 &&
        !resolvedFacultyCatalog.some((item) => item.id === matchedMajor?.facultyId)
      ) {
        const facultyFromDetail = await getFacultyById(
          matchedMajor.facultyId,
          authorization,
        ).catch(() => null);

        if (
          facultyFromDetail?.id &&
          Number.isInteger(facultyFromDetail.id) &&
          facultyFromDetail.id > 0
        ) {
          resolvedFacultyCatalog = [...resolvedFacultyCatalog, facultyFromDetail];
        }
      }

      setFacultyCatalog(resolvedFacultyCatalog);
      setMajorCatalog(resolvedMajorCatalog);

      if (
        matchedMajor &&
        typeof matchedMajor.facultyId === "number" &&
        Number.isInteger(matchedMajor.facultyId) &&
        matchedMajor.facultyId > 0
      ) {
        const majorsInFaculty = await getMajorsByFaculty(
          matchedMajor.facultyId,
          authorization,
        ).catch(() =>
          resolvedMajorCatalog.filter(
            (item) => item.facultyId === matchedMajor.facultyId,
          ),
        );

        const normalizedMajorsInFaculty = majorsInFaculty.some(
          (item) => item.id === matchedMajor.id,
        )
          ? majorsInFaculty
          : [...majorsInFaculty, matchedMajor];

        setMajorsBySelectedProfileFaculty(normalizedMajorsInFaculty);
        setSelectedProfileFacultyId(String(matchedMajor.facultyId));

        const matchedMajorByName = normalizedMajorsInFaculty.find(
          (item) =>
            normalizeTextValue(item.majorName).toLowerCase() === normalizedMajorName,
        );
        const resolvedMajorId = normalizedMajorsInFaculty.some(
          (item) => item.id === matchedMajor.id,
        )
          ? matchedMajor.id
          : matchedMajorByName?.id;

        setSelectedProfileMajorId(
          resolvedMajorId && Number.isInteger(resolvedMajorId) && resolvedMajorId > 0
            ? String(resolvedMajorId)
            : "",
        );

        if (resolvedMajorId && Number.isInteger(resolvedMajorId) && resolvedMajorId > 0) {
          const specializationsInMajor = await getSpecializationsByMajor(
            resolvedMajorId,
            authorization,
          ).catch(() =>
            specializations.filter((item) => item.majorId === resolvedMajorId),
          );
          const classesInMajor = administrativeClasses.filter(
            (item) => item.majorId === resolvedMajorId,
          );

          setSpecializationsBySelectedProfileMajor(specializationsInMajor);

          const matchedSpecialization =
            (preferredSpecializationId !== null
              ? specializationsInMajor.find(
                  (item) => item.id === preferredSpecializationId,
                ) || null
              : null) ||
            specializationsInMajor.find(
              (item) =>
                normalizeTextValue(item.specializationName).toLowerCase() ===
                normalizedSpecializationName,
            ) ||
            specializationsInMajor.find((item) => {
              const specializationName = normalizeTextValue(
                item.specializationName,
              ).toLowerCase();
              return (
                normalizedSpecializationName !== "" &&
                specializationName !== "" &&
                (specializationName.includes(normalizedSpecializationName) ||
                  normalizedSpecializationName.includes(specializationName))
              );
            }) ||
            null;

          setSelectedProfileSpecializationId(
            matchedSpecialization?.id &&
              Number.isInteger(matchedSpecialization.id) &&
              matchedSpecialization.id > 0
              ? String(matchedSpecialization.id)
              : "",
          );

          const matchedClass =
            (preferredClassId !== null
              ? classesInMajor.find((item) => item.id === preferredClassId) || null
              : null) ||
            classesInMajor.find(
              (item) =>
                normalizeTextValue(item.className).toLowerCase() === normalizedClassName,
            ) ||
            classesInMajor.find((item) => {
              const className = normalizeTextValue(item.className).toLowerCase();
              return (
                normalizedClassName !== "" &&
                className !== "" &&
                (className.includes(normalizedClassName) ||
                  normalizedClassName.includes(className))
              );
            }) ||
            null;

          setSelectedProfileClassId(
            matchedClass?.id && Number.isInteger(matchedClass.id) && matchedClass.id > 0
              ? String(matchedClass.id)
              : "",
          );
          return;
        }
      }

      setMajorsBySelectedProfileFaculty([]);
      setSelectedProfileFacultyId("");
      setSelectedProfileMajorId(
        matchedMajor?.id &&
          Number.isInteger(matchedMajor.id) &&
          matchedMajor.id > 0
          ? String(matchedMajor.id)
          : "",
      );
      setSpecializationsBySelectedProfileMajor([]);
      const resolvedFallbackSpecializationId =
        matchedSpecializationById?.id || matchedSpecializationByNameAll?.id;
      setSelectedProfileSpecializationId(
        resolvedFallbackSpecializationId &&
          Number.isInteger(resolvedFallbackSpecializationId) &&
          resolvedFallbackSpecializationId > 0
          ? String(resolvedFallbackSpecializationId)
          : "",
      );
      const resolvedFallbackClassId = matchedClassById?.id || matchedClassByNameAll?.id;
      setSelectedProfileClassId(
        resolvedFallbackClassId &&
          Number.isInteger(resolvedFallbackClassId) &&
          resolvedFallbackClassId > 0
          ? String(resolvedFallbackClassId)
          : "",
      );
    } finally {
      setIsProfileMajorContextLoading(false);
      setIsProfileSpecializationContextLoading(false);
      setIsProfileClassContextLoading(false);
    }
  };

  const hydrateProfileForm = (data: ProfileResponse) => {
    setProfileForm({
      fullName: data.fullName || "",
      phone: data.phone || "",
      address: data.address || "",
      dateOfBirth: toDateOnlyValue(data.dateOfBirth),
    });
  };

  const handleLoadProfile = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    setIsWorking(true);
    setTabError("");
    setTabMessage("");
    setProfileFormError("");

    try {
      const profileData = await getMyStudentProfile(authorization);

      setProfile(profileData);
      if (
        typeof profileData.id === "number" &&
        Number.isInteger(profileData.id) &&
        profileData.id > 0
      ) {
        setStudentIdInput(String(profileData.id));
      }
      hydrateProfileForm(profileData);
      await syncProfileMajorReferenceContext(profileData, authorization);
      setProfileLastLoadedAt(new Date().toISOString());
      setTabMessage("Đã tải thông tin hồ sơ.");
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      if (isForbiddenOrNotFoundError(errorMessage)) {
        const fallbackProfile = buildFallbackProfile();
        setProfile(fallbackProfile);
        hydrateProfileForm(fallbackProfile);
        await syncProfileMajorReferenceContext(fallbackProfile, authorization);
        setProfileLastLoadedAt(new Date().toISOString());
        setTabMessage(
          "Tài khoản hiện tại chưa có dữ liệu hồ sơ đầy đủ. Đang hiển thị thông tin cơ bản.",
        );
        return;
      }

      setTabError(errorMessage);
    } finally {
      setIsWorking(false);
    }
  };

  const handleRefreshSelectedProfileClassDetail = async () => {
    const authorization = requireSession();
    if (!authorization || !selectedProfileClassIdValue) {
      return;
    }

    setLoadingProfileClassDetailId(selectedProfileClassIdValue);
    setTabError("");

    try {
      const detail = await getAdministrativeClassById(
        selectedProfileClassIdValue,
        authorization,
      );
      setAdministrativeClassDetailsById((current) => ({
        ...current,
        [selectedProfileClassIdValue]: detail,
      }));
      setTabMessage("Đã làm mới chi tiết lớp hành chính.");
    } catch (error) {
      setAdministrativeClassDetailsById((current) => ({
        ...current,
        [selectedProfileClassIdValue]: null,
      }));
      setTabError(toErrorMessage(error));
    } finally {
      setLoadingProfileClassDetailId((current) =>
        current === selectedProfileClassIdValue ? null : current,
      );
    }
  };

  const handleRefreshSelectedProfileCohortDetail = async () => {
    const authorization = requireSession();
    if (!authorization || !selectedProfileCohortIdValue) {
      return;
    }

    setLoadingProfileCohortDetailId(selectedProfileCohortIdValue);
    setTabError("");

    try {
      const detail = await getCohortById(selectedProfileCohortIdValue, authorization);
      setCohortDetailsById((current) => ({
        ...current,
        [selectedProfileCohortIdValue]: detail,
      }));
      setTabMessage("Đã làm mới thông tin niên khóa.");
    } catch (error) {
      setCohortDetailsById((current) => ({
        ...current,
        [selectedProfileCohortIdValue]: null,
      }));
      setTabError(toErrorMessage(error));
    } finally {
      setLoadingProfileCohortDetailId((current) =>
        current === selectedProfileCohortIdValue ? null : current,
      );
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    setProfileFormError("");

    const normalizedFullName = normalizeTextValue(profileForm.fullName);
    const normalizedPhone = normalizePhoneValue(profileForm.phone);
    const normalizedAddress = normalizeTextValue(profileForm.address);
    const normalizedDateOfBirth = toDateOnlyValue(profileForm.dateOfBirth);

    if (!normalizedFullName) {
      setProfileFormError("Họ và tên không được để trống.");
      return;
    }

    if (normalizedFullName.length < 2) {
      setProfileFormError("Họ và tên cần tối thiểu 2 ký tự.");
      return;
    }

    if (normalizedPhone && (normalizedPhone.length < 9 || normalizedPhone.length > 15)) {
      setProfileFormError("Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    if (normalizedDateOfBirth) {
      const birthDate = parseIsoDateLocal(normalizedDateOfBirth);
      const today = new Date();
      const todayOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      if (birthDate.getTime() > todayOnly.getTime()) {
        setProfileFormError("Ngày sinh không thể lớn hơn ngày hiện tại.");
        return;
      }

      let age = todayOnly.getFullYear() - birthDate.getFullYear();
      const monthDelta = todayOnly.getMonth() - birthDate.getMonth();
      if (
        monthDelta < 0 ||
        (monthDelta === 0 && todayOnly.getDate() < birthDate.getDate())
      ) {
        age -= 1;
      }

      if (age < 14) {
        setProfileFormError("Ngày sinh chưa hợp lệ với hồ sơ sinh viên (tối thiểu 14 tuổi).");
        return;
      }
    }

    if (!isProfileFormDirty) {
      setTabMessage("Không có thay đổi mới để cập nhật hồ sơ.");
      return;
    }

    await runAction(async () => {
      const data = await updateMyProfile(
        {
          fullName: normalizedFullName,
          phone: normalizedPhone || undefined,
          address: normalizedAddress || undefined,
          dateOfBirth: normalizedDateOfBirth || undefined,
        },
        authorization,
      );
      setProfile(data);
      hydrateProfileForm(data);
      await syncProfileMajorReferenceContext(data, authorization);
      setProfileLastLoadedAt(new Date().toISOString());
      setTabMessage("Cập nhật hồ sơ thành công.");
      toast.success("Cập nhật hồ sơ thành công.", "Thành công");
    });
  };

  const handleResetProfileForm = () => {
    hydrateProfileForm(profile || {});
    setProfileFormError("");
    setTabMessage("Đã hoàn tác các thay đổi chưa lưu.");
  };

  const handleLoadGrades = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      const data = await getMyGradeReports(authorization);
      setGradeReports(data);
      setHasLoadedGrades(true);
      setGradeLastLoadedAt(new Date().toISOString());
      setSelectedGradeReportId(data[0]?.id ?? null);
      setIsGradeDetailModalOpen(false);
      setGradeReportDetailsById({});
      setLoadingGradeReportId(null);
      setGradeComponentsByCourseId({});
      setLoadingGradeComponentCourseId(null);

      const sectionIds = Array.from(
        new Set(
          data
            .map((item) => item.sectionId)
            .filter(
              (value): value is number =>
                typeof value === "number" && Number.isInteger(value) && value > 0,
            ),
        ),
      );

      if (sectionIds.length === 0) {
        setGradeSectionsById({});
        setTabMessage(`Đã tải ${data.length} bản ghi điểm.`);
        return;
      }

      setIsGradeContextLoading(true);

      try {
        const sections = await Promise.all(
          sectionIds.map((sectionId) =>
            getCourseSectionById(sectionId, authorization).catch(() => null),
          ),
        );

        const nextSectionMap: Record<number, CourseSectionResponse> = {};
        sections.forEach((section) => {
          if (!section) {
            return;
          }
          nextSectionMap[section.id] = section;
        });

        setGradeSectionsById(nextSectionMap);
      } finally {
        setIsGradeContextLoading(false);
      }

      setTabMessage(`Đã tải ${data.length} bản ghi điểm.`);
    });
  };

  const handleRefreshSelectedGradeDetail = async () => {
    const authorization = requireSession();
    const reportId = selectedGradeReport?.id;

    if (!authorization || !reportId) {
      return;
    }

    setLoadingGradeReportId(reportId);
    setTabError("");

    try {
      const detail = await getGradeReportById(reportId, authorization);

      setGradeReportDetailsById((current) => ({
        ...current,
        [reportId]: detail,
      }));
      setTabMessage("Đã làm mới chi tiết điểm môn học.");
    } catch (error) {
      setGradeReportDetailsById((current) => ({
        ...current,
        [reportId]: null,
      }));
      setTabError(toErrorMessage(error));
    } finally {
      setLoadingGradeReportId((current) =>
        current === reportId ? null : current,
      );
    }
  };

  const handleExportGradesCsv = () => {
    const rows = gradeGroupedRows.flatMap((group) =>
      group.items.map((item, index) => ({
        semesterLabel: group.semesterLabel || "Học kỳ chưa xác định",
        stt: index + 1,
        courseCode: item.courseCode,
        sectionCode: item.sectionCode,
        courseName: item.courseName,
        credits:
          typeof item.credits === "number" ? String(item.credits) : "",
        score10: formatScore(item.score10 === null ? undefined : item.score10),
        score4: formatScore(item.score4 === null ? undefined : item.score4),
        letterGrade: item.letterGrade,
        result: item.resultLabel,
      })),
    );

    if (rows.length === 0) {
      setTabMessage("Không có dữ liệu điểm để xuất.");
      return;
    }

    const escapeCell = (value: string): string => {
      const normalized = String(value || "");
      if (
        normalized.includes(",") ||
        normalized.includes("\"") ||
        normalized.includes("\n")
      ) {
        return `"${normalized.replace(/\"/g, '""')}"`;
      }

      return normalized;
    };

    const headers = [
      "Hoc ky",
      "STT",
      "Ma MH",
      "Nhom/to mon hoc",
      "Ten mon hoc",
      "So tin chi",
      "Diem TK (10)",
      "Diem TK (4)",
      "Diem TK (C)",
      "Ket qua",
    ];

    const csvLines = [headers.join(",")].concat(
      rows.map((row) =>
        [
          row.semesterLabel,
          String(row.stt),
          row.courseCode,
          row.sectionCode,
          row.courseName,
          row.credits,
          row.score10,
          row.score4,
          row.letterGrade,
          row.result,
        ]
          .map((cell) => escapeCell(cell))
          .join(","),
      ),
    );

    const csvContent = `\uFEFF${csvLines.join("\r\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bang-diem-${toLocalIsoDate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setTabMessage("Đã xuất bảng điểm ra tệp CSV.");
  };

  const handleLoadAttendance = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      const data = await getMyAttendance(authorization);
      setAttendanceItems(data);
      setHasLoadedAttendance(true);
      setAttendanceLastLoadedAt(new Date().toISOString());
      setTabMessage(`Đã tải ${data.length} bản ghi chuyên cần.`);
    });
  };

  const handleLoadStudentWeeklySchedule = async () => {
    const authorization = requireSession();

    if (!authorization) {
      return;
    }

    setIsScheduleLoading(true);
    setTabError("");
    setTabMessage("");

    try {
      const [registrations, classrooms, scheduleSemesters] = await Promise.all([
        getMyCourseRegistrations(authorization),
        getClassrooms(authorization).catch(() => []),
        getMyScheduleSemesterOptions(authorization).catch(() => []),
      ]);
      setClassroomCatalog(classrooms);
      setScheduleSemesterCatalog(scheduleSemesters);
      const registeredItems = await resolveRegisteredSectionItems(
        registrations,
        authorization,
      );

      if (registeredItems.length === 0) {
        setMyScheduleBlocks([]);
        setTabMessage(
          "Sinh viên chưa có lớp học phần đã đăng ký để tạo thời khóa biểu.",
        );
        return;
      }

      const validSections = registeredItems.map((item) => item.section);

      const nextBlocks: WeeklyScheduleBlock[] = [];

      await Promise.all(
        validSections.map(async (section) => {
          const schedules = await getRecurringSchedulesBySection(
            section.id,
            authorization,
          ).catch(() => []);

          await Promise.all(
            schedules.map(async (schedule) => {
              const parsedStart = schedule.startPeriod || 0;
              const parsedEnd = schedule.endPeriod || 0;
              if (parsedStart <= 0 || parsedEnd <= 0) {
                return;
              }

              const sessions = schedule.id
                ? await getRecurringScheduleSessions(
                    schedule.id,
                    authorization,
                  ).catch(() => [])
                : [];

              const validSessions = sessions.filter(
                (session) => session.sessionDate && session.status !== "CANCELLED",
              );

              if (validSessions.length > 0) {
                validSessions.forEach((session) => {
                  const dayIndex =
                    getDayIndexFromSessionDate(session.sessionDate) ??
                    normalizeDayIndex(schedule.dayOfWeek, schedule.dayOfWeekName);

                  if (dayIndex === null) {
                    return;
                  }

                  nextBlocks.push({
                    key: `session-${session.id || `${section.id}-${schedule.id || "x"}-${session.sessionDate || ""}-${parsedStart}-${parsedEnd}`}`,
                    sectionId: section.id,
                    recurringScheduleId: schedule.id,
                    classroomId: session.classroomId || schedule.classroomId,
                    lecturerId: section.lecturerId,
                    courseName: getCourseDisplayName(section),
                    courseCode: section.courseCode,
                    sectionCode: section.sectionCode,
                    lecturerName: section.lecturerName,
                    classroomName: session.classroomName || schedule.classroomName,
                    startPeriod: session.startPeriod || parsedStart,
                    endPeriod: session.endPeriod || parsedEnd,
                    dayIndex,
                    sessionDate: session.sessionDate,
                    status: session.status,
                    semesterId: section.semesterId,
                    semesterNumber: section.semesterNumber,
                    academicYear: section.academicYear,
                  });
                });

                return;
              }

              const recurringDayIndex = normalizeDayIndex(
                schedule.dayOfWeek,
                schedule.dayOfWeekName,
              );
              if (recurringDayIndex === null) {
                return;
              }

              nextBlocks.push({
                key: `recurring-${schedule.id || `${section.id}-${recurringDayIndex}-${parsedStart}-${parsedEnd}`}`,
                sectionId: section.id,
                recurringScheduleId: schedule.id,
                classroomId: schedule.classroomId,
                lecturerId: section.lecturerId,
                courseName: getCourseDisplayName(section),
                courseCode: section.courseCode,
                sectionCode: section.sectionCode,
                lecturerName: section.lecturerName,
                classroomName: schedule.classroomName,
                startPeriod: parsedStart,
                endPeriod: parsedEnd,
                dayIndex: recurringDayIndex,
                semesterId: section.semesterId,
                semesterNumber: section.semesterNumber,
                academicYear: section.academicYear,
              });
            }),
          );
        }),
      );

      const dedupedBlocks = Array.from(
        new Map(nextBlocks.map((block) => [block.key, block])).values(),
      );

      dedupedBlocks.sort((first, second) => {
        if ((first.sessionDate || "") === (second.sessionDate || "")) {
          if (first.dayIndex === second.dayIndex) {
            return first.startPeriod - second.startPeriod;
          }
          return first.dayIndex - second.dayIndex;
        }

        return (first.sessionDate || "").localeCompare(second.sessionDate || "");
      });

      setMyScheduleBlocks(dedupedBlocks);
      if (dedupedBlocks.length === 0) {
        setTabMessage(
          "Chưa có buổi học cụ thể trong thời khóa biểu của các học phần đã đăng ký.",
        );
      } else {
        setTabMessage(`Đã tải thời khóa biểu cá nhân với ${dedupedBlocks.length} ca học.`);
      }
    } catch (error) {
      setTabError(toErrorMessage(error));
      setMyScheduleBlocks([]);
    } finally {
      setIsScheduleLoading(false);
    }
  };

  const handleShiftScheduleWeek = (direction: -1 | 1) => {
    const currentIndex = scheduleWeekSelectOptions.findIndex(
      (item) => item.key === selectedScheduleWeek.startDate,
    );

    if (currentIndex >= 0) {
      const nextIndex = Math.min(
        Math.max(currentIndex + direction, 0),
        scheduleWeekSelectOptions.length - 1,
      );
      setSelectedScheduleWeekKey(scheduleWeekSelectOptions[nextIndex].key);
      return;
    }

    const baseWeekStart = selectedScheduleWeek.startDate;
    const nextWeekStart = addDays(
      parseIsoDateLocal(baseWeekStart),
      direction * 7,
    );
    setSelectedScheduleWeekKey(toLocalIsoDate(nextWeekStart));
  };

  const handleRefreshSelectedRecurringScheduleDetail = async () => {
    const authorization = requireSession();
    const recurringScheduleId = selectedScheduleBlock?.recurringScheduleId;

    if (!authorization || !recurringScheduleId) {
      return;
    }

    setLoadingRecurringScheduleId(recurringScheduleId);
    setTabError("");

    try {
      const detail = await getRecurringScheduleById(
        recurringScheduleId,
        authorization,
      );

      setRecurringScheduleDetailsById((current) => ({
        ...current,
        [recurringScheduleId]: detail,
      }));
      setTabMessage("Đã làm mới chi tiết lịch định kỳ.");
    } catch (error) {
      setRecurringScheduleDetailsById((current) => ({
        ...current,
        [recurringScheduleId]: null,
      }));
      setTabError(toErrorMessage(error));
    } finally {
      setLoadingRecurringScheduleId((current) =>
        current === recurringScheduleId ? null : current,
      );
    }
  };

  const handleRefreshSelectedClassroomDetail = async () => {
    const authorization = requireSession();
    if (!authorization || !selectedScheduleClassroomId) {
      return;
    }

    setLoadingClassroomDetailId(selectedScheduleClassroomId);
    setTabError("");

    try {
      const detail = await getClassroomById(selectedScheduleClassroomId, authorization);

      setClassroomDetailsById((current) => ({
        ...current,
        [selectedScheduleClassroomId]: detail,
      }));
      setTabMessage("Đã làm mới chi tiết phòng học.");
    } catch (error) {
      setClassroomDetailsById((current) => ({
        ...current,
        [selectedScheduleClassroomId]: null,
      }));
      setTabError(toErrorMessage(error));
    } finally {
      setLoadingClassroomDetailId((current) =>
        current === selectedScheduleClassroomId ? null : current,
      );
    }
  };

  const handleRefreshSelectedLecturerDetail = async () => {
    const authorization = requireSession();
    if (!authorization || !selectedScheduleLecturerId) {
      return;
    }

    setLoadingLecturerDetailId(selectedScheduleLecturerId);
    setTabError("");

    try {
      const detail = await getLecturerById(selectedScheduleLecturerId, authorization);

      setLecturerDetailsById((current) => ({
        ...current,
        [selectedScheduleLecturerId]: detail,
      }));
      setTabMessage("Đã làm mới chi tiết giảng viên.");
    } catch (error) {
      setLecturerDetailsById((current) => ({
        ...current,
        [selectedScheduleLecturerId]: null,
      }));
      setTabError(toErrorMessage(error));
    } finally {
      setLoadingLecturerDetailId((current) =>
        current === selectedScheduleLecturerId ? null : current,
      );
    }
  };

  const syncSelectedSection = (nextSections: AvailableCourseSectionResponse[]) => {
    setSelectedSectionId((currentSectionId) => {
      if (
        currentSectionId &&
        nextSections.some(
          (section) => String(section.courseSectionId) === currentSectionId,
        )
      ) {
        return currentSectionId;
      }

      return nextSections.length > 0 ? String(nextSections[0].courseSectionId) : "";
    });
  };

  const handleLoadRegistrationSections = async (
    courseIdValue = selectedCourseId,
    facultyIdValue = selectedFacultyId,
  ) => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      setRegistrationNotice(null);
      setIsRegistrationAccessChecked(false);

      const [faculties, allCourses, scheduleSemesters] = await Promise.all([
        getFaculties(authorization).catch(() => []),
        getCourses(authorization).catch(() => []),
        getMyScheduleSemesterOptions(authorization).catch(() => []),
      ]);

      setFacultyCatalog(faculties);
      setAllCoursesCatalog(allCourses);

      setScheduleSemesterCatalog(scheduleSemesters);
      const hasOpenRegistrationWindow = scheduleSemesters.some(
        isRegistrationWindowOpen,
      );

      setIsRegistrationPeriodOpen(hasOpenRegistrationWindow);
      setIsRegistrationAccessChecked(true);

      if (!hasOpenRegistrationWindow) {
        setCourseSections([]);
        setRegistrationSectionsBySemester({});
        setRegisteredSections([]);
        setSelectedSectionId("");
        setRegistrationDeleteTarget(null);
        setRegistrationSwitchTarget(null);
        setTabMessage("Hiện chưa có đợt đăng ký học phần nào đang mở.");
        return;
      }

      const facultyId = parsePositiveInteger(facultyIdValue);
      let coursesInSelectedFaculty: CourseResponse[] = [];

      if (facultyId) {
        coursesInSelectedFaculty = await getCoursesByFaculty(
          facultyId,
          authorization,
        ).catch(() =>
          allCourses.filter((course) => course.facultyId === facultyId),
        );
      }

      setCoursesBySelectedFaculty(coursesInSelectedFaculty);

      let resolvedCourseIdValue = courseIdValue;
      if (resolvedCourseIdValue) {
        const candidateCourses = facultyId
          ? coursesInSelectedFaculty
          : allCourses;

        const matched = candidateCourses.some(
          (course) => String(course.id) === resolvedCourseIdValue,
        );

        if (!matched) {
          resolvedCourseIdValue = "";
          setSelectedCourseId("");
        }
      }

      const parsedCourseId = parsePositiveInteger(resolvedCourseIdValue);
      const [availableSections, sectionsForRegisteredList] = await Promise.all([
        getAvailableCourseSections(authorization, {
          facultyId: facultyId || undefined,
          courseId: parsedCourseId || undefined,
          keyword: courseKeyword,
        }),
        getAvailableCourseSections(authorization),
      ]);

      setCourseSections(availableSections);
      setRegistrationSectionsBySemester(
        Object.fromEntries(
          sectionsForRegisteredList.map((section) => [
            section.courseSectionId,
            section,
          ]),
        ),
      );
      syncSelectedSection(availableSections);
      await loadMyRegisteredSections(
        authorization,
        new Map(
          sectionsForRegisteredList.map((section) => [section.courseSectionId, section]),
        ),
      );
      setTabMessage(
        `Đã tải ${availableSections.length} lớp học phần đủ điều kiện đăng ký.`,
      );
    });
  };

  const handleFacultyFilterChange = (nextFacultyId: string) => {
    setSelectedFacultyId(nextFacultyId);
    setSelectedCourseId("");
    void handleLoadRegistrationSections("", nextFacultyId);
  };

  const handleCourseFilterChange = (nextCourseId: string) => {
    setSelectedCourseId(nextCourseId);
    void handleLoadRegistrationSections(nextCourseId, selectedFacultyId);
  };

  const handleRegisterSection = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    if (isCourseRegistrationBlocked) {
      setRegistrationNotice({
        title: "Chưa mở đợt đăng ký",
        message:
          "Hiện chưa có đợt đăng ký học phần đang mở. Bạn chưa thể thực hiện thao tác đăng ký.",
      });
      return;
    }

    const parsedSectionId = Number(selectedSectionId);
    if (!Number.isInteger(parsedSectionId) || parsedSectionId <= 0) {
      const notice = {
        title: "Chưa chọn lớp học phần",
        message: "Vui lòng chọn một lớp học phần trước khi đăng ký.",
      };
      setRegistrationNotice(notice);
      return;
    }

    const parsedStudentId = Number(studentIdInput);

    try {
      setIsWorking(true);
      setTabError("");
      setTabMessage("");
      setRegistrationNotice(null);

      await registerCourseSection(
        {
          courseSectionId: parsedSectionId,
          studentId:
            Number.isInteger(parsedStudentId) && parsedStudentId > 0
              ? parsedStudentId
              : undefined,
        },
        authorization,
      );

      await handleLoadRegistrationSections();

      setTabMessage("Đăng ký học phần thành công.");
      toast.success("Đăng ký học phần thành công.", "Thành công");
    } catch (error) {
      const notice = parseRegistrationError(error);
      setRegistrationNotice(notice);
    } finally {
      setIsWorking(false);
    }
  };

  const handleRequestDeleteRegistration = (item: RegisteredCourseItem) => {
    setRegistrationNotice(null);
    setRegistrationDeleteTarget(item);
  };

  const handleConfirmDeleteRegistration = async () => {
    const authorization = requireSession();
    if (!authorization || !registrationDeleteTarget) {
      return;
    }

    try {
      setIsWorking(true);
      setTabError("");
      setTabMessage("");
      await cancelCourseRegistration(
        registrationDeleteTarget.registrationId,
        authorization,
      );

      setRegistrationDeleteTarget(null);
      await handleLoadRegistrationSections();
      setTabMessage("Hủy đăng ký học phần thành công.");
      toast.success("Hủy đăng ký học phần thành công.", "Thành công");
    } catch (error) {
      setRegistrationDeleteTarget(null);
      setRegistrationNotice({
        title: "Không thể hủy đăng ký học phần",
        message: toErrorMessage(error),
      });
    } finally {
      setIsWorking(false);
    }
  };

  const handleRequestSwitchRegistration = (item: RegisteredCourseItem) => {
    setRegistrationNotice(null);
    setRegistrationSwitchTarget({
      item,
      nextSectionId: "",
    });
  };

  const handleConfirmSwitchRegistration = async () => {
    const authorization = requireSession();
    if (!authorization || !registrationSwitchTarget) {
      return;
    }

    const nextSectionId = parsePositiveInteger(registrationSwitchTarget.nextSectionId);
    if (!nextSectionId) {
      setRegistrationNotice({
        title: "Chưa chọn nhóm mới",
        message: "Vui lòng chọn nhóm học phần muốn chuyển sang.",
      });
      return;
    }

    try {
      setIsWorking(true);
      setTabError("");
      setTabMessage("");
      setRegistrationNotice(null);
      await switchCourseRegistration(
        registrationSwitchTarget.item.registrationId,
        { newCourseSectionId: nextSectionId },
        authorization,
      );

      setRegistrationSwitchTarget(null);
      await handleLoadRegistrationSections();
      setTabMessage("Đổi nhóm học phần thành công.");
      toast.success("Đổi nhóm học phần thành công.", "Thành công");
    } catch (error) {
      const notice = parseRegistrationError(error);
      setRegistrationNotice({
        title: "Không thể đổi nhóm học phần",
        message: notice.message,
      });
    } finally {
      setIsWorking(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    if (
      !passwordForm.oldPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setTabError("Vui lòng nhập đầy đủ thông tin đổi mật khẩu.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setTabError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }

    await runAction(async () => {
      await changeMyPassword(passwordForm, authorization);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTabMessage("Đổi mật khẩu thành công.");
      toast.success("Đổi mật khẩu thành công.", "Thành công");
    });
  };

  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <div className="min-h-screen bg-[#e9edf2]">
        <header className="flex h-[52px] items-center justify-between bg-[#0a6ca0] px-3 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/45 text-sm font-semibold">
              SG
            </div>
            <nav className="flex items-center gap-6 text-lg font-semibold">
              {studentTopHeaderTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="text-base transition hover:text-[#d7f0ff]"
                >
                  {getTopHeaderDisplayLabel(item)}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold">
              {(session?.username || "S").slice(0, 1).toUpperCase()}
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{session?.username || "-"}</p>
              <p className="text-xs opacity-90">
                Mã sinh viên: {profile?.studentCode || studentIdInput || "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-[4px] border border-white/40 px-2 py-1 text-sm font-semibold transition hover:bg-white/15"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 lg:grid-cols-[255px_minmax(0,1fr)]">
          <aside className="border-r border-[#b9cfe0] bg-[#f2f5f8]">
            <div className="border-b border-[#c7d8e5] px-4 py-3 text-[17px] font-semibold text-[#1c587f]">
              Menu sinh viên
            </div>
            <nav className="px-2 py-2">
              {studentFeatureTabs.map((item) => {
                const active = item.key === activeTabKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTabKey(item.key);
                      setTabError("");
                      setTabMessage("");
                      if (item.key !== "course-registration") {
                        setRegistrationNotice(null);
                      }
                      if (item.key === "profile") {
                        void handleLoadProfile();
                      }
                      if (item.key === "course-registration") {
                        void handleLoadRegistrationSections();
                      }
                      if (item.key === "schedule") {
                        void handleLoadStudentWeeklySchedule();
                      }
                      if (item.key === "grades" && !hasLoadedGrades) {
                        void handleLoadGrades();
                      }
                      if (item.key === "attendance" && !hasLoadedAttendance) {
                        void handleLoadAttendance();
                      }
                    }}
                    className={`mb-1 flex w-full items-center justify-between rounded-[4px] px-3 py-2 text-left text-[17px] transition ${
                      active
                        ? "bg-[#d6e9f7] font-semibold text-[#0d517a]"
                        : "text-[#234d69] hover:bg-[#e5eef6]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{getStudentTabDisplayLabel(item)}</span>
                      {item.key === "course-registration" &&
                      isCourseRegistrationBlocked ? (
                        <span className="rounded-full border border-[#efc9a8] bg-[#fff5e9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8a5a00]">
                          Tạm đóng
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-5 border-t border-[#d0dce6] px-3 py-3 text-sm text-[#516b7f]">
              <p className="font-semibold text-[#2d5672]">Điều hướng nhanh</p>
              <p className="mt-2">
                <Link className="font-semibold text-[#0a5f92] hover:underline" href="/login">
                  Về trang đăng nhập
                </Link>
              </p>
            </div>
          </aside>

          <main className="space-y-4 p-3 sm:p-4">
            <section className={contentCardClass}>
              <div className={sectionTitleClass}>
                <h1>{getStudentTabDisplayLabel(activeTab)}</h1>
              </div>
              <div className="space-y-2 px-4 py-3 text-sm text-[#355970]">
                <p>{getStudentTabDescription(activeTab)}</p>
                {tabError ? (
                  <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                    {tabError}
                  </p>
                ) : null}
                {tabMessage && !shouldHideFeedbackMessage(tabMessage) ? (
                  <p className="rounded-[4px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                    {tabMessage}
                  </p>
                ) : null}
              </div>
            </section>

            {activeTab.key === "home" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Thông báo</h2>
                  </div>
                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                    {[
                      "Đăng ký môn học học kỳ mới",
                      "Lịch công bố kết quả học tập",
                      "Hướng dẫn cập nhật hồ sơ",
                    ].map((item) => (
                      <article
                        key={item}
                        className="rounded-[8px] border border-[#c0d8ea] bg-[#f4fbff] p-3"
                      >
                        <p className="text-base font-semibold text-[#1d5b82]">{item}</p>
                        <p className="mt-2 text-sm text-[#4b6a7f]">
                          Cập nhật {formatDateTime(new Date().toISOString())}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Chức năng sinh viên</h2>
                  </div>
                  <div className="overflow-x-auto px-4 py-3">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">Tab</th>
                          <th className="px-2 py-2">Mô tả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentFeatureTabs
                          .filter((item) => item.key !== "home")
                          .map((item) => (
                            <tr
                              key={item.key}
                              className="border-b border-[#e0ebf4] text-[#3f6178]"
                            >
                              <td className="px-2 py-2 font-semibold text-[#1f567b]">
                                {item.label}
                              </td>
                              <td className="px-2 py-2">{item.description}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab.key === "profile" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Hồ sơ cá nhân sinh viên</h2>
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-medium text-[#6a8599]">
                      Đồng bộ:{" "}
                      <span className="font-semibold text-[#2a5877]">
                        {profileLastLoadedAt ? formatDateTime(profileLastLoadedAt) : "Chưa tải"}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadProfile();
                      }}
                      disabled={isWorking}
                      className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Làm mới
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-3">
                    <div className="rounded-[6px] border border-[#c8dceb] bg-[#f5fbff] p-3 text-sm text-[#335a72]">
                      {isWorking && !profile ? (
                        <p className="text-[#4c6e86]">Đang tải thông tin hồ sơ...</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Họ và tên</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.fullName || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Mã sinh viên</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.studentCode || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Lớp hành chính</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.className ||
                                selectedProfileClassResolved?.className ||
                                "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Ngành học</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.majorName || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Chuyên ngành</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.specializationName ||
                                selectedProfileSpecializationResolved?.specializationName ||
                                "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Email</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.email || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Điện thoại</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.phone || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Ngày sinh</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.dateOfBirth
                                ? formatDate(toDateOnlyValue(profile.dateOfBirth))
                                : "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2 sm:col-span-2">
                            <p className="text-xs text-[#6f8798]">Địa chỉ</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.address || "-"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-[6px] border border-[#c8dceb] bg-[#f5fbff] p-3 text-sm text-[#335a72]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-[#1f567b]">
                          Thông tin học tập
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedProfileCohortIdValue ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleRefreshSelectedProfileCohortDetail();
                              }}
                              disabled={
                                isProfileReferenceLoading ||
                                isLoadingSelectedProfileCohortDetail
                              }
                              className="rounded-[6px] border border-[#6da8c9] bg-white px-3 py-1.5 text-xs font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff] disabled:opacity-60"
                            >
                              {isLoadingSelectedProfileCohortDetail
                                ? "Đang tải niên khóa..."
                                : "Làm mới niên khóa"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              void handleRefreshSelectedProfileClassDetail();
                            }}
                            disabled={
                              isProfileReferenceLoading ||
                              !selectedProfileClassIdValue ||
                              isLoadingSelectedProfileClassDetail
                            }
                            className="rounded-[6px] border border-[#6da8c9] bg-white px-3 py-1.5 text-xs font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff] disabled:opacity-60"
                          >
                            {isLoadingSelectedProfileClassDetail
                              ? "Đang tải lớp..."
                              : "Làm mới lớp"}
                          </button>
                        </div>
                      </div>

                      {isProfileReferenceLoading ? (
                        <p className="mt-2 text-xs text-[#5f7e93]">
                          Đang đồng bộ dữ liệu học tập từ hệ thống...
                        </p>
                      ) : null}

                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                          <p className="text-xs text-[#6f8798]">Khoa</p>
                          <p className="font-semibold text-[#1c4f72]">
                            {selectedProfileMajorResolved?.facultyName || "-"}
                          </p>
                        </div>
                        <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                          <p className="text-xs text-[#6f8798]">Ngành</p>
                          <p className="font-semibold text-[#1c4f72]">
                            {selectedProfileMajorResolved?.majorName ||
                              profile?.majorName ||
                              "-"}
                          </p>
                        </div>
                        <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                          <p className="text-xs text-[#6f8798]">Chuyên ngành</p>
                          <p className="font-semibold text-[#1c4f72]">
                            {selectedProfileSpecializationResolved?.specializationName ||
                              profile?.specializationName ||
                              "-"}
                          </p>
                        </div>
                        <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                          <p className="text-xs text-[#6f8798]">Lớp hành chính</p>
                          <p className="font-semibold text-[#1c4f72]">
                            {selectedProfileClassResolved?.className ||
                              profile?.className ||
                              "-"}
                          </p>
                        </div>
                        <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                          <p className="text-xs text-[#6f8798]">Cố vấn học tập</p>
                          <p className="font-semibold text-[#1c4f72]">
                            {selectedProfileClassResolved?.headLecturerName || "-"}
                          </p>
                        </div>
                        <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                          <p className="text-xs text-[#6f8798]">Niên khóa</p>
                          <p className="font-semibold text-[#1c4f72]">
                            {selectedProfileCohortResolved?.cohortName ||
                              selectedProfileClassResolved?.cohortName ||
                              "-"}
                          </p>
                        </div>
                      </div>

                      {!selectedProfileMajorResolved && normalizeTextValue(profile?.majorName) ? (
                        <p className="mt-2 text-xs text-[#5f7e93]">
                          Dữ liệu ngành đang hiển thị theo hồ sơ hiện có.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <form className="space-y-3 rounded-[6px] border border-[#d5e4ef] bg-[#f9fcff] p-3" onSubmit={handleSaveProfile}>
                    <h3 className="text-base font-semibold text-[#1f567b]">
                      Cập nhật hồ sơ
                    </h3>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-[#335a72]">Họ và tên</label>
                      <input
                        className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                        placeholder="Nhập họ và tên"
                        value={profileForm.fullName}
                        onChange={(event) => {
                          setProfileFormError("");
                          setProfileForm((prev) => ({
                            ...prev,
                            fullName: event.target.value,
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-[#335a72]">Số điện thoại</label>
                      <input
                        className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                        placeholder="Ví dụ: 0912345678"
                        value={profileForm.phone}
                        onChange={(event) => {
                          setProfileFormError("");
                          setProfileForm((prev) => ({
                            ...prev,
                            phone: event.target.value,
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-[#335a72]">Địa chỉ</label>
                      <input
                        className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                        placeholder="Nhập địa chỉ liên hệ"
                        value={profileForm.address}
                        onChange={(event) => {
                          setProfileFormError("");
                          setProfileForm((prev) => ({
                            ...prev,
                            address: event.target.value,
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-[#335a72]">Ngày sinh</label>
                      <input
                        type="date"
                        className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                        value={profileForm.dateOfBirth}
                        onChange={(event) => {
                          setProfileFormError("");
                          setProfileForm((prev) => ({
                            ...prev,
                            dateOfBirth: event.target.value,
                          }));
                        }}
                      />
                      <p className="text-xs text-[#5f7e93]">
                        Hệ thống yêu cầu ngày sinh không vượt quá ngày hiện tại.
                      </p>
                    </div>

                    {profileFormError ? (
                      <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
                        {profileFormError}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isWorking || !isProfileFormDirty}
                        className="rounded-[6px] bg-[#0d6ea6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                      >
                        {isProfileFormDirty ? "Lưu cập nhật" : "Chưa có thay đổi"}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetProfileForm}
                        disabled={isWorking || !isProfileFormDirty}
                        className="rounded-[6px] border border-[#6da8c9] bg-white px-4 py-2 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff] disabled:opacity-60"
                      >
                        Hoàn tác
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            ) : null}

            {activeTab.key === "course-registration" ? (
              <section className="rounded-[10px] border border-[#6da8c9] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
                <div className="border-b border-[#c5dced] px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3 text-[#185678]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#8ebed9] bg-[#edf7fc] text-sm font-bold">
                        *
                      </span>
                      <div>
                        <h2 className="text-[24px] font-semibold tracking-[0.01em]">
                          Đăng ký môn học
                        </h2>
                        <p className="mt-1 text-sm text-[#5f7e93]">
                          Chọn đúng học kỳ, khoa và môn học để xem các lớp học phần
                          đủ điều kiện đăng ký theo backend.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleLoadRegistrationSections();
                        }}
                        disabled={isWorking}
                        className="h-10 rounded-[8px] border border-[#0d6ea6] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                      >
                        {isWorking
                          ? "Đang kiểm tra..."
                          : "Tải lớp được phép đăng ký"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFacultyId("");
                          setSelectedCourseId("");
                          setCourseKeyword("");
                          void handleLoadRegistrationSections("", "");
                        }}
                        disabled={isWorking || isCourseRegistrationBlocked}
                        className="h-10 rounded-[8px] border border-[#6da8c9] bg-white px-4 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff] disabled:opacity-60"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  </div>
                </div>

                {isCourseRegistrationBlocked ? (
                  <div className="px-4 py-4">
                    <div className="rounded-[10px] border border-[#efc9a8] bg-[#fff8ef] px-4 py-4 text-[#8a5a00]">
                      <p className="text-base font-semibold">
                        Hiện chưa có đợt đăng ký học phần nào đang mở.
                      </p>
                      <p className="mt-1 text-sm">
                        Bạn chưa thể truy cập chức năng đăng ký môn học ở thời điểm này. Vui lòng quay lại khi nhà trường mở đợt đăng ký.
                      </p>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadRegistrationSections();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[8px] border border-[#d7ab7f] bg-white px-4 text-sm font-semibold text-[#8a5a00] transition hover:bg-[#fff1e3] disabled:opacity-60"
                        >
                          {isWorking ? "Đang kiểm tra..." : "Kiểm tra lại"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="space-y-5 px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      placeholder="Tìm theo mã môn, tên môn, mã lớp, giảng viên..."
                      value={courseKeyword}
                      onChange={(event) => setCourseKeyword(event.target.value)}
                    />
                    <select
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      value={selectedFacultyId}
                      onChange={(event) =>
                        handleFacultyFilterChange(event.target.value)
                      }
                    >
                      <option value="">Tất cả khoa</option>
                      {facultyFilterOptions.map((option) => (
                        <option key={option.facultyId} value={option.facultyId}>
                          {option.facultyCode
                            ? `${option.facultyCode} - ${option.facultyName}`
                            : option.facultyName}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      value={selectedCourseId}
                      onChange={(event) => handleCourseFilterChange(event.target.value)}
                    >
                      <option value="">Tất cả môn học</option>
                      {courseFilterOptions.map((option) => (
                        <option key={option.courseId} value={option.courseId}>
                          {option.courseCode
                            ? `${option.courseCode} - ${option.courseName}`
                            : option.courseName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedRegistrationSection ? (
                    <div className="rounded-[10px] border border-[#d9e7f1] bg-[#f7fbff] px-4 py-3 text-sm text-[#44657d]">
                      <p className="font-semibold text-[#1a4f75]">
                        Đợt đăng ký hiện tại:{" "}
                        {selectedRegistrationSection.registrationPeriodName ||
                          "Chưa rõ tên đợt"}
                      </p>
                      <p className="mt-1">
                        Thời gian hiệu lực:{" "}
                        {formatDateTime(
                          selectedRegistrationSection.registrationStartTime,
                        )}{" "}
                        -{" "}
                        {formatDateTime(
                          selectedRegistrationSection.registrationEndTime,
                        )}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-[12px] border border-[#6da8c9]">
                    <div className="border-b border-[#c5dced] px-4 py-3">
                      <h3 className="text-[18px] font-semibold text-[#1a4f75]">
                        Danh sách môn học mở cho đăng ký
                      </h3>
                    </div>

                    <div className="max-h-[430px] overflow-auto">
                      <table className="min-w-[1080px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#2a7da9] text-[#2d5067]">
                            <th className="w-10 px-3 py-3">Chọn</th>
                            <th className="px-3 py-3">Mã MH</th>
                            <th className="px-3 py-3">Tên môn học</th>
                            <th className="px-3 py-3">Số TC</th>
                            <th className="px-3 py-3">Môn tiên quyết</th>
                            <th className="px-3 py-3">Lớp</th>
                            <th className="px-3 py-3">Giảng viên</th>
                            <th className="px-3 py-3">Học kỳ</th>
                            <th className="px-3 py-3">Sĩ số</th>
                            <th className="px-3 py-3">Đã đăng ký</th>
                            <th className="px-3 py-3">Còn lại</th>
                            <th className="px-3 py-3">Trạng thái</th>
                            <th className="px-3 py-3">Thời khóa biểu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSections.map((section) => {
                            const selected =
                              String(section.courseSectionId) === selectedSectionId;
                            const scheduleLines = getAvailableScheduleSummaryLines(
                              section.schedules,
                            );

                            return (
                              <tr
                                key={section.courseSectionId}
                                className={`border-b border-[#d7e7f1] text-[#375d75] ${
                                  selected ? "bg-[#edf7fc]" : "bg-white"
                                }`}
                              >
                                <td className="px-3 py-3 align-top">
                                  <input
                                    type="radio"
                                    name="selected-course-section"
                                    checked={selected}
                                    onChange={() =>
                                      setSelectedSectionId(
                                        String(section.courseSectionId),
                                      )
                                    }
                                    className="mt-1 h-4 w-4 rounded border-[#a9c6d8] accent-[#0d6ea6]"
                                  />
                                </td>
                                <td className="px-3 py-3 align-top font-semibold text-[#1b547a]">
                                  {section.courseCode || "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <p className="max-w-[260px] leading-5">
                                    {getAvailableSectionCourseName(section)}
                                  </p>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {typeof section.credits === "number"
                                    ? section.credits
                                    : "-"}
                                </td>
                                <td className="px-3 py-3 align-top text-[#58758a]">
                                  {section.prerequisiteCourseName || "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {section.sectionCode ||
                                    getAvailableSectionDisplayName(section)}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {section.lecturerName || "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {getSemesterDisplayLabel(
                                    section.semesterNumber,
                                    section.academicYear,
                                  )}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {section.maxCapacity ?? "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {section.registeredCount ?? "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <span
                                    className={
                                      typeof section.remainingCapacity === "number" &&
                                      section.remainingCapacity <= 5
                                        ? "font-semibold text-[#c25757]"
                                        : ""
                                    }
                                  >
                                    {section.remainingCapacity ?? "-"}
                                  </span>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRegistrationStatusClass(
                                      section.status,
                                    )}`}
                                  >
                                    {getRegistrationStatusLabel(section.status)}
                                  </span>
                                </td>
                                <td className="px-3 py-3 align-top text-[#58758a]">
                                  {scheduleLines.length > 0 ? (
                                    <div className="space-y-1">
                                      {scheduleLines.map((line, index) => (
                                        <p
                                          key={`${section.courseSectionId}-schedule-${index}`}
                                        >
                                          {line}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <span>Chưa có lịch học định kỳ</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredSections.length === 0 ? (
                            <tr>
                              <td
                                colSpan={13}
                                className="px-3 py-8 text-center text-[#5d7b91]"
                              >
                                Chưa có học phần phù hợp với bộ lọc hiện tại.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-[12px] border border-[#6da8c9]">
                    <div className="border-b border-[#c5dced] px-4 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <h3 className="text-[18px] font-semibold text-[#1a4f75]">
                          Danh sách môn học đã đăng ký: {registeredSections.length} môn,{" "}
                          {registeredCredits} tín chỉ
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleRegisterSection();
                            }}
                            disabled={isWorking || !selectedSectionId}
                            className="h-10 rounded-[8px] border border-[#0d6ea6] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                          >
                            Đăng ký học phần đã chọn
                          </button>
                          <button
                            type="button"
                            className="h-10 rounded-[8px] border border-[#6da8c9] bg-white px-4 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff]"
                          >
                            Xuất phiếu đăng ký
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[980px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#2a7da9] text-[#2d5067]">
                            <th className="px-3 py-3">Xóa</th>
                            <th className="px-3 py-3">Mã MH</th>
                            <th className="px-3 py-3">Tên môn học</th>
                            <th className="px-3 py-3">Nhóm tổ</th>
                            <th className="px-3 py-3">Số TC</th>
                            <th className="px-3 py-3">Môn tiên quyết</th>
                            <th className="px-3 py-3">Lớp</th>
                            <th className="px-3 py-3">Ngày đăng ký</th>
                            <th className="px-3 py-3">Trạng thái</th>
                            <th className="px-3 py-3">Thời khóa biểu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registeredSections.map((item) => {
                            const scheduleLines = getAvailableScheduleSummaryLines(
                              item.availableSection?.schedules,
                            );

                            return (
                              <tr
                                key={item.registrationId}
                                className="border-b border-[#d7e7f1] text-[#375d75]"
                              >
                                <td className="px-3 py-3 align-top">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleRequestDeleteRegistration(item);
                                    }}
                                    disabled={isWorking}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#efb3b3] bg-[#fff4f4] text-sm font-semibold text-[#c25757] transition hover:bg-[#ffeaea] disabled:opacity-60"
                                    aria-label={`Xóa đăng ký ${item.courseName || item.courseCode || item.registrationId}`}
                                  >
                                    x
                                  </button>
                                </td>
                                <td className="px-3 py-3 align-top font-semibold text-[#1b547a]">
                                  {item.courseCode || item.availableSection?.courseCode || "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {item.courseName ||
                                    item.availableSection?.courseName ||
                                    "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {item.availableSection
                                    ? getAvailableSectionGroupLabel(item.availableSection)
                                    : item.sectionCode || "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {typeof item.availableSection?.credits === "number"
                                    ? item.availableSection.credits
                                    : typeof item.courseId === "number" &&
                                        typeof courseCatalogById.get(item.courseId)?.credits ===
                                          "number"
                                      ? courseCatalogById.get(item.courseId)?.credits
                                    : "-"}
                                </td>
                                <td className="px-3 py-3 align-top text-[#58758a]">
                                  {item.availableSection?.prerequisiteCourseName ||
                                    (typeof item.courseId === "number"
                                      ? courseCatalogById.get(item.courseId)
                                          ?.prerequisiteCourseName
                                      : undefined) ||
                                    "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {item.sectionCode ||
                                    item.availableSection?.sectionCode ||
                                    "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {formatDateTime(item.registrationTime)}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRegistrationStatusClass(
                                      item.status,
                                    )}`}
                                  >
                                    {getRegistrationStatusLabel(item.status)}
                                  </span>
                                </td>
                                <td className="px-3 py-3 align-top text-[#58758a]">
                                  {scheduleLines.length > 0 ? (
                                    <div className="space-y-1">
                                      {scheduleLines.map((line, index) => (
                                        <p
                                          key={`${item.registrationId}-schedule-${index}`}
                                        >
                                          {line}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <span>Chưa có lịch học định kỳ</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {registeredSections.length === 0 ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="px-3 py-8 text-center text-[#5d7b91]"
                              >
                                Chưa có học phần nào được đăng ký trong phiên hiện tại.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                )}
              </section>
            ) : null}

            {activeTab.key === "schedule" ? (
              <section className="rounded-[10px] border border-[#6da8c9] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
                <div className="border-b border-[#c5dced] px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3 text-[#185678]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#8ebed9] bg-[#edf7fc] text-sm font-bold">
                        ⚙
                      </span>
                      <div>
                        <h2 className="text-[22px] font-semibold tracking-[0.01em]">
                          THỜI KHÓA BIỂU DẠNG TUẦN
                        </h2>
                        <p className="mt-1 text-sm text-[#5f7e93]">
                          Dữ liệu lấy theo học phần của chính sinh viên đang đăng nhập.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadStudentWeeklySchedule();
                      }}
                      disabled={isScheduleLoading}
                      className="h-10 rounded-[8px] border border-[#0d6ea6] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      {isScheduleLoading ? "Đang tải..." : "Làm mới thời khóa biểu"}
                    </button>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <select
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      value={selectedScheduleSemesterId}
                      onChange={(event) =>
                        setSelectedScheduleSemesterId(event.target.value)
                      }
                    >
                      {scheduleSemesterOptions.length === 0 ? (
                        <option value="">Chưa có học kỳ mở</option>
                      ) : null}
                      {scheduleSemesterOptions.map((option) => (
                        <option key={option.semesterId} value={option.semesterId}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <select
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      value={scheduleViewType}
                      onChange={(event) => setScheduleViewType(event.target.value)}
                    >
                      <option value="personal">Thời khóa biểu cá nhân</option>
                    </select>

                    <select
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      value={selectedScheduleWeek.startDate}
                      onChange={(event) => setSelectedScheduleWeekKey(event.target.value)}
                    >
                      {scheduleWeekSelectOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="h-11 rounded-[8px] border border-[#6da8c9] bg-white px-4 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff]"
                    >
                      In
                    </button>
                  </div>

                  <div className="rounded-[8px] border border-[#d4e2ec] bg-[#f6fbff] px-3 py-2 text-sm text-[#355970]">
                    <p>
                      {selectedScheduleWeek
                        ? `${selectedScheduleWeek.label} - ${selectedScheduleSemesterLabel}`
                        : `Chưa có tuần học để hiển thị - ${selectedScheduleSemesterLabel}`}
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-[8px] border border-[#88aed4]">
                    <table className="min-w-[1180px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-[#f3f7fb] text-[#2f4f67]">
                          <th className="w-[70px] border border-[#cfdbe7] px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleShiftScheduleWeek(-1)}
                              className="rounded-[4px] px-2 py-1 text-sm font-semibold text-[#1f4f72] transition hover:bg-[#e8f0f8]"
                            >
                              ←
                            </button>
                          </th>
                          {scheduleDayLabels.map((dayLabel, dayIndex) => (
                            <th
                              key={`schedule-header-${dayLabel}`}
                              className="w-[155px] border border-[#cfdbe7] px-2 py-2 text-center"
                            >
                              <p className="font-semibold text-[#1f4562]">{dayLabel}</p>
                              <p className="mt-0.5 text-[#5a768b]">
                                {scheduleWeekDates[dayIndex]
                                  ? `(${formatDateShort(scheduleWeekDates[dayIndex])})`
                                  : ""}
                              </p>
                            </th>
                          ))}
                          <th className="w-[72px] border border-[#cfdbe7] px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleShiftScheduleWeek(1)}
                              className="rounded-[4px] px-2 py-1 text-sm font-semibold text-[#1f4f72] transition hover:bg-[#e8f0f8]"
                            >
                              →
                            </button>
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {Array.from({ length: 14 }, (_, index) => index + 1).map((period) => (
                          <tr key={`period-${period}`} className="h-[58px]">
                            <th className="border border-[#d4e0ea] bg-[#2f5f92] px-2 py-2 text-left text-sm font-semibold text-white">
                              Tiết {period}
                            </th>

                            {scheduleDayLabels.map((_, dayIndex) => {
                              const dayBlocks = scheduleBlocksByDay[dayIndex] || [];
                              const startingBlocks = dayBlocks.filter(
                                (block) => block.startPeriod === period,
                              );
                              const isCoveredByPreviousBlock = dayBlocks.some(
                                (block) =>
                                  block.startPeriod < period && block.endPeriod >= period,
                              );

                              if (isCoveredByPreviousBlock) {
                                return null;
                              }

                              if (startingBlocks.length === 0) {
                                return (
                                  <td
                                    key={`empty-${period}-${dayIndex}`}
                                    className="border border-[#d4e0ea] bg-white/70"
                                  />
                                );
                              }

                              const maxEndPeriod = Math.max(
                                ...startingBlocks.map((block) => block.endPeriod),
                              );
                              const rowSpan = Math.max(1, maxEndPeriod - period + 1);

                              return (
                                <td
                                  key={`event-${period}-${dayIndex}`}
                                  rowSpan={rowSpan}
                                  className="border border-[#d4e0ea] align-top p-1"
                                >
                                  <div className="flex h-full flex-col gap-1">
                                    {startingBlocks.map((block) => (
                                      <button
                                        key={block.key}
                                        type="button"
                                        onClick={() => setSelectedScheduleBlockKey(block.key)}
                                        className={`h-full rounded-[4px] border px-2 py-1 text-left leading-4 transition ${getScheduleCardClassName(
                                          block.status,
                                          block.courseCode,
                                        )} ${
                                          selectedScheduleBlockKey === block.key
                                            ? "ring-2 ring-[#1f5f8f] ring-offset-1"
                                            : "hover:brightness-95"
                                        }`}
                                      >
                                        <p className="font-semibold">
                                          {block.courseName}
                                          {block.courseCode ? ` (${block.courseCode})` : ""}
                                        </p>
                                        <p className="mt-1">
                                          Nhóm: {getGroupLabel({ sectionCode: block.sectionCode, id: block.sectionId })}
                                        </p>
                                        <p>Phòng: {block.classroomName || "-"}</p>
                                        <p>GV: {block.lecturerName || "-"}</p>
                                        <p>{getPeriodClockRange(block.startPeriod, block.endPeriod)}</p>
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              );
                            })}

                            <td className="border border-[#d4e0ea] bg-[#2f5f92] px-2 py-2 text-center text-sm font-semibold text-white">
                              {periodStartTimeMap[period] || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr className="bg-[#f3f7fb] text-[#2f4f67]">
                          <th className="border border-[#cfdbe7] px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleShiftScheduleWeek(-1)}
                              className="rounded-[4px] px-2 py-1 text-sm font-semibold text-[#1f4f72] transition hover:bg-[#e8f0f8]"
                            >
                              ←
                            </button>
                          </th>
                          {scheduleDayLabels.map((dayLabel, dayIndex) => (
                            <th
                              key={`schedule-footer-${dayLabel}`}
                              className="border border-[#cfdbe7] px-2 py-2 text-center font-semibold text-[#1f4562]"
                            >
                              {dayLabel}
                              {scheduleWeekDates[dayIndex]
                                ? ` (${formatDateShort(scheduleWeekDates[dayIndex])})`
                                : ""}
                            </th>
                          ))}
                          <th className="border border-[#cfdbe7] px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleShiftScheduleWeek(1)}
                              className="rounded-[4px] px-2 py-1 text-sm font-semibold text-[#1f4f72] transition hover:bg-[#e8f0f8]"
                            >
                              →
                            </button>
                          </th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {isScheduleLoading ? (
                    <p className="text-sm text-[#5d7b91]">
                      Đang tổng hợp lịch học cá nhân từ học phần đã đăng ký...
                    </p>
                  ) : null}

                  {!isScheduleLoading && myScheduleBlocks.length === 0 ? (
                    <p className="rounded-[6px] border border-[#d8e4ee] bg-[#f8fbff] px-3 py-2 text-sm text-[#5d7b91]">
                      Chưa có dữ liệu lịch học cá nhân trong kỳ đã chọn.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activeTab.key === "course-registration" && registrationNotice ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2f47]/35 px-4">
                <button
                  type="button"
                  aria-label="Đóng thông báo"
                  className="absolute inset-0 cursor-default"
                  onClick={() => setRegistrationNotice(null)}
                />
                <div className="relative w-full max-w-[520px] rounded-[16px] border border-[#efbcbc] bg-white px-6 py-8 text-center shadow-[0_20px_60px_rgba(15,47,71,0.22)]">
                  <p className="text-lg font-semibold leading-8 text-[#a94242]">
                    {registrationNotice.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRegistrationNotice(null)}
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0d6ea6] px-5 text-sm font-semibold text-white transition hover:bg-[#085d90]"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab.key === "course-registration" && registrationSwitchTarget ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2f47]/35 px-4">
                <button
                  type="button"
                  aria-label="Đóng xác nhận đổi nhóm"
                  className="absolute inset-0 cursor-default"
                  onClick={() => setRegistrationSwitchTarget(null)}
                />
                <div className="relative w-full max-w-[560px] rounded-[16px] border border-[#d5e4ef] bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,47,71,0.22)]">
                  <p className="text-center text-lg font-semibold leading-8 text-[#1f567b]">
                    Đổi sang nhóm học phần khác
                  </p>
                  <p className="mt-3 text-center text-sm text-[#5d7b91]">
                    {registrationSwitchTarget.item.courseName ||
                      registrationSwitchTarget.item.availableSection?.courseName ||
                      "Môn học"}
                  </p>
                  <div className="mt-5 space-y-2">
                    <label className="text-sm font-semibold text-[#355970]">
                      Chọn nhóm mới cùng môn và cùng học kỳ
                    </label>
                    <select
                      className="h-11 w-full rounded-[10px] border border-[#c8d3dd] px-3 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      value={registrationSwitchTarget.nextSectionId}
                      onChange={(event) =>
                        setRegistrationSwitchTarget((current) =>
                          current
                            ? { ...current, nextSectionId: event.target.value }
                            : current,
                        )
                      }
                    >
                      <option value="">Chọn nhóm muốn chuyển</option>
                      {(
                        switchableSectionOptionsByRegistrationId.get(
                          registrationSwitchTarget.item.registrationId,
                        ) || []
                      ).map((section) => (
                        <option
                          key={section.courseSectionId}
                          value={section.courseSectionId}
                        >
                          {`${section.sectionCode || getAvailableSectionDisplayName(section)} - ${
                            section.lecturerName || "Chưa có giảng viên"
                          }`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRegistrationSwitchTarget(null)}
                      className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#9ec3dd] bg-white px-5 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                    >
                      Không
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleConfirmSwitchRegistration();
                      }}
                      disabled={isWorking}
                      className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0d6ea6] px-5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      {isWorking ? "Đang đổi..." : "Xác nhận đổi nhóm"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab.key === "course-registration" && registrationDeleteTarget ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2f47]/35 px-4">
                <button
                  type="button"
                  aria-label="Đóng xác nhận hủy đăng ký"
                  className="absolute inset-0 cursor-default"
                  onClick={() => setRegistrationDeleteTarget(null)}
                />
                <div className="relative w-full max-w-[520px] rounded-[16px] border border-[#d5e4ef] bg-white px-6 py-8 text-center shadow-[0_20px_60px_rgba(15,47,71,0.22)]">
                  <p className="text-lg font-semibold leading-8 text-[#1f567b]">
                    Bạn có chắc muốn hủy đăng ký học phần này không?
                  </p>
                  <p className="mt-3 text-sm text-[#5d7b91]">
                    {registrationDeleteTarget.courseName ||
                      registrationDeleteTarget.availableSection?.courseName ||
                      registrationDeleteTarget.courseCode ||
                      "Học phần"}
                    {registrationDeleteTarget.sectionCode
                      ? ` - ${registrationDeleteTarget.sectionCode}`
                      : ""}
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRegistrationDeleteTarget(null)}
                      className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#9ec3dd] bg-white px-5 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                    >
                      Không
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleConfirmDeleteRegistration();
                      }}
                      disabled={isWorking}
                      className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#c25757] px-5 text-sm font-semibold text-white transition hover:bg-[#af4747] disabled:opacity-60"
                    >
                      {isWorking ? "Đang xóa..." : "Xác nhận xóa"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab.key === "grades" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2 className="uppercase tracking-[0.02em]">Xem điểm</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadGrades();
                      }}
                      disabled={isWorking}
                      className="h-9 rounded-[6px] border border-[#0d6ea6] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      {isWorking ? "Đang tải..." : "Làm mới"}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="h-9 rounded-[6px] border border-[#8cb3ce] bg-white px-3 text-sm font-semibold text-[#235775] transition hover:bg-[#edf6fd]"
                    >
                      In
                    </button>
                    <button
                      type="button"
                      onClick={handleExportGradesCsv}
                      disabled={isWorking || gradeGroupedRows.length === 0}
                      className="h-9 rounded-[6px] border border-[#8cb3ce] bg-white px-3 text-sm font-semibold text-[#235775] transition hover:bg-[#edf6fd] disabled:opacity-60"
                    >
                      Xuất Excel
                    </button>
                  </div>
                </div>

                <div className="space-y-4 px-1 py-3 sm:px-3">
                  <div className="overflow-x-auto rounded-[8px] border border-[#b8d2e5]">
                    <table className="min-w-[1280px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#7aafd0] bg-[#f8fcff] text-[#234d69]">
                          <th className="w-[50px] px-3 py-3">STT</th>
                          <th className="w-[100px] px-3 py-3">Mã MH</th>
                          <th className="w-[140px] px-3 py-3">Nhóm/tổ môn học</th>
                          <th className="min-w-[320px] px-3 py-3">Tên môn học</th>
                          <th className="w-[90px] px-3 py-3">Số tín chỉ</th>
                          <th className="w-[110px] px-3 py-3">Điểm TK (10)</th>
                          <th className="w-[110px] px-3 py-3">Điểm TK (4)</th>
                          <th className="w-[100px] px-3 py-3">Điểm TK (C)</th>
                          <th className="w-[100px] px-3 py-3">Kết quả</th>
                          <th className="w-[90px] px-3 py-3">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeGroupedRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-3 py-8 text-center text-[#5f7e93]">
                              Chưa có dữ liệu bảng điểm.
                            </td>
                          </tr>
                        ) : null}

                        {gradeGroupedRows.map((group) => {
                          const semesterTitle =
                            typeof group.semesterNumber === "number" && group.academicYear
                              ? `Học kỳ ${group.semesterNumber} - Năm học ${group.academicYear}`
                              : group.semesterLabel;

                          return (
                            <Fragment key={group.key}>
                              <tr className="border-y border-[#7aafd0] bg-[#eef6fc] text-[#1e4f72]">
                                <td colSpan={10} className="px-3 py-2 font-semibold">
                                  {semesterTitle}
                                </td>
                              </tr>

                              {group.items.map((item, index) => (
                                <tr
                                  key={item.report.id}
                                  className="border-b border-[#c4d9e8] text-[#1f4059] hover:bg-[#f8fcff]"
                                >
                                  <td className="px-3 py-2">{index + 1}</td>
                                  <td className="px-3 py-2 font-semibold">{item.courseCode}</td>
                                  <td className="px-3 py-2">{item.sectionCode}</td>
                                  <td className="px-3 py-2">{item.courseName}</td>
                                  <td className="px-3 py-2">
                                    {typeof item.credits === "number" ? item.credits : "-"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatScore(
                                      item.score10 === null ? undefined : item.score10,
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatScore(
                                      item.score4 === null ? undefined : item.score4,
                                    )}
                                  </td>
                                  <td className="px-3 py-2">{item.letterGrade}</td>
                                  <td className="px-3 py-2">
                                    {item.passed === true ? (
                                      <span className="font-semibold text-[#1f7a47]">✓</span>
                                    ) : item.passed === false ? (
                                      <span className="font-semibold text-[#bc4a4a]">✕</span>
                                    ) : (
                                      <span className="text-[#5f7e93]">{item.resultLabel}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedGradeReportId(item.report.id);
                                        setIsGradeDetailModalOpen(true);
                                      }}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#95bdd8] text-[#1f5f8f] transition hover:bg-[#eef6fc]"
                                      aria-label={`Xem chi tiết ${item.courseName}`}
                                    >
                                      ≡
                                    </button>
                                  </td>
                                </tr>
                              ))}

                              <tr className="border-b border-[#7aafd0] bg-[#d8ebf8] text-[#1f567b]">
                                <td colSpan={5} className="px-3 py-2 text-xs leading-6">
                                  <p>
                                    - Điểm trung bình học kỳ hệ 4: {" "}
                                    {formatScore(
                                      group.semesterAverage4 === null
                                        ? undefined
                                        : group.semesterAverage4,
                                    )}
                                  </p>
                                  <p>
                                    - Điểm trung bình học kỳ hệ 10: {" "}
                                    {formatScore(
                                      group.semesterAverage10 === null
                                        ? undefined
                                        : group.semesterAverage10,
                                    )}
                                  </p>
                                  <p>
                                    - Số tín chỉ đạt học kỳ: {" "}
                                    {group.semesterEarnedCredits === null
                                      ? "-"
                                      : group.semesterEarnedCredits}
                                  </p>
                                </td>
                                <td colSpan={5} className="px-3 py-2 text-xs leading-6">
                                  <p>
                                    - Điểm trung bình tích lũy hệ 4: {" "}
                                    {formatScore(
                                      group.cumulativeAverage4 === null
                                        ? undefined
                                        : group.cumulativeAverage4,
                                    )}
                                  </p>
                                  <p>
                                    - Điểm trung bình tích lũy hệ 10: {" "}
                                    {formatScore(
                                      group.cumulativeAverage10 === null
                                        ? undefined
                                        : group.cumulativeAverage10,
                                    )}
                                  </p>
                                  <p>
                                    - Số tín chỉ tích lũy: {" "}
                                    {group.cumulativeEarnedCredits === null
                                      ? "-"
                                      : group.cumulativeEarnedCredits}
                                  </p>
                                </td>
                              </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isGradeDetailModalOpen ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2f47]/35 px-4">
                      <button
                        type="button"
                        aria-label="Đóng chi tiết điểm"
                        className="absolute inset-0 cursor-default"
                        onClick={() => setIsGradeDetailModalOpen(false)}
                      />
                      <div className="relative w-full max-w-[840px] rounded-[16px] border border-[#d5e4ef] bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,47,71,0.22)]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-base font-semibold text-[#1f567b]">
                            Chi tiết điểm thành phần
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void handleRefreshSelectedGradeDetail();
                              }}
                              disabled={!selectedGradeReport || isLoadingSelectedGradeReportDetail}
                              className="rounded-[6px] border border-[#6da8c9] bg-white px-3 py-1.5 text-xs font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff] disabled:opacity-60"
                            >
                              {isLoadingSelectedGradeReportDetail
                                ? "Đang tải..."
                                : "Làm mới chi tiết"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsGradeDetailModalOpen(false)}
                              className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                            >
                              Đóng
                            </button>
                          </div>
                        </div>

                        {selectedGradeReportResolved ? (
                          <>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                                <p className="text-xs text-[#6a8599]">Môn học</p>
                                <p className="text-sm font-semibold text-[#1f567b]">
                                  {selectedGradeReportResolved.courseName || "-"}
                                </p>
                              </div>
                              <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                                <p className="text-xs text-[#6a8599]">Lớp học phần</p>
                                <p className="text-sm font-semibold text-[#1f567b]">
                                  {selectedGradeSection?.sectionCode ||
                                    selectedGradeSection?.displayName ||
                                    "-"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 max-h-[55vh] overflow-auto rounded-[6px] border border-[#dbe7f1] bg-white">
                              <table className="min-w-full text-left text-sm">
                                <thead className="bg-[#f7fbff]">
                                  <tr className="border-b border-[#e1ecf4] text-[#44657d]">
                                    <th className="px-3 py-2">Thành phần</th>
                                    <th className="px-3 py-2">Tỷ trọng</th>
                                    <th className="px-3 py-2">Điểm</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedGradeComponentRows.map((detail, index) => (
                                    <tr
                                      key={detail.id || detail.componentId || `grade-detail-${index}`}
                                      className="border-b border-[#edf3f8] text-[#3f6178]"
                                    >
                                      <td className="px-3 py-2">{detail.componentName || "-"}</td>
                                      <td className="px-3 py-2">
                                        {typeof detail.weightPercentage === "number"
                                          ? `${detail.weightPercentage}%`
                                          : "-"}
                                      </td>
                                      <td className="px-3 py-2">
                                        {typeof detail.score === "number"
                                          ? formatScore(detail.score)
                                          : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                  {selectedGradeComponentRows.length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="px-3 py-4 text-center text-[#5f7e93]">
                                        Chưa có dữ liệu điểm thành phần.
                                      </td>
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <p className="mt-3 rounded-[6px] border border-[#dbe7f1] bg-[#f8fbff] px-3 py-4 text-sm text-[#5f7e93]">
                            Chưa có dữ liệu chi tiết để hiển thị.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activeTab.key === "attendance" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Chuyên cần của tôi</h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded-[4px] border border-[#c8d3dd] bg-[#f6fbff] px-3 py-1.5 text-xs text-[#47677e]">
                      Dữ liệu cá nhân theo tài khoản đang đăng nhập
                    </span>
                    {attendanceLastLoadedAt ? (
                      <span className="text-xs text-[#5f7e93]">
                        Cập nhật: {formatDateTime(attendanceLastLoadedAt)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadAttendance();
                      }}
                      disabled={isWorking}
                      className="h-9 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      {isWorking ? "Đang tải..." : "Làm mới chuyên cần"}
                    </button>
                  </div>
                </div>
                <div className="space-y-4 px-4 py-4">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_170px_170px_auto]">
                    <input
                      className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      placeholder="Tìm theo trạng thái, ghi chú, ngày học, session..."
                      value={attendanceKeyword}
                      onChange={(event) => setAttendanceKeyword(event.target.value)}
                    />
                    <select
                      className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      value={attendanceStatusFilter}
                      onChange={(event) =>
                        setAttendanceStatusFilter(event.target.value)
                      }
                    >
                      <option value="">Tất cả trạng thái</option>
                      {attendanceStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {getAttendanceStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      value={attendanceDateFrom}
                      onChange={(event) => setAttendanceDateFrom(event.target.value)}
                    />
                    <input
                      type="date"
                      className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      value={attendanceDateTo}
                      onChange={(event) => setAttendanceDateTo(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceKeyword("");
                        setAttendanceStatusFilter("");
                        setAttendanceDateFrom("");
                        setAttendanceDateTo("");
                      }}
                      className="h-10 rounded-[6px] border border-[#6da8c9] bg-white px-3 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff]"
                    >
                      Xóa lọc
                    </button>
                  </div>

                  {isAttendanceDateRangeInvalid ? (
                    <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
                      Khoảng ngày không hợp lệ: ngày bắt đầu đang lớn hơn ngày kết thúc.
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                      <p className="text-xs text-[#648095]">Buổi đã điểm danh</p>
                      <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                        {attendanceSummary.total}
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                      <p className="text-xs text-[#648095]">Có mặt</p>
                      <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                        {attendanceSummary.presentCount}
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                      <p className="text-xs text-[#648095]">Đi muộn</p>
                      <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                        {attendanceSummary.lateCount}
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                      <p className="text-xs text-[#648095]">Có phép</p>
                      <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                        {attendanceSummary.excusedCount}
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                      <p className="text-xs text-[#648095]">Vắng</p>
                      <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                        {attendanceSummary.absentCount}
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                      <p className="text-xs text-[#648095]">Tỷ lệ tham dự</p>
                      <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                        {attendanceSummary.participationRate !== null
                          ? `${formatScore(attendanceSummary.participationRate)}%`
                          : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#f7fbff]">
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">Ngày học</th>
                          <th className="px-2 py-2">Session ID</th>
                          <th className="px-2 py-2">Trạng thái</th>
                          <th className="px-2 py-2">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendanceItems.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[#e0ebf4] text-[#3f6178]"
                          >
                            <td className="px-2 py-2">{formatDate(item.sessionDate)}</td>
                            <td className="px-2 py-2">{item.sessionId || "-"}</td>
                            <td className="px-2 py-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAttendanceStatusClass(
                                  item.status,
                                )}`}
                              >
                                {getAttendanceStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-2 py-2">{item.note || "-"}</td>
                          </tr>
                        ))}
                        {filteredAttendanceItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-center text-[#577086]">
                              {hasLoadedAttendance
                                ? "Chưa có dữ liệu điểm danh phù hợp với bộ lọc."
                                : "Nhấn 'Làm mới chuyên cần' để tải dữ liệu mới nhất."}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab.key === "password" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Đổi mật khẩu</h2>
                </div>
                <form
                  className="grid max-w-[520px] gap-2 px-4 py-4"
                  onSubmit={handleChangePassword}
                >
                  <input
                    type="password"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Mật khẩu hiện tại"
                    value={passwordForm.oldPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        oldPassword: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="password"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Mật khẩu mới"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="password"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Xác nhận mật khẩu mới"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={isWorking}
                    className="mt-1 h-10 rounded-[4px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Lưu mật khẩu mới
                  </button>
                </form>
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
