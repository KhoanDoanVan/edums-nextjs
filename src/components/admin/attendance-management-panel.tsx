"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteAttendance,
  getAttendancesBySession,
  getCourseSections,
  getDynamicListByPath,
  updateAttendance,
} from "@/lib/admin/service";
import { toErrorMessage } from "@/components/admin/format-utils";
import type {
  AttendanceItem,
  AttendanceStatus,
  CourseSectionListItem,
  DynamicRow,
} from "@/lib/admin/types";

type RecurringScheduleOption = {
  id: number;
  sectionId?: number;
  dayOfWeek?: number;
  dayOfWeekName?: string;
  startPeriod?: number;
  endPeriod?: number;
  classroomName?: string;
};

type ClassSessionOption = {
  id: number;
  sessionDate?: string;
  startPeriod?: number;
  endPeriod?: number;
  status?: string;
  classroomName?: string;
};

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

const attendanceStatusOptions: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return undefined;
};

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  return undefined;
};

const parsePositiveInteger = (rawValue: string): number | null => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const normalizeTextValue = (value?: string): string => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeAttendanceStatus = (status?: string): AttendanceStatus => {
  const normalized = String(status || "").toUpperCase();
  if (attendanceStatusOptions.includes(normalized as AttendanceStatus)) {
    return normalized as AttendanceStatus;
  }
  return "PRESENT";
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

const toRecurringScheduleOptions = (rows: DynamicRow[]): RecurringScheduleOption[] => {
  return rows
    .map((row) => ({
      id: toNumber(row.id) || 0,
      sectionId: toNumber(row.sectionId),
      dayOfWeek: toNumber(row.dayOfWeek),
      dayOfWeekName: toText(row.dayOfWeekName),
      startPeriod: toNumber(row.startPeriod),
      endPeriod: toNumber(row.endPeriod),
      classroomName: toText(row.classroomName),
    }))
    .filter((item) => item.id > 0)
    .sort((a, b) => {
      const weekdayCompare = (a.dayOfWeek || 0) - (b.dayOfWeek || 0);
      if (weekdayCompare !== 0) {
        return weekdayCompare;
      }

      return (a.startPeriod || 0) - (b.startPeriod || 0);
    });
};

const toSessionOptions = (rows: DynamicRow[]): ClassSessionOption[] => {
  return rows
    .map((row) => ({
      id: toNumber(row.id) || 0,
      sessionDate: toText(row.sessionDate),
      startPeriod: toNumber(row.startPeriod),
      endPeriod: toNumber(row.endPeriod),
      status: toText(row.status),
      classroomName: toText(row.classroomName),
    }))
    .filter((item) => item.id > 0)
    .sort((a, b) => {
      const aTime = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
      const bTime = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return (a.startPeriod || 0) - (b.startPeriod || 0);
    });
};

const getSectionLabel = (section: CourseSectionListItem): string => {
  const parts = [section.sectionCode, section.displayName, section.courseName]
    .map((item) => normalizeTextValue(item))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : `Lớp học phần #${section.id}`;
};

const getScheduleLabel = (schedule: RecurringScheduleOption): string => {
  const dayPart = schedule.dayOfWeekName || `Thứ ${schedule.dayOfWeek || "?"}`;
  const periodPart =
    typeof schedule.startPeriod === "number" && typeof schedule.endPeriod === "number"
      ? `Tiết ${schedule.startPeriod}-${schedule.endPeriod}`
      : "Chưa có tiết";
  const roomPart = schedule.classroomName || "Chưa có phòng";
  return `${dayPart} | ${periodPart} | ${roomPart}`;
};

const getSessionLabel = (session: ClassSessionOption): string => {
  const datePart = formatDate(session.sessionDate);
  const periodPart =
    typeof session.startPeriod === "number" && typeof session.endPeriod === "number"
      ? `Tiết ${session.startPeriod}-${session.endPeriod}`
      : "Chưa có tiết";
  const statusPart = session.status || "Chưa rõ trạng thái";
  return `${datePart} | ${periodPart} | ${statusPart}`;
};

const normalizeAttendanceRows = (items: AttendanceItem[]): AttendanceItem[] => {
  return items
    .map((item) => ({
      ...item,
      status: normalizeAttendanceStatus(item.status),
      note: item.note || "",
    }))
    .sort((a, b) => {
      const firstCode = normalizeTextValue(a.studentCode).toLowerCase();
      const secondCode = normalizeTextValue(b.studentCode).toLowerCase();
      if (firstCode && secondCode && firstCode !== secondCode) {
        return firstCode.localeCompare(secondCode);
      }

      return normalizeTextValue(a.studentName).localeCompare(
        normalizeTextValue(b.studentName),
        "vi",
      );
    });
};

const isAttendanceChanged = (
  nextRow: AttendanceItem,
  sourceRow: AttendanceItem | undefined,
): boolean => {
  if (!sourceRow) {
    return false;
  }

  const nextStatus = normalizeAttendanceStatus(nextRow.status);
  const sourceStatus = normalizeAttendanceStatus(sourceRow.status);
  const nextNote = normalizeTextValue(nextRow.note);
  const sourceNote = normalizeTextValue(sourceRow.note);

  return nextStatus !== sourceStatus || nextNote !== sourceNote;
};

export function AttendanceManagementPanel({
  authorization,
}: {
  authorization?: string;
}) {
  const [sectionOptions, setSectionOptions] = useState<CourseSectionListItem[]>([]);
  const [scheduleOptions, setScheduleOptions] = useState<RecurringScheduleOption[]>([]);
  const [sessionOptions, setSessionOptions] = useState<ClassSessionOption[]>([]);

  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const [attendanceRows, setAttendanceRows] = useState<AttendanceItem[]>([]);
  const [attendanceBaseline, setAttendanceBaseline] = useState<AttendanceItem[]>([]);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isSectionLoading, setIsSectionLoading] = useState(false);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sectionIdValue = parsePositiveInteger(selectedSectionId);
  const scheduleIdValue = parsePositiveInteger(selectedScheduleId);
  const sessionIdValue = parsePositiveInteger(selectedSessionId);

  const loadAttendancesForSession = useCallback(
    async (sessionId: number) => {
      if (!authorization) {
        return;
      }

      setIsAttendanceLoading(true);
      setErrorMessage("");

      try {
        const data = await getAttendancesBySession(sessionId, authorization);
        const normalizedRows = normalizeAttendanceRows(data);
        setAttendanceRows(normalizedRows);
        setAttendanceBaseline(normalizedRows);
      } catch (error) {
        setAttendanceRows([]);
        setAttendanceBaseline([]);
        setErrorMessage(toErrorMessage(error));
      } finally {
        setIsAttendanceLoading(false);
      }
    },
    [authorization],
  );

  useEffect(() => {
    if (!authorization) {
      setSectionOptions([]);
      setSelectedSectionId("");
      return;
    }

    let cancelled = false;
    setIsSectionLoading(true);
    setErrorMessage("");

    const loadSections = async () => {
      try {
        const sections = await getCourseSections(authorization);

        if (cancelled) {
          return;
        }

        setSectionOptions(sections);
        setSelectedSectionId((current) => {
          if (current && sections.some((item) => String(item.id) === current)) {
            return current;
          }
          return sections.length > 0 ? String(sections[0].id) : "";
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSectionOptions([]);
        setSelectedSectionId("");
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsSectionLoading(false);
        }
      }
    };

    void loadSections();

    return () => {
      cancelled = true;
    };
  }, [authorization]);

  useEffect(() => {
    if (!authorization || !sectionIdValue) {
      setScheduleOptions([]);
      setSelectedScheduleId("");
      setSessionOptions([]);
      setSelectedSessionId("");
      setAttendanceRows([]);
      setAttendanceBaseline([]);
      return;
    }

    let cancelled = false;
    setIsScheduleLoading(true);
    setErrorMessage("");

    const loadSchedules = async () => {
      try {
        const payload = await getDynamicListByPath(
          `/api/v1/recurring-schedules/section/${sectionIdValue}`,
          authorization,
        );

        if (cancelled) {
          return;
        }

        const options = toRecurringScheduleOptions(payload.rows);
        setScheduleOptions(options);
        setSelectedScheduleId((current) => {
          if (current && options.some((item) => String(item.id) === current)) {
            return current;
          }
          return options.length > 0 ? String(options[0].id) : "";
        });
        setSessionOptions([]);
        setSelectedSessionId("");
        setAttendanceRows([]);
        setAttendanceBaseline([]);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setScheduleOptions([]);
        setSelectedScheduleId("");
        setSessionOptions([]);
        setSelectedSessionId("");
        setAttendanceRows([]);
        setAttendanceBaseline([]);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsScheduleLoading(false);
        }
      }
    };

    void loadSchedules();

    return () => {
      cancelled = true;
    };
  }, [authorization, sectionIdValue]);

  useEffect(() => {
    if (!authorization || !scheduleIdValue) {
      setSessionOptions([]);
      setSelectedSessionId("");
      setAttendanceRows([]);
      setAttendanceBaseline([]);
      return;
    }

    let cancelled = false;
    setIsSessionLoading(true);
    setErrorMessage("");

    const loadSessions = async () => {
      try {
        const payload = await getDynamicListByPath(
          `/api/v1/recurring-schedules/${scheduleIdValue}/sessions`,
          authorization,
        );

        if (cancelled) {
          return;
        }

        const options = toSessionOptions(payload.rows);
        setSessionOptions(options);
        setSelectedSessionId((current) => {
          if (current && options.some((item) => String(item.id) === current)) {
            return current;
          }
          return options.length > 0 ? String(options[0].id) : "";
        });
        setAttendanceRows([]);
        setAttendanceBaseline([]);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSessionOptions([]);
        setSelectedSessionId("");
        setAttendanceRows([]);
        setAttendanceBaseline([]);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsSessionLoading(false);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [authorization, scheduleIdValue]);

  useEffect(() => {
    if (!sessionIdValue) {
      setAttendanceRows([]);
      setAttendanceBaseline([]);
      return;
    }

    void loadAttendancesForSession(sessionIdValue);
  }, [loadAttendancesForSession, sessionIdValue]);

  const filteredAttendanceRows = useMemo(() => {
    const normalizedKeyword = normalizeTextValue(keyword).toLowerCase();

    return attendanceRows.filter((row) => {
      if (statusFilter && normalizeAttendanceStatus(row.status) !== statusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      const searchText = [
        row.studentCode,
        row.studentName,
        row.note,
        row.courseRegistrationId ? String(row.courseRegistrationId) : "",
        getAttendanceStatusLabel(row.status),
      ]
        .map((value) => normalizeTextValue(String(value || "")).toLowerCase())
        .join(" ");

      return searchText.includes(normalizedKeyword);
    });
  }, [attendanceRows, keyword, statusFilter]);

  const summary = useMemo(() => {
    const result = {
      total: filteredAttendanceRows.length,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    };

    filteredAttendanceRows.forEach((row) => {
      const status = normalizeAttendanceStatus(row.status);
      if (status === "PRESENT") {
        result.present += 1;
      } else if (status === "LATE") {
        result.late += 1;
      } else if (status === "EXCUSED") {
        result.excused += 1;
      } else if (status === "ABSENT") {
        result.absent += 1;
      }
    });

    return result;
  }, [filteredAttendanceRows]);

  const changedCount = useMemo(() => {
    const baselineById = new Map<number, AttendanceItem>();
    attendanceBaseline.forEach((row) => {
      if (typeof row.id === "number" && row.id > 0) {
        baselineById.set(row.id, row);
      }
    });

    return attendanceRows.filter((row) => {
      if (typeof row.id !== "number" || row.id <= 0) {
        return false;
      }
      return isAttendanceChanged(row, baselineById.get(row.id));
    }).length;
  }, [attendanceBaseline, attendanceRows]);

  const handleRowStatusChange = (attendanceId: number, nextStatus: AttendanceStatus) => {
    setAttendanceRows((current) =>
      current.map((row) =>
        row.id === attendanceId
          ? {
              ...row,
              status: nextStatus,
            }
          : row,
      ),
    );
  };

  const handleRowNoteChange = (attendanceId: number, nextNote: string) => {
    setAttendanceRows((current) =>
      current.map((row) =>
        row.id === attendanceId
          ? {
              ...row,
              note: nextNote,
            }
          : row,
      ),
    );
  };

  const handleSaveChanges = async () => {
    if (!authorization || !sessionIdValue) {
      setErrorMessage("Vui lòng chọn buổi học hợp lệ trước khi lưu.");
      return;
    }

    const baselineById = new Map<number, AttendanceItem>();
    attendanceBaseline.forEach((row) => {
      if (typeof row.id === "number" && row.id > 0) {
        baselineById.set(row.id, row);
      }
    });

    const changedRows = attendanceRows.filter((row) => {
      if (typeof row.id !== "number" || row.id <= 0) {
        return false;
      }
      return isAttendanceChanged(row, baselineById.get(row.id));
    });

    if (changedRows.length === 0) {
      setSuccessMessage("Không có thay đổi để lưu.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      await Promise.all(
        changedRows.map((row) =>
          updateAttendance(
            row.id as number,
            {
              status: normalizeAttendanceStatus(row.status),
              note: normalizeTextValue(row.note) || undefined,
            },
            authorization,
          ),
        ),
      );

      await loadAttendancesForSession(sessionIdValue);
      setSuccessMessage(`Đã cập nhật ${changedRows.length} bản ghi điểm danh.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAttendance = async (row: AttendanceItem) => {
    if (!authorization || !sessionIdValue || typeof row.id !== "number" || row.id <= 0) {
      return;
    }

    const shouldDelete = window.confirm(
      `Bạn có chắc muốn xóa bản ghi điểm danh #${row.id} của ${row.studentName || row.studentCode || "sinh viên này"}?`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      await deleteAttendance(row.id, authorization);
      await loadAttendancesForSession(sessionIdValue);
      setSuccessMessage(`Đã xóa bản ghi điểm danh #${row.id}.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {(errorMessage || successMessage) && (
        <section className={contentCardClass}>
          <div className="space-y-2 px-4 py-3 text-sm">
            {errorMessage ? (
              <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p className="rounded-[4px] border border-[#bad9bd] bg-[#f2fff2] px-3 py-2 text-[#2f6d37]">
                {successMessage}
              </p>
            ) : null}
          </div>
        </section>
      )}

      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>Điểm danh theo buổi học</h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <select
              value={selectedSectionId}
              onChange={(event) => setSelectedSectionId(event.target.value)}
              className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
              disabled={isSectionLoading || sectionOptions.length === 0}
            >
              {sectionOptions.length === 0 ? (
                <option value="">Chưa có lớp học phần</option>
              ) : null}
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {getSectionLabel(section)}
                </option>
              ))}
            </select>

            <select
              value={selectedScheduleId}
              onChange={(event) => setSelectedScheduleId(event.target.value)}
              className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
              disabled={isScheduleLoading || scheduleOptions.length === 0}
            >
              {scheduleOptions.length === 0 ? (
                <option value="">Chưa có lịch học định kỳ</option>
              ) : null}
              {scheduleOptions.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {getScheduleLabel(schedule)}
                </option>
              ))}
            </select>

            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
              disabled={isSessionLoading || sessionOptions.length === 0}
            >
              {sessionOptions.length === 0 ? (
                <option value="">Chưa có buổi học</option>
              ) : null}
              {sessionOptions.map((session) => (
                <option key={session.id} value={session.id}>
                  {getSessionLabel(session)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
              placeholder="Tìm theo mã SV, họ tên, ghi chú..."
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
            >
              <option value="">Tất cả trạng thái</option>
              {attendanceStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {getAttendanceStatusLabel(status)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                void handleSaveChanges();
              }}
              disabled={isSaving || isAttendanceLoading || changedCount === 0}
              className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
            >
              {isSaving ? "Đang lưu..." : `Lưu thay đổi (${changedCount})`}
            </button>
          </div>
        </div>
      </section>

      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>Danh sách điểm danh</h2>
          <span className="text-sm font-medium text-[#396786]">
            {filteredAttendanceRows.length} bản ghi
          </span>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
              <p className="text-xs text-[#648095]">Tổng sinh viên</p>
              <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">{summary.total}</p>
            </div>
            <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
              <p className="text-xs text-[#648095]">Có mặt</p>
              <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">{summary.present}</p>
            </div>
            <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
              <p className="text-xs text-[#648095]">Đi muộn</p>
              <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">{summary.late}</p>
            </div>
            <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
              <p className="text-xs text-[#648095]">Có phép</p>
              <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">{summary.excused}</p>
            </div>
            <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
              <p className="text-xs text-[#648095]">Vắng</p>
              <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">{summary.absent}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f7fbff]">
                <tr className="border-b border-[#cfdfec] text-[#305970]">
                  <th className="px-2 py-2">Mã SV</th>
                  <th className="px-2 py-2">Họ tên</th>
                  <th className="px-2 py-2">Mã đăng ký</th>
                  <th className="px-2 py-2">Ngày học</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2">Ghi chú</th>
                  <th className="px-2 py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendanceRows.map((row, rowIndex) => {
                  const attendanceId = typeof row.id === "number" ? row.id : 0;
                  const status = normalizeAttendanceStatus(row.status);
                  return (
                    <tr
                      key={attendanceId > 0 ? `attendance-${attendanceId}` : `fallback-${rowIndex + 1}`}
                      className="border-b border-[#e0ebf4] text-[#3f6178]"
                    >
                      <td className="px-2 py-2">{row.studentCode || "-"}</td>
                      <td className="px-2 py-2">{row.studentName || "-"}</td>
                      <td className="px-2 py-2">{row.courseRegistrationId || "-"}</td>
                      <td className="px-2 py-2">{formatDate(row.sessionDate)}</td>
                      <td className="px-2 py-2">
                        <select
                          value={status}
                          onChange={(event) => {
                            if (attendanceId <= 0) {
                              return;
                            }
                            handleRowStatusChange(
                              attendanceId,
                              event.target.value as AttendanceStatus,
                            );
                          }}
                          disabled={attendanceId <= 0 || isSaving}
                          className="h-9 rounded-[6px] border border-[#c8d3dd] bg-white px-2 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf] disabled:opacity-60"
                        >
                          {attendanceStatusOptions.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {getAttendanceStatusLabel(statusOption)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={row.note || ""}
                          onChange={(event) => {
                            if (attendanceId <= 0) {
                              return;
                            }
                            handleRowNoteChange(attendanceId, event.target.value);
                          }}
                          disabled={attendanceId <= 0 || isSaving}
                          placeholder="Nhập ghi chú"
                          className="h-9 w-full min-w-[220px] rounded-[6px] border border-[#c8d3dd] px-2 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf] disabled:opacity-60"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {attendanceId > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteAttendance(row);
                            }}
                            disabled={isSaving}
                            className="rounded-[6px] border border-[#e7b6b6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#b03d3d] transition hover:bg-[#fff1f1] disabled:opacity-60"
                          >
                            Xóa
                          </button>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAttendanceStatusClass(status)}`}
                          >
                            {getAttendanceStatusLabel(status)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!isAttendanceLoading && filteredAttendanceRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-center text-[#577086]">
                      Chưa có dữ liệu điểm danh theo buổi học đã chọn.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {isAttendanceLoading ? (
              <p className="px-3 py-3 text-sm text-[#5d7b91]">
                Đang tải danh sách điểm danh...
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
