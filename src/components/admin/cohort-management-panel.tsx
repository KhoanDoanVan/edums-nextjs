"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { TablePaginationControls } from "@/components/admin/table-pagination-controls";
import { toErrorMessage } from "@/components/admin/format-utils";
import { shouldHideFeedbackMessage } from "@/hooks/use-toast-feedback";
import { useTablePagination } from "@/hooks/use-table-pagination";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getDynamicListByPath,
  updateDynamicByPath,
} from "@/lib/admin/service";
import type { DynamicRow } from "@/lib/admin/types";

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

type CohortRow = {
  id: number;
  cohortName?: string;
  startYear?: number;
  endYear?: number;
  status?: string;
};

type CohortFormState = {
  cohortName: string;
  startYear: string;
  endYear: string;
  status: string;
};

const emptyCohortForm: CohortFormState = {
  cohortName: "",
  startYear: "",
  endYear: "",
  status: "ACTIVE",
};

const toCohortRows = (rows: DynamicRow[]): CohortRow[] => {
  return rows.map((row) => ({
    id: typeof row.id === "number" ? row.id : Number(row.id || 0),
    cohortName:
      typeof row.cohortName === "string" ? row.cohortName : undefined,
    startYear:
      typeof row.startYear === "number"
        ? row.startYear
        : Number(row.startYear || 0) || undefined,
    endYear:
      typeof row.endYear === "number"
        ? row.endYear
        : Number(row.endYear || 0) || undefined,
    status: typeof row.status === "string" ? row.status : undefined,
  }));
};

const getCohortProgressLabel = (cohort: CohortRow, currentYear: number): string => {
  if (cohort.startYear && cohort.startYear > currentYear) {
    return "Sắp mở";
  }

  if (
    cohort.startYear &&
    cohort.endYear &&
    cohort.startYear <= currentYear &&
    cohort.endYear >= currentYear
  ) {
    return "Đang đào tạo";
  }

  if (cohort.endYear && cohort.endYear < currentYear) {
    return "Đã kết thúc";
  }

  return "Chưa xác định";
};

const getCohortStatusClass = (label: string): string => {
  switch (label) {
    case "Đang đào tạo":
      return "bg-[#ebf8f0] text-[#1d7a47]";
    case "Sắp mở":
      return "bg-[#eef5ff] text-[#2b67a1]";
    case "Đã kết thúc":
      return "bg-[#fff3eb] text-[#b56223]";
    default:
      return "bg-[#eef4f8] text-[#4a6a7d]";
  }
};

export function CohortManagementPanel({
  authorization,
}: {
  authorization?: string;
}) {
  const currentYear = new Date().getFullYear();
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CohortFormState>(emptyCohortForm);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<CohortRow | null>(null);

  const loadRows = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await getDynamicListByPath("/api/v1/cohorts", authorization);
      setRows(toCohortRows(response.rows));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialRows = async () => {
      if (!authorization) {
        setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getDynamicListByPath("/api/v1/cohorts", authorization);
        setRows(toCohortRows(response.rows));
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialRows();
  }, [authorization]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      const progress = getCohortProgressLabel(row, currentYear);
      const matchesKeyword =
        !normalizedKeyword ||
        [row.cohortName, row.startYear, row.endYear, row.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedKeyword));

      const matchesStatus =
        statusFilter === "ALL" ||
        row.status === statusFilter ||
        progress === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [currentYear, keyword, rows, statusFilter]);

  const cohortPagination = useTablePagination(filteredRows);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyCohortForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const startYear = Number(form.startYear);
    const endYear = Number(form.endYear);

    if (!form.cohortName.trim()) {
      setErrorMessage("Vui lòng nhập tên niên khóa.");
      return;
    }

    if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
      setErrorMessage("Năm bắt đầu và năm kết thúc phải là số hợp lệ.");
      return;
    }

    if (endYear < startYear) {
      setErrorMessage("Năm kết thúc phải lớn hơn hoặc bằng năm bắt đầu.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = {
        cohortName: form.cohortName.trim(),
        startYear,
        endYear,
        status: form.status,
      };

      if (editingId) {
        await updateDynamicByPath(
          `/api/v1/cohorts/${editingId}`,
          payload,
          authorization,
        );
        setSuccessMessage(`Đã cập nhật niên khóa #${editingId}.`);
      } else {
        await createDynamicByPath("/api/v1/cohorts", payload, authorization);
        setSuccessMessage("Đã tạo niên khóa mới.");
      }

      resetForm();
      const response = await getDynamicListByPath("/api/v1/cohorts", authorization);
      setRows(toCohortRows(response.rows));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (row: CohortRow) => {
    setEditingId(row.id);
    setForm({
      cohortName: row.cohortName || "",
      startYear: row.startYear ? String(row.startYear) : "",
      endYear: row.endYear ? String(row.endYear) : "",
      status: row.status || "ACTIVE",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleDelete = (row: CohortRow) => {
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
      await deleteDynamicByPath(`/api/v1/cohorts/${row.id}`, authorization);
      setSuccessMessage(`Đã xóa niên khóa #${row.id}.`);
      const response = await getDynamicListByPath("/api/v1/cohorts", authorization);
      setRows(toCohortRows(response.rows));
      if (editingId === row.id) {
        resetForm();
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={contentCardClass}>
      <div className={sectionTitleClass}>
        <div>
          <h2>Quản lý niên khóa</h2>
          <p className="mt-1 text-sm font-medium text-[#5a7890]">
            Theo dõi niên khóa đang đào tạo, sắp mở và cập nhật nhanh theo từng năm.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadRows();
          }}
          disabled={isLoading}
          className="rounded-[4px] border border-[#9ec3dd] bg-white px-3 py-1.5 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
        >
          Làm mới
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_360px]">
          <section className="rounded-[10px] border border-[#c7dceb] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#d9e7f1] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#184f74]">
                  Danh sách niên khóa
                </h3>
                <p className="mt-1 text-sm text-[#678197]">
                  Bố cục ưu tiên theo dõi nhanh khoảng năm và trạng thái đào tạo.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[220px_180px]">
                <input
                  className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Tìm theo tên hoặc năm"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                <select
                  className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="Đang đào tạo">Đang đào tạo</option>
                  <option value="Sắp mở">Sắp mở</option>
                  <option value="Đã kết thúc">Đã kết thúc</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    <th className="px-3 py-3">Niên khóa</th>
                    <th className="px-3 py-3">Khoảng năm</th>
                    <th className="px-3 py-3">Tiến độ</th>
                    <th className="px-3 py-3">Trạng thái hệ thống</th>
                    <th className="px-3 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortPagination.paginatedRows.map((row) => {
                    const progressLabel = getCohortProgressLabel(row, currentYear);

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[#e0ebf4] text-[#3f6178]"
                      >
                        <td className="px-3 py-3">
                          <p className="font-semibold text-[#1f567b]">
                            {row.cohortName || "-"}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          {row.startYear || "-"} - {row.endYear || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getCohortStatusClass(
                              progressLabel,
                            )}`}
                          >
                            {progressLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-[#eef4f8] px-2.5 py-1 text-xs font-semibold text-[#47677e]">
                            {row.status || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              disabled={isLoading}
                              className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                            >
                              Chỉnh sửa
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
                    );
                  })}
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[#577086]">
                        Chưa có niên khóa phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <TablePaginationControls
              pageIndex={cohortPagination.pageIndex}
              pageSize={cohortPagination.pageSize}
              totalItems={cohortPagination.totalItems}
              totalPages={cohortPagination.totalPages}
              startItem={cohortPagination.startItem}
              endItem={cohortPagination.endItem}
              onPageChange={cohortPagination.setPageIndex}
              onPageSizeChange={cohortPagination.setPageSize}
            />
          </section>

          <section className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff]">
            <div className="border-b border-[#d9e7f1] px-4 py-3">
              <h3 className="text-[18px] font-semibold text-[#184f74]">
                {editingId ? `Cập nhật niên khóa #${editingId}` : "Tạo niên khóa mới"}
              </h3>
              <p className="mt-1 text-sm text-[#678197]">
                Nhập thông tin theo từng trường để thao tác nhanh và hạn chế sai payload.
              </p>
            </div>

            <form className="space-y-3 px-4 py-4" onSubmit={handleSubmit}>
              {errorMessage ? (
                <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage && !shouldHideFeedbackMessage(successMessage) ? (
                <p className="rounded-[6px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-sm text-[#2f7b4f]">
                  {successMessage}
                </p>
              ) : null}

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-[#315972]">Tên niên khóa</span>
                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={form.cohortName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cohortName: event.target.value }))
                  }
                  placeholder="Ví dụ: K2026 - 2030"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Năm bắt đầu</span>
                  <input
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.startYear}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, startYear: event.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="2026"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Năm kết thúc</span>
                  <input
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.endYear}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, endYear: event.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="2030"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-[#315972]">Trạng thái</span>
                <select
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {editingId ? "Lưu cập nhật" : "Tạo niên khóa"}
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
      </div>

      <ConfirmDialog
        open={Boolean(confirmDeleteRow)}
        title="Xác nhận xóa niên khóa"
        message={
          confirmDeleteRow
            ? `Bạn có chắc muốn xóa niên khóa ${confirmDeleteRow.cohortName || `#${confirmDeleteRow.id}`} không?`
            : ""
        }
        confirmText="Xóa"
        isProcessing={isLoading}
        onCancel={() => setConfirmDeleteRow(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </section>
  );
}
