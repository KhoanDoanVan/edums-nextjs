"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getDynamicListByPath,
  updateDynamicByPath,
} from "@/lib/admin/service";
import type { DynamicRow } from "@/lib/admin/types";

interface GradeComponentPanelProps {
  authorization?: string;
}

interface GradeComponentRow {
  id: number;
  componentName: string;
  weightPercentage: number;
  courseId: number;
}

interface GradeComponentFormState {
  componentName: string;
  weightPercentage: string;
  courseId: string;
}

const emptyForm: GradeComponentFormState = {
  componentName: "",
  weightPercentage: "",
  courseId: "",
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Thao tác thất bại. Vui lòng thử lại.";
};

const toGradeComponentRows = (rows: DynamicRow[]): GradeComponentRow[] => {
  return rows
    .map((row) => ({
      id: typeof row.id === "number" ? row.id : Number(row.id || 0),
      componentName:
        typeof row.componentName === "string" ? row.componentName : "",
      weightPercentage:
        typeof row.weightPercentage === "number"
          ? row.weightPercentage
          : Number(row.weightPercentage || 0),
      courseId:
        typeof row.courseId === "number" ? row.courseId : Number(row.courseId || 0),
    }))
    .filter((row) => row.id > 0);
};

export const GradeComponentPanel = ({
  authorization,
}: GradeComponentPanelProps) => {
  const [rows, setRows] = useState<GradeComponentRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [form, setForm] = useState<GradeComponentFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác cấu hình điểm thất bại",
    successTitle: "Thao tác cấu hình điểm thành công",
  });

  const loadRows = useCallback(async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await getDynamicListByPath(
        "/api/v1/grade-components",
        authorization,
      );
      setRows(toGradeComponentRows(response.rows));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authorization]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedCourse = courseFilter.trim();

    return rows.filter((row) => {
      const matchesKeyword =
        !normalizedKeyword ||
        row.componentName.toLowerCase().includes(normalizedKeyword) ||
        String(row.courseId).includes(normalizedKeyword);
      const matchesCourse =
        !normalizedCourse || String(row.courseId) === normalizedCourse;

      return matchesKeyword && matchesCourse;
    });
  }, [courseFilter, keyword, rows]);

  const totalWeight = filteredRows.reduce(
    (total, row) => total + (row.weightPercentage || 0),
    0,
  );

  const resetForm = () => {
    setEditingRowId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const componentName = form.componentName.trim();
    const courseId = Number(form.courseId);
    const weightPercentage = Number(form.weightPercentage);

    if (!componentName) {
      setErrorMessage("Vui lòng nhap ten thành phần điểm.");
      return;
    }

    if (!Number.isInteger(courseId) || courseId <= 0) {
      setErrorMessage("Mã môn học không hop le.");
      return;
    }

    if (Number.isNaN(weightPercentage) || weightPercentage < 0 || weightPercentage > 100) {
      setErrorMessage("Trong so phai nam trong khoang 0 den 100.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = {
        componentName,
        weightPercentage,
        courseId,
      };

      if (editingRowId) {
        await updateDynamicByPath(
          `/api/v1/grade-components/${editingRowId}`,
          payload,
          authorization,
        );
        setSuccessMessage(`Đã cập nhật thành phần điểm #${editingRowId}.`);
      } else {
        await createDynamicByPath("/api/v1/grade-components", payload, authorization);
        setSuccessMessage("Đã tạo thành phần điểm moi.");
      }

      resetForm();
      const response = await getDynamicListByPath(
        "/api/v1/grade-components",
        authorization,
      );
      setRows(toGradeComponentRows(response.rows));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (row: GradeComponentRow) => {
    setEditingRowId(row.id);
    setForm({
      componentName: row.componentName,
      weightPercentage: String(row.weightPercentage),
      courseId: String(row.courseId),
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleDelete = async (row: GradeComponentRow) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const accepted = window.confirm(
      `Bạn có chắc muốn xoa thành phần điểm "${row.componentName}" không?`,
    );

    if (!accepted) {
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      await deleteDynamicByPath(`/api/v1/grade-components/${row.id}`, authorization);
      setSuccessMessage(`Đã xóa thành phần điểm #${row.id}.`);
      const response = await getDynamicListByPath(
        "/api/v1/grade-components",
        authorization,
      );
      setRows(toGradeComponentRows(response.rows));
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
          <h2 className="text-[20px] font-semibold text-[#1a4f75]">Cấu hình điểm</h2>
          <p className="mt-1 text-sm text-[#5a7890]">
            Quản lý cac thành phần điểm theo môn học voi form cấu trúc rõ ràng hơn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadRows();
          }}
          disabled={isLoading}
          className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-1.5 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
        >
          Làm mới
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
            <p className="text-sm font-medium text-[#5f7d93]">Tổng thanh phan</p>
            <p className="mt-2 text-[28px] font-bold text-[#1d5b82]">{rows.length}</p>
          </article>
          <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
            <p className="text-sm font-medium text-[#5f7d93]">Sau bo loc</p>
            <p className="mt-2 text-[28px] font-bold text-[#2b67a1]">
              {filteredRows.length}
            </p>
          </article>
          <article className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3">
            <p className="text-sm font-medium text-[#5f7d93]">Tổng trọng số hiển thị</p>
            <p className="mt-2 text-[28px] font-bold text-[#1d7a47]">
              {totalWeight.toFixed(1)}%
            </p>
          </article>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_360px]">
          <section className="rounded-[10px] border border-[#c7dceb] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#d9e7f1] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#184f74]">
                  Danh sách thành phần điểm
                </h3>
                <p className="mt-1 text-sm text-[#678197]">
                  Tap trung vao ten thanh phan, môn học va trọng số để thao tac nhanh.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[220px_140px]">
                <input
                  className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Tim theo ten thanh phan"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                <input
                  className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Mã môn học"
                  value={courseFilter}
                  onChange={(event) => setCourseFilter(event.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    <th className="px-3 py-3">Ten thanh phan</th>
                    <th className="px-3 py-3">Mã môn học</th>
                    <th className="px-3 py-3">Trong so</th>
                    <th className="px-3 py-3">Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                      <td className="px-3 py-3 font-semibold text-[#1f567b]">
                        {row.componentName}
                      </td>
                      <td className="px-3 py-3">{row.courseId}</td>
                      <td className="px-3 py-3">{row.weightPercentage}%</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
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
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[#577086]">
                        Chưa co thành phần điểm phu hop voi bo loc hiện tại.
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
                  ? `Cập nhật thành phần điểm #${editingRowId}`
                  : "Tạo thành phần điểm moi"}
              </h3>
              <p className="mt-1 text-sm text-[#678197]">
                Form truc tiep giup thao tac nhanh hon so voi editor JSON thong thuong.
              </p>
            </div>

            <form className="space-y-3 px-4 py-4" onSubmit={handleSubmit}>
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

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-[#315972]">
                  Ten thành phần điểm
                </span>
                <input
                  className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={form.componentName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      componentName: event.target.value,
                    }))
                  }
                  placeholder="VD: Quiz, Giua ky, Cuoi ky"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Mã môn học</span>
                  <input
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.courseId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, courseId: event.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="1"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-[#315972]">Trong so (%)</span>
                  <input
                    className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={form.weightPercentage}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        weightPercentage: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="30"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {editingRowId ? "Luu cap nhat" : "Tạo thanh phan"}
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
    </section>
  );
};


