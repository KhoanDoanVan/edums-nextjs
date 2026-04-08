"use client";

import { useMemo, useState } from "react";
import {
  createAttendancesBatch,
  deleteAttendance,
  getAttendancesBySession,
  getGuardianStudentAttendances,
  getStudentAttendances,
  updateAttendance,
} from "@/lib/admin/service";
import { TablePaginationControls } from "@/components/admin/table-pagination-controls";
import { toErrorMessage } from "@/components/admin/format-utils";
import { buildColumns, toColumnLabel, toDisplayValue } from "@/components/admin/table-utils";
import { useTablePagination } from "@/hooks/use-table-pagination";
import type {
  AttendanceItem,
  AttendanceStatus,
  DynamicRow,
} from "@/lib/admin/types";

type TablePaginationState = {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  paginatedRows: DynamicRow[];
  setPageIndex: (nextPageIndex: number) => void;
  setPageSize: (nextPageSize: number) => void;
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

export function AttendanceManagementPanel({
  authorization,
}: {
  authorization?: string;
}) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [attendanceRows, setAttendanceRows] = useState<DynamicRow[]>([]);
  const [guardianAttendanceRows, setGuardianAttendanceRows] = useState<AttendanceItem[]>([]);
  const [attendanceSessionRows, setAttendanceSessionRows] = useState<AttendanceItem[]>([]);
  const [attendanceStudentIdInput, setAttendanceStudentIdInput] = useState("");
  const [attendanceGuardianIdInput, setAttendanceGuardianIdInput] = useState("");
  const [attendanceGuardianStudentIdInput, setAttendanceGuardianStudentIdInput] =
    useState("");
  const [attendanceSessionIdInput, setAttendanceSessionIdInput] = useState("");
  const [attendanceBatchSessionIdInput, setAttendanceBatchSessionIdInput] = useState("");
  const [attendanceActionIdInput, setAttendanceActionIdInput] = useState("");
  const [attendanceActionStatus, setAttendanceActionStatus] =
    useState<AttendanceStatus>("PRESENT");
  const [attendanceActionNote, setAttendanceActionNote] = useState("");
  const [attendanceBatchRows, setAttendanceBatchRows] = useState<
    Array<{ courseRegistrationId: string; status: AttendanceStatus; note: string }>
  >([{ courseRegistrationId: "1", status: "PRESENT", note: "" }]);

  const attendanceColumns = useMemo(
    () =>
      buildColumns(attendanceRows, [
        "id",
        "studentId",
        "sessionId",
        "sessionDate",
        "status",
        "note",
      ]),
    [attendanceRows],
  );

  const guardianAttendanceColumns = useMemo(
    () =>
      buildColumns(guardianAttendanceRows as unknown as DynamicRow[], [
        "id",
        "studentId",
        "studentCode",
        "sessionId",
        "sessionDate",
        "status",
        "note",
      ]),
    [guardianAttendanceRows],
  );

  const sessionAttendanceColumns = useMemo(
    () =>
      buildColumns(attendanceSessionRows as unknown as DynamicRow[], [
        "id",
        "sessionId",
        "studentId",
        "studentCode",
        "status",
        "note",
      ]),
    [attendanceSessionRows],
  );

  const attendancePagination = useTablePagination(attendanceRows);
  const guardianAttendancePagination = useTablePagination(
    guardianAttendanceRows as unknown as DynamicRow[],
  );
  const sessionAttendancePagination = useTablePagination(
    attendanceSessionRows as unknown as DynamicRow[],
  );

  const requireAuthorization = (): string | null => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return null;
    }

    return authorization;
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      setIsWorking(true);
      setErrorMessage("");
      setSuccessMessage("");
      await action();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const parsePositiveInteger = (
    rawValue: string,
    fieldLabel: string,
  ): number | null => {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setErrorMessage(`${fieldLabel} không hop le.`);
      return null;
    }

    return parsed;
  };

  const handleAttendanceBatchRowChange = (
    index: number,
    field: "courseRegistrationId" | "status" | "note",
    value: string,
  ) => {
    setAttendanceBatchRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  };

  const addAttendanceBatchRow = () => {
    setAttendanceBatchRows((prev) => [
      ...prev,
      { courseRegistrationId: "", status: "PRESENT", note: "" },
    ]);
  };

  const removeAttendanceBatchRow = (index: number) => {
    setAttendanceBatchRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleLoadAttendances = async () => {
    const token = requireAuthorization();
    const studentId = parsePositiveInteger(attendanceStudentIdInput, "Mã sinh viên");
    if (!token || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getStudentAttendances(studentId, token);
      setAttendanceRows(data);
      setSuccessMessage(`Đã tải ${data.length} bản ghi điểm danh cho student ${studentId}.`);
    });
  };

  const handleLoadAttendancesBySession = async () => {
    const token = requireAuthorization();
    const sessionId = parsePositiveInteger(attendanceSessionIdInput, "Mã buổi học");
    if (!token || !sessionId) {
      return;
    }

    await runAction(async () => {
      const data = await getAttendancesBySession(sessionId, token);
      setAttendanceSessionRows(data);
      setSuccessMessage(`Đã tải ${data.length} điểm danh theo session #${sessionId}.`);
    });
  };

  const handleLoadGuardianStudentAttendances = async () => {
    const token = requireAuthorization();
    const guardianId = parsePositiveInteger(attendanceGuardianIdInput, "Mã phụ huynh");
    const studentId = parsePositiveInteger(
      attendanceGuardianStudentIdInput,
      "Mã sinh viên",
    );
    if (!token || !guardianId || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getGuardianStudentAttendances(guardianId, studentId, token);
      setGuardianAttendanceRows(data);
      setSuccessMessage(
        `Đã tải ${data.length} bản ghi điểm danh cho phụ huynh #${guardianId} và sinh viên #${studentId}.`,
      );
    });
  };

  const handleCreateAttendancesBatch = async () => {
    const token = requireAuthorization();
    const sessionId = parsePositiveInteger(
      attendanceBatchSessionIdInput,
      "Mã buổi học cho batch",
    );
    if (!token || !sessionId) {
      return;
    }

    const items = attendanceBatchRows
      .map((row) => {
        const courseRegistrationId = Number(row.courseRegistrationId);
        if (!Number.isInteger(courseRegistrationId) || courseRegistrationId <= 0) {
          return null;
        }

        if (!attendanceStatusOptions.includes(row.status)) {
          return null;
        }

        const nextItem: {
          courseRegistrationId: number;
          status: AttendanceStatus;
          note?: string;
        } = {
          courseRegistrationId,
          status: row.status,
        };

        const note = row.note.trim();
        if (note) {
          nextItem.note = note;
        }

        return nextItem;
      })
      .filter(
        (
          row,
        ): row is { courseRegistrationId: number; status: AttendanceStatus; note?: string } =>
          row !== null,
      );

    if (items.length === 0) {
      setErrorMessage("Danh sách batch không hop le hoặc đang để trống.");
      return;
    }

    await runAction(async () => {
      const data = await createAttendancesBatch(sessionId, { items }, token);
      setAttendanceSessionRows(data);
      setSuccessMessage(`Đã tạo/cập nhật batch điểm danh cho session #${sessionId}.`);
    });
  };

  const handleUpdateAttendance = async () => {
    const token = requireAuthorization();
    const attendanceId = parsePositiveInteger(attendanceActionIdInput, "Mã attendance");
    if (!token || !attendanceId) {
      return;
    }

    await runAction(async () => {
      await updateAttendance(
        attendanceId,
        {
          status: attendanceActionStatus,
          note: attendanceActionNote.trim() || undefined,
        },
        token,
      );
      if (attendanceSessionIdInput.trim()) {
        const sessionId = parsePositiveInteger(attendanceSessionIdInput, "Mã buổi học");
        if (sessionId) {
          const data = await getAttendancesBySession(sessionId, token);
          setAttendanceSessionRows(data);
        }
      }
      setSuccessMessage(`Đã cập nhật attendance #${attendanceId}.`);
    });
  };

  const handleDeleteAttendance = async () => {
    const token = requireAuthorization();
    const attendanceId = parsePositiveInteger(attendanceActionIdInput, "Mã attendance");
    if (!token || !attendanceId) {
      return;
    }

    await runAction(async () => {
      await deleteAttendance(attendanceId, token);
      if (attendanceSessionIdInput.trim()) {
        const sessionId = parsePositiveInteger(attendanceSessionIdInput, "Mã buổi học");
        if (sessionId) {
          const data = await getAttendancesBySession(sessionId, token);
          setAttendanceSessionRows(data);
        }
      }
      setSuccessMessage(`Đã xóa attendance #${attendanceId}.`);
    });
  };

  const renderDynamicTable = (
    title: string,
    rows: DynamicRow[],
    columns: string[],
    pagination: TablePaginationState,
  ) => {
    return (
      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>{title}</h2>
          <span className="text-sm font-medium text-[#396786]">{rows.length} bản ghi</span>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#cfdfec] text-[#305970]">
                <th className="w-16 px-2 py-2">STT</th>
                {columns.map((column) => (
                  <th key={column} className="px-2 py-2">
                    {toColumnLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedRows.map((row, index) => (
                <tr key={`dynamic-row-${index}`} className="border-b border-[#e0ebf4] text-[#3f6178]">
                  <td className="px-2 py-2 font-medium text-[#355970]">
                    {pagination.startItem + index}
                  </td>
                  {columns.map((column) => (
                    <td key={`${index}-${column}`} className="max-w-[260px] px-2 py-2">
                      <span className="line-clamp-2">{toDisplayValue(row[column])}</span>
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length + 1, 1)} className="px-2 py-4 text-center text-[#577086]">
                    Chưa co dữ liệu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <TablePaginationControls
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
          startItem={pagination.startItem}
          endItem={pagination.endItem}
          onPageChange={pagination.setPageIndex}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>
    );
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
          <h2>Quản lý điểm danh theo sinh viên</h2>
        </div>
        <div className="grid gap-4 px-4 py-4 xl:grid-cols-2">
          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <h3 className="text-base font-semibold text-[#1a4f75]">Tra cứu theo sinh viên / session</h3>
            <div className="grid gap-2 sm:grid-cols-[220px_160px]">
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Mã sinh viên"
                value={attendanceStudentIdInput}
                onChange={(event) => setAttendanceStudentIdInput(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  void handleLoadAttendances();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Tải theo sinh viên
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_160px]">
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Mã session"
                value={attendanceSessionIdInput}
                onChange={(event) => setAttendanceSessionIdInput(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  void handleLoadAttendancesBySession();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Tải theo session
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[180px_180px_180px]">
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Mã phụ huynh"
                value={attendanceGuardianIdInput}
                onChange={(event) => setAttendanceGuardianIdInput(event.target.value)}
              />
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Mã sinh viên của phụ huynh"
                value={attendanceGuardianStudentIdInput}
                onChange={(event) => setAttendanceGuardianStudentIdInput(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  void handleLoadGuardianStudentAttendances();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Tải theo phụ huynh
              </button>
            </div>
          </section>

          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <h3 className="text-base font-semibold text-[#1a4f75]">Batch và chỉnh sửa attendance</h3>
            <div className="grid gap-2 sm:grid-cols-[220px_180px]">
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Session ID cho batch"
                value={attendanceBatchSessionIdInput}
                onChange={(event) => setAttendanceBatchSessionIdInput(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  void handleCreateAttendancesBatch();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Gửi batch
              </button>
            </div>
            <div className="space-y-2 rounded-[6px] border border-[#d7e7f3] bg-white p-2">
              {attendanceBatchRows.map((row, index) => (
                <div
                  key={`attendance-batch-row-${index + 1}`}
                  className="grid gap-2 sm:grid-cols-[1fr_140px_1fr_36px]"
                >
                  <input
                    className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Course registration ID"
                    value={row.courseRegistrationId}
                    onChange={(event) =>
                      handleAttendanceBatchRowChange(index, "courseRegistrationId", event.target.value)
                    }
                  />
                  <select
                    className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={row.status}
                    onChange={(event) =>
                      handleAttendanceBatchRowChange(index, "status", event.target.value)
                    }
                  >
                    {attendanceStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Ghi chú"
                    value={row.note}
                    onChange={(event) =>
                      handleAttendanceBatchRowChange(index, "note", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeAttendanceBatchRow(index)}
                    disabled={attendanceBatchRows.length === 1 || isWorking}
                    className="h-9 rounded-[4px] bg-[#cc3a3a] px-2 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                    aria-label="Xóa dòng batch"
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAttendanceBatchRow}
                disabled={isWorking}
                className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Thêm dòng batch
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_140px_1fr]">
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Attendance ID"
                value={attendanceActionIdInput}
                onChange={(event) => setAttendanceActionIdInput(event.target.value)}
              />
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={attendanceActionStatus}
                onChange={(event) => setAttendanceActionStatus(event.target.value as AttendanceStatus)}
              >
                {attendanceStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Ghi chú"
                value={attendanceActionNote}
                onChange={(event) => setAttendanceActionNote(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleUpdateAttendance();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Cập nhật attendance
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteAttendance();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] bg-[#cc3a3a] px-3 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
              >
                Xóa attendance
              </button>
            </div>
          </section>
        </div>
      </section>

      {renderDynamicTable(
        "Bạng điểm danh theo sinh viên",
        attendanceRows,
        attendanceColumns,
        attendancePagination,
      )}
      {renderDynamicTable(
        "Bảng điểm danh theo phụ huynh - sinh viên",
        guardianAttendanceRows as unknown as DynamicRow[],
        guardianAttendanceColumns,
        guardianAttendancePagination,
      )}
      {renderDynamicTable(
        "Bạng điểm danh theo buổi học (session)",
        attendanceSessionRows as unknown as DynamicRow[],
        sessionAttendanceColumns,
        sessionAttendancePagination,
      )}
    </div>
  );
}
