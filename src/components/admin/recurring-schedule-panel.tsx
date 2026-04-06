"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getDynamicByPath,
  getDynamicListByPath,
  updateDynamicByPath,
} from "@/lib/admin/service";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { formatDateTime, toErrorMessage } from "@/components/admin/format-utils";
import type { DynamicRow } from "@/lib/admin/types";

interface RecurringSchedulePanelProps {
  authorization?: string;
  fixedSectionId?: number;
  initialSectionId?: number;
  embedded?: boolean;
}

interface RecurringScheduleRow {
  id: number;
  sectionId: number;
  sectionStatus?: string;
  sectionCode?: string;
  sectionDisplayName?: string;
  classroomId: number;
  classroomName?: string;
  dayOfWeek: number;
  dayOfWeekName?: string;
  startPeriod: number;
  startPeriodTime?: string;
  endPeriod: number;
  endPeriodTime?: string;
  startWeek?: number;
  endWeek?: number;
  createdAt?: string;
}

interface ClassSessionRow {
  id: number;
  sessionDate?: string;
  classroomName?: string;
  startPeriod?: number;
  endPeriod?: number;
  status?: string;
}

interface ScheduleFormState {
  sectionId: string;
  classroomId: string;
  dayOfWeek: string;
  startPeriod: string;
  endPeriod: string;
  startWeek: string;
  endWeek: string;
}

const weekdayOptions = [
  { value: "1", label: "Thứ hai" },
  { value: "2", label: "Thứ ba" },
  { value: "3", label: "Thứ tư" },
  { value: "4", label: "Thứ năm" },
  { value: "5", label: "Thứ sáu" },
  { value: "6", label: "Thứ bảy" },
  { value: "7", label: "Chủ nhật" },
] as const;

const periodOptions = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
] as const;

const sectionStatusValues = new Set([
  "DRAFT",
  "OPEN",
  "ONGOING",
  "FINISHED",
  "CANCELLED",
]);

const normalizeSectionStatus = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!sectionStatusValues.has(normalized)) {
    return null;
  }

  return normalized;
};

const sectionStatusLabelMap: Record<string, string> = {
  DRAFT: "Nháp",
  OPEN: "Đang mở",
  ONGOING: "Đang diễn ra",
  FINISHED: "Đã kết thúc",
  CANCELLED: "Đã hủy",
};

const createEmptyForm = (sectionId?: string): ScheduleFormState => ({
  sectionId: sectionId || "",
  classroomId: "",
  dayOfWeek: "1",
  startPeriod: "1",
  endPeriod: "2",
  startWeek: "1",
  endWeek: "8",
});

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

const resolveWeekdayLabel = (dayOfWeekName?: string, dayOfWeek?: number): string => {
  if (dayOfWeekName && dayOfWeekName.trim()) {
    return dayOfWeekName;
  }

  if (!dayOfWeek) {
    return "-";
  }

  return (
    weekdayOptions.find((item) => Number(item.value) === dayOfWeek)?.label ||
    String(dayOfWeek)
  );
};

const toScheduleRows = (rows: DynamicRow[]): RecurringScheduleRow[] => {
  return rows
    .map((row) => ({
      id: typeof row.id === "number" ? row.id : Number(row.id || 0),
      sectionId:
        typeof row.sectionId === "number" ? row.sectionId : Number(row.sectionId || 0),
      sectionStatus:
        normalizeSectionStatus(row.sectionStatus) ||
        normalizeSectionStatus(row.courseSectionStatus) ||
        normalizeSectionStatus(row.status) ||
        undefined,
      sectionCode:
        typeof row.sectionCode === "string" ? row.sectionCode : undefined,
      sectionDisplayName:
        typeof row.sectionDisplayName === "string" ? row.sectionDisplayName : undefined,
      classroomId:
        typeof row.classroomId === "number"
          ? row.classroomId
          : Number(row.classroomId || 0),
      classroomName:
        typeof row.classroomName === "string" ? row.classroomName : undefined,
      dayOfWeek:
        typeof row.dayOfWeek === "number" ? row.dayOfWeek : Number(row.dayOfWeek || 0),
      dayOfWeekName:
        typeof row.dayOfWeekName === "string" ? row.dayOfWeekName : undefined,
      startPeriod:
        typeof row.startPeriod === "number"
          ? row.startPeriod
          : Number(row.startPeriod || 0),
      startPeriodTime:
        typeof row.startPeriodTime === "string" ? row.startPeriodTime : undefined,
      endPeriod:
        typeof row.endPeriod === "number" ? row.endPeriod : Number(row.endPeriod || 0),
      endPeriodTime:
        typeof row.endPeriodTime === "string" ? row.endPeriodTime : undefined,
      startWeek:
        typeof row.startWeek === "number"
          ? row.startWeek
          : Number(row.startWeek || 0) || undefined,
      endWeek:
        typeof row.endWeek === "number"
          ? row.endWeek
          : Number(row.endWeek || 0) || undefined,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    }))
    .filter((row) => row.id > 0)
    .sort((a, b) => {
      const dayCompare = a.dayOfWeek - b.dayOfWeek;
      if (dayCompare !== 0) {
        return dayCompare;
      }

      const periodCompare = a.startPeriod - b.startPeriod;
      if (periodCompare !== 0) {
        return periodCompare;
      }

      return a.endPeriod - b.endPeriod;
    });
};

const toSessionRows = (rows: DynamicRow[]): ClassSessionRow[] => {
  return rows
    .map((row) => ({
      id: typeof row.id === "number" ? row.id : Number(row.id || 0),
      sessionDate:
        typeof row.sessionDate === "string" ? row.sessionDate : undefined,
      classroomName:
        typeof row.classroomName === "string" ? row.classroomName : undefined,
      startPeriod:
        typeof row.startPeriod === "number"
          ? row.startPeriod
          : Number(row.startPeriod || 0) || undefined,
      endPeriod:
        typeof row.endPeriod === "number"
          ? row.endPeriod
          : Number(row.endPeriod || 0) || undefined,
      status: typeof row.status === "string" ? row.status : undefined,
    }))
    .filter((row) => row.id > 0)
    .sort((a, b) => {
      const aTime = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
      const bTime = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
      const dateCompare = aTime - bTime;
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return (a.startPeriod || 0) - (b.startPeriod || 0);
    });
};

export const RecurringSchedulePanel = ({
  authorization,
  fixedSectionId,
  initialSectionId,
  embedded = false,
}: RecurringSchedulePanelProps) => {
  const defaultSectionId = fixedSectionId
    ? String(fixedSectionId)
    : initialSectionId
      ? String(initialSectionId)
      : "";

  const [sectionIdInput, setSectionIdInput] = useState(defaultSectionId);
  const [sectionOptions, setSectionOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [classroomOptions, setClassroomOptions] = useState<Array<{ id: number; label: string }>>(
    [],
  );
  const [rows, setRows] = useState<RecurringScheduleRow[]>([]);
  const [sectionStatusById, setSectionStatusById] = useState<Record<number, string>>({});
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [sessionRows, setSessionRows] = useState<ClassSessionRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editingSourceRow, setEditingSourceRow] = useState<RecurringScheduleRow | null>(null);
  const [editingSectionStatus, setEditingSectionStatus] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState<ScheduleFormState>(createEmptyForm(defaultSectionId));
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<RecurringScheduleRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác lịch học thất bại",
    successTitle: "Thao tác lịch học thành công",
  });

  const selectedSchedule = useMemo(() => {
    return rows.find((row) => row.id === selectedScheduleId) || null;
  }, [rows, selectedScheduleId]);

  const editModeRule = useMemo<"default" | "draft" | "open" | "locked">(() => {
    if (!editingRowId) {
      return "default";
    }

    if (editingSectionStatus === "DRAFT") {
      return "draft";
    }

    if (editingSectionStatus === "OPEN") {
      return "open";
    }

    return "locked";
  }, [editingRowId, editingSectionStatus]);

  const isSectionFieldDisabled =
    Boolean(fixedSectionId) ||
    isLoading ||
    (editingRowId !== null && (editModeRule === "draft" || editModeRule === "open" || editModeRule === "locked"));

  const isClassroomFieldDisabled = isLoading || (editingRowId !== null && editModeRule === "locked");

  const isTimingFieldDisabled =
    isLoading ||
    (editingRowId !== null && (editModeRule === "open" || editModeRule === "locked"));

  const isSubmitDisabled = isLoading || (editingRowId !== null && editModeRule === "locked");

  const loadSchedules = async (sectionIdOverride?: number) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const sectionId = sectionIdOverride ?? fixedSectionId ?? Number(sectionIdInput);
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      setErrorMessage("Vui lòng chọn lớp học phần hợp lệ.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await getDynamicListByPath(
        `/api/v1/recurring-schedules/section/${sectionId}`,
        authorization,
      );
      const nextRows = toScheduleRows(response.rows);
      setRows(nextRows);
      setSelectedScheduleId(nextRows[0]?.id || null);
      setSessionRows([]);
      setSuccessMessage(`Đã tải ${nextRows.length} lịch học định kỳ của lớp #${sectionId}.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const loadSelectionOptions = useCallback(async () => {
    if (!authorization) {
      return;
    }

    try {
      const requests: Promise<Awaited<ReturnType<typeof getDynamicListByPath>>>[] = [
        getDynamicListByPath("/api/v1/classrooms", authorization),
      ];

      if (!fixedSectionId) {
        requests.unshift(getDynamicListByPath("/api/v1/course-sections", authorization));
      }

      const [sections, classrooms] =
        fixedSectionId
          ? [null, await requests[0]]
          : (await Promise.all(requests)) as [
              Awaited<ReturnType<typeof getDynamicListByPath>>,
              Awaited<ReturnType<typeof getDynamicListByPath>>,
            ];

      const nextSections = fixedSectionId
        ? []
        : (sections?.rows || [])
            .map((item) => {
              const id = Number(item.id || 0);
              if (!Number.isInteger(id) || id <= 0) {
                return null;
              }

              const label =
                (typeof item.displayName === "string" && item.displayName) ||
                (typeof item.sectionCode === "string" && item.sectionCode) ||
                String(id);

              return { id, label };
            })
            .filter((item): item is { id: number; label: string } => item !== null);

      const nextSectionStatusById = (sections?.rows || []).reduce<Record<number, string>>(
        (accumulator, item) => {
          const id = Number(item.id || 0);
          if (!Number.isInteger(id) || id <= 0) {
            return accumulator;
          }

          const status =
            normalizeSectionStatus(item.status) ||
            normalizeSectionStatus(item.sectionStatus) ||
            normalizeSectionStatus(item.courseSectionStatus);

          if (status) {
            accumulator[id] = status;
          }

          return accumulator;
        },
        {},
      );

      const nextClassrooms = classrooms.rows
        .map((item) => {
          const id = Number(item.id || 0);
          if (!Number.isInteger(id) || id <= 0) {
            return null;
          }

          const label =
            (typeof item.roomName === "string" && item.roomName.trim()) || String(id);

          return { id, label };
        })
        .filter((item): item is { id: number; label: string } => item !== null);

      setSectionOptions(nextSections);
      setClassroomOptions(nextClassrooms);
      setSectionStatusById(nextSectionStatusById);
    } catch {
      setSectionOptions([]);
      setClassroomOptions([]);
      setSectionStatusById({});
    }
  }, [authorization, fixedSectionId]);

  useEffect(() => {
    void loadSelectionOptions();
  }, [loadSelectionOptions]);

  useEffect(() => {
    if (!fixedSectionId) {
      return;
    }

    const fixed = String(fixedSectionId);
    setSectionIdInput(fixed);
    setForm((prev) => ({ ...prev, sectionId: fixed }));
    void loadSchedules(fixedSectionId);
  }, [fixedSectionId]);

  useEffect(() => {
    if (fixedSectionId || !initialSectionId) {
      return;
    }

    const initial = String(initialSectionId);
    setSectionIdInput(initial);
    setForm((prev) => ({ ...prev, sectionId: initial }));
    void loadSchedules(initialSectionId);
  }, [fixedSectionId, initialSectionId]);

  const loadSessions = async (scheduleId: number) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await getDynamicListByPath(
        `/api/v1/recurring-schedules/${scheduleId}/sessions`,
        authorization,
      );
      setSessionRows(toSessionRows(response.rows));
      setSelectedScheduleId(scheduleId);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    const nextSection = fixedSectionId
      ? String(fixedSectionId)
      : form.sectionId || sectionIdInput;
    setEditingRowId(null);
    setEditingSourceRow(null);
    setEditingSectionStatus(null);
    setForm(createEmptyForm(nextSection));
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormModalOpen(true);
  };

  const resolveSectionStatusForEdit = async (row: RecurringScheduleRow): Promise<string | null> => {
    const fromRow =
      normalizeSectionStatus(row.sectionStatus) ||
      normalizeSectionStatus((row as unknown as Record<string, unknown>).status);
    if (fromRow) {
      return fromRow;
    }

    const cached = sectionStatusById[row.sectionId];
    const fromCache = normalizeSectionStatus(cached);
    if (fromCache) {
      return fromCache;
    }

    if (!authorization) {
      return null;
    }

    try {
      const section = await getDynamicByPath(`/api/v1/course-sections/${row.sectionId}`, authorization);
      const status =
        normalizeSectionStatus(section.status) ||
        normalizeSectionStatus(section.sectionStatus) ||
        normalizeSectionStatus(section.courseSectionStatus);

      if (status) {
        setSectionStatusById((previous) => ({
          ...previous,
          [row.sectionId]: status,
        }));
      }

      return status;
    } catch {
      return null;
    }
  };

  const handleEdit = async (row: RecurringScheduleRow) => {
    const sectionStatus = await resolveSectionStatusForEdit(row);
    setEditingRowId(row.id);
    setEditingSourceRow(row);
    setEditingSectionStatus(sectionStatus);
    setForm({
      sectionId: String(row.sectionId),
      classroomId: String(row.classroomId),
      dayOfWeek: String(row.dayOfWeek),
      startPeriod: String(row.startPeriod),
      endPeriod: String(row.endPeriod),
      startWeek: row.startWeek ? String(row.startWeek) : "1",
      endWeek: row.endWeek ? String(row.endWeek) : "8",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    if (isLoading) {
      return;
    }
    setEditingSourceRow(null);
    setEditingSectionStatus(null);
    setIsFormModalOpen(false);
  };

  const resetForm = () => {
    const nextSection = fixedSectionId
      ? String(fixedSectionId)
      : form.sectionId || sectionIdInput;
    setEditingRowId(null);
    setEditingSourceRow(null);
    setEditingSectionStatus(null);
    setForm(createEmptyForm(nextSection));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const sectionId = Number(form.sectionId);
    const classroomId = Number(form.classroomId);
    const dayOfWeek = Number(form.dayOfWeek);
    const startPeriod = Number(form.startPeriod);
    const endPeriod = Number(form.endPeriod);
    const startWeek = Number(form.startWeek);
    const endWeek = Number(form.endWeek);

    if (editingRowId && editModeRule === "locked") {
      const statusText = editingSectionStatus
        ? sectionStatusLabelMap[editingSectionStatus] || editingSectionStatus
        : "hiện tại";
      setErrorMessage(`Không thể chỉnh sửa lịch khi lớp học phần ở trạng thái ${statusText}.`);
      return;
    }

    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      setErrorMessage("Lớp học phần không hợp lệ.");
      return;
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      setErrorMessage("Phòng học không hợp lệ.");
      return;
    }

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      setErrorMessage("Thứ trong tuần không hợp lệ.");
      return;
    }

    if (endPeriod < startPeriod) {
      setErrorMessage("Tiết kết thúc phải lớn hơn hoặc bằng tiết bắt đầu.");
      return;
    }

    if (!Number.isInteger(startWeek) || startWeek <= 0) {
      setErrorMessage("Tuần bắt đầu không hợp lệ.");
      return;
    }

    if (!Number.isInteger(endWeek) || endWeek < startWeek) {
      setErrorMessage("Tuần kết thúc phải lớn hơn hoặc bằng tuần bắt đầu.");
      return;
    }

    if (editingRowId && editingSourceRow) {
      if (editModeRule === "draft" && sectionId !== editingSourceRow.sectionId) {
        setErrorMessage("Trạng thái Nháp: không được thay đổi lớp học phần.");
        return;
      }

      if (editModeRule === "open") {
        const nonClassroomChanged =
          sectionId !== editingSourceRow.sectionId ||
          dayOfWeek !== editingSourceRow.dayOfWeek ||
          startPeriod !== editingSourceRow.startPeriod ||
          endPeriod !== editingSourceRow.endPeriod ||
          startWeek !== (editingSourceRow.startWeek || 1) ||
          endWeek !== (editingSourceRow.endWeek || 8);

        if (nonClassroomChanged) {
          setErrorMessage("Trạng thái Đang mở: chỉ được sửa phòng học.");
          return;
        }
      }
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = {
        sectionId,
        classroomId,
        dayOfWeek,
        startPeriod,
        endPeriod,
        startWeek,
        endWeek,
      };

      if (editingRowId) {
        await updateDynamicByPath(
          `/api/v1/recurring-schedules/${editingRowId}`,
          payload,
          authorization,
        );
        setSuccessMessage(`Đã cập nhật lịch học định kỳ #${editingRowId}.`);
      } else {
        await createDynamicByPath("/api/v1/recurring-schedules", payload, authorization);
        setSuccessMessage("Đã tạo lịch học định kỳ mới.");
      }

      setSectionIdInput(String(sectionId));
      setIsFormModalOpen(false);
      resetForm();
      await loadSchedules(sectionId);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (row: RecurringScheduleRow) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    setConfirmDeleteRow(row);
  };

  const handleConfirmDelete = async () => {
    if (!authorization || !confirmDeleteRow) {
      return;
    }

    const row = confirmDeleteRow;
    setConfirmDeleteRow(null);

    try {
      setIsLoading(true);
      setErrorMessage("");
      await deleteDynamicByPath(`/api/v1/recurring-schedules/${row.id}`, authorization);
      setSuccessMessage(`Đã xóa lịch học định kỳ #${row.id}.`);
      await loadSchedules(row.sectionId);
      if (editingRowId === row.id) {
        resetForm();
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
      <div className="flex items-center justify-between border-b border-[#c5dced] px-4 py-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#1a4f75]">Quản lý lịch học định kỳ</h2>
          <p className="mt-1 text-sm text-[#5a7890]">
            Theo dõi lịch định kỳ theo từng lớp học phần, chỉnh sửa nhanh và xem buổi học đã sinh.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {!embedded ? (
          <section className="rounded-[8px] border border-[#d7e7f3] bg-[#f8fcff] p-3">
            <h3 className="text-sm font-semibold text-[#1f567b]">Tra cứu theo lớp học phần</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_130px]">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#315972]">Lớp học phần</span>
                <select
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={sectionIdInput}
                  onChange={(event) => setSectionIdInput(event.target.value)}
                  disabled={Boolean(fixedSectionId)}
                >
                  <option value="">Chọn lớp học phần</option>
                  {sectionOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  void loadSchedules();
                }}
                disabled={isLoading}
                className="mt-6 h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Tải lịch
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                disabled={isLoading}
                className="mt-6 h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Tạo lịch
              </button>
            </div>
          </section>
        ) : (
          <div className="flex items-center justify-between rounded-[8px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-sm text-[#315972]">
            <span>
              Lớp học phần: <strong>#{fixedSectionId || sectionIdInput || "-"}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadSchedules();
                }}
                disabled={isLoading}
                className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Làm mới lịch
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                disabled={isLoading}
                className="h-9 rounded-[6px] bg-[#0d6ea6] px-3 text-xs font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Tạo lịch
              </button>
            </div>
          </div>
        )}

        {successMessage && !shouldHideFeedbackMessage(successMessage) ? (
          <p className="rounded-[6px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-sm text-[#2f7b4f]">
            {successMessage}
          </p>
        ) : null}

        <section className="rounded-[10px] border border-[#c7dceb] bg-white">
          <div className="flex items-center justify-between border-b border-[#d9e7f1] px-4 py-3">
            <h3 className="text-[18px] font-semibold text-[#184f74]">Danh sách lịch định kỳ</h3>
            <span className="text-sm font-medium text-[#396786]">{rows.length} lịch</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#cfdfec] text-[#305970]">
                  <th className="px-3 py-3">STT</th>
                  <th className="px-3 py-3">Lớp học phần</th>
                  <th className="px-3 py-3">Phòng</th>
                  <th className="px-3 py-3">Thứ</th>
                  <th className="px-3 py-3">Tiết</th>
                  <th className="px-3 py-3">Tuần áp dụng</th>
                  <th className="px-3 py-3">Tạo lúc</th>
                  <th className="px-3 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b border-[#e0ebf4] text-[#3f6178] ${
                      selectedScheduleId === row.id ? "bg-[#eef6fd]" : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-semibold text-[#244f6f]">{index + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#1f567b]">
                        {row.sectionDisplayName || row.sectionCode || row.sectionId}
                      </p>
                      <p className="mt-1 text-xs text-[#6b8497]">Nhóm: {row.sectionCode || "-"}</p>
                    </td>
                    <td className="px-3 py-3">{row.classroomName || row.classroomId}</td>
                    <td className="px-3 py-3">
                      {resolveWeekdayLabel(row.dayOfWeekName, row.dayOfWeek)}
                    </td>
                    <td className="px-3 py-3">
                      {row.startPeriod} - {row.endPeriod}
                      <p className="mt-1 text-xs text-[#6b8497]">
                        {row.startPeriodTime || "-"} / {row.endPeriodTime || "-"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {row.startWeek && row.endWeek
                        ? `Tuần ${row.startWeek} - ${row.endWeek}`
                        : "-"}
                    </td>
                    <td className="px-3 py-3">{formatDateTime(row.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void loadSessions(row.id);
                          }}
                          disabled={isLoading}
                          className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Xem buổi học
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleEdit(row);
                          }}
                          disabled={isLoading}
                          className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(row);
                          }}
                          disabled={isLoading}
                          className="h-9 rounded-[6px] bg-[#cc3a3a] px-3 text-xs font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-[#577086]">
                      Chưa có lịch học định kỳ. Chọn lớp học phần để tải hoặc tạo mới.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[10px] border border-[#c7dceb] bg-white">
          <div className="flex items-center justify-between border-b border-[#d9e7f1] px-4 py-3">
            <div>
              <h3 className="text-[18px] font-semibold text-[#184f74]">Danh sách buổi học đã sinh</h3>
              <p className="mt-1 text-sm text-[#678197]">
                {selectedSchedule
                  ? `Đang hiển thị buổi học của lịch #${selectedSchedule.id}.`
                  : "Chọn một lịch và bấm 'Xem buổi học' để tải danh sách."}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#cfdfec] text-[#305970]">
                  <th className="px-3 py-3">Ngày học</th>
                  <th className="px-3 py-3">Phòng học</th>
                  <th className="px-3 py-3">Tiết học</th>
                  <th className="px-3 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map((row) => (
                  <tr key={row.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                    <td className="px-3 py-3">{formatDate(row.sessionDate)}</td>
                    <td className="px-3 py-3">{row.classroomName || "-"}</td>
                    <td className="px-3 py-3">
                      {row.startPeriod || "-"} - {row.endPeriod || "-"}
                    </td>
                    <td className="px-3 py-3">{row.status || "-"}</td>
                  </tr>
                ))}
                {sessionRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[#577086]">
                      Chưa có dữ liệu buổi học.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {isFormModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
            onClick={closeFormModal}
          >
            <div
              className="w-full max-w-[680px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
                <h3 className="text-[20px] font-semibold text-[#154f75]">
                  {editingRowId ? `Cập nhật lịch #${editingRowId}` : "Tạo lịch định kỳ"}
                </h3>
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                  disabled={isLoading}
                  aria-label="Đóng popup"
                >
                  x
                </button>
              </div>

              <form className="space-y-3 px-5 py-4" onSubmit={handleSubmit}>
                {editingRowId && editingSectionStatus ? (
                  <p className="rounded-[6px] border border-[#d3e2ee] bg-[#f4f9fd] px-3 py-2 text-xs text-[#2f5f80]">
                    {editModeRule === "draft"
                      ? "Trạng thái Nháp: chỉ khóa ô lớp học phần."
                      : editModeRule === "open"
                        ? "Trạng thái Đang mở: chỉ cho phép sửa phòng học."
                        : `Trạng thái ${sectionStatusLabelMap[editingSectionStatus] || editingSectionStatus}: không thể chỉnh sửa lịch này.`}
                  </p>
                ) : null}

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Lớp học phần</span>
                  {fixedSectionId ? (
                    <input
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] bg-[#f3f8fc] px-3 text-sm text-[#315972]"
                      value={`#${fixedSectionId}`}
                      readOnly
                    />
                  ) : (
                    <select
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={form.sectionId}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, sectionId: event.target.value }))
                      }
                      disabled={isSectionFieldDisabled}
                    >
                      <option value="">Chọn lớp học phần</option>
                      {sectionOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Phòng học</span>
                  <select
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.classroomId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, classroomId: event.target.value }))
                    }
                    disabled={isClassroomFieldDisabled}
                  >
                    <option value="">Chọn phòng học</option>
                    {classroomOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Thứ trong tuần</span>
                  <select
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.dayOfWeek}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))
                    }
                    disabled={isTimingFieldDisabled}
                  >
                    {weekdayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-[#315972]">Tiết bắt đầu</span>
                    <select
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={form.startPeriod}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, startPeriod: event.target.value }))
                      }
                      disabled={isTimingFieldDisabled}
                    >
                      {periodOptions.map((option) => (
                        <option key={`start-${option}`} value={option}>
                          Tiết {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-[#315972]">Tiết kết thúc</span>
                    <select
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={form.endPeriod}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, endPeriod: event.target.value }))
                      }
                      disabled={isTimingFieldDisabled}
                    >
                      {periodOptions.map((option) => (
                        <option key={`end-${option}`} value={option}>
                          Tiết {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-[#315972]">Tuần bắt đầu</span>
                    <input
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={form.startWeek}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, startWeek: event.target.value }))
                      }
                      inputMode="numeric"
                      placeholder="Ví dụ: 1"
                      disabled={isTimingFieldDisabled}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-[#315972]">Tuần kết thúc</span>
                    <input
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={form.endWeek}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, endWeek: event.target.value }))
                      }
                      inputMode="numeric"
                      placeholder="Ví dụ: 8"
                      disabled={isTimingFieldDisabled}
                    />
                  </label>
                </div>

                <div className="mt-1 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeFormModal}
                    className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                    disabled={isLoading}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    {isLoading
                      ? "Đang xử lý..."
                      : editingRowId
                        ? editModeRule === "locked"
                          ? "Không thể cập nhật"
                          : "Lưu cập nhật"
                        : "Tạo lịch"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <ConfirmDialog
          open={Boolean(confirmDeleteRow)}
          title="Xác nhận xóa lịch học"
          message={
            confirmDeleteRow
              ? `Bạn có chắc muốn xóa lịch học lặp lại #${confirmDeleteRow.id} không?`
              : ""
          }
          confirmText="Xóa"
          isProcessing={isLoading}
          onCancel={() => setConfirmDeleteRow(null)}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      </div>
    </section>
  );
};
