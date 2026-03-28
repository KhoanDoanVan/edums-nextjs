"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AccountManagementPanel } from "@/components/admin/account-management-panel";
import { DynamicCrudPanel } from "@/components/admin/dynamic-crud-panel";
import { GradeComponentPanel } from "@/components/admin/grade-component-panel";
import { RecurringSchedulePanel } from "@/components/admin/recurring-schedule-panel";
import { RolePermissionPanel } from "@/components/admin/role-permission-panel";
import { useAuth } from "@/context/auth-context";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getAdmissionApplications,
  getAdmissionBenchmarks,
  getAdmissionBlocks,
  getAdmissionPeriods,
  getDynamicListByPath,
  getSectionGradeReports,
  getStudentAttendances,
  updateDynamicByPath,
} from "@/lib/admin/service";
import { adminFeatureTabs, adminTopHeaderTabs } from "@/lib/admin/tabs";
import type {
  AdminFeatureTab,
  AdminTabKey,
  ApplicationListItem,
  BenchmarkListItem,
  BlockListItem,
  DynamicRow,
  PagedRows,
  PeriodListItem,
} from "@/lib/admin/types";

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

const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
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

const toColumnLabel = (field: string): string => {
  const spaced = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  return spaced ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : field;
};

const buildColumns = (
  rows: DynamicRow[],
  priorityColumns: string[],
): string[] => {
  const keys = new Set<string>();

  for (const row of rows.slice(0, 50)) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }

  const priority = priorityColumns.filter((key) => keys.has(key));
  const others = [...keys].filter((key) => !priorityColumns.includes(key)).sort();

  return [...priority, ...others];
};

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

type DynamicCrudTabConfig = {
  title: string;
  basePath: string;
  listQuery?: Record<string, string | number | undefined>;
  priorityColumns: string[];
  createTemplate: Record<string, unknown>;
  updateTemplate: Record<string, unknown>;
  statusPatch?: {
    fieldName: string;
    pathSuffix: string;
    options: string[];
  };
};

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

function CohortManagementPanel({
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
          .some((value) =>
            String(value).toLowerCase().includes(normalizedKeyword),
          );

      const matchesStatus =
        statusFilter === "ALL" ||
        row.status === statusFilter ||
        progress === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [currentYear, keyword, rows, statusFilter]);

  const totalCount = rows.length;
  const activeCount = rows.filter(
    (row) => getCohortProgressLabel(row, currentYear) === "Đang đào tạo",
  ).length;
  const upcomingCount = rows.filter(
    (row) => getCohortProgressLabel(row, currentYear) === "Sắp mở",
  ).length;
  const finishedCount = rows.filter(
    (row) => getCohortProgressLabel(row, currentYear) === "Đã kết thúc",
  ).length;

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

  const handleDelete = async (row: CohortRow) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const accepted = window.confirm(
      `Bạn có chắc muốn xóa niên khóa ${row.cohortName || `#${row.id}`} không?`,
    );

    if (!accepted) {
      return;
    }

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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Tổng niên khóa", value: totalCount, tone: "text-[#1d5b82]" },
            { label: "Đang đào tạo", value: activeCount, tone: "text-[#1d7a47]" },
            { label: "Sắp mở", value: upcomingCount, tone: "text-[#2b67a1]" },
            { label: "Đã kết thúc", value: finishedCount, tone: "text-[#b56223]" },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-[10px] border border-[#c7dceb] bg-[#f8fcff] px-4 py-3"
            >
              <p className="text-sm font-medium text-[#5f7d93]">{item.label}</p>
              <p className={`mt-2 text-[28px] font-bold ${item.tone}`}>{item.value}</p>
            </article>
          ))}
        </div>

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
                  {filteredRows.map((row) => {
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
                          <p className="mt-1 text-xs text-[#6b8497]">ID: {row.id}</p>
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

              {successMessage ? (
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
    </section>
  );
}

const dynamicCrudTabConfigs: Partial<Record<AdminTabKey, DynamicCrudTabConfig>> = {
  faculties: {
    title: "Danh sách khoa",
    basePath: "/api/v1/faculties",
    priorityColumns: ["id", "facultyCode", "facultyName", "status"],
    createTemplate: {
      facultyCode: "",
      facultyName: "",
    },
    updateTemplate: {
      facultyCode: "",
      facultyName: "",
    },
  },
  majors: {
    title: "Danh sách ngành",
    basePath: "/api/v1/majors",
    priorityColumns: ["id", "majorCode", "majorName", "facultyId", "status"],
    createTemplate: {
      facultyId: 1,
      majorCode: "",
      majorName: "",
    },
    updateTemplate: {
      facultyId: 1,
      majorCode: "",
      majorName: "",
    },
  },
  specializations: {
    title: "Danh sách chuyen ngành",
    basePath: "/api/v1/specializations",
    priorityColumns: ["id", "specializationName", "majorId", "status"],
    createTemplate: {
      majorId: 1,
      specializationName: "",
    },
    updateTemplate: {
      majorId: 1,
      specializationName: "",
    },
  },
  cohorts: {
    title: "Danh sách niên khóa",
    basePath: "/api/v1/cohorts",
    priorityColumns: ["id", "cohortName", "startYear", "endYear", "status"],
    createTemplate: {
      cohortName: "",
      startYear: 2026,
      endYear: 2030,
      status: "ACTIVE",
    },
    updateTemplate: {
      cohortName: "",
      startYear: 2026,
      endYear: 2030,
      status: "ACTIVE",
    },
  },
  courses: {
    title: "Danh sách môn học",
    basePath: "/api/v1/courses",
    priorityColumns: [
      "id",
      "courseCode",
      "courseName",
      "credits",
      "facultyId",
      "status",
    ],
    createTemplate: {
      courseCode: "",
      courseName: "",
      credits: 3,
      facultyId: 1,
      status: "ACTIVE",
    },
    updateTemplate: {
      courseCode: "",
      courseName: "",
      credits: 3,
      facultyId: 1,
      status: "ACTIVE",
    },
  },
  "grade-components": {
    title: "Cấu hình điểm",
    basePath: "/api/v1/grade-components",
    priorityColumns: ["id", "componentName", "weightPercentage", "courseId"],
    createTemplate: {
      componentName: "",
      weightPercentage: 10,
      courseId: 1,
    },
    updateTemplate: {
      componentName: "",
      weightPercentage: 10,
      courseId: 1,
    },
  },
  classrooms: {
    title: "Danh sách phong hoc",
    basePath: "/api/v1/classrooms",
    priorityColumns: ["id", "roomName", "capacity", "roomType"],
    createTemplate: {
      roomName: "",
      capacity: 40,
      roomType: "THEORY",
    },
    updateTemplate: {
      roomName: "",
      capacity: 40,
      roomType: "THEORY",
    },
  },
  "administrative-classes": {
    title: "Danh sách lớp chủ nhiệm",
    basePath: "/api/v1/administrative-classes",
    priorityColumns: [
      "id",
      "className",
      "cohortId",
      "majorId",
      "headLecturerId",
      "maxCapacity",
    ],
    createTemplate: {
      className: "",
      headLecturerId: 1,
      cohortId: 1,
      majorId: 1,
      maxCapacity: 60,
    },
    updateTemplate: {
      className: "",
      headLecturerId: 1,
      cohortId: 1,
      majorId: 1,
      maxCapacity: 60,
    },
  },
  students: {
    title: "Quản lý sinh viên",
    basePath: "/api/v1/students",
    listQuery: {
      page: 0,
      size: 20,
    },
    priorityColumns: [
      "id",
      "studentCode",
      "fullName",
      "email",
      "phone",
      "status",
      "classId",
      "majorId",
    ],
    createTemplate: {
      classId: 1,
      majorId: 1,
      specializationId: 1,
      guardianId: 1,
      studentCode: "",
      fullName: "",
      email: "",
      nationalId: "",
      dateOfBirth: "2004-01-01",
      gender: true,
      phone: "",
      address: "",
      ethnicity: "",
      religion: "",
      placeOfBirth: "",
      nationality: "VN",
    },
    updateTemplate: {
      classId: 1,
      majorId: 1,
      specializationId: 1,
      guardianId: 1,
      fullName: "",
      email: "",
      nationalId: "",
      dateOfBirth: "2004-01-01",
      gender: true,
      phone: "",
      address: "",
      ethnicity: "",
      religion: "",
      placeOfBirth: "",
      nationality: "VN",
    },
    statusPatch: {
      fieldName: "status",
      pathSuffix: "/status",
      options: ["ACTIVE", "SUSPENDED", "GRADUATED", "DROPPED_OUT"],
    },
  },
  lecturers: {
    title: "Quản lý giảng viên",
    basePath: "/api/v1/lecturers",
    listQuery: {
      page: 0,
      size: 20,
    },
    priorityColumns: ["id", "fullName", "email", "academicDegree", "phone"],
    createTemplate: {
      fullName: "",
      email: "",
      academicDegree: "",
      phone: "",
    },
    updateTemplate: {
      fullName: "",
      email: "",
      academicDegree: "",
      phone: "",
    },
  },
  guardians: {
    title: "Quản lý phụ huynh",
    basePath: "/api/v1/guardians",
    listQuery: {
      page: 0,
      size: 20,
    },
    priorityColumns: ["id", "fullName", "phone", "relationship"],
    createTemplate: {
      fullName: "",
      phone: "",
      relationship: "",
    },
    updateTemplate: {
      fullName: "",
      phone: "",
      relationship: "",
    },
  },
  "course-sections": {
    title: "Quản lý lop hoc phan",
    basePath: "/api/v1/course-sections",
    priorityColumns: [
      "id",
      "sectionCode",
      "displayName",
      "courseId",
      "lecturerId",
      "semesterId",
      "maxCapacity",
      "status",
    ],
    createTemplate: {
      sectionCode: "",
      displayName: "",
      courseId: 1,
      lecturerId: 1,
      semesterId: 1,
      maxCapacity: 60,
      status: "DRAFT",
    },
    updateTemplate: {
      sectionCode: "",
      displayName: "",
      courseId: 1,
      lecturerId: 1,
      semesterId: 1,
      maxCapacity: 60,
      status: "DRAFT",
    },
    statusPatch: {
      fieldName: "status",
      pathSuffix: "/status",
      options: ["DRAFT", "OPEN", "ONGOING", "FINISHED", "CANCELLED"],
    },
  },
};

export default function AdminDashboardPage() {
  const { session, logout } = useAuth();

  const [activeTabKey, setActiveTabKey] = useState<AdminTabKey>("home");
  const [tabError, setTabError] = useState("");
  const [tabMessage, setTabMessage] = useState("");
  useToastFeedback({
    errorMessage: tabError,
    errorTitle: "Thao tác quản trị thất bại",
  });
  const [isWorking, setIsWorking] = useState(false);

  const [admissionPeriods, setAdmissionPeriods] = useState<PagedRows<PeriodListItem>>({
    rows: [],
  });
  const [admissionBlocks, setAdmissionBlocks] = useState<BlockListItem[]>([]);
  const [admissionBenchmarks, setAdmissionBenchmarks] = useState<
    PagedRows<BenchmarkListItem>
  >({ rows: [] });
  const [admissionApplications, setAdmissionApplications] = useState<
    PagedRows<ApplicationListItem>
  >({ rows: [] });
  const [gradeRows, setGradeRows] = useState<DynamicRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<DynamicRow[]>([]);
  const [gradeSectionIdInput, setGradeSectionIdInput] = useState("");
  const [attendanceStudentIdInput, setAttendanceStudentIdInput] = useState("");

  const activeTab = useMemo(
    () =>
      adminFeatureTabs.find((item) => item.key === activeTabKey) ||
      adminFeatureTabs[0],
    [activeTabKey],
  );

  const gradeColumns = useMemo(
    () =>
      buildColumns(gradeRows, [
        "id",
        "courseName",
        "studentId",
        "studentCode",
        "finalScore",
        "letterGrade",
        "status",
      ]),
    [gradeRows],
  );

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

  const requireAuthorization = (): string | null => {
    if (!session?.authorization) {
      setTabError("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return null;
    }

    return session.authorization;
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      setIsWorking(true);
      setTabError("");
      setTabMessage("");
      await action();
    } catch (error) {
      setTabError(toErrorMessage(error));
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
      setTabError(`${fieldLabel} không hop le.`);
      return null;
    }

    return parsed;
  };

  const loadTabData = async (tabKey: AdminTabKey) => {
    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      switch (tabKey) {
        case "accounts": {
          setTabMessage("Sử dụng module Quản lý tải khoan để thao tac CRUD.");
          break;
        }
        case "roles": {
          setTabMessage(
            "Sử dụng module Vai trò & phan quyen để thao tac toan bo CRUD vai trò.",
          );
          break;
        }
        case "faculties": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu khoa.");
          break;
        }
        case "majors": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu ngành.");
          break;
        }
        case "specializations": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu chuyen ngành.");
          break;
        }
        case "cohorts": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu niên khóa.");
          break;
        }
        case "courses": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu môn học.");
          break;
        }
        case "grade-components": {
          setTabMessage("Sử dụng module Cấu hình điểm để quan ly thành phần điểm theo môn học.");
          break;
        }
        case "classrooms": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu phong hoc.");
          break;
        }
        case "administrative-classes": {
          setTabMessage("Sử dụng module CRUD để quan ly lớp chủ nhiệm.");
          break;
        }
        case "students": {
          setTabMessage("Sử dụng module CRUD để quan ly sinh viên.");
          break;
        }
        case "lecturers": {
          setTabMessage("Sử dụng module CRUD để quan ly giảng viên.");
          break;
        }
        case "guardians": {
          setTabMessage("Sử dụng module CRUD để quan ly phụ huynh.");
          break;
        }
        case "course-sections": {
          setTabMessage("Sử dụng module CRUD để quan ly lop hoc phan.");
          break;
        }
        case "recurring-schedules": {
          setTabMessage("Nhập section ID để tải va quan ly lịch học lap lai.");
          break;
        }
        case "admissions": {
          const [periodRows, blockRows, benchmarkRows, applicationRows] =
            await Promise.all([
              getAdmissionPeriods(authorization),
              getAdmissionBlocks(authorization),
              getAdmissionBenchmarks(authorization),
              getAdmissionApplications(authorization),
            ]);

          setAdmissionPeriods(periodRows);
          setAdmissionBlocks(blockRows);
          setAdmissionBenchmarks(benchmarkRows);
          setAdmissionApplications(applicationRows);
          setTabMessage(
            `Đã tải tuyen sinh: ${periodRows.rows.length} periods, ${blockRows.length} blocks, ${benchmarkRows.rows.length} benchmarks, ${applicationRows.rows.length} applications.`,
          );
          break;
        }
        case "grade-management": {
          setGradeRows([]);
          setTabMessage("Nhập section ID rồi bam Tải diem theo lop hoc phan.");
          break;
        }
        case "attendance-management": {
          setAttendanceRows([]);
          setTabMessage("Nhập student ID rồi bam Tải điểm danh.");
          break;
        }
        case "home":
        default:
          break;
      }
    });
  };

  const handleTabChange = (tab: AdminFeatureTab) => {
    setActiveTabKey(tab.key);
    setTabError("");
    setTabMessage("");

    if (tab.key !== "home") {
      void loadTabData(tab.key);
    }
  };

  const handleLoadGradeReports = async () => {
    const authorization = requireAuthorization();
    const sectionId = parsePositiveInteger(gradeSectionIdInput, "Mã lớp học phần");
    if (!authorization || !sectionId) {
      return;
    }

    await runAction(async () => {
      const data = await getSectionGradeReports(sectionId, authorization);
      setGradeRows(data);
      setTabMessage(`Đã tải ${data.length} bản ghi diem cho section ${sectionId}.`);
    });
  };

  const handleLoadAttendances = async () => {
    const authorization = requireAuthorization();
    const studentId = parsePositiveInteger(
      attendanceStudentIdInput,
      "Mã sinh viên",
    );
    if (!authorization || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getStudentAttendances(studentId, authorization);
      setAttendanceRows(data);
      setTabMessage(`Đã tải ${data.length} bản ghi điểm danh cho student ${studentId}.`);
    });
  };

  const renderDynamicTable = (
    title: string,
    rows: DynamicRow[],
    columns: string[],
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
                {columns.map((column) => (
                  <th key={column} className="px-2 py-2">
                    {toColumnLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`dynamic-row-${index}`}
                  className="border-b border-[#e0ebf4] text-[#3f6178]"
                >
                  {columns.map((column) => (
                    <td key={`${index}-${column}`} className="max-w-[260px] px-2 py-2">
                      <span className="line-clamp-2">{toDisplayValue(row[column])}</span>
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="px-2 py-4 text-center text-[#577086]">
                    Chưa co dữ liệu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const activeDynamicCrudConfig =
    activeTab.key === "cohorts" || activeTab.key === "recurring-schedules"
      ? undefined
      : dynamicCrudTabConfigs[activeTab.key];

  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-[#e9edf2]">
        <header className="flex h-[52px] items-center justify-between bg-[#0a6ca0] px-3 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/45 text-sm font-semibold">
              AD
            </div>
            <nav className="flex items-center gap-6 text-lg font-semibold">
              {adminTopHeaderTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="text-base transition hover:text-[#d7f0ff]"
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold">
              {(session?.username || "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{session?.username || "-"}</p>
              <p className="text-xs opacity-90">Vai trò: {session?.role || "-"}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-[4px] border border-white/40 px-2 py-1 text-sm font-semibold transition hover:bg-white/15"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 lg:grid-cols-[275px_minmax(0,1fr)]">
          <aside className="border-r border-[#b9cfe0] bg-[#f2f5f8]">
            <div className="border-b border-[#c7d8e5] px-4 py-3 text-[17px] font-semibold text-[#1c587f]">
              Admin Menu
            </div>
            <nav className="px-2 py-2">
              {adminFeatureTabs.map((item) => {
                const active = item.key === activeTabKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleTabChange(item)}
                    className={`mb-1 flex w-full items-center justify-between rounded-[4px] px-3 py-2 text-left text-[17px] transition ${
                      active
                        ? "bg-[#d6e9f7] font-semibold text-[#0d517a]"
                        : "text-[#234d69] hover:bg-[#e5eef6]"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-5 border-t border-[#d0dce6] px-3 py-3 text-sm text-[#516b7f]">
              <p className="font-semibold text-[#2d5672]">Điều hướng nhanh</p>
              <p className="mt-2">
                <Link className="font-semibold text-[#0a5f92] hover:underline" href="/dashboard">
                  Mo dashboard student
                </Link>
              </p>
            </div>
          </aside>

          <main className="space-y-4 p-3 sm:p-4">
            <section className={contentCardClass}>
              <div className={sectionTitleClass}>
                <h1>{activeTab.label}</h1>
              </div>
              <div className="space-y-2 px-4 py-3 text-sm text-[#355970]">
                <p>{activeTab.description}</p>
                {tabError ? (
                  <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                    {tabError}
                  </p>
                ) : null}
                {tabMessage ? (
                  <p className="rounded-[4px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                    {tabMessage}
                  </p>
                ) : null}
              </div>
            </section>

            {activeTab.key === "home" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Tổng quan nhanh</h2>
                  </div>
                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3 xl:grid-cols-4">
                    {adminFeatureTabs
                      .filter((item) => item.key !== "home")
                      .map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleTabChange(item)}
                          className="rounded-[8px] border border-[#c0d8ea] bg-[#f4fbff] p-3 text-left transition hover:border-[#7eb3d9] hover:bg-[#eaf5ff]"
                        >
                          <p className="text-base font-semibold text-[#1d5b82]">{item.label}</p>
                          <p className="mt-2 text-xs text-[#6c8597]">Click để tải dữ liệu</p>
                        </button>
                      ))}
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Danh sách chuc nang admin</h2>
                  </div>
                  <div className="overflow-x-auto px-4 py-3">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">Tab</th>
                          <th className="px-2 py-2">Mo ta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminFeatureTabs
                          .filter((item) => item.key !== "home")
                          .map((item) => (
                            <tr key={item.key} className="border-b border-[#e0ebf4] text-[#3f6178]">
                              <td className="px-2 py-2 font-semibold text-[#1f567b]">{item.label}</td>
                              <td className="px-2 py-2">{item.description}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab.key === "accounts" ? (
              <AccountManagementPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "roles" ? (
              <RolePermissionPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "cohorts" ? (
              <CohortManagementPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "grade-components" ? (
              <GradeComponentPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "recurring-schedules" ? (
              <RecurringSchedulePanel authorization={session?.authorization} />
            ) : null}

            {activeDynamicCrudConfig ? (
              <DynamicCrudPanel
                authorization={session?.authorization}
                title={activeDynamicCrudConfig.title}
                basePath={activeDynamicCrudConfig.basePath}
                listQuery={activeDynamicCrudConfig.listQuery}
                priorityColumns={activeDynamicCrudConfig.priorityColumns}
                createTemplate={activeDynamicCrudConfig.createTemplate}
                updateTemplate={activeDynamicCrudConfig.updateTemplate}
                statusPatch={activeDynamicCrudConfig.statusPatch}
              />
            ) : null}

            {activeTab.key === "grade-management" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Quản lý diem theo lop hoc phan</h2>
                  </div>
                  <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px]">
                    <input
                      className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Mã lớp học phần"
                      value={gradeSectionIdInput}
                      onChange={(event) => setGradeSectionIdInput(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadGradeReports();
                      }}
                      disabled={isWorking}
                      className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Tải diem theo lop
                    </button>
                  </div>
                </section>
                {renderDynamicTable(
                  "Bạng diem theo lop hoc phan",
                  gradeRows,
                  gradeColumns,
                )}
              </div>
            ) : null}

            {activeTab.key === "attendance-management" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Quản lý điểm danh theo sinh viên</h2>
                  </div>
                  <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px]">
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
                      Tải điểm danh
                    </button>
                  </div>
                </section>
                {renderDynamicTable(
                  "Bạng điểm danh theo sinh viên",
                  attendanceRows,
                  attendanceColumns,
                )}
              </div>
            ) : null}


            {activeTab.key === "admissions" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Ky tuyen sinh (periods)</h2>
                    <button
                      type="button"
                      onClick={() => {
                        void loadTabData("admissions");
                      }}
                      disabled={isWorking}
                      className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Làm mới tat ca
                    </button>
                  </div>
                  <div className="overflow-x-auto px-4 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">ID</th>
                          <th className="px-2 py-2">Ten ky</th>
                          <th className="px-2 py-2">Bat dau</th>
                          <th className="px-2 py-2">Ket thuc</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Tổng ho so</th>
                          <th className="px-2 py-2">Da duyet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissionPeriods.rows.map((item) => (
                          <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                            <td className="px-2 py-2">{item.id}</td>
                            <td className="px-2 py-2">{item.periodName || "-"}</td>
                            <td className="px-2 py-2">{formatDateTime(item.startTime)}</td>
                            <td className="px-2 py-2">{formatDateTime(item.endTime)}</td>
                            <td className="px-2 py-2">{item.status || "-"}</td>
                            <td className="px-2 py-2">{item.totalApplications ?? "-"}</td>
                            <td className="px-2 py-2">{item.approvedApplications ?? "-"}</td>
                          </tr>
                        ))}
                        {admissionPeriods.rows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-2 py-4 text-center text-[#577086]">
                              Chưa co dữ liệu period.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Khoi xet tuyen (blocks)</h2>
                    <span className="text-sm font-medium text-[#396786]">{admissionBlocks.length} blocks</span>
                  </div>
                  <div className="overflow-x-auto px-4 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">ID</th>
                          <th className="px-2 py-2">Block</th>
                          <th className="px-2 py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissionBlocks.map((item) => (
                          <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                            <td className="px-2 py-2">{item.id}</td>
                            <td className="px-2 py-2">{item.blockName || "-"}</td>
                            <td className="px-2 py-2">{item.description || "-"}</td>
                          </tr>
                        ))}
                        {admissionBlocks.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-2 py-4 text-center text-[#577086]">
                              Chưa co dữ liệu blocks.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Điểm chưan (benchmarks)</h2>
                    <span className="text-sm font-medium text-[#396786]">{admissionBenchmarks.rows.length} benchmarks</span>
                  </div>
                  <div className="overflow-x-auto px-4 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">ID</th>
                          <th className="px-2 py-2">Nganh</th>
                          <th className="px-2 py-2">Block</th>
                          <th className="px-2 py-2">Period</th>
                          <th className="px-2 py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissionBenchmarks.rows.map((item) => (
                          <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                            <td className="px-2 py-2">{item.id}</td>
                            <td className="px-2 py-2">{item.majorName || "-"}</td>
                            <td className="px-2 py-2">{item.blockName || "-"}</td>
                            <td className="px-2 py-2">{item.periodName || "-"}</td>
                            <td className="px-2 py-2">{item.score ?? "-"}</td>
                          </tr>
                        ))}
                        {admissionBenchmarks.rows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-2 py-4 text-center text-[#577086]">
                              Chưa co dữ liệu benchmark.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Ho so du tuyen</h2>
                    <span className="text-sm font-medium text-[#396786]">{admissionApplications.rows.length} applications</span>
                  </div>
                  <div className="overflow-x-auto px-4 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">ID</th>
                          <th className="px-2 py-2">Ho ten</th>
                          <th className="px-2 py-2">Nganh</th>
                          <th className="px-2 py-2">Block</th>
                          <th className="px-2 py-2">Period</th>
                          <th className="px-2 py-2">Tổng diem</th>
                          <th className="px-2 py-2">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissionApplications.rows.map((item) => (
                          <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                            <td className="px-2 py-2">{item.id}</td>
                            <td className="px-2 py-2">{item.fullName || "-"}</td>
                            <td className="px-2 py-2">{item.majorName || "-"}</td>
                            <td className="px-2 py-2">{item.blockName || "-"}</td>
                            <td className="px-2 py-2">{item.periodName || "-"}</td>
                            <td className="px-2 py-2">{item.totalScore ?? "-"}</td>
                            <td className="px-2 py-2">{item.status || "-"}</td>
                          </tr>
                        ))}
                        {admissionApplications.rows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-2 py-4 text-center text-[#577086]">
                              Chưa co dữ liệu application.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}



