"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import { getMyLecturerSchedule } from "@/lib/lecturer/service";
import type { LecturerScheduleRow } from "@/lib/lecturer/types";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Tải thời khóa biểu thất bại. Vui lòng thử lại.";
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
    return value ? "Yes" : "No";
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

const formatDateInput = (offsetDays = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

export default function LecturerDashboardPage() {
  const { session, logout } = useAuth();

  const [startDate, setStartDate] = useState(formatDateInput(0));
  const [endDate, setEndDate] = useState(formatDateInput(7));
  const [rows, setRows] = useState<LecturerScheduleRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Tải lịch giảng dạy thất bại",
    successTitle: "Tải lịch giảng dạy thành công",
  });

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows.slice(0, 80)) {
      for (const key of Object.keys(row)) {
        keys.add(key);
      }
    }
    return [...keys];
  }, [rows]);

  const handleLoadSchedule = async () => {
    if (!session?.authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      const nextRows = await getMyLecturerSchedule(
        startDate,
        endDate,
        session.authorization,
      );
      setRows(nextRows);
      setSuccessMessage(`Đã tải ${nextRows.length} bản ghi lịch giảng dạy.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard allowedRoles={["LECTURER"]}>
      <main className="min-h-screen bg-[#edf1f5] px-4 py-6">
        <div className="mx-auto w-full max-w-[1100px] space-y-4">
          <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c5dced] px-4 py-3">
              <div>
                <h1 className="text-[22px] font-semibold text-[#1a4f75]">Dashboard giảng viên</h1>
                <p className="mt-1 text-sm text-[#4f6d82]">
                  Tra cứu thời khóa biểu giảng dạy theo khoảng ngày.
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

            <div className="grid gap-2 px-4 py-4 sm:grid-cols-[180px_180px_140px]">
              <input
                type="date"
                className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <input
                type="date"
                className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  void handleLoadSchedule();
                }}
                disabled={isLoading}
                className="h-10 rounded-[6px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                {isLoading ? "Đang tải..." : "Tải lịch"}
              </button>
            </div>

            {(errorMessage || successMessage) && (
              <div className="space-y-2 px-4 pb-3 text-sm">
                {errorMessage ? (
                  <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                    {errorMessage}
                  </p>
                ) : null}
                {successMessage && !shouldHideFeedbackMessage(successMessage) ? (
                  <p className="rounded-[4px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                    {successMessage}
                  </p>
                ) : null}
              </div>
            )}

            <div className="overflow-x-auto px-4 pb-4">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    {columns.map((column) => (
                      <th key={column} className="px-2 py-2">
                        {toColumnLabel(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`schedule-row-${rowIndex + 1}`} className="border-b border-[#e0ebf4] text-[#3f6178]">
                      {columns.map((column) => (
                        <td key={`${rowIndex + 1}-${column}`} className="max-w-[260px] px-2 py-2">
                          <span className="line-clamp-2">{toDisplayValue(row[column])}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(columns.length, 1)} className="px-2 py-4 text-center text-[#577086]">
                        Chưa có dữ liệu lịch giảng dạy.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </AuthGuard>
  );
}
