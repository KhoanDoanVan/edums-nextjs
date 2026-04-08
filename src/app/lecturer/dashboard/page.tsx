"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  getAttendancesBySession,
  getCourseSections,
  getGradeReportById,
  getGradeReportsBySection,
  getMyLecturerSchedule,
  saveAttendancesBySession,
  updateAttendance,
} from "@/lib/lecturer/service";
import { lecturerFeatureTabs } from "@/lib/lecturer/tabs";
import type {
  AttendanceResponse,
  AttendanceStatus,
  ClassSessionResponse,
  CourseSectionResponse,
  GradeReportResponse,
  LecturerFeatureTab,
  LecturerScheduleRow,
} from "@/lib/lecturer/types";

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const normalizeTextValue = (value?: string): string => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const toLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateInput = (offsetDays = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toLocalIsoDate(date);
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

const parsePositiveInteger = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const toColumnLabel = (field: string): string => {
  const spaced = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  return spaced ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : field;
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
    case "OPEN":
    case "ONGOING":
      return "bg-[#eef8f1] text-[#1d7a46]";
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

const getAttendanceStatusLabel = (status?: AttendanceStatus): string => {
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
      return "-";
  }
};

const getAttendanceStatusClass = (status?: AttendanceStatus): string => {
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

  const sectionLabel = normalizeTextValue(session.sectionCode);
  const classroomLabel = normalizeTextValue(session.classroomName);

  const parts = [dateLabel, periodLabel, sectionLabel, classroomLabel].filter(
    (item) => item && item !== "-",
  );

  return parts.join(" | ");
};

const getRowSearchText = (row: LecturerScheduleRow): string => {
  return Object.values(row)
    .map((value) => toDisplayValue(value).toLowerCase())
    .join(" ");
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
        classroomName: getStringValueFromRow(row, ["classroomName", "roomName"]),
        sessionDate: getStringValueFromRow(row, ["sessionDate", "date", "lessonDate"]),
        startPeriod: getNumericValueFromRow(row, ["startPeriod", "fromPeriod"]),
        endPeriod: getNumericValueFromRow(row, ["endPeriod", "toPeriod"]),
        status:
          (getStringValueFromRow(row, ["status", "sessionStatus"]) as
            | "NORMAL"
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

  const [scheduleStartDate, setScheduleStartDate] = useState(formatDateInput(0));
  const [scheduleEndDate, setScheduleEndDate] = useState(formatDateInput(7));
  const [scheduleRows, setScheduleRows] = useState<LecturerScheduleRow[]>([]);
  const [scheduleKeyword, setScheduleKeyword] = useState("");
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  const [sectionCatalog, setSectionCatalog] = useState<CourseSectionResponse[]>([]);
  const [isSectionCatalogLoading, setIsSectionCatalogLoading] = useState(false);

  const [selectedGradeSectionId, setSelectedGradeSectionId] = useState("");
  const [gradeReports, setGradeReports] = useState<GradeReportResponse[]>([]);
  const [gradeKeyword, setGradeKeyword] = useState("");
  const [gradeStatusFilter, setGradeStatusFilter] = useState("");
  const [selectedGradeReportId, setSelectedGradeReportId] = useState<number | null>(
    null,
  );
  const [gradeReportDetailsById, setGradeReportDetailsById] = useState<
    Record<number, GradeReportResponse | null>
  >({});
  const [loadingGradeReportId, setLoadingGradeReportId] = useState<number | null>(
    null,
  );
  const [isGradeLoading, setIsGradeLoading] = useState(false);

  const [attendanceStartDate, setAttendanceStartDate] = useState(
    formatDateInput(-3),
  );
  const [attendanceEndDate, setAttendanceEndDate] = useState(formatDateInput(7));
  const [attendanceSessions, setAttendanceSessions] = useState<ClassSessionResponse[]>(
    [],
  );
  const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] =
    useState("");
  const [attendanceItems, setAttendanceItems] = useState<AttendanceResponse[]>([]);
  const [attendanceKeyword, setAttendanceKeyword] = useState("");
  const [isAttendanceSessionLoading, setIsAttendanceSessionLoading] =
    useState(false);
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

  const lecturerSections = useMemo(() => {
    const lecturerId = session?.accountId;
    if (!lecturerId) {
      return sectionCatalog;
    }

    const ownedSections = sectionCatalog.filter(
      (section) => section.lecturerId === lecturerId,
    );

    return ownedSections.length > 0 ? ownedSections : sectionCatalog;
  }, [sectionCatalog, session?.accountId]);

  const isLecturerSectionScopeMatched = useMemo(() => {
    const lecturerId = session?.accountId;
    if (!lecturerId) {
      return false;
    }

    return sectionCatalog.some((section) => section.lecturerId === lecturerId);
  }, [sectionCatalog, session?.accountId]);

  const scheduleColumns = useMemo(() => {
    const keys = new Set<string>();

    for (const row of scheduleRows.slice(0, 120)) {
      for (const key of Object.keys(row)) {
        keys.add(key);
      }
    }

    const preferredOrder = [
      "sessionDate",
      "dayOfWeekName",
      "courseCode",
      "courseName",
      "sectionCode",
      "classroomName",
      "startPeriod",
      "endPeriod",
      "lecturerName",
      "status",
    ];

    const preferred = preferredOrder.filter((key) => keys.has(key));
    const remaining = [...keys].filter((key) => !preferred.includes(key));

    return [...preferred, ...remaining];
  }, [scheduleRows]);

  const filteredScheduleRows = useMemo(() => {
    const keyword = normalizeTextValue(scheduleKeyword).toLowerCase();
    if (!keyword) {
      return scheduleRows;
    }

    return scheduleRows.filter((row) => getRowSearchText(row).includes(keyword));
  }, [scheduleKeyword, scheduleRows]);

  const scheduleSummary = useMemo(() => {
    const total = filteredScheduleRows.length;
    const sectionSet = new Set<string>();
    const dateSet = new Set<string>();

    filteredScheduleRows.forEach((row) => {
      const sectionValue = getScheduleValue(row, ["sectionCode", "sectionName"]);
      if (sectionValue !== "-") {
        sectionSet.add(sectionValue);
      }

      const dateValue = getScheduleValue(row, ["sessionDate", "date", "lessonDate"]);
      if (dateValue !== "-") {
        dateSet.add(dateValue);
      }
    });

    return {
      total,
      sectionCount: sectionSet.size,
      teachingDayCount: dateSet.size,
    };
  }, [filteredScheduleRows]);

  const filteredGradeReports = useMemo(() => {
    const keyword = normalizeTextValue(gradeKeyword).toLowerCase();

    return gradeReports.filter((report) => {
      const statusMatched = !gradeStatusFilter || report.status === gradeStatusFilter;
      if (!statusMatched) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const text = [
        report.studentCode,
        report.studentName,
        report.courseName,
        report.letterGrade,
        report.status,
        String(report.finalScore ?? ""),
      ]
        .map((value) => normalizeTextValue(value).toLowerCase())
        .join(" ");

      return text.includes(keyword);
    });
  }, [gradeKeyword, gradeReports, gradeStatusFilter]);

  const selectedGradeReport = useMemo(() => {
    if (!selectedGradeReportId) {
      return null;
    }

    return (
      gradeReportDetailsById[selectedGradeReportId] ||
      gradeReports.find((report) => report.id === selectedGradeReportId) ||
      null
    );
  }, [gradeReportDetailsById, gradeReports, selectedGradeReportId]);

  const isSelectedGradeReportLoading =
    selectedGradeReportId !== null && loadingGradeReportId === selectedGradeReportId;

  const filteredAttendanceItems = useMemo(() => {
    const keyword = normalizeTextValue(attendanceKeyword).toLowerCase();
    if (!keyword) {
      return attendanceItems;
    }

    return attendanceItems.filter((item) => {
      const text = [
        item.studentCode,
        item.studentName,
        getAttendanceStatusLabel(item.status),
        item.note,
        formatDate(item.sessionDate),
      ]
        .map((value) => normalizeTextValue(value).toLowerCase())
        .join(" ");

      return text.includes(keyword);
    });
  }, [attendanceItems, attendanceKeyword]);

  const attendanceSummary = useMemo(() => {
    const summary = {
      total: attendanceItems.length,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    };

    attendanceItems.forEach((item) => {
      if (item.status === "PRESENT") {
        summary.present += 1;
      } else if (item.status === "LATE") {
        summary.late += 1;
      } else if (item.status === "EXCUSED") {
        summary.excused += 1;
      } else if (item.status === "ABSENT") {
        summary.absent += 1;
      }
    });

    return summary;
  }, [attendanceItems]);

  const attendanceDateRangeInvalid =
    attendanceStartDate &&
    attendanceEndDate &&
    attendanceStartDate > attendanceEndDate;

  useEffect(() => {
    const authorization = session?.authorization;

    if (!authorization) {
      setSectionCatalog([]);
      return;
    }

    let cancelled = false;
    setIsSectionCatalogLoading(true);

    const loadSectionCatalog = async () => {
      try {
        const sections = await getCourseSections(authorization);

        if (cancelled) {
          return;
        }

        setSectionCatalog(sections);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSectionCatalog([]);
        setTabError(
          toErrorMessage(error, "Không thể tải danh sách lớp học phần giảng viên."),
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
      const stillValid = lecturerSections.some(
        (section) => String(section.id) === selectedGradeSectionId,
      );
      if (stillValid) {
        return;
      }
    }

    setSelectedGradeSectionId(
      lecturerSections.length > 0 ? String(lecturerSections[0].id) : "",
    );
  }, [lecturerSections, selectedGradeSectionId]);

  useEffect(() => {
    if (activeTabKey !== "grades") {
      return;
    }

    const authorization = session?.authorization;
    const sectionId = parsePositiveInteger(selectedGradeSectionId);

    if (!authorization || !sectionId) {
      setGradeReports([]);
      setSelectedGradeReportId(null);
      return;
    }

    let cancelled = false;
    setIsGradeLoading(true);

    const loadGradeReports = async () => {
      try {
        const reports = await getGradeReportsBySection(sectionId, authorization);

        if (cancelled) {
          return;
        }

        setGradeReports(reports);
        setSelectedGradeReportId(reports.length > 0 ? reports[0].id : null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setGradeReports([]);
        setSelectedGradeReportId(null);
        setTabError(
          toErrorMessage(error, "Không thể tải bảng điểm theo lớp học phần đã chọn."),
        );
      } finally {
        if (!cancelled) {
          setIsGradeLoading(false);
        }
      }
    };

    void loadGradeReports();

    return () => {
      cancelled = true;
    };
  }, [activeTabKey, selectedGradeSectionId, session?.authorization]);

  useEffect(() => {
    if (activeTabKey !== "grades" || !selectedGradeReportId) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        gradeReportDetailsById,
        selectedGradeReportId,
      )
    ) {
      return;
    }

    const authorization = session?.authorization;
    if (!authorization) {
      return;
    }

    let cancelled = false;
    setLoadingGradeReportId(selectedGradeReportId);

    const loadGradeReportDetail = async () => {
      try {
        const detail = await getGradeReportById(selectedGradeReportId, authorization);

        if (cancelled) {
          return;
        }

        setGradeReportDetailsById((current) => ({
          ...current,
          [selectedGradeReportId]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setGradeReportDetailsById((current) => ({
          ...current,
          [selectedGradeReportId]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingGradeReportId((current) =>
            current === selectedGradeReportId ? null : current,
          );
        }
      }
    };

    void loadGradeReportDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    gradeReportDetailsById,
    selectedGradeReportId,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "attendance") {
      return;
    }

    const authorization = session?.authorization;

    if (!authorization) {
      setAttendanceSessions([]);
      setSelectedAttendanceSessionId("");
      return;
    }

    if (!attendanceStartDate || !attendanceEndDate || attendanceDateRangeInvalid) {
      setAttendanceSessions([]);
      setSelectedAttendanceSessionId("");
      return;
    }

    let cancelled = false;
    setIsAttendanceSessionLoading(true);

    const loadSessionsByDateRange = async () => {
      try {
        const rows = await getMyLecturerSchedule(
          attendanceStartDate,
          attendanceEndDate,
          authorization,
        );

        if (cancelled) {
          return;
        }

        const mappedSessions = toAttendanceSessionsFromSchedule(rows);

        setAttendanceSessions(mappedSessions);
        setSelectedAttendanceSessionId((current) => {
          if (current && mappedSessions.some((sessionItem) => String(sessionItem.id) === current)) {
            return current;
          }
          return mappedSessions.length > 0 ? String(mappedSessions[0].id) : "";
        });
        setAttendanceItems([]);
        setAttendanceDraftByRegistrationId({});
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAttendanceSessions([]);
        setSelectedAttendanceSessionId("");
        setAttendanceItems([]);
        setAttendanceDraftByRegistrationId({});
        setTabError(
          toErrorMessage(error, "Không thể tải danh sách buổi dạy theo khoảng ngày đã chọn."),
        );
      } finally {
        if (!cancelled) {
          setIsAttendanceSessionLoading(false);
        }
      }
    };

    void loadSessionsByDateRange();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    attendanceEndDate,
    attendanceDateRangeInvalid,
    attendanceStartDate,
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

    const loadAttendancesBySession = async () => {
      try {
        const items = await getAttendancesBySession(sessionId, authorization);

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

        const nextDraft: Record<number, { status: AttendanceStatus; note: string }> = {};

        sortedItems.forEach((item) => {
          if (!item.courseRegistrationId || item.courseRegistrationId <= 0) {
            return;
          }

          nextDraft[item.courseRegistrationId] = {
            status: item.status || "PRESENT",
            note: item.note || "",
          };
        });

        if (sortedItems.length > 0) {
          setAttendanceItems(sortedItems);
          setAttendanceDraftByRegistrationId(nextDraft);
          return;
        }

        const selectedSession = attendanceSessions.find(
          (sessionItem) => sessionItem.id === sessionId,
        );
        const sectionId = selectedSession?.sectionId;

        if (!sectionId || sectionId <= 0) {
          setAttendanceItems([]);
          setAttendanceDraftByRegistrationId({});
          setTabMessage(
            "Buổi học chưa có điểm danh và chưa xác định được lớp để dựng danh sách chấm lần đầu.",
          );
          return;
        }

        const fallbackReports = await getGradeReportsBySection(sectionId, authorization);
        if (cancelled) {
          return;
        }

        const fallbackItems = fallbackReports
          .map((report, index) => {
            const registrationId = report.registrationId;
            if (!registrationId || registrationId <= 0) {
              return null;
            }

            return {
              id: -(registrationId + index + 1),
              sessionId,
              sessionDate: selectedSession?.sessionDate,
              courseRegistrationId: registrationId,
              studentId: report.studentId,
              studentName: report.studentName,
              studentCode: report.studentCode,
              status: "PRESENT" as AttendanceStatus,
              note: "",
            } as AttendanceResponse;
          })
          .filter((item): item is AttendanceResponse => item !== null)
          .sort((first, second) => {
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

        const fallbackDraft: Record<number, { status: AttendanceStatus; note: string }> = {};
        fallbackItems.forEach((item) => {
          if (!item.courseRegistrationId || item.courseRegistrationId <= 0) {
            return;
          }

          fallbackDraft[item.courseRegistrationId] = {
            status: "PRESENT",
            note: "",
          };
        });

        setAttendanceItems(fallbackItems);
        setAttendanceDraftByRegistrationId(fallbackDraft);
        setTabMessage(
          fallbackItems.length > 0
            ? "Buổi này chưa có dữ liệu điểm danh, hệ thống đã dựng sẵn danh sách để chấm lần đầu."
            : "Buổi này chưa có dữ liệu điểm danh và chưa có danh sách đăng ký hợp lệ để chấm lần đầu.",
        );
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

    void loadAttendancesBySession();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    attendanceSessions,
    selectedAttendanceSessionId,
    session?.authorization,
  ]);

  const handleLoadSchedule = async () => {
    const authorization = session?.authorization;

    if (!authorization) {
      setTabError("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    if (!scheduleStartDate || !scheduleEndDate) {
      setTabError("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
      return;
    }

    if (scheduleStartDate > scheduleEndDate) {
      setTabError("Khoảng ngày không hợp lệ: ngày bắt đầu lớn hơn ngày kết thúc.");
      return;
    }

    try {
      setIsScheduleLoading(true);
      setTabError("");
      setTabMessage("");

      const rows = await getMyLecturerSchedule(
        scheduleStartDate,
        scheduleEndDate,
        authorization,
      );

      setScheduleRows(rows);
      setTabMessage(`Đã tải ${rows.length} bản ghi lịch giảng dạy.`);
    } catch (error) {
      setTabError(toErrorMessage(error, "Tải lịch giảng dạy thất bại."));
    } finally {
      setIsScheduleLoading(false);
    }
  };

  const handleRefreshSelectedGradeDetail = async () => {
    const authorization = session?.authorization;

    if (!authorization || !selectedGradeReportId) {
      return;
    }

    setLoadingGradeReportId(selectedGradeReportId);
    setTabError("");

    try {
      const detail = await getGradeReportById(selectedGradeReportId, authorization);
      setGradeReportDetailsById((current) => ({
        ...current,
        [selectedGradeReportId]: detail,
      }));
      setTabMessage("Đã làm mới chi tiết bảng điểm.");
    } catch (error) {
      setGradeReportDetailsById((current) => ({
        ...current,
        [selectedGradeReportId]: null,
      }));
      setTabError(toErrorMessage(error, "Không thể tải chi tiết bảng điểm."));
    } finally {
      setLoadingGradeReportId((current) =>
        current === selectedGradeReportId ? null : current,
      );
    }
  };

  const handleSaveAttendanceBatch = async () => {
    const authorization = session?.authorization;
    const sessionId = parsePositiveInteger(selectedAttendanceSessionId);

    if (!authorization || !sessionId) {
      setTabError("Vui lòng chọn buổi học hợp lệ trước khi lưu điểm danh.");
      return;
    }

    const creationPayload: Array<{
      courseRegistrationId: number;
      status: AttendanceStatus;
      note: string;
    }> = [];
    const updatePayload: Array<{
      attendanceId: number;
      status: AttendanceStatus;
      note: string;
    }> = [];

    attendanceItems.forEach((item) => {
      const registrationId = item.courseRegistrationId;
      if (!registrationId || registrationId <= 0) {
        return;
      }

      const draft = attendanceDraftByRegistrationId[registrationId];
      const status = draft?.status || item.status || "PRESENT";
      const note = normalizeTextValue(draft?.note ?? item.note ?? "");
      const attendanceId = typeof item.id === "number" ? item.id : Number(item.id || 0);

      if (Number.isInteger(attendanceId) && attendanceId > 0) {
        const currentStatus = item.status || "PRESENT";
        const currentNote = normalizeTextValue(item.note || "");
        const hasChanged = currentStatus !== status || currentNote !== note;

        if (!hasChanged) {
          return;
        }

        updatePayload.push({
          attendanceId,
          status,
          note,
        });
        return;
      }

      creationPayload.push({
        courseRegistrationId: registrationId,
        status,
        note,
      });
    });

    if (creationPayload.length === 0 && updatePayload.length === 0) {
      setTabError("Không có thay đổi điểm danh để lưu.");
      return;
    }

    try {
      setIsSavingAttendance(true);
      setTabError("");

      if (creationPayload.length > 0) {
        await saveAttendancesBySession(
          sessionId,
          { items: creationPayload },
          authorization,
        );
      }

      if (updatePayload.length > 0) {
        await Promise.all(
          updatePayload.map((payload) =>
            updateAttendance(
              payload.attendanceId,
              {
                status: payload.status,
                note: payload.note,
              },
              authorization,
            ),
          ),
        );
      }

      const saved = await getAttendancesBySession(sessionId, authorization);

      const nextDraft: Record<number, { status: AttendanceStatus; note: string }> =
        {};

      saved.forEach((item) => {
        if (!item.courseRegistrationId || item.courseRegistrationId <= 0) {
          return;
        }

        nextDraft[item.courseRegistrationId] = {
          status: item.status || "PRESENT",
          note: item.note || "",
        };
      });

      setAttendanceItems(saved);
      setAttendanceDraftByRegistrationId(nextDraft);
      setTabMessage(
        `Đã lưu điểm danh: tạo mới ${creationPayload.length}, cập nhật ${updatePayload.length}.`,
      );
    } catch (error) {
      setTabError(toErrorMessage(error, "Lưu điểm danh thất bại."));
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const contentCardClass =
    "rounded-[10px] border border-[#6da8c9] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

  return (
    <AuthGuard allowedRoles={["LECTURER"]}>
      <main className="min-h-screen bg-[#edf3f8] px-4 py-6">
        <div className="mx-auto w-full max-w-[1260px] space-y-4">
          <section className={contentCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c5dced] px-4 py-3">
              <div>
                <h1 className="text-[22px] font-semibold text-[#1a4f75]">
                  Dashboard giảng viên
                </h1>
                <p className="mt-1 text-sm text-[#4f6d82]">
                  Quản lý lịch giảng dạy, bảng điểm và điểm danh theo đúng nghiệp vụ
                  giảng viên.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link
                  href="/login"
                  className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-2 font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                >
                  Về đăng nhập
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-[6px] bg-[#0d6ea6] px-3 py-2 font-semibold text-white transition hover:bg-[#085d90]"
                >
                  Đăng xuất
                </button>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {lecturerFeatureTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTabKey(tab.key);
                      setTabError("");
                      setTabMessage("");
                    }}
                    className={`rounded-[8px] border px-3 py-2 text-sm font-semibold transition ${
                      activeTabKey === tab.key
                        ? "border-[#0d6ea6] bg-[#0d6ea6] text-white"
                        : "border-[#9ec3dd] bg-white text-[#245977] hover:bg-[#edf6fd]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-[#5e7a8f]">{activeTab.description}</p>
            </div>

            {(tabError || tabMessage) && (
              <div className="space-y-2 px-4 pb-3 text-sm">
                {tabError ? (
                  <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                    {tabError}
                  </p>
                ) : null}
                {tabMessage && !shouldHideFeedbackMessage(tabMessage) ? (
                  <p className="rounded-[6px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                    {tabMessage}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {activeTab.key === "schedule" ? (
            <section className={contentCardClass}>
              <div className="border-b border-[#c5dced] px-4 py-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#5f7e93]">
                      Từ ngày
                    </label>
                    <input
                      type="date"
                      value={scheduleStartDate}
                      onChange={(event) => setScheduleStartDate(event.target.value)}
                      className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#5f7e93]">
                      Đến ngày
                    </label>
                    <input
                      type="date"
                      value={scheduleEndDate}
                      onChange={(event) => setScheduleEndDate(event.target.value)}
                      className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLoadSchedule();
                    }}
                    disabled={isScheduleLoading}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    {isScheduleLoading ? "Đang tải..." : "Tải lịch dạy"}
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Số ca trong bộ lọc</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {scheduleSummary.total}
                    </p>
                  </div>
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

                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  placeholder="Tìm theo môn học, lớp học phần, phòng, trạng thái..."
                  value={scheduleKeyword}
                  onChange={(event) => setScheduleKeyword(event.target.value)}
                />

                <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f7fbff]">
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        {scheduleColumns.map((column) => (
                          <th key={column} className="px-2 py-2">
                            {toColumnLabel(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScheduleRows.map((row, rowIndex) => (
                        <tr
                          key={`schedule-row-${rowIndex + 1}`}
                          className="border-b border-[#e0ebf4] text-[#3f6178]"
                        >
                          {scheduleColumns.map((column) => {
                            const value = row[column];
                            const display = toDisplayValue(value);
                            const statusLikeColumn =
                              column.toLowerCase().includes("status") && display !== "-";

                            return (
                              <td
                                key={`${rowIndex + 1}-${column}`}
                                className="max-w-[260px] px-2 py-2"
                              >
                                {statusLikeColumn ? (
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getScheduleStatusClass(
                                      display,
                                    )}`}
                                  >
                                    {display}
                                  </span>
                                ) : (
                                  <span className="line-clamp-2">{display}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {filteredScheduleRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={Math.max(scheduleColumns.length, 1)}
                            className="px-2 py-4 text-center text-[#577086]"
                          >
                            Chưa có dữ liệu lịch giảng dạy phù hợp.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab.key === "grades" ? (
            <section className={contentCardClass}>
              <div className="border-b border-[#c5dced] px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
                  <select
                    value={selectedGradeSectionId}
                    onChange={(event) => setSelectedGradeSectionId(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    disabled={isSectionCatalogLoading || lecturerSections.length === 0}
                  >
                    {lecturerSections.length === 0 ? (
                      <option value="">Chưa có lớp học phần</option>
                    ) : null}
                    {lecturerSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {getSectionLabel(section)}
                      </option>
                    ))}
                  </select>

                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    placeholder="Tìm sinh viên, mã SV, điểm chữ..."
                    value={gradeKeyword}
                    onChange={(event) => setGradeKeyword(event.target.value)}
                  />

                  <select
                    value={gradeStatusFilter}
                    onChange={(event) => setGradeStatusFilter(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="PUBLISHED">Đã công bố</option>
                    <option value="LOCKED">Đã chốt</option>
                    <option value="DRAFT">Nháp</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setGradeKeyword("");
                      setGradeStatusFilter("");
                    }}
                    className="h-10 rounded-[6px] border border-[#6da8c9] bg-white px-3 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff]"
                  >
                    Xóa lọc
                  </button>
                </div>

                {!isLecturerSectionScopeMatched && lecturerSections.length > 0 ? (
                  <p className="mt-2 text-xs text-[#5f7e93]">
                    Hệ thống chưa map chính xác lớp theo `lecturerId` của tài khoản hiện tại,
                    đang hiển thị tất cả lớp có thể truy cập.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f7fbff]">
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Mã SV</th>
                        <th className="px-2 py-2">Họ tên</th>
                        <th className="px-2 py-2">Điểm tổng</th>
                        <th className="px-2 py-2">Điểm chữ</th>
                        <th className="px-2 py-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGradeReports.map((report) => (
                        <tr
                          key={report.id}
                          className={`cursor-pointer border-b border-[#e0ebf4] text-[#3f6178] transition ${
                            selectedGradeReportId === report.id
                              ? "bg-[#eaf5fd]"
                              : "hover:bg-[#f8fbff]"
                          }`}
                          onClick={() => setSelectedGradeReportId(report.id)}
                        >
                          <td className="px-2 py-2">{report.studentCode || "-"}</td>
                          <td className="px-2 py-2">{report.studentName || "-"}</td>
                          <td className="px-2 py-2">{formatScore(report.finalScore)}</td>
                          <td className="px-2 py-2">{report.letterGrade || "-"}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getGradeStatusClass(
                                report.status,
                              )}`}
                            >
                              {getGradeStatusLabel(report.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!isGradeLoading && filteredGradeReports.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-2 py-4 text-center text-[#577086]">
                            Chưa có dữ liệu bảng điểm phù hợp.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  {isGradeLoading ? (
                    <p className="px-3 py-3 text-sm text-[#5d7b91]">
                      Đang tải bảng điểm theo lớp học phần...
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f9fcff] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[#1a4f75]">
                      Chi tiết bảng điểm
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        void handleRefreshSelectedGradeDetail();
                      }}
                      disabled={!selectedGradeReportId || isSelectedGradeReportLoading}
                      className="rounded-[6px] border border-[#6da8c9] bg-white px-2.5 py-1 text-xs font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff] disabled:opacity-60"
                    >
                      {isSelectedGradeReportLoading
                        ? "Đang tải..."
                        : "Làm mới chi tiết"}
                    </button>
                  </div>

                  {!selectedGradeReport ? (
                    <p className="mt-3 text-sm text-[#5d7b91]">
                      Chọn một sinh viên bên trái để xem chi tiết điểm thành phần.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Mã SV</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {selectedGradeReport.studentCode || "-"}
                          </p>
                        </div>
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Họ tên</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {selectedGradeReport.studentName || "-"}
                          </p>
                        </div>
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Điểm tổng</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {formatScore(selectedGradeReport.finalScore)}
                          </p>
                        </div>
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Điểm chữ</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {selectedGradeReport.letterGrade || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-[8px] border border-[#dbe7f1]">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-white">
                            <tr className="border-b border-[#e0ebf4] text-[#335a72]">
                              <th className="px-2 py-2">Thành phần</th>
                              <th className="px-2 py-2">Trọng số (%)</th>
                              <th className="px-2 py-2">Điểm</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedGradeReport.gradeDetails || []).map((detail) => (
                              <tr key={detail.id || `${detail.componentId}-${detail.componentName}`} className="border-b border-[#eef4f8] text-[#3f6178]">
                                <td className="px-2 py-2">{detail.componentName || "-"}</td>
                                <td className="px-2 py-2">
                                  {typeof detail.weightPercentage === "number"
                                    ? detail.weightPercentage
                                    : "-"}
                                </td>
                                <td className="px-2 py-2">{formatScore(detail.score)}</td>
                              </tr>
                            ))}
                            {(selectedGradeReport.gradeDetails || []).length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-2 py-3 text-center text-[#5d7b91]">
                                  Chưa có chi tiết điểm thành phần.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>

                      <p className="text-xs text-[#5f7e93]">
                        Cập nhật lần tạo: {formatDateTime(selectedGradeReport.createdAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab.key === "attendance" ? (
            <section className={contentCardClass}>
              <div className="border-b border-[#c5dced] px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[200px_200px_auto]">
                  <input
                    type="date"
                    value={attendanceStartDate}
                    onChange={(event) => setAttendanceStartDate(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  />
                  <input
                    type="date"
                    value={attendanceEndDate}
                    onChange={(event) => setAttendanceEndDate(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  />
                  <div className="text-xs text-[#5f7e93] lg:place-self-center">
                    Chọn khoảng ngày để hệ thống tự lấy các buổi dạy từ lịch cá nhân.
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <select
                    value={selectedAttendanceSessionId}
                    onChange={(event) => setSelectedAttendanceSessionId(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    disabled={isAttendanceSessionLoading || attendanceSessions.length === 0}
                  >
                    {attendanceSessions.length === 0 ? (
                      <option value="">Chưa có buổi học trong khoảng ngày đã chọn</option>
                    ) : null}
                    {attendanceSessions.map((sessionItem) => (
                      <option key={sessionItem.id} value={sessionItem.id}>
                        {getSessionLabel(sessionItem)}
                      </option>
                    ))}
                  </select>

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
                {attendanceDateRangeInvalid ? (
                  <p className="mt-3 rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
                    Khoảng ngày không hợp lệ: ngày bắt đầu lớn hơn ngày kết thúc.
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Tổng sinh viên</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.total}
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

                        const currentStatus = draft?.status || item.status || "PRESENT";
                        const currentNote = draft?.note ?? item.note ?? "";

                        return (
                          <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                            <td className="px-2 py-2">{item.studentCode || "-"}</td>
                            <td className="px-2 py-2">{item.studentName || "-"}</td>
                            <td className="px-2 py-2">
                              {registrationId > 0 ? (
                                <select
                                  value={currentStatus}
                                  onChange={(event) => {
                                    const nextStatus = event.target
                                      .value as AttendanceStatus;
                                    setAttendanceDraftByRegistrationId((current) => ({
                                      ...current,
                                      [registrationId]: {
                                        status: nextStatus,
                                        note: currentNote,
                                      },
                                    }));
                                  }}
                                  className="h-9 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                                >
                                  {attendanceStatusOptions.map((statusOption) => (
                                    <option key={statusOption} value={statusOption}>
                                      {getAttendanceStatusLabel(statusOption)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAttendanceStatusClass(
                                    item.status,
                                  )}`}
                                >
                                  {getAttendanceStatusLabel(item.status)}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {registrationId > 0 ? (
                                <input
                                  value={currentNote}
                                  onChange={(event) => {
                                    const nextNote = event.target.value;
                                    setAttendanceDraftByRegistrationId((current) => ({
                                      ...current,
                                      [registrationId]: {
                                        status: currentStatus,
                                        note: nextNote,
                                      },
                                    }));
                                  }}
                                  placeholder="Nhập ghi chú"
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
        </div>
      </main>
    </AuthGuard>
  );
}
