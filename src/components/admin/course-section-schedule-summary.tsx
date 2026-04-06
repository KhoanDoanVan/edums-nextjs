"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  getDynamicListByPath,
} from "@/lib/admin/service";
import { toErrorMessage } from "@/components/admin/format-utils";
import type { DynamicRow } from "@/lib/admin/types";

type CourseSectionScheduleSummaryProps = {
  authorization?: string;
  sectionId: number;
  onOpenFullManagement: (sectionId: number) => void;
};

type ScheduleSummaryRow = {
  id: number;
  dayOfWeek?: number;
  dayOfWeekName?: string;
  startPeriod?: number;
  endPeriod?: number;
  classroomName?: string;
  startWeek?: number;
  endWeek?: number;
};

type ClassroomOption = {
  id: number;
  label: string;
};

const weekdayLabels: Record<number, string> = {
  1: "Thứ hai",
  2: "Thứ ba",
  3: "Thứ tư",
  4: "Thứ năm",
  5: "Thứ sáu",
  6: "Thứ bảy",
  7: "Chủ nhật",
};

const weekdayOptions = ["1", "2", "3", "4", "5", "6", "7"] as const;
const periodOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"] as const;

const toScheduleRows = (rows: DynamicRow[]): ScheduleSummaryRow[] => {
  const parsed: ScheduleSummaryRow[] = [];

  for (const row of rows) {
    const id = Number(row.id || 0);
    if (!Number.isInteger(id) || id <= 0) {
      continue;
    }

    parsed.push({
      id,
      dayOfWeek: Number(row.dayOfWeek || 0) || undefined,
      dayOfWeekName:
        typeof row.dayOfWeekName === "string" ? row.dayOfWeekName : undefined,
      startPeriod: Number(row.startPeriod || 0) || undefined,
      endPeriod: Number(row.endPeriod || 0) || undefined,
      classroomName:
        typeof row.classroomName === "string" ? row.classroomName : undefined,
      startWeek: Number(row.startWeek || 0) || undefined,
      endWeek: Number(row.endWeek || 0) || undefined,
    });
  }

  return parsed;
};

const toClassroomOptions = (rows: DynamicRow[]): ClassroomOption[] => {
  return rows
    .map((row) => {
      const id = Number(row.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      return {
        id,
        label:
          (typeof row.roomName === "string" && row.roomName.trim()) ||
          `Phong ${id}`,
      } satisfies ClassroomOption;
    })
    .filter((item): item is ClassroomOption => item !== null);
};

export function CourseSectionScheduleSummary({
  authorization,
  sectionId,
  onOpenFullManagement,
}: CourseSectionScheduleSummaryProps) {
  const [rows, setRows] = useState<ScheduleSummaryRow[]>([]);
  const [classroomOptions, setClassroomOptions] = useState<ClassroomOption[]>([]);
  const [form, setForm] = useState({
    classroomId: "",
    dayOfWeek: "1",
    startPeriod: "1",
    endPeriod: "2",
    startWeek: "1",
    endWeek: "8",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Lịch học định kỳ thất bại",
    successTitle: "Lịch học định kỳ thành công",
  });

  const previewRows = useMemo(() => rows.slice(0, 6), [rows]);

  const loadData = useCallback(async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      const [schedulesResponse, classroomsResponse] = await Promise.all([
        getDynamicListByPath(`/api/v1/recurring-schedules/section/${sectionId}`, authorization),
        getDynamicListByPath("/api/v1/classrooms", authorization),
      ]);

      setRows(toScheduleRows(schedulesResponse.rows));
      setClassroomOptions(toClassroomOptions(classroomsResponse.rows));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authorization, sectionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleQuickCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const classroomId = Number(form.classroomId);
    const dayOfWeek = Number(form.dayOfWeek);
    const startPeriod = Number(form.startPeriod);
    const endPeriod = Number(form.endPeriod);
    const startWeek = Number(form.startWeek);
    const endWeek = Number(form.endWeek);

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      setErrorMessage("Vui lòng chọn phòng học hợp lệ.");
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

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      await createDynamicByPath(
        "/api/v1/recurring-schedules",
        {
          sectionId,
          classroomId,
          dayOfWeek,
          startPeriod,
          endPeriod,
          startWeek,
          endWeek,
        },
        authorization,
      );

      setSuccessMessage("Đã thêm lịch định kỳ nhanh.");
      await loadData();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff]">
      <div className="flex items-center justify-between border-b border-[#d9e7f1] px-4 py-3">
        <div>
          <h4 className="text-[16px] font-semibold text-[#184f74]">Lịch học định kỳ</h4>
          <p className="mt-1 text-xs text-[#678197]">
            Tóm tắt lịch hiện có và thêm nhanh lịch mới cho lớp học phần này.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenFullManagement(sectionId)}
          className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
        >
          Quản lý đầy đủ
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        {errorMessage ? (
          <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-xs text-[#b03d3d]">
            {errorMessage}
          </p>
        ) : null}

        {successMessage && !shouldHideFeedbackMessage(successMessage) ? (
          <p className="rounded-[6px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-xs text-[#2f7b4f]">
            {successMessage}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-[8px] border border-[#dbe7f1] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f7fbfe] text-[#2d5a77]">
              <tr>
                <th className="px-3 py-2">Thứ</th>
                <th className="px-3 py-2">Tiết</th>
                <th className="px-3 py-2">Phòng</th>
                <th className="px-3 py-2">Tuần</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.id} className="border-t border-[#e0ebf4] text-[#365f7b]">
                  <td className="px-3 py-2">
                    {row.dayOfWeekName ||
                      (row.dayOfWeek ? weekdayLabels[row.dayOfWeek] || row.dayOfWeek : "-")}
                  </td>
                  <td className="px-3 py-2">
                    {row.startPeriod && row.endPeriod
                      ? `${row.startPeriod} - ${row.endPeriod}`
                      : "-"}
                  </td>
                  <td className="px-3 py-2">{row.classroomName || "-"}</td>
                  <td className="px-3 py-2">
                    {row.startWeek && row.endWeek
                      ? `${row.startWeek} - ${row.endWeek}`
                      : "-"}
                  </td>
                </tr>
              ))}
              {previewRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-xs text-[#688296]">
                    Chưa có lịch học định kỳ cho lớp học phần này.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form className="grid gap-2 md:grid-cols-6" onSubmit={handleQuickCreate}>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[#315972]">Phòng học</span>
            <select
              className="h-9 w-full rounded-[6px] border border-[#c8d3dd] px-2 text-sm outline-none focus:border-[#6aa8cf]"
              value={form.classroomId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, classroomId: event.target.value }))
              }
              disabled={isLoading}
            >
              <option value="">Chọn phòng học</option>
              {classroomOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#315972]">Thứ trong tuần</span>
            <select
              className="h-9 w-full rounded-[6px] border border-[#c8d3dd] px-2 text-sm outline-none focus:border-[#6aa8cf]"
              value={form.dayOfWeek}
              onChange={(event) => setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
              disabled={isLoading}
            >
              {weekdayOptions.map((option) => (
                <option key={option} value={option}>
                  {weekdayLabels[Number(option)]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#315972]">Tiết bắt đầu</span>
            <select
              className="h-9 w-full rounded-[6px] border border-[#c8d3dd] px-2 text-sm outline-none focus:border-[#6aa8cf]"
              value={form.startPeriod}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startPeriod: event.target.value }))
              }
              disabled={isLoading}
            >
              {periodOptions.map((option) => (
                <option key={`start-${option}`} value={option}>
                  Tiết {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#315972]">Tiết kết thúc</span>
            <select
              className="h-9 w-full rounded-[6px] border border-[#c8d3dd] px-2 text-sm outline-none focus:border-[#6aa8cf]"
              value={form.endPeriod}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, endPeriod: event.target.value }))
              }
              disabled={isLoading}
            >
              {periodOptions.map((option) => (
                <option key={`end-${option}`} value={option}>
                  Đến {option}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#315972]">Tuần bắt đầu</span>
              <input
                className="h-9 w-full rounded-[6px] border border-[#c8d3dd] px-2 text-sm outline-none focus:border-[#6aa8cf]"
                value={form.startWeek}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startWeek: event.target.value }))
                }
                inputMode="numeric"
                placeholder="Ví dụ: 1"
                disabled={isLoading}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#315972]">Tuần kết thúc</span>
              <input
                className="h-9 w-full rounded-[6px] border border-[#c8d3dd] px-2 text-sm outline-none focus:border-[#6aa8cf]"
                value={form.endWeek}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endWeek: event.target.value }))
                }
                inputMode="numeric"
                placeholder="Ví dụ: 8"
                disabled={isLoading}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="h-9 rounded-[6px] bg-[#0d6ea6] px-3 text-xs font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60 md:col-span-2"
          >
            Thêm lịch nhanh
          </button>
        </form>
      </div>
    </section>
  );
}
