"use client";

import { FormEvent, useMemo, useState } from "react";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getDynamicListByPath,
  updateDynamicByPath,
} from "@/lib/admin/service";
import type { DynamicRow } from "@/lib/admin/types";

interface RecurringSchedulePanelProps {
  authorization?: string;
}

interface RecurringScheduleRow {
  id: number;
  sectionId: number;
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
}

const emptyForm: ScheduleFormState = {
  sectionId: "",
  classroomId: "",
  dayOfWeek: "2",
  startPeriod: "1",
  endPeriod: "2",
};

const weekdayOptions = [
  { value: "1", label: "Chu nhat" },
  { value: "2", label: "Thu hai" },
  { value: "3", label: "Thu ba" },
  { value: "4", label: "Thu tu" },
  { value: "5", label: "Thu nam" },
  { value: "6", label: "Thu sau" },
  { value: "7", label: "Thu bay" },
] as const;

const periodOptions = ["1", "2", "3", "4"] as const;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Thao tác thất bại. Vui lòng thử lại.";
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

const toScheduleRows = (rows: DynamicRow[]): RecurringScheduleRow[] => {
  return rows
    .map((row) => ({
      id: typeof row.id === "number" ? row.id : Number(row.id || 0),
      sectionId:
        typeof row.sectionId === "number" ? row.sectionId : Number(row.sectionId || 0),
      sectionCode:
        typeof row.sectionCode === "string" ? row.sectionCode : undefined,
      sectionDisplayName:
        typeof row.sectionDisplayName === "string"
          ? row.sectionDisplayName
          : undefined,
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
      createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    }))
    .filter((row) => row.id > 0);
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
    .filter((row) => row.id > 0);
};

export const RecurringSchedulePanel = ({
  authorization,
}: RecurringSchedulePanelProps) => {
  const [sectionIdInput, setSectionIdInput] = useState("");
  const [rows, setRows] = useState<RecurringScheduleRow[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [sessionRows, setSessionRows] = useState<ClassSessionRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleFormState>(emptyForm);
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

  const uniqueClassrooms = new Set(
    rows.map((row) => row.classroomName || String(row.classroomId)),
  ).size;

  const loadSchedules = async (sectionIdOverride?: number) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const sectionId = sectionIdOverride ?? Number(sectionIdInput);
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      setErrorMessage("Vui lòng nhap section ID hop le.");
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
      setSuccessMessage(`Đã tải ${nextRows.length} lịch học lap lai cua section ${sectionId}.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

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

  const resetForm = () => {
    setEditingRowId(null);
    setForm((prev) => ({
      ...emptyForm,
      sectionId: prev.sectionId || sectionIdInput,
    }));
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

    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      setErrorMessage("Mã lớp học phần không hop le.");
      return;
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      setErrorMessage("Mã phòng học không hop le.");
      return;
    }

    if (endPeriod < startPeriod) {
      setErrorMessage("Tiet ket thuc phai lon hon hoac bạng tiet bat dau.");
      return;
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
      };

      if (editingRowId) {
        await updateDynamicByPath(
          `/api/v1/recurring-schedules/${editingRowId}`,
          payload,
          authorization,
        );
        setSuccessMessage(`Đã cập nhật lịch học lap lai #${editingRowId}.`);
      } else {
        await createDynamicByPath("/api/v1/recurring-schedules", payload, authorization);
        setSuccessMessage("Đã tạo lịch học lap lai moi.");
      }

      setSectionIdInput(String(sectionId));
      resetForm();
      await loadSchedules(sectionId);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (row: RecurringScheduleRow) => {
    setEditingRowId(row.id);
    setForm({
      sectionId: String(row.sectionId),
      classroomId: String(row.classroomId),
      dayOfWeek: String(row.dayOfWeek),
      startPeriod: String(row.startPeriod),
      endPeriod: String(row.endPeriod),
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleDelete = async (row: RecurringScheduleRow) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const accepted = window.confirm(
      `Bạn có chắc muốn xoa lịch học lap lai #${row.id} không?`,
    );
    if (!accepted) {
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      await deleteDynamicByPath(`/api/v1/recurring-schedules/${row.id}`, authorization);
      setSuccessMessage(`Đã xóa lịch học lap lai #${row.id}.`);
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
          <h2 className="text-[20px] font-semibold text-[#1a4f75]">
            Quản lý lịch học lap lai
          </h2>
          <p className="mt-1 text-sm text-[#5a7890]">
            Quản lý lịch học theo tung lop hoc phan va xem cac buổi học duoc sinh ra.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-[220px_160px_1fr]">
          <input
            className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
            placeholder="Mã lớp học phần"
            value={sectionIdInput}
            onChange={(event) => setSectionIdInput(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              void loadSchedules();
            }}
            disabled={isLoading}
            className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
          >
            Tải lịch học
          </button>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
              <p className="text-sm font-medium text-[#5f7d93]">Tổng lich</p>
              <p className="mt-2 text-[26px] font-bold text-[#1d5b82]">{rows.length}</p>
            </article>
            <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
              <p className="text-sm font-medium text-[#5f7d93]">Phong hoc</p>
              <p className="mt-2 text-[26px] font-bold text-[#2b67a1]">
                {uniqueClassrooms}
              </p>
            </article>
            <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
              <p className="text-sm font-medium text-[#5f7d93]">Buoi da tai</p>
              <p className="mt-2 text-[26px] font-bold text-[#1d7a47]">
                {sessionRows.length}
              </p>
            </article>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-[6px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-sm text-[#2f7b4f]">
            {successMessage}
          </p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <section className="rounded-[10px] border border-[#c7dceb] bg-white">
            <div className="border-b border-[#d9e7f1] px-4 py-3">
              <h3 className="text-[18px] font-semibold text-[#184f74]">
                Danh sách lịch học lap lai
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    <th className="px-3 py-3">Section</th>
                    <th className="px-3 py-3">Phong</th>
                    <th className="px-3 py-3">Thu</th>
                    <th className="px-3 py-3">Tiet</th>
                    <th className="px-3 py-3">Tạo luc</th>
                    <th className="px-3 py-3">Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[#1f567b]">
                          {row.sectionDisplayName || row.sectionCođể || row.sectionId}
                        </p>
                        <p className="mt-1 text-xs text-[#6b8497]">ID: {row.id}</p>
                      </td>
                      <td className="px-3 py-3">
                        {row.classroomName || row.classroomId}
                      </td>
                      <td className="px-3 py-3">
                        {row.dayOfWeekName || row.dayOfWeek}
                      </td>
                      <td className="px-3 py-3">
                        {row.startPeriod} - {row.endPeriod}
                        <p className="mt-1 text-xs text-[#6b8497]">
                          {row.startPeriodTime || "-"} / {row.endPeriodTime || "-"}
                        </p>
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
                            onClick={() => handleEdit(row)}
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
                      <td colSpan={6} className="px-3 py-6 text-center text-[#577086]">
                        Chưa co lịch học lap lai. Nhập section ID để tải hoac tao moi.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff]">
            <div className="border-b border-[#d9e7f1] px-4 py-3">
              <h3 className="text-[18px] font-semibold text-[#184f74]">
                {editingRowId
                  ? `Cập nhật lịch học #${editingRowId}`
                  : "Tạo lịch học lap lai"}
              </h3>
              <p className="mt-1 text-sm text-[#678197]">
                Tạo lich lap lai theo thu va tiet cho mot lop hoc phan cu the.
              </p>
            </div>

            <form className="space-y-3 px-4 py-4" onSubmit={handleSubmit}>
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-[#315972]">Mã lớp học phần</span>
                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={form.sectionId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, sectionId: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="1"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-[#315972]">Mã phòng học</span>
                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={form.classroomId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, classroomId: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="1"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-[#315972]">Thu trong tuan</span>
                <select
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={form.dayOfWeek}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))
                  }
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
                  <span className="text-sm font-semibold text-[#315972]">Tiet bat dau</span>
                  <select
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.startPeriod}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, startPeriod: event.target.value }))
                    }
                  >
                    {periodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Tiet ket thuc</span>
                  <select
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.endPeriod}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, endPeriod: event.target.value }))
                    }
                  >
                    {periodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {editingRowId ? "Luu cap nhat" : "Tạo lịch học"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isLoading}
                  className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Xóa form
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-[10px] border border-[#c7dceb] bg-white">
          <div className="flex items-center justify-between border-b border-[#d9e7f1] px-4 py-3">
            <div>
              <h3 className="text-[18px] font-semibold text-[#184f74]">
                Danh sách buổi học da sinh
              </h3>
              <p className="mt-1 text-sm text-[#678197]">
                {selectedSchedule
                  ? `Dang hiển thị buổi học cua lich #${selectedSchedule.id}.`
                  : "Chon mot lịch học va bam 'Xem buổi học' để tải danh sách."}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#cfdfec] text-[#305970]">
                  <th className="px-3 py-3">Ngay hoc</th>
                  <th className="px-3 py-3">Phong hoc</th>
                  <th className="px-3 py-3">Tiet hoc</th>
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
                      Chưa co dữ liệu buổi học.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
};


