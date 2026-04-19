"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import { TablePaginationControls } from "@/components/admin/table-pagination-controls";
import {
  createDynamicByPath,
  getCoursesByFaculty,
  deleteDynamicByPath,
  getDynamicListByPath,
  getGradeComponentsByCourse,
  updateDynamicByPath,
} from "@/lib/admin/service";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { toErrorMessage } from "@/components/admin/format-utils";
import { useTablePagination } from "@/hooks/use-table-pagination";
import type { DynamicRow } from "@/lib/admin/types";

interface GradeComponentPanelProps {
  authorization?: string;
}

interface CourseRow {
  id: number;
  courseCode: string;
  courseName: string;
  facultyName: string;
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
}

const emptyForm: GradeComponentFormState = {
  componentName: "",
  weightPercentage: "",
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const toText = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toCourseRows = (rows: DynamicRow[]): CourseRow[] => {
  return rows
    .map((row) => {
      const id = typeof row.id === "number" ? row.id : Number(row.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      const nestedFaculty = toRecord(row.faculty);
      const facultyName =
        toText(row.facultyName) ||
        toText(nestedFaculty?.facultyName) ||
        toText(row.facultyCode) ||
        toText(nestedFaculty?.facultyCode);
      const courseName = toText(row.courseName) || `Môn học #${id}`;
      const courseCode = toText(row.courseCode);

      return {
        id,
        courseCode,
        courseName,
        facultyName,
      };
    })
    .filter((row): row is CourseRow => row !== null);
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
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [rows, setRows] = useState<GradeComponentRow[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const [facultyFilter, setFacultyFilter] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);
  const [keyword, setKeyword] = useState("");
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [form, setForm] = useState<GradeComponentFormState>(emptyForm);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<GradeComponentRow | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác cấu hình điểm thất bại",
    successTitle: "Thao tác cấu hình điểm thành công",
  });

  const loadCourseRows = useCallback(async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setIsLoadingCourses(true);
      setErrorMessage("");
      const facultyId = Number(facultyFilter);
      const hasFacultyFilter = Number.isInteger(facultyId) && facultyId > 0;

      const [courseResponse, faculties] = await Promise.all([
        hasFacultyFilter
          ? getCoursesByFaculty(facultyId, authorization)
          : getDynamicListByPath("/api/v1/courses", authorization, {
              page: 0,
              size: 500,
            }),
        getDynamicListByPath("/api/v1/faculties", authorization),
      ]);

      const nextCourses = toCourseRows(courseResponse.rows).sort((left, right) => {
        if (left.courseName !== right.courseName) {
          return left.courseName.localeCompare(right.courseName, "vi");
        }
        return left.courseCode.localeCompare(right.courseCode, "vi");
      });

      setCourses(nextCourses);
      setSelectedCourse((current) => {
        if (!current) {
          return current;
        }

        return nextCourses.find((item) => item.id === current.id) || null;
      });

      const nextFacultyOptions = faculties.rows
        .map((item) => {
          const id = Number(item.id || 0);
          if (!Number.isInteger(id) || id <= 0) {
            return null;
          }
          const label =
            (typeof item.facultyName === "string" && item.facultyName) ||
            (typeof item.facultyCode === "string" && item.facultyCode) ||
            String(id);
          return { id, label };
        })
        .filter((item): item is { id: number; label: string } => item !== null);
      setFacultyOptions(nextFacultyOptions);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoadingCourses(false);
    }
  }, [authorization, facultyFilter]);

  const loadSelectedCourseComponents = useCallback(
    async (courseId: number) => {
      if (!authorization) {
        setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
        return;
      }

      try {
        setIsLoadingComponents(true);
        setErrorMessage("");
        const courseRows = await getGradeComponentsByCourse(courseId, authorization);
        setRows(toGradeComponentRows(courseRows));
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setIsLoadingComponents(false);
      }
    },
    [authorization],
  );

  useEffect(() => {
    void loadCourseRows();
  }, [loadCourseRows]);

  const filteredCourses = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesKeyword =
        !normalizedKeyword ||
        course.courseName.toLowerCase().includes(normalizedKeyword) ||
        course.courseCode.toLowerCase().includes(normalizedKeyword) ||
        course.facultyName.toLowerCase().includes(normalizedKeyword) ||
        String(course.id).includes(normalizedKeyword);

      return matchesKeyword;
    });
  }, [courses, keyword]);

  const coursePagination = useTablePagination(filteredCourses);
  const gradeComponentPagination = useTablePagination(rows);

  const isWorking = isLoadingCourses || isLoadingComponents || isSubmitting;

  const openCourseModal = (course: CourseRow) => {
    setSelectedCourse(course);
    setRows([]);
    setEditingRowId(null);
    setForm(emptyForm);
    setConfirmDeleteRow(null);
    setSuccessMessage("");
    setErrorMessage("");
    void loadSelectedCourseComponents(course.id);
  };

  const closeCourseModal = () => {
    setSelectedCourse(null);
    setRows([]);
    setEditingRowId(null);
    setForm(emptyForm);
    setConfirmDeleteRow(null);
    setErrorMessage("");
    setSuccessMessage("");
  };

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

    if (!selectedCourse) {
      setErrorMessage("Vui lòng chọn môn học để cấu hình điểm.");
      return;
    }

    const componentName = form.componentName.trim();
    const weightPercentage = Number(form.weightPercentage);

    if (!componentName) {
      setErrorMessage("Vui lòng nhập tên thành phần điểm.");
      return;
    }

    if (Number.isNaN(weightPercentage) || weightPercentage < 0 || weightPercentage > 100) {
      setErrorMessage("Trọng số phải nằm trong khoảng từ 0 đến 100.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = {
        componentName,
        weightPercentage,
        courseId: selectedCourse.id,
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
        setSuccessMessage("Đã tạo thành phần điểm mới.");
      }

      resetForm();
      await loadSelectedCourseComponents(selectedCourse.id);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (row: GradeComponentRow) => {
    setEditingRowId(row.id);
    setForm({
      componentName: row.componentName,
      weightPercentage: String(row.weightPercentage),
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleDelete = (row: GradeComponentRow) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    if (!selectedCourse) {
      setErrorMessage("Vui lòng chọn môn học để thực hiện thao tác.");
      return;
    }

    setConfirmDeleteRow(row);
  };

  const handleConfirmDelete = async () => {
    if (!authorization || !confirmDeleteRow || !selectedCourse) {
      return;
    }

    const row = confirmDeleteRow;
    setConfirmDeleteRow(null);

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await deleteDynamicByPath(`/api/v1/grade-components/${row.id}`, authorization);
      setSuccessMessage(`Đã xóa thành phần điểm #${row.id}.`);
      await loadSelectedCourseComponents(selectedCourse.id);
      if (editingRowId === row.id) {
        resetForm();
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
      <div className="border-b border-[#c5dced] px-4 py-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#1a4f75]">Cấu hình điểm theo môn học</h2>
          <p className="mt-1 text-sm text-[#5a7890]">
            Chọn môn học trong danh sách để mở popup cấu hình thành phần điểm.
          </p>
        </div>
      </div>

      <div className="border-b border-[#d9e7f1] px-4 py-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_240px_auto]">
          <input
            className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
            placeholder="Tìm theo tên/mã môn học"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
            value={facultyFilter}
            onChange={(event) => {
              setFacultyFilter(event.target.value);
            }}
          >
            <option value="">Tất cả khoa</option>
            {facultyOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2 xl:justify-end">
            <button
              type="button"
              onClick={() => {
                void loadCourseRows();
              }}
              disabled={isWorking}
              className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
            >
              Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2 px-4 pt-3">
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
      </div>

      <div className="overflow-x-auto px-4 pb-1 pt-3">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#cfdfec] text-[#305970]">
              <th className="px-3 py-3">STT</th>
              <th className="px-3 py-3">Mã môn học</th>
              <th className="px-3 py-3">Môn học</th>
              <th className="px-3 py-3">Khoa</th>
              <th className="px-3 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {coursePagination.paginatedRows.map((course, index) => (
              <tr key={course.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                <td className="px-3 py-3">{coursePagination.startItem + index}</td>
                <td className="px-3 py-3 font-semibold text-[#1f567b]">
                  {course.courseCode || `MH-${course.id}`}
                </td>
                <td className="px-3 py-3">{course.courseName}</td>
                <td className="px-3 py-3">{course.facultyName || "-"}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openCourseModal(course)}
                      disabled={isWorking}
                      className="h-9 rounded-[6px] bg-[#0d6ea6] px-3 text-xs font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Cấu hình điểm
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCourses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#577086]">
                  Chưa có môn học phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePaginationControls
        pageIndex={coursePagination.pageIndex}
        pageSize={coursePagination.pageSize}
        totalItems={coursePagination.totalItems}
        totalPages={coursePagination.totalPages}
        startItem={coursePagination.startItem}
        endItem={coursePagination.endItem}
        onPageChange={coursePagination.setPageIndex}
        onPageSizeChange={coursePagination.setPageSize}
      />

      {selectedCourse ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c2a]/45 p-4"
          onClick={closeCourseModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_8px_28px_rgba(7,51,84,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#c5dced] px-4 py-3">
              <div>
                <h3 className="text-[19px] font-semibold text-[#1a4f75]">
                  Cấu hình điểm: {selectedCourse.courseName}
                </h3>
                <p className="mt-1 text-sm text-[#5a7890]">
                  {selectedCourse.courseCode
                    ? `Mã môn học: ${selectedCourse.courseCode}`
                    : `Môn học ID: ${selectedCourse.id}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void loadSelectedCourseComponents(selectedCourse.id);
                  }}
                  disabled={isWorking}
                  className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Làm mới
                </button>
                <button
                  type="button"
                  onClick={closeCourseModal}
                  disabled={isWorking}
                  className="h-10 rounded-[6px] border border-[#c5dced] bg-white px-3 text-sm font-semibold text-[#315972] transition hover:bg-[#f3f9fe] disabled:opacity-60"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="max-h-[calc(90vh-72px)] overflow-y-auto">
              <div className="space-y-2 px-4 pt-3">
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
              </div>

              <div className="overflow-x-auto px-4 pb-1 pt-3">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#cfdfec] text-[#305970]">
                      <th className="px-3 py-3">STT</th>
                      <th className="px-3 py-3">Tên thành phần</th>
                      <th className="px-3 py-3">Trọng số</th>
                      <th className="px-3 py-3">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeComponentPagination.paginatedRows.map((row, index) => (
                      <tr key={row.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                        <td className="px-3 py-3">{gradeComponentPagination.startItem + index}</td>
                        <td className="px-3 py-3 font-semibold text-[#1f567b]">{row.componentName}</td>
                        <td className="px-3 py-3">{row.weightPercentage}%</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              disabled={isWorking}
                              className="h-9 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleDelete(row);
                              }}
                              disabled={isWorking}
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
                        <td colSpan={4} className="px-3 py-6 text-center text-[#577086]">
                          Môn học này chưa có thành phần điểm.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <TablePaginationControls
                pageIndex={gradeComponentPagination.pageIndex}
                pageSize={gradeComponentPagination.pageSize}
                totalItems={gradeComponentPagination.totalItems}
                totalPages={gradeComponentPagination.totalPages}
                startItem={gradeComponentPagination.startItem}
                endItem={gradeComponentPagination.endItem}
                onPageChange={gradeComponentPagination.setPageIndex}
                onPageSizeChange={gradeComponentPagination.setPageSize}
              />

              <div className="border-t border-[#d9e7f1] bg-[#f8fcff] px-4 py-4">
                <h4 className="text-[17px] font-semibold text-[#184f74]">
                  {editingRowId
                    ? `Cập nhật thành phần điểm #${editingRowId}`
                    : "Thêm thành phần điểm"}
                </h4>

                <form
                  className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end"
                  onSubmit={handleSubmit}
                >
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-[#315972]">Tên thành phần điểm</span>
                    <input
                      className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={form.componentName}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          componentName: event.target.value,
                        }))
                      }
                      placeholder="VD: Quiz, Giữa kỳ, Cuối kỳ"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-[#315972]">Trọng số (%)</span>
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

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button
                      type="submit"
                      disabled={isWorking}
                      className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      {editingRowId ? "Lưu cập nhật" : "Tạo thành phần"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={isWorking}
                      className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                    >
                      Xóa form
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDeleteRow)}
        title="Xác nhận xóa thành phần điểm"
        message={
          confirmDeleteRow
            ? `Bạn có chắc muốn xóa thành phần điểm "${confirmDeleteRow.componentName}" không?`
            : ""
        }
        confirmText="Xóa"
        isProcessing={isWorking}
        onCancel={() => setConfirmDeleteRow(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </section>
  );
};
