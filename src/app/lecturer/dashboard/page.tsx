"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  createGradeReport,
  getAttendanceRosterBySession,
  getCourseSections,
  getGradeComponentsByCourse,
  getGradeEntryRosterBySection,
  getLecturerSemesterOptions,
  getSectionRoster,
  getMyLecturerSchedule,
  saveAttendancesBySession,
  updateGradeReport,
} from "@/lib/lecturer/service";
import { lecturerFeatureTabs } from "@/lib/lecturer/tabs";
import { toErrorMessage as toSharedErrorMessage } from "@/components/admin/format-utils";
import type {
  AttendanceRosterResponse,
  AttendanceRosterStatus,
  AttendanceStatus,
  ClassSessionResponse,
  CourseSectionResponse,
  GradeEntryComponentResponse,
  GradeEntryRosterRowResponse,
  GradeReportStatus,
  LecturerFeatureTab,
  LecturerSemesterOptionResponse,
  LecturerScheduleRow,
  SectionRosterResponse,
} from "@/lib/lecturer/types";

const toErrorMessage = (error: unknown, fallback: string): string => {
  const normalized = toSharedErrorMessage(error).trim();
  return normalized || fallback;
};

const normalizeTextValue = (value?: string | null): string => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSearchText = (value?: string | null): string => {
  return normalizeTextValue(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
};

const toLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

const formatScore = (value?: number): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(2);
};

const parsePositiveInteger = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseIsoDateLocal = (value: string): Date => {
  const normalized = String(value).trim().slice(0, 10);
  const [year, month, day] = normalized.split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    const fallback = new Date(value);
    if (!Number.isNaN(fallback.getTime())) {
      return new Date(
        fallback.getFullYear(),
        fallback.getMonth(),
        fallback.getDate(),
      );
    }
  }

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

const formatDateShortWithYear = (value: string): string => {
  const date = parseIsoDateLocal(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}/${date.getFullYear()}`;
};

interface ScheduleWeekOption {
  key: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  label: string;
}

interface LecturerWeeklyScheduleBlock {
  key: string;
  sessionId?: number;
  sectionId?: number;
  recurringScheduleId?: number;
  courseCode?: string;
  courseName: string;
  sectionCode?: string;
  classroomName?: string;
  lecturerName?: string;
  startPeriod: number;
  endPeriod: number;
  dayIndex: number;
  sessionDate?: string;
  status?: string;
}

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
    label: `Tuần ${weekNumber} [từ ngày ${formatDateShortWithYear(
      startDate,
    )} đến ngày ${formatDateShortWithYear(endDate)}]`,
  };
};

const toDisplayValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Có" : "Không";
  }

  if (Array.isArray(value)) {
    return value.map((item) => toDisplayValue(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }

  return String(value);
};

const getScheduleStatusClass = (status?: string): string => {
  switch ((status || "").toUpperCase()) {
    case "NORMAL":
    case "SCHEDULED":
    case "OPEN":
    case "ONGOING":
      return "bg-[#eef8f1] text-[#1d7a46]";
    case "COMPLETED":
      return "bg-[#eef4fb] text-[#1f4f84]";
    case "CANCELLED":
      return "bg-[#fff0f0] text-[#bf4e4e]";
    case "RESCHEDULED":
      return "bg-[#fff7e8] text-[#a16a00]";
    case "FINISHED":
      return "bg-[#eef4fb] text-[#1f4f84]";
    default:
      return "bg-[#eef4f8] text-[#47677e]";
  }
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

const gradeStatusOptions: GradeReportStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "LOCKED",
];

const toEditableAttendanceStatus = (
  status?: AttendanceRosterStatus | null,
): AttendanceStatus | undefined => {
  if (
    status === "PRESENT" ||
    status === "ABSENT" ||
    status === "LATE" ||
    status === "EXCUSED"
  ) {
    return status;
  }

  return undefined;
};

const getAttendanceStatusLabel = (status?: AttendanceRosterStatus | null): string => {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "LATE":
      return "Đi muộn";
    case "EXCUSED":
      return "Có phép";
    case "ABSENT":
      return "Vắng";
    case "NOT_MARKED":
      return "Chưa điểm danh";
    default:
      return "Chưa điểm danh";
  }
};

const getAttendanceStatusClass = (status?: AttendanceRosterStatus | null): string => {
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

const attendanceStatusOptions: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

interface GradeEntryDraftRow {
  status: GradeReportStatus;
  scoresByComponentId: Record<number, string>;
}

const formatScoreInput = (value?: number | null): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }

  return String(value);
};

const sortAttendanceRosterItems = (
  items: AttendanceRosterResponse[],
): AttendanceRosterResponse[] => {
  return [...items].sort((first, second) => {
    const firstCode = normalizeTextValue(first.studentCode).toLowerCase();
    const secondCode = normalizeTextValue(second.studentCode).toLowerCase();

    if (firstCode && secondCode && firstCode !== secondCode) {
      return firstCode.localeCompare(secondCode);
    }

    return normalizeTextValue(first.studentName).localeCompare(
      normalizeTextValue(second.studentName),
      "vi",
    );
  });
};

const buildAttendanceDraftByRegistrationId = (
  items: AttendanceRosterResponse[],
): Record<number, { status: AttendanceStatus; note: string }> => {
  const nextDraft: Record<number, { status: AttendanceStatus; note: string }> = {};

  items.forEach((item) => {
    if (!item.courseRegistrationId || item.courseRegistrationId <= 0) {
      return;
    }

    const status = toEditableAttendanceStatus(item.attendanceStatus);
    if (!status) {
      return;
    }

    nextDraft[item.courseRegistrationId] = {
      status,
      note: item.note || "",
    };
  });

  return nextDraft;
};

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

const lecturerTopHeaderTabs = ["Thông báo", "Nghiệp vụ", "Hỗ trợ"] as const;

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

const getSectionLabel = (section: CourseSectionResponse): string => {
  const parts = [
    section.sectionCode,
    section.displayName,
    section.courseCode,
    section.courseName,
  ]
    .map((item) => normalizeTextValue(item))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : `Lớp học phần #${section.id}`;
};

const getSessionLabel = (session: ClassSessionResponse): string => {
  const dateLabel = formatDate(session.sessionDate);
  const periodLabel =
    typeof session.startPeriod === "number" && typeof session.endPeriod === "number"
      ? `Tiết ${session.startPeriod}-${session.endPeriod}`
      : "Chưa có tiết học";

  const courseLabel = [normalizeTextValue(session.courseCode), normalizeTextValue(session.courseName)]
    .filter(Boolean)
    .join(" - ");
  const sectionLabel = normalizeTextValue(session.sectionCode);
  const classroomLabel = normalizeTextValue(session.classroomName);

  const parts = [dateLabel, periodLabel, courseLabel, sectionLabel, classroomLabel].filter(
    (item) => item && item !== "-",
  );

  return parts.join(" | ");
};

const buildScheduleSectionIdentity = (row: LecturerScheduleRow): string | null => {
  const sectionId = getNumericValueFromRow(row, ["sectionId", "courseSectionId"]);
  if (sectionId && sectionId > 0) {
    return `id:${sectionId}`;
  }

  const courseCode = normalizeTextValue(
    getStringValueFromRow(row, ["courseCode", "subjectCode"]),
  ).toLowerCase();
  const courseName = normalizeTextValue(
    getStringValueFromRow(row, ["courseName", "subjectName", "className"]),
  ).toLowerCase();
  const sectionCode = normalizeTextValue(
    getStringValueFromRow(row, ["sectionCode", "sectionName"]),
  ).toLowerCase();

  const fallbackIdentity = [courseCode, courseName, sectionCode]
    .filter(Boolean)
    .join("|");

  return fallbackIdentity || null;
};

const resolveAttendanceSessionSectionIdentity = (
  session: ClassSessionResponse,
  sectionById: Map<number, CourseSectionResponse>,
  sectionByComposite: Map<string, CourseSectionResponse>,
  uniqueSectionByCode: Map<string, CourseSectionResponse>,
): { key: string; label: string } | null => {
  const sectionId =
    typeof session.sectionId === "number" && session.sectionId > 0
      ? session.sectionId
      : null;
  const sectionCode = normalizeTextValue(session.sectionCode);
  const normalizedSectionCode = sectionCode.toLowerCase();
  const normalizedCourseCode = normalizeTextValue(session.courseCode).toLowerCase();
  const courseName = normalizeTextValue(session.courseName);
  const normalizedCourseName = courseName.toLowerCase();

  const resolvedSection =
    (sectionId ? sectionById.get(sectionId) : undefined) ||
    (normalizedCourseCode && normalizedSectionCode
      ? sectionByComposite.get(
          `course:${normalizedCourseCode}|group:${normalizedSectionCode}`,
        )
      : undefined) ||
    (normalizedCourseName && normalizedSectionCode
      ? sectionByComposite.get(
          `courseName:${normalizedCourseName}|group:${normalizedSectionCode}`,
        )
      : undefined) ||
    (normalizedSectionCode ? uniqueSectionByCode.get(normalizedSectionCode) : undefined);

  if (resolvedSection) {
    return {
      key: `id:${resolvedSection.id}`,
      label: getSectionLabel(resolvedSection),
    };
  }

  if (sectionId) {
    return {
      key: `id:${sectionId}`,
      label: sectionCode || `Lớp học phần #${sectionId}`,
    };
  }

  const fallbackKeyParts = [
    normalizedCourseCode ? `course:${normalizedCourseCode}` : "",
    normalizedCourseName ? `courseName:${normalizedCourseName}` : "",
    normalizedSectionCode ? `group:${normalizedSectionCode}` : "",
  ].filter(Boolean);

  if (fallbackKeyParts.length === 0) {
    return null;
  }

  const label = [
    normalizeTextValue(session.courseCode),
    normalizeTextValue(session.courseName),
    sectionCode,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    key: fallbackKeyParts.join("|"),
    label: label || "Lớp học phần",
  };
};

const isOngoingOrUpcomingSemesterStatus = (
  status?: LecturerSemesterOptionResponse["semesterStatus"],
): boolean => {
  return status === "ONGOING" || status === "REGISTRATION_OPEN";
};

const getScheduleValue = (
  row: LecturerScheduleRow,
  keys: string[],
): string => {
  for (const key of keys) {
    if (!(key in row)) {
      continue;
    }

    const value = row[key];
    const displayValue = toDisplayValue(value);
    if (displayValue !== "-") {
      return displayValue;
    }
  }

  return "-";
};

const getNumericValueFromRow = (
  row: LecturerScheduleRow,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    if (!(key in row)) {
      continue;
    }

    const rawValue = row[key];
    if (typeof rawValue === "number" && Number.isInteger(rawValue)) {
      return rawValue;
    }

    if (typeof rawValue === "string") {
      const parsed = Number(rawValue);
      if (Number.isInteger(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const getStringValueFromRow = (
  row: LecturerScheduleRow,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    if (!(key in row)) {
      continue;
    }

    const normalized = normalizeTextValue(toDisplayValue(row[key]));
    if (normalized && normalized !== "-") {
      return normalized;
    }
  }

  return undefined;
};

const toAttendanceSessionsFromSchedule = (
  rows: LecturerScheduleRow[],
): ClassSessionResponse[] => {
  const sessions = rows
    .map((row) => {
      const sessionId = getNumericValueFromRow(row, ["sessionId", "classSessionId", "id"]);
      if (!sessionId || sessionId <= 0) {
        return null;
      }

      return {
        id: sessionId,
        sectionId: getNumericValueFromRow(row, ["sectionId", "courseSectionId"]),
        sectionCode: getStringValueFromRow(row, ["sectionCode", "sectionName"]),
        courseCode: getStringValueFromRow(row, ["courseCode", "subjectCode"]),
        courseName: getStringValueFromRow(row, ["courseName", "subjectName", "className"]),
        classroomName: getStringValueFromRow(row, ["classroomName", "roomName"]),
        sessionDate: getStringValueFromRow(row, ["sessionDate", "date", "lessonDate"]),
        startPeriod: getNumericValueFromRow(row, ["startPeriod", "fromPeriod"]),
        endPeriod: getNumericValueFromRow(row, ["endPeriod", "toPeriod"]),
        status:
          (getStringValueFromRow(row, ["status", "sessionStatus"]) as
            | "NORMAL"
            | "SCHEDULED"
            | "COMPLETED"
            | "CANCELLED"
            | "RESCHEDULED"
            | undefined) || undefined,
      } as ClassSessionResponse;
    })
    .filter((item): item is ClassSessionResponse => item !== null);

  const deduped = Array.from(
    new Map(sessions.map((session) => [session.id, session])).values(),
  );

  deduped.sort((first, second) => {
    const firstDate = first.sessionDate || "";
    const secondDate = second.sessionDate || "";

    if (firstDate === secondDate) {
      return (first.startPeriod || 0) - (second.startPeriod || 0);
    }

    return firstDate.localeCompare(secondDate);
  });

  return deduped;
};

export default function LecturerDashboardPage() {
  const { session, logout } = useAuth();

  const [activeTabKey, setActiveTabKey] =
    useState<LecturerFeatureTab["key"]>("schedule");

  const [tabError, setTabError] = useState("");
  const [tabMessage, setTabMessage] = useState("");

  const [scheduleSemesterOptions, setScheduleSemesterOptions] = useState<
    LecturerSemesterOptionResponse[]
  >([]);
  const [selectedScheduleSemesterId, setSelectedScheduleSemesterId] = useState("");
  const [scheduleRows, setScheduleRows] = useState<LecturerScheduleRow[]>([]);
  const [selectedScheduleWeekKey, setSelectedScheduleWeekKey] = useState("");
  const [selectedScheduleBlockKey, setSelectedScheduleBlockKey] = useState("");
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  const [sectionCatalog, setSectionCatalog] = useState<CourseSectionResponse[]>([]);
  const [isSectionCatalogLoading, setIsSectionCatalogLoading] = useState(false);

  const [selectedGradeSemesterId, setSelectedGradeSemesterId] = useState("");
  const [selectedGradeSectionId, setSelectedGradeSectionId] = useState("");
  const [gradeEntryComponents, setGradeEntryComponents] = useState<
    GradeEntryComponentResponse[]
  >([]);
  const [gradeEntryRows, setGradeEntryRows] = useState<GradeEntryRosterRowResponse[]>([]);
  const [gradeDraftByRegistrationId, setGradeDraftByRegistrationId] = useState<
    Record<number, GradeEntryDraftRow>
  >({});
  const [gradeKeyword, setGradeKeyword] = useState("");
  const [gradeStatusFilter, setGradeStatusFilter] = useState("");
  const [isGradeRosterLoading, setIsGradeRosterLoading] = useState(false);
  const [isSavingGradeRoster, setIsSavingGradeRoster] = useState(false);

  const [selectedAttendanceSemesterId, setSelectedAttendanceSemesterId] =
    useState("");
  const [selectedAttendanceSectionId, setSelectedAttendanceSectionId] = useState("");
  const [attendanceSessions, setAttendanceSessions] = useState<ClassSessionResponse[]>(
    [],
  );
  const [sectionRoster, setSectionRoster] = useState<SectionRosterResponse[]>([]);
  const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] =
    useState("");
  const [attendanceItems, setAttendanceItems] = useState<AttendanceRosterResponse[]>(
    [],
  );
  const [attendanceKeyword, setAttendanceKeyword] = useState("");
  const [isAttendanceSessionLoading, setIsAttendanceSessionLoading] =
    useState(false);
  const [isSectionRosterLoading, setIsSectionRosterLoading] = useState(false);
  const [isAttendanceItemsLoading, setIsAttendanceItemsLoading] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceDraftByRegistrationId, setAttendanceDraftByRegistrationId] =
    useState<Record<number, { status: AttendanceStatus; note: string }>>({});

  useToastFeedback({
    errorMessage: tabError,
    successMessage: tabMessage,
    errorTitle: "Thao tác giảng viên thất bại",
    successTitle: "Thao tác giảng viên thành công",
  });

  const activeTab = useMemo(
    () =>
      lecturerFeatureTabs.find((tab) => tab.key === activeTabKey) ||
      lecturerFeatureTabs[0],
    [activeTabKey],
  );

  const lecturerSections = useMemo(() => sectionCatalog, [sectionCatalog]);

  const scheduleSummary = useMemo(() => {
    const sectionSet = new Set<string>();
    const dateSet = new Set<string>();

    scheduleRows.forEach((row) => {
      const sectionIdentity = buildScheduleSectionIdentity(row);
      if (sectionIdentity) {
        sectionSet.add(sectionIdentity);
      }

      const dateValue = getScheduleValue(row, ["sessionDate", "date", "lessonDate"]);
      if (dateValue !== "-") {
        dateSet.add(dateValue);
      }
    });

    return {
      sectionCount: sectionSet.size,
      teachingDayCount: dateSet.size,
    };
  }, [scheduleRows]);

  const selectedScheduleSemesterDetail = useMemo(() => {
    const semesterId = parsePositiveInteger(selectedScheduleSemesterId);
    if (!semesterId) {
      return null;
    }

    return (
      scheduleSemesterOptions.find((item) => item.semesterId === semesterId) || null
    );
  }, [scheduleSemesterOptions, selectedScheduleSemesterId]);

  const selectedScheduleSemesterLabel = useMemo(() => {
    const semester = selectedScheduleSemesterDetail;
    if (!semester) {
      return "Chưa chọn học kỳ";
    }

    const term = semester.semesterNumber
      ? `Học kỳ ${semester.semesterNumber}`
      : "Học kỳ";
    const detail = semester.displayName || semester.academicYear || `#${semester.semesterId}`;
    return `${term} - ${detail}`;
  }, [selectedScheduleSemesterDetail]);

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
    scheduleRows.forEach((row) => {
      const sessionDate = getStringValueFromRow(row, ["sessionDate", "date", "lessonDate"]);
      if (!sessionDate) {
        return;
      }

      const monday = getMondayOfWeek(parseIsoDateLocal(sessionDate));
      weekStarts.add(toLocalIsoDate(monday));
    });

    if (weekStarts.size === 0) {
      weekStarts.add(toLocalIsoDate(getMondayOfWeek(new Date())));
    }

    return Array.from(weekStarts.values())
      .sort((a, b) => parseIsoDateLocal(a).getTime() - parseIsoDateLocal(b).getTime())
      .map((startDate) => buildScheduleWeekOption(startDate));
  }, [scheduleRows, selectedScheduleSemesterDetail?.endDate, selectedScheduleSemesterDetail?.startDate]);

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
  }, [scheduleWeekOptions, selectedScheduleWeekStartKey]);

  const scheduleWeekDates = useMemo(() => {
    const startDate = parseIsoDateLocal(selectedScheduleWeek.startDate);
    return Array.from({ length: 7 }, (_, index) =>
      toLocalIsoDate(addDays(startDate, index)),
    );
  }, [selectedScheduleWeek]);

  const scheduleVisibleBlocks = useMemo<LecturerWeeklyScheduleBlock[]>(() => {
    const weekStart = parseIsoDateLocal(selectedScheduleWeek.startDate).getTime();
    const weekEnd = parseIsoDateLocal(selectedScheduleWeek.endDate).getTime();
    const currentWeekStart = parseIsoDateLocal(selectedScheduleWeek.startDate);

    const mappedBlocks: Array<LecturerWeeklyScheduleBlock | null> = scheduleRows.map(
      (row, index) => {
        const sessionDate = getStringValueFromRow(row, ["sessionDate", "date", "lessonDate"]);
        const dayOfWeek = getNumericValueFromRow(row, ["dayOfWeek", "weekday"]);
        const dayOfWeekName = getStringValueFromRow(row, ["dayOfWeekName", "weekdayName"]);

        const resolvedDayIndex = sessionDate
          ? getDayIndexFromSessionDate(sessionDate)
          : normalizeDayIndex(dayOfWeek, dayOfWeekName);

        if (resolvedDayIndex === null || resolvedDayIndex < 0 || resolvedDayIndex > 6) {
          return null;
        }

        const startPeriod = getNumericValueFromRow(row, ["startPeriod", "fromPeriod"]);
        const endPeriod = getNumericValueFromRow(row, ["endPeriod", "toPeriod"]);

        if (!startPeriod || startPeriod <= 0) {
          return null;
        }

        const safeStart = Math.max(1, Math.min(14, startPeriod));
        const safeEnd = Math.max(
          safeStart,
          Math.min(14, Number.isInteger(endPeriod) ? endPeriod || safeStart : safeStart),
        );

        const blockSessionDate = sessionDate
          ? sessionDate
          : toLocalIsoDate(addDays(currentWeekStart, resolvedDayIndex));

        return {
          key: [
            getNumericValueFromRow(row, ["sessionId", "classSessionId", "id"]),
            blockSessionDate,
            safeStart,
            safeEnd,
            getStringValueFromRow(row, ["courseCode", "sectionCode", "courseName"]),
            index,
          ].join("-"),
          sessionId: getNumericValueFromRow(row, ["sessionId", "classSessionId", "id"]),
          sectionId: getNumericValueFromRow(row, ["sectionId", "courseSectionId"]),
          recurringScheduleId: getNumericValueFromRow(row, ["recurringScheduleId"]),
          courseCode: getStringValueFromRow(row, ["courseCode"]),
          courseName:
            getStringValueFromRow(row, ["courseName", "subjectName", "className"]) ||
            "Chưa cập nhật",
          sectionCode: getStringValueFromRow(row, ["sectionCode", "sectionName"]),
          classroomName: getStringValueFromRow(row, ["classroomName", "roomName"]),
          lecturerName: getStringValueFromRow(row, ["lecturerName", "teacherName"]),
          startPeriod: safeStart,
          endPeriod: safeEnd,
          dayIndex: resolvedDayIndex,
          sessionDate: blockSessionDate,
          status: getStringValueFromRow(row, ["status", "sessionStatus"]),
        } satisfies LecturerWeeklyScheduleBlock;
      },
    );

    return mappedBlocks
      .filter((item): item is LecturerWeeklyScheduleBlock => item !== null)
      .filter((block) => {
        if (!block.sessionDate) {
          return true;
        }

        const sessionTime = parseIsoDateLocal(block.sessionDate).getTime();
        return sessionTime >= weekStart && sessionTime <= weekEnd;
      });
  }, [scheduleRows, selectedScheduleWeek]);

  const scheduleBlocksByDay = useMemo(() => {
    const buckets: LecturerWeeklyScheduleBlock[][] = Array.from(
      { length: 7 },
      () => [],
    );

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

  const gradeSectionsForSemester = useMemo(() => {
    const semesterId = parsePositiveInteger(selectedGradeSemesterId);
    if (!semesterId) {
      return lecturerSections;
    }

    return lecturerSections.filter((section) => section.semesterId === semesterId);
  }, [lecturerSections, selectedGradeSemesterId]);

  const gradeEntryRowsWithDraft = useMemo(() => {
    return gradeEntryRows
      .map((row) => {
        const registrationId = row.registrationId;
        if (!registrationId || registrationId <= 0) {
          return null;
        }

        const baseScoresByComponentId: Record<number, string> = {};
        gradeEntryComponents.forEach((component) => {
          const componentId = component.componentId;
          const detail = (row.gradeDetails || []).find(
            (item) => item.componentId === componentId,
          );
          baseScoresByComponentId[componentId] = formatScoreInput(detail?.score ?? null);
        });

        const draft = gradeDraftByRegistrationId[registrationId];
        const mergedScoresByComponentId = {
          ...baseScoresByComponentId,
          ...(draft?.scoresByComponentId || {}),
        };
        const effectiveStatus: GradeReportStatus =
          draft?.status || row.status || "DRAFT";

        const hasStatusChanged = effectiveStatus !== (row.status || "DRAFT");
        const hasScoreChanged = gradeEntryComponents.some((component) => {
          const componentId = component.componentId;
          const previousValue = (baseScoresByComponentId[componentId] || "").trim();
          const nextValue = (mergedScoresByComponentId[componentId] || "").trim();
          return previousValue !== nextValue;
        });

        return {
          row,
          registrationId,
          effectiveStatus,
          mergedScoresByComponentId,
          hasChanges: hasStatusChanged || hasScoreChanged,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((first, second) => {
        const firstCode = normalizeTextValue(first.row.studentCode).toLowerCase();
        const secondCode = normalizeTextValue(second.row.studentCode).toLowerCase();

        if (firstCode && secondCode && firstCode !== secondCode) {
          return firstCode.localeCompare(secondCode);
        }

        return normalizeTextValue(first.row.studentName).localeCompare(
          normalizeTextValue(second.row.studentName),
          "vi",
        );
      });
  }, [gradeDraftByRegistrationId, gradeEntryComponents, gradeEntryRows]);

  const filteredGradeEntryRows = useMemo(() => {
    const keyword = normalizeSearchText(gradeKeyword);

    return gradeEntryRowsWithDraft.filter((entry) => {
      const statusMatched =
        !gradeStatusFilter || entry.effectiveStatus === gradeStatusFilter;
      if (!statusMatched) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const text = [
        entry.row.studentCode,
        entry.row.studentName,
        entry.row.letterGrade,
        getGradeStatusLabel(entry.effectiveStatus),
        String(entry.row.finalScore ?? ""),
        ...gradeEntryComponents.map(
          (component) =>
            entry.mergedScoresByComponentId[component.componentId] || "",
        ),
      ]
        .map((value) => normalizeSearchText(value))
        .join(" ");

      return text.includes(keyword);
    });
  }, [gradeEntryComponents, gradeEntryRowsWithDraft, gradeKeyword, gradeStatusFilter]);

  const gradeSummary = useMemo(() => {
    const draftCount = gradeEntryRowsWithDraft.filter(
      (entry) => entry.effectiveStatus === "DRAFT",
    ).length;
    const publishedCount = gradeEntryRowsWithDraft.filter(
      (entry) => entry.effectiveStatus === "PUBLISHED",
    ).length;
    const lockedCount = gradeEntryRowsWithDraft.filter(
      (entry) => entry.effectiveStatus === "LOCKED",
    ).length;
    const changedCount = gradeEntryRowsWithDraft.filter(
      (entry) => entry.hasChanges,
    ).length;

    return {
      total: gradeEntryRowsWithDraft.length,
      noReportCount: gradeEntryRowsWithDraft.filter(
        (entry) => !entry.row.gradeReportId,
      ).length,
      draftCount,
      publishedCount,
      lockedCount,
      changedCount,
    };
  }, [gradeEntryRowsWithDraft]);

  const filteredAttendanceItems = useMemo(() => {
    const keyword = normalizeSearchText(attendanceKeyword);
    if (!keyword) {
      return attendanceItems;
    }

    return attendanceItems.filter((item) => {
      const registrationId = item.courseRegistrationId || 0;
      const draft =
        registrationId > 0
          ? attendanceDraftByRegistrationId[registrationId]
          : undefined;
      const effectiveStatus = draft?.status || item.attendanceStatus;
      const effectiveNote = draft?.note ?? item.note;

      const text = [
        item.studentCode,
        item.studentName,
        getAttendanceStatusLabel(effectiveStatus),
        effectiveNote,
        formatDate(item.sessionDate),
      ]
        .map((value) => normalizeSearchText(value))
        .join(" ");

      return text.includes(keyword);
    });
  }, [attendanceDraftByRegistrationId, attendanceItems, attendanceKeyword]);

  const attendanceSummary = useMemo(() => {
    const summary = {
      total: filteredAttendanceItems.length,
      notMarked: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    };

    filteredAttendanceItems.forEach((item) => {
      const registrationId = item.courseRegistrationId || 0;
      const draft =
        registrationId > 0
          ? attendanceDraftByRegistrationId[registrationId]
          : undefined;
      const effectiveStatus = draft?.status || item.attendanceStatus;

      if (effectiveStatus === "PRESENT") {
        summary.present += 1;
      } else if (effectiveStatus === "LATE") {
        summary.late += 1;
      } else if (effectiveStatus === "EXCUSED") {
        summary.excused += 1;
      } else if (effectiveStatus === "ABSENT") {
        summary.absent += 1;
      } else {
        summary.notMarked += 1;
      }
    });

    return summary;
  }, [attendanceDraftByRegistrationId, filteredAttendanceItems]);

  const sectionRosterSummary = useMemo(() => {
    const active = sectionRoster.filter((item) => item.status !== "REMOVED").length;

    return {
      total: sectionRoster.length,
      active,
      removed: Math.max(sectionRoster.length - active, 0),
    };
  }, [sectionRoster]);

  const attendanceSectionsForSemester = useMemo(() => {
    const semesterId = parsePositiveInteger(selectedAttendanceSemesterId);
    if (!semesterId) {
      return lecturerSections;
    }

    return lecturerSections.filter((section) => section.semesterId === semesterId);
  }, [lecturerSections, selectedAttendanceSemesterId]);

  const attendanceSectionOptions = useMemo(() => {
    const dedupedSections = Array.from(
      new Map(
        attendanceSectionsForSemester
          .filter(
            (section) =>
              typeof section.id === "number" &&
              Number.isInteger(section.id) &&
              section.id > 0,
          )
          .map((section) => [section.id, section]),
      ).values(),
    );

    return dedupedSections
      .map((section) => ({
        key: `id:${section.id}`,
        label: getSectionLabel(section),
      }))
      .sort((first, second) =>
      first.label.localeCompare(second.label, "vi"),
    );
  }, [attendanceSectionsForSemester]);

  const filteredAttendanceSessions = useMemo(() => {
    const selectedSectionKey = normalizeTextValue(selectedAttendanceSectionId);
    if (!selectedSectionKey) {
      return attendanceSessions;
    }

    const selectedSectionId = selectedSectionKey.startsWith("id:")
      ? parsePositiveInteger(selectedSectionKey.slice(3))
      : null;

    if (selectedSectionId) {
      const directMatches = attendanceSessions.filter(
        (sessionItem) => sessionItem.sectionId === selectedSectionId,
      );

      if (directMatches.length > 0) {
        return directMatches;
      }
    }

    const sectionById = new Map<number, CourseSectionResponse>();
    const sectionByComposite = new Map<string, CourseSectionResponse>();
    const sectionsByCode = new Map<string, CourseSectionResponse[]>();

    attendanceSectionsForSemester.forEach((section) => {
      if (typeof section.id === "number" && Number.isInteger(section.id) && section.id > 0) {
        sectionById.set(section.id, section);
      }

      const normalizedCode = normalizeTextValue(section.sectionCode).toLowerCase();
      const normalizedCourseCode = normalizeTextValue(section.courseCode).toLowerCase();
      const normalizedCourseName = normalizeTextValue(section.courseName).toLowerCase();

      if (normalizedCourseCode && normalizedCode) {
        sectionByComposite.set(`course:${normalizedCourseCode}|group:${normalizedCode}`, section);
      }

      if (normalizedCourseName && normalizedCode) {
        sectionByComposite.set(`courseName:${normalizedCourseName}|group:${normalizedCode}`, section);
      }

      if (normalizedCode) {
        const bucket = sectionsByCode.get(normalizedCode) || [];
        bucket.push(section);
        sectionsByCode.set(normalizedCode, bucket);
      }
    });

    const uniqueSectionByCode = new Map<string, CourseSectionResponse>();
    sectionsByCode.forEach((bucket, normalizedCode) => {
      if (bucket.length === 1) {
        uniqueSectionByCode.set(normalizedCode, bucket[0]);
      }
    });

    return attendanceSessions.filter((sessionItem) => {
      const resolved = resolveAttendanceSessionSectionIdentity(
        sessionItem,
        sectionById,
        sectionByComposite,
        uniqueSectionByCode,
      );

      return Boolean(resolved && resolved.key === selectedSectionKey);
    });
  }, [
    attendanceSectionsForSemester,
    attendanceSessions,
    selectedAttendanceSectionId,
  ]);

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
    if (scheduleSemesterOptions.length === 0) {
      if (selectedScheduleSemesterId) {
        setSelectedScheduleSemesterId("");
      }
      if (selectedGradeSemesterId) {
        setSelectedGradeSemesterId("");
      }
      if (selectedAttendanceSemesterId) {
        setSelectedAttendanceSemesterId("");
      }
      return;
    }

    const pickDefaultSemester = () => {
      const ongoing = scheduleSemesterOptions.find(
        (item) => item.semesterStatus === "ONGOING",
      );
      if (ongoing) {
        return ongoing;
      }

      return scheduleSemesterOptions[scheduleSemesterOptions.length - 1];
    };

    if (
      !selectedScheduleSemesterId ||
      !scheduleSemesterOptions.some(
        (item) => String(item.semesterId) === selectedScheduleSemesterId,
      )
    ) {
      const fallback = pickDefaultSemester();
      if (fallback) {
        setSelectedScheduleSemesterId(String(fallback.semesterId));
      }
    }

    if (
      !selectedGradeSemesterId ||
      !scheduleSemesterOptions.some(
        (item) => String(item.semesterId) === selectedGradeSemesterId,
      )
    ) {
      const fallback = pickDefaultSemester();
      if (fallback) {
        setSelectedGradeSemesterId(String(fallback.semesterId));
      }
    }

    if (
      !selectedAttendanceSemesterId ||
      !scheduleSemesterOptions.some(
        (item) => String(item.semesterId) === selectedAttendanceSemesterId,
      )
    ) {
      const fallback = pickDefaultSemester();
      if (fallback) {
        setSelectedAttendanceSemesterId(String(fallback.semesterId));
      }
    }
  }, [
    scheduleSemesterOptions,
    selectedAttendanceSemesterId,
    selectedGradeSemesterId,
    selectedScheduleSemesterId,
  ]);

  useEffect(() => {
    if (selectedAttendanceSectionId) {
      const stillValid = attendanceSectionOptions.some(
        (section) => section.key === selectedAttendanceSectionId,
      );

      if (stillValid) {
        return;
      }
    }

    setSelectedAttendanceSectionId(
      attendanceSectionOptions.length > 0
        ? attendanceSectionOptions[0].key
        : "",
    );
  }, [attendanceSectionOptions, selectedAttendanceSectionId]);

  useEffect(() => {
    if (selectedAttendanceSessionId) {
      const stillValid = filteredAttendanceSessions.some(
        (sessionItem) => String(sessionItem.id) === selectedAttendanceSessionId,
      );

      if (stillValid) {
        return;
      }
    }

    setSelectedAttendanceSessionId(
      filteredAttendanceSessions.length > 0
        ? String(filteredAttendanceSessions[0].id)
        : "",
    );
  }, [filteredAttendanceSessions, selectedAttendanceSessionId]);

  useEffect(() => {
    const authorization = session?.authorization;

    if (!authorization) {
      setSectionCatalog([]);
      setScheduleSemesterOptions([]);
      return;
    }

    let cancelled = false;
    setIsSectionCatalogLoading(true);

    const loadSectionCatalog = async () => {
      try {
        const [sections, semesters] = await Promise.all([
          getCourseSections(authorization),
          getLecturerSemesterOptions(authorization),
        ]);

        if (cancelled) {
          return;
        }

        setSectionCatalog(sections);
        setScheduleSemesterOptions(
          semesters.filter((semester) =>
            isOngoingOrUpcomingSemesterStatus(semester.semesterStatus),
          ),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSectionCatalog([]);
        setScheduleSemesterOptions([]);
        setTabError(
          toErrorMessage(
            error,
            "Không thể tải dữ liệu học kỳ hoặc lớp học phần của giảng viên.",
          ),
        );
      } finally {
        if (!cancelled) {
          setIsSectionCatalogLoading(false);
        }
      }
    };

    void loadSectionCatalog();

    return () => {
      cancelled = true;
    };
  }, [session?.authorization]);

  useEffect(() => {
    if (selectedGradeSectionId) {
      const stillValid = gradeSectionsForSemester.some(
        (section) => String(section.id) === selectedGradeSectionId,
      );
      if (stillValid) {
        return;
      }
    }

    setSelectedGradeSectionId(
      gradeSectionsForSemester.length > 0
        ? String(gradeSectionsForSemester[0].id)
        : "",
    );
  }, [gradeSectionsForSemester, selectedGradeSectionId]);

  useEffect(() => {
    if (activeTabKey !== "grades") {
      return;
    }

    const authorization = session?.authorization;
    const sectionId = parsePositiveInteger(selectedGradeSectionId);

    if (!authorization || !sectionId) {
      setGradeEntryComponents([]);
      setGradeEntryRows([]);
      setGradeDraftByRegistrationId({});
      return;
    }

    let cancelled = false;
    setIsGradeRosterLoading(true);

    const loadGradeEntryRoster = async () => {
      try {
        const roster = await getGradeEntryRosterBySection(sectionId, authorization);
        let resolvedComponents = [...roster.components];

        if (resolvedComponents.length === 0) {
          const fallbackCourseId =
            roster.courseId ||
            lecturerSections.find((section) => section.id === sectionId)?.courseId;

          if (fallbackCourseId) {
            try {
              resolvedComponents = await getGradeComponentsByCourse(
                fallbackCourseId,
                authorization,
              );
            } catch {
              resolvedComponents = [];
            }
          }
        }

        if (cancelled) {
          return;
        }

        setGradeEntryComponents(
          [...resolvedComponents].sort(
            (first, second) =>
              (first.weightPercentage ?? 0) - (second.weightPercentage ?? 0),
          ),
        );
        setGradeEntryRows(roster.rows);
        setGradeDraftByRegistrationId({});
      } catch (error) {
        if (cancelled) {
          return;
        }

        setGradeEntryComponents([]);
        setGradeEntryRows([]);
        setGradeDraftByRegistrationId({});
        setTabError(
          toErrorMessage(error, "Không thể tải grade-entry roster của lớp học phần đã chọn."),
        );
      } finally {
        if (!cancelled) {
          setIsGradeRosterLoading(false);
        }
      }
    };

    void loadGradeEntryRoster();

    return () => {
      cancelled = true;
    };
  }, [activeTabKey, lecturerSections, selectedGradeSectionId, session?.authorization]);

  useEffect(() => {
    if (activeTabKey !== "attendance") {
      return;
    }

    const authorization = session?.authorization;
    const semesterId = parsePositiveInteger(selectedAttendanceSemesterId);

    if (!authorization || !semesterId) {
      setAttendanceSessions([]);
      setSectionRoster([]);
      setSelectedAttendanceSessionId("");
      return;
    }

    let cancelled = false;
    setIsAttendanceSessionLoading(true);

    const loadSessionsBySemester = async () => {
      try {
        const [rows, sections] = await Promise.all([
          getMyLecturerSchedule(semesterId, authorization),
          getCourseSections(authorization),
        ]);

        if (cancelled) {
          return;
        }

        setSectionCatalog(sections);

        const mappedSessions = toAttendanceSessionsFromSchedule(rows);

        setAttendanceSessions(mappedSessions);
        setSelectedAttendanceSessionId((current) => {
          if (current && mappedSessions.some((sessionItem) => String(sessionItem.id) === current)) {
            return current;
          }
          return mappedSessions.length > 0 ? String(mappedSessions[0].id) : "";
        });
        setSectionRoster([]);
        setAttendanceItems([]);
        setAttendanceDraftByRegistrationId({});
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAttendanceSessions([]);
        setSectionRoster([]);
        setSelectedAttendanceSessionId("");
        setAttendanceItems([]);
        setAttendanceDraftByRegistrationId({});
        setTabError(
          toErrorMessage(error, "Không thể tải danh sách buổi dạy theo học kỳ đã chọn."),
        );
      } finally {
        if (!cancelled) {
          setIsAttendanceSessionLoading(false);
        }
      }
    };

    void loadSessionsBySemester();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    selectedAttendanceSemesterId,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "attendance") {
      return;
    }

    const authorization = session?.authorization;
    const selectedSectionKey = normalizeTextValue(selectedAttendanceSectionId);
    const sectionId = selectedSectionKey.startsWith("id:")
      ? parsePositiveInteger(selectedSectionKey.slice(3))
      : null;

    if (!authorization || !sectionId) {
      setSectionRoster([]);
      return;
    }

    let cancelled = false;
    setIsSectionRosterLoading(true);

    const loadSectionRoster = async () => {
      try {
        const items = await getSectionRoster(sectionId, authorization);

        if (cancelled) {
          return;
        }

        const sortedItems = [...items].sort((first, second) => {
          const firstCode = normalizeTextValue(first.studentCode).toLowerCase();
          const secondCode = normalizeTextValue(second.studentCode).toLowerCase();

          if (firstCode && secondCode && firstCode !== secondCode) {
            return firstCode.localeCompare(secondCode);
          }

          return normalizeTextValue(first.studentName).localeCompare(
            normalizeTextValue(second.studentName),
            "vi",
          );
        });

        setSectionRoster(sortedItems);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSectionRoster([]);
        setTabError(
          toErrorMessage(error, "Không thể tải danh sách lớp học phần đã chọn."),
        );
      } finally {
        if (!cancelled) {
          setIsSectionRosterLoading(false);
        }
      }
    };

    void loadSectionRoster();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    selectedAttendanceSectionId,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "attendance") {
      return;
    }

    const authorization = session?.authorization;
    const sessionId = parsePositiveInteger(selectedAttendanceSessionId);

    if (!authorization || !sessionId) {
      setAttendanceItems([]);
      setAttendanceDraftByRegistrationId({});
      return;
    }

    let cancelled = false;
    setIsAttendanceItemsLoading(true);

    const loadAttendanceRoster = async () => {
      try {
        const items = await getAttendanceRosterBySession(sessionId, authorization);

        if (cancelled) {
          return;
        }

        const sortedItems = sortAttendanceRosterItems(items);
        const nextDraft = buildAttendanceDraftByRegistrationId(sortedItems);

        setAttendanceItems(sortedItems);
        setAttendanceDraftByRegistrationId(nextDraft);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAttendanceItems([]);
        setAttendanceDraftByRegistrationId({});
        setTabError(
          toErrorMessage(error, "Không thể tải dữ liệu điểm danh của buổi học."),
        );
      } finally {
        if (!cancelled) {
          setIsAttendanceItemsLoading(false);
        }
      }
    };

    void loadAttendanceRoster();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    selectedAttendanceSessionId,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "schedule") {
      return;
    }

    const authorization = session?.authorization;
    const semesterId = parsePositiveInteger(selectedScheduleSemesterId);

    if (!authorization || !semesterId) {
      setScheduleRows([]);
      return;
    }

    let cancelled = false;
    setIsScheduleLoading(true);

    const loadScheduleBySemester = async () => {
      try {
        const rows = await getMyLecturerSchedule(semesterId, authorization);

        if (cancelled) {
          return;
        }

        setScheduleRows(rows);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setScheduleRows([]);
        setTabError(toErrorMessage(error, "Không thể tải lịch giảng dạy theo học kỳ đã chọn."));
      } finally {
        if (!cancelled) {
          setIsScheduleLoading(false);
        }
      }
    };

    void loadScheduleBySemester();

    return () => {
      cancelled = true;
    };
  }, [activeTabKey, selectedScheduleSemesterId, session?.authorization]);

  const handleShiftScheduleWeek = (direction: -1 | 1) => {
    const currentIndex = scheduleWeekSelectOptions.findIndex(
      (item) => item.key === selectedScheduleWeekStartKey,
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
    const nextWeekStart = addDays(parseIsoDateLocal(baseWeekStart), direction * 7);
    setSelectedScheduleWeekKey(toLocalIsoDate(nextWeekStart));
  };

  const handleGradeDraftScoreChange = (
    registrationId: number,
    componentId: number,
    value: string,
    fallbackStatus: GradeReportStatus,
  ) => {
    setGradeDraftByRegistrationId((current) => {
      const existing = current[registrationId];

      return {
        ...current,
        [registrationId]: {
          status: existing?.status || fallbackStatus,
          scoresByComponentId: {
            ...(existing?.scoresByComponentId || {}),
            [componentId]: value,
          },
        },
      };
    });
  };

  const handleGradeDraftStatusChange = (
    registrationId: number,
    status: GradeReportStatus,
  ) => {
    setGradeDraftByRegistrationId((current) => {
      const existing = current[registrationId];

      return {
        ...current,
        [registrationId]: {
          status,
          scoresByComponentId: {
            ...(existing?.scoresByComponentId || {}),
          },
        },
      };
    });
  };

  const handleSaveGradeEntryRoster = async () => {
    const authorization = session?.authorization;
    if (!authorization) {
      setTabError("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const changedRows = gradeEntryRowsWithDraft.filter((entry) => entry.hasChanges);
    if (changedRows.length === 0) {
      setTabError("Không có thay đổi điểm để lưu.");
      return;
    }

    const toScoreNumber = (value: string): number | null => {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }

      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        return null;
      }

      return parsed;
    };

    const invalidRows: string[] = [];

    const requests = changedRows.map((entry) => {
      const details = gradeEntryComponents
        .map((component) => {
          const rawScore =
            entry.mergedScoresByComponentId[component.componentId] || "";
          const score = toScoreNumber(rawScore);

          if (score === null) {
            return null;
          }

          if (score < 0 || score > 10) {
            return "__invalid_range__";
          }

          return {
            componentId: component.componentId,
            score,
          };
        });

      if (details.includes("__invalid_range__")) {
        invalidRows.push(
          `${entry.row.studentCode || "SV"} - điểm phải nằm trong khoảng 0 đến 10`,
        );
      }

      const normalizedDetails = details.filter(
        (detail): detail is { componentId: number; score: number } =>
          detail !== null && detail !== "__invalid_range__",
      );

      if (
        gradeEntryComponents.length > 0 &&
        normalizedDetails.length !== gradeEntryComponents.length
      ) {
        invalidRows.push(
          `${entry.row.studentCode || "SV"} - cần nhập đủ điểm cho tất cả thành phần`,
        );
      }

      return {
        entry,
        payload: {
          registrationId: entry.registrationId,
          status: entry.effectiveStatus,
          gradeDetails: normalizedDetails,
        },
      };
    });

    if (invalidRows.length > 0) {
      setTabError(invalidRows[0]);
      return;
    }

    try {
      setIsSavingGradeRoster(true);
      setTabError("");
      setTabMessage("");

      let createdCount = 0;
      let updatedCount = 0;

      await Promise.all(
        requests.map(async ({ entry, payload }) => {
          if (entry.row.gradeReportId && entry.row.gradeReportId > 0) {
            await updateGradeReport(entry.row.gradeReportId, payload, authorization);
            updatedCount += 1;
            return;
          }

          await createGradeReport(payload, authorization);
          createdCount += 1;
        }),
      );

      const sectionId = parsePositiveInteger(selectedGradeSectionId);
      if (sectionId) {
        const roster = await getGradeEntryRosterBySection(sectionId, authorization);
        let resolvedComponents = [...roster.components];

        if (resolvedComponents.length === 0) {
          const fallbackCourseId =
            roster.courseId ||
            lecturerSections.find((section) => section.id === sectionId)?.courseId;

          if (fallbackCourseId) {
            try {
              resolvedComponents = await getGradeComponentsByCourse(
                fallbackCourseId,
                authorization,
              );
            } catch {
              resolvedComponents = [];
            }
          }
        }

        setGradeEntryComponents(
          [...resolvedComponents].sort(
            (first, second) =>
              (first.weightPercentage ?? 0) - (second.weightPercentage ?? 0),
          ),
        );
        setGradeEntryRows(roster.rows);
        setGradeDraftByRegistrationId({});
      }

      setTabMessage(
        `Đã lưu nhập điểm: tạo mới ${createdCount}, cập nhật ${updatedCount}.`,
      );
    } catch (error) {
      setTabError(toErrorMessage(error, "Lưu nhập điểm thất bại."));
    } finally {
      setIsSavingGradeRoster(false);
    }
  };

  const handleSaveAttendanceBatch = async () => {
    const authorization = session?.authorization;
    const sessionId = parsePositiveInteger(selectedAttendanceSessionId);

    if (!authorization || !sessionId) {
      setTabError("Vui lòng chọn buổi học hợp lệ trước khi lưu điểm danh.");
      return;
    }

    const payloadItems: Array<{
      courseRegistrationId: number;
      status: AttendanceStatus;
      note: string;
    }> = [];
    let changedCount = 0;
    let missingStatusCount = 0;

    attendanceItems.forEach((item) => {
      const registrationId = item.courseRegistrationId;
      if (!registrationId || registrationId <= 0) {
        return;
      }

      const draft = attendanceDraftByRegistrationId[registrationId];
      const currentStatus = toEditableAttendanceStatus(item.attendanceStatus);
      const status = draft?.status || currentStatus;
      const note = normalizeTextValue(draft?.note ?? item.note ?? "");
      const currentNote = normalizeTextValue(item.note || "");

      const hasChanged = currentStatus !== status || currentNote !== note;

      if (!hasChanged) {
        return;
      }

      if (!status) {
        missingStatusCount += 1;
        return;
      }

      changedCount += 1;
      payloadItems.push({
        courseRegistrationId: registrationId,
        status,
        note,
      });
    });

    if (missingStatusCount > 0) {
      setTabError(
        `Có ${missingStatusCount} sinh viên chưa chọn trạng thái điểm danh cuối cùng. Vui lòng chọn trước khi lưu.`,
      );
      return;
    }

    if (payloadItems.length === 0) {
      setTabError("Không có dữ liệu điểm danh hợp lệ để lưu.");
      return;
    }

    if (changedCount === 0) {
      setTabError("Không có thay đổi điểm danh để lưu.");
      return;
    }

    try {
      setIsSavingAttendance(true);
      setTabError("");
      setTabMessage("");

      await saveAttendancesBySession(
        sessionId,
        { items: payloadItems },
        authorization,
      );

      const saved = await getAttendanceRosterBySession(sessionId, authorization);

      const sortedSaved = sortAttendanceRosterItems(saved);
      const nextDraft = buildAttendanceDraftByRegistrationId(sortedSaved);

      setAttendanceItems(sortedSaved);
      setAttendanceDraftByRegistrationId(nextDraft);
      setTabMessage(`Đã lưu điểm danh cho ${changedCount} sinh viên.`);
    } catch (error) {
      setTabError(toErrorMessage(error, "Lưu điểm danh thất bại."));
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleTabChange = (tab: LecturerFeatureTab) => {
    setActiveTabKey(tab.key);
    setTabError("");
    setTabMessage("");
  };

  const contentCardClass =
    "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

  const sectionTitleClass =
    "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

  const userInitial = (session?.username || "L").slice(0, 1).toUpperCase();

  return (
    <AuthGuard allowedRoles={["LECTURER"]}>
      <div className="min-h-screen bg-[#e9edf2]">
        <header className="flex h-[52px] items-center justify-between bg-[#0a6ca0] px-3 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/45 text-sm font-semibold">
              LC
            </div>
            <nav className="flex items-center gap-6 text-lg font-semibold">
              {lecturerTopHeaderTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="text-base transition hover:text-[#d7f0ff]"
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold">
              {userInitial}
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{session?.username || "-"}</p>
              <p className="text-xs opacity-90">Vai trò: {session?.role || "-"}</p>
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

        <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 lg:grid-cols-[275px_minmax(0,1fr)]">
          <aside className="border-r border-[#b9cfe0] bg-[#f2f5f8]">
            <div className="border-b border-[#c7d8e5] px-4 py-3 text-[17px] font-semibold text-[#1c587f]">
              Lecturer Menu
            </div>
            <nav className="px-2 py-2">
              {lecturerFeatureTabs.map((tab) => {
                const active = tab.key === activeTabKey;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab)}
                    className={`mb-1 flex w-full items-center justify-between rounded-[4px] px-3 py-2 text-left text-[17px] transition ${
                      active
                        ? "bg-[#d6e9f7] font-semibold text-[#0d517a]"
                        : "text-[#234d69] hover:bg-[#e5eef6]"
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="space-y-4 p-3 sm:p-4">
            <section className={contentCardClass}>
              <div className={sectionTitleClass}>
                <h1>{activeTab.label}</h1>
              </div>
              <div className="space-y-2 px-4 py-3 text-sm text-[#355970]">
                <p>{activeTab.description}</p>
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

            {activeTab.key === "schedule" ? (
            <section className={contentCardClass}>
              <div className="space-y-4 px-4 py-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#5f7e93]">
                    Học kỳ
                  </label>
                  <select
                    value={selectedScheduleSemesterId}
                    onChange={(event) => setSelectedScheduleSemesterId(event.target.value)}
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    disabled={isSectionCatalogLoading || scheduleSemesterOptions.length === 0}
                  >
                    {scheduleSemesterOptions.length === 0 ? (
                      <option value="">Chưa có học kỳ</option>
                    ) : null}
                    {scheduleSemesterOptions.map((semester, index) => (
                      <option
                        key={`schedule-semester-${semester.semesterId}-${index}`}
                        value={semester.semesterId}
                      >
                        {semester.displayName ||
                          `Học kỳ ${semester.semesterNumber || "?"} - ${semester.academicYear || `#${semester.semesterId}`}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Số lớp học phần</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {scheduleSummary.sectionCount}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Số ngày giảng dạy</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {scheduleSummary.teachingDayCount}
                    </p>
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#d4e2ec] bg-[#f6fbff] px-3 py-2 text-sm text-[#355970]">
                  <p>{`${selectedScheduleWeek.label} - ${selectedScheduleSemesterLabel}`}</p>
                </div>

                <div className="overflow-hidden rounded-[8px] border border-[#88aed4]">
                  <table className="w-full table-fixed border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#f3f7fb] text-[#2f4f67]">
                        <th className="w-[70px] min-w-[70px] border border-[#cfdbe7] px-2 py-2 text-center">
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
                            className="border border-[#cfdbe7] px-2 py-2 text-center"
                          >
                            <p className="font-semibold text-[#1f4562]">{dayLabel}</p>
                            <p className="mt-0.5 text-[#5a768b]">
                              ({formatDateShort(scheduleWeekDates[dayIndex])})
                            </p>
                          </th>
                        ))}
                        <th className="w-[72px] min-w-[72px] border border-[#cfdbe7] px-2 py-2 text-center">
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
                          <th className="w-[70px] min-w-[70px] border border-[#d4e0ea] bg-[#2f5f92] px-2 py-2 text-left text-sm font-semibold text-white">
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
                                      <p className="mt-1">Nhóm: {block.sectionCode || "-"}</p>
                                      <p>Phòng: {block.classroomName || "-"}</p>
                                      <p>{getPeriodClockRange(block.startPeriod, block.endPeriod)}</p>
                                    </button>
                                  ))}
                                </div>
                              </td>
                            );
                          })}

                          <td className="w-[72px] min-w-[72px] border border-[#d4e0ea] bg-[#2f5f92] px-2 py-2 text-center text-sm font-semibold text-white">
                            {periodStartTimeMap[period] || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr className="bg-[#f3f7fb] text-[#2f4f67]">
                        <th className="w-[70px] min-w-[70px] border border-[#cfdbe7] px-2 py-2 text-center">
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
                            {dayLabel} ({formatDateShort(scheduleWeekDates[dayIndex])})
                          </th>
                        ))}
                        <th className="w-[72px] min-w-[72px] border border-[#cfdbe7] px-2 py-2 text-center">
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

                {!isScheduleLoading && scheduleVisibleBlocks.length === 0 ? (
                  <p className="rounded-[8px] border border-[#d4e2ec] bg-[#f8fbff] px-3 py-3 text-sm text-[#5d7b91]">
                    Chưa có dữ liệu lịch giảng dạy phù hợp trong tuần đã chọn.
                  </p>
                ) : null}

                {selectedScheduleBlock ? (
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f9fcff] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#1a4f75]">
                        Chi tiết buổi dạy đã chọn
                      </h4>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getScheduleStatusClass(
                          selectedScheduleBlock.status,
                        )}`}
                      >
                        {selectedScheduleBlock.status || "Không rõ trạng thái"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Môn học</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {selectedScheduleBlock.courseName}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Lớp học phần</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {selectedScheduleBlock.sectionCode || "-"}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Phòng học</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {selectedScheduleBlock.classroomName || "-"}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Ngày học</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {formatDate(selectedScheduleBlock.sessionDate)}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Khung giờ</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {getPeriodClockRange(
                            selectedScheduleBlock.startPeriod,
                            selectedScheduleBlock.endPeriod,
                          )}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Giảng viên</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {selectedScheduleBlock.lecturerName || session?.username || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeTab.key === "grades" ? (
            <section className={contentCardClass}>
              <div className="border-b border-[#c5dced] px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#5f7e93]">Học kỳ</label>
                    <select
                      value={selectedGradeSemesterId}
                      onChange={(event) => setSelectedGradeSemesterId(event.target.value)}
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      disabled={isSectionCatalogLoading || scheduleSemesterOptions.length === 0}
                    >
                      {scheduleSemesterOptions.length === 0 ? (
                        <option value="">Chưa có học kỳ</option>
                      ) : null}
                      {scheduleSemesterOptions.map((semester, index) => (
                        <option
                          key={`grade-semester-${semester.semesterId}-${index}`}
                          value={semester.semesterId}
                        >
                          {semester.displayName ||
                            `Học kỳ ${semester.semesterNumber || "?"} - ${semester.academicYear || `#${semester.semesterId}`}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#5f7e93]">Lớp học phần</label>
                    <select
                      value={selectedGradeSectionId}
                      onChange={(event) => setSelectedGradeSectionId(event.target.value)}
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      disabled={isSectionCatalogLoading || gradeSectionsForSemester.length === 0}
                    >
                      {gradeSectionsForSemester.length === 0 ? (
                        <option value="">Chưa có lớp học phần trong học kỳ</option>
                      ) : null}
                      {gradeSectionsForSemester.map((section, index) => (
                        <option key={`grade-section-${section.id}-${index}`} value={section.id}>
                          {getSectionLabel(section)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    placeholder="Tìm sinh viên, mã SV, điểm chữ, điểm thành phần..."
                    value={gradeKeyword}
                    onChange={(event) => setGradeKeyword(event.target.value)}
                  />

                  <select
                    value={gradeStatusFilter}
                    onChange={(event) => setGradeStatusFilter(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  >
                    <option value="">Tất cả trạng thái</option>
                    {gradeStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {getGradeStatusLabel(status)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveGradeEntryRoster();
                    }}
                    disabled={
                      isSavingGradeRoster ||
                      isGradeRosterLoading ||
                      gradeEntryRowsWithDraft.length === 0
                    }
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    {isSavingGradeRoster ? "Đang lưu..." : "Lưu nhập điểm"}
                  </button>
                </div>

              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Tổng sinh viên</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {gradeSummary.total}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Chưa có báo cáo điểm</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {gradeSummary.noReportCount}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Nháp</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {gradeSummary.draftCount}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Đã công bố</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {gradeSummary.publishedCount}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Đã chốt</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {gradeSummary.lockedCount}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Dòng đã thay đổi</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {gradeSummary.changedCount}
                    </p>
                  </div>
                </div>

                {!isGradeRosterLoading &&
                gradeEntryRows.length > 0 &&
                gradeEntryComponents.length === 0 ? (
                  <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
                    Môn học phần này chưa có cấu hình thành phần điểm, nên chưa thể nhập điểm.
                  </p>
                ) : null}

                <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f7fbff]">
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-3 py-2">Mã SV</th>
                        <th className="px-3 py-2">Họ tên</th>
                        {gradeEntryComponents.length > 0 ? (
                          gradeEntryComponents.map((component) => (
                            <th
                              key={`grade-component-${component.componentId}`}
                              className="min-w-[170px] px-3 py-2"
                            >
                              <p>{component.componentName || `TP #${component.componentId}`}</p>
                              <p className="text-xs font-normal text-[#5f7e93]">
                                Trọng số: {component.weightPercentage ?? "-"}%
                              </p>
                            </th>
                          ))
                        ) : (
                          <th className="px-3 py-2">Thành phần điểm</th>
                        )}
                        <th className="px-3 py-2">Điểm tổng</th>
                        <th className="px-3 py-2">Điểm chữ</th>
                        <th className="px-3 py-2">Trạng thái</th>
                        <th className="px-3 py-2">Báo cáo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGradeEntryRows.map((entry) => {
                        const isLocked = entry.effectiveStatus === "LOCKED";

                        return (
                          <tr
                            key={`grade-entry-row-${entry.registrationId}`}
                            className="border-b border-[#e0ebf4] text-[#3f6178]"
                          >
                            <td className="px-3 py-2">{entry.row.studentCode || "-"}</td>
                            <td className="px-3 py-2">{entry.row.studentName || "-"}</td>
                            {gradeEntryComponents.length > 0 ? (
                              gradeEntryComponents.map((component) => (
                                <td
                                  key={`grade-entry-score-${entry.registrationId}-${component.componentId}`}
                                  className="px-3 py-2"
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    value={
                                      entry.mergedScoresByComponentId[component.componentId] || ""
                                    }
                                    onChange={(event) =>
                                      handleGradeDraftScoreChange(
                                        entry.registrationId,
                                        component.componentId,
                                        event.target.value,
                                        entry.effectiveStatus,
                                      )
                                    }
                                    disabled={isSavingGradeRoster || isGradeRosterLoading || isLocked}
                                    className="h-9 w-full rounded-[6px] border border-[#c8d3dd] px-2 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf] disabled:bg-[#f2f5f8]"
                                  />
                                </td>
                              ))
                            ) : (
                              <td className="px-3 py-2 text-[#5f7e93]">-
                              </td>
                            )}
                            <td className="px-3 py-2">{formatScore(entry.row.finalScore ?? undefined)}</td>
                            <td className="px-3 py-2">{entry.row.letterGrade || "-"}</td>
                            <td className="px-3 py-2">
                              <select
                                value={entry.effectiveStatus}
                                onChange={(event) =>
                                  handleGradeDraftStatusChange(
                                    entry.registrationId,
                                    event.target.value as GradeReportStatus,
                                  )
                                }
                                disabled={isSavingGradeRoster || isGradeRosterLoading || isLocked}
                                className="h-9 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf] disabled:bg-[#f2f5f8]"
                              >
                                {gradeStatusOptions.map((status) => (
                                  <option key={`${entry.registrationId}-${status}`} value={status}>
                                    {getGradeStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getGradeStatusClass(
                                    entry.effectiveStatus,
                                  )}`}
                                >
                                  {getGradeStatusLabel(entry.effectiveStatus)}
                                </span>
                                <span className="text-xs text-[#5f7e93]">
                                  {entry.row.gradeReportId
                                    ? `ID #${entry.row.gradeReportId}`
                                    : "Chưa tạo"}
                                </span>
                                {entry.hasChanges ? (
                                  <span className="rounded-full border border-[#6da8c9] bg-[#f4fbff] px-2 py-0.5 text-[11px] font-semibold text-[#0d6ea6]">
                                    Đã sửa
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!isGradeRosterLoading && filteredGradeEntryRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={(gradeEntryComponents.length || 1) + 6}
                            className="px-3 py-4 text-center text-[#577086]"
                          >
                            Chưa có dữ liệu nhập điểm phù hợp với bộ lọc.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  {isGradeRosterLoading ? (
                    <p className="px-3 py-3 text-sm text-[#5d7b91]">
                      Đang tải grade-entry roster của lớp học phần...
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab.key === "attendance" ? (
            <section className={contentCardClass}>
              <div className="border-b border-[#c5dced] px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#5f7e93]">Học kỳ</label>
                    <select
                      value={selectedAttendanceSemesterId}
                      onChange={(event) => setSelectedAttendanceSemesterId(event.target.value)}
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      disabled={isSectionCatalogLoading || scheduleSemesterOptions.length === 0}
                    >
                      {scheduleSemesterOptions.length === 0 ? (
                        <option value="">Chưa có học kỳ</option>
                      ) : null}
                      {scheduleSemesterOptions.map((semester, index) => (
                        <option
                          key={`attendance-semester-${semester.semesterId}-${index}`}
                          value={semester.semesterId}
                        >
                          {semester.displayName ||
                            `Học kỳ ${semester.semesterNumber || "?"} - ${semester.academicYear || `#${semester.semesterId}`}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#5f7e93]">Lớp học phần</label>
                    <select
                      value={selectedAttendanceSectionId}
                      onChange={(event) => setSelectedAttendanceSectionId(event.target.value)}
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      disabled={isAttendanceSessionLoading || attendanceSectionOptions.length === 0}
                    >
                      {attendanceSectionOptions.length === 0 ? (
                        <option value="">Chưa có lớp học phần trong học kỳ</option>
                      ) : null}
                      {attendanceSectionOptions.map((section, index) => (
                        <option
                          key={`attendance-section-${section.key}-${index}`}
                          value={section.key}
                        >
                          {section.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#5f7e93]">Buổi học</label>
                    <select
                      value={selectedAttendanceSessionId}
                      onChange={(event) => setSelectedAttendanceSessionId(event.target.value)}
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                      disabled={
                        isAttendanceSessionLoading || filteredAttendanceSessions.length === 0
                      }
                    >
                      {filteredAttendanceSessions.length === 0 ? (
                        <option value="">Chưa có buổi học phù hợp</option>
                      ) : null}
                      {filteredAttendanceSessions.map((sessionItem, index) => (
                        <option
                          key={`attendance-session-${sessionItem.id}-${index}`}
                          value={sessionItem.id}
                        >
                          {getSessionLabel(sessionItem)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    placeholder="Tìm theo mã SV, họ tên, trạng thái..."
                    value={attendanceKeyword}
                    onChange={(event) => setAttendanceKeyword(event.target.value)}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveAttendanceBatch();
                    }}
                    disabled={
                      isSavingAttendance ||
                      isAttendanceItemsLoading ||
                      attendanceItems.length === 0
                    }
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    {isSavingAttendance ? "Đang lưu..." : "Lưu điểm danh"}
                  </button>
                </div>

                {isSectionRosterLoading ? (
                  <p className="mt-1 text-xs text-[#5f7e93]">
                    Đang tải danh sách lớp học phần đã chọn...
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Roster lớp (active)</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {sectionRosterSummary.active}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Tổng sinh viên</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.total}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Chưa điểm danh</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.notMarked}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Có mặt</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.present}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Đi muộn</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.late}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Có phép</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.excused}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Vắng</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.absent}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f7fbff]">
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Mã SV</th>
                        <th className="px-2 py-2">Họ tên</th>
                        <th className="px-2 py-2">Trạng thái</th>
                        <th className="px-2 py-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendanceItems.map((item) => {
                        const registrationId = item.courseRegistrationId || 0;
                        const draft =
                          registrationId > 0
                            ? attendanceDraftByRegistrationId[registrationId]
                            : undefined;

                        const currentStatus =
                          draft?.status || toEditableAttendanceStatus(item.attendanceStatus);
                        const currentNote = draft?.note ?? item.note ?? "";
                        const noteEditableStatus =
                          currentStatus || toEditableAttendanceStatus(item.attendanceStatus);

                        return (
                          <tr
                            key={`${item.rosterId}-${item.sessionId || "session"}`}
                            className="border-b border-[#e0ebf4] text-[#3f6178]"
                          >
                            <td className="px-2 py-2">{item.studentCode || "-"}</td>
                            <td className="px-2 py-2">{item.studentName || "-"}</td>
                            <td className="px-2 py-2">
                              {registrationId > 0 ? (
                                <div className="space-y-1">
                                  <select
                                    value={currentStatus || ""}
                                    onChange={(event) => {
                                      const nextStatus = event.target.value;
                                      setAttendanceDraftByRegistrationId((current) => {
                                        const next = { ...current };

                                        if (!nextStatus) {
                                          delete next[registrationId];
                                          return next;
                                        }

                                        next[registrationId] = {
                                          status: nextStatus as AttendanceStatus,
                                          note: currentNote,
                                        };

                                        return next;
                                      });
                                    }}
                                    className="h-9 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                                  >
                                    <option value="">Chưa điểm danh</option>
                                    {attendanceStatusOptions.map((statusOption, index) => (
                                      <option
                                        key={`attendance-status-${statusOption}-${index}`}
                                        value={statusOption}
                                      >
                                        {getAttendanceStatusLabel(statusOption)}
                                      </option>
                                    ))}
                                  </select>
                                  {!item.attendanceId ? (
                                    <p className="text-xs text-[#5f7e93]">Chưa điểm danh</p>
                                  ) : null}
                                </div>
                              ) : (
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAttendanceStatusClass(
                                    item.attendanceStatus,
                                  )}`}
                                >
                                  {getAttendanceStatusLabel(item.attendanceStatus)}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {registrationId > 0 ? (
                                <input
                                  value={currentNote}
                                  onChange={(event) => {
                                    const nextNote = event.target.value;
                                    if (!noteEditableStatus) {
                                      return;
                                    }

                                    setAttendanceDraftByRegistrationId((current) => ({
                                      ...current,
                                      [registrationId]: {
                                        status: noteEditableStatus,
                                        note: nextNote,
                                      },
                                    }));
                                  }}
                                  placeholder={
                                    noteEditableStatus
                                      ? "Nhập ghi chú"
                                      : "Chọn trạng thái trước khi ghi chú"
                                  }
                                  disabled={!noteEditableStatus}
                                  className="h-9 w-full min-w-[220px] rounded-[6px] border border-[#c8d3dd] px-2 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                                />
                              ) : (
                                <span>{currentNote || "-"}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!isAttendanceItemsLoading && filteredAttendanceItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-[#577086]">
                            Chưa có dữ liệu điểm danh phù hợp.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>

                  {isAttendanceSessionLoading ? (
                    <p className="px-3 py-3 text-sm text-[#5d7b91]">
                      Đang tải danh sách buổi học...
                    </p>
                  ) : null}

                  {isAttendanceItemsLoading ? (
                    <p className="px-3 py-3 text-sm text-[#5d7b91]">
                      Đang tải dữ liệu điểm danh của buổi học đã chọn...
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
