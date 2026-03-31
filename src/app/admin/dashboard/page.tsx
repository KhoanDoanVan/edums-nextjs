"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AccountManagementPanel } from "@/components/admin/account-management-panel";
import { CourseSectionPanel } from "@/components/admin/course-section-panel";
import { DynamicCrudPanel } from "@/components/admin/dynamic-crud-panel";
import { GradeComponentPanel } from "@/components/admin/grade-component-panel";
import { RecurringSchedulePanel } from "@/components/admin/recurring-schedule-panel";
import { RolePermissionPanel } from "@/components/admin/role-permission-panel";
import { useAuth } from "@/context/auth-context";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  autoScreenAdmissionApplications,
  createAttendancesBatch,
  createAdmissionBlock,
  createAdmissionPeriod,
  createGradeReport,
  deleteAttendance,
  deleteAdmissionBenchmark,
  deleteAdmissionBlock,
  deleteAdmissionPeriod,
  deleteGradeReport,
  createDynamicByPath,
  deleteDynamicByPath,
  getAttendancesBySession,
  getAdmissionApplicationById,
  getAdmissionApplications,
  getAdmissionBenchmarks,
  getAdmissionBlocks,
  getAdmissionFormOptions,
  getAdmissionPeriodById,
  getGradeComponentsByCourse,
  getAdmissionPeriods,
  getGuardianStudentAttendances,
  getGradeReportById,
  getDynamicListByPath,
  processAdmissionOnboarding,
  reviewAdmissionApplication,
  reviewAdmissionApplicationsBulk,
  saveAdmissionBenchmarksBulk,
  getSectionGradeReports,
  getStudentAttendances,
  getStudentGradeReports,
  updateAdmissionBenchmark,
  updateAdmissionBlock,
  updateAdmissionPeriod,
  updateAttendance,
  updateDynamicByPath,
  updateGradeReport,
} from "@/lib/admin/service";
import { adminFeatureTabs, adminTopHeaderTabs } from "@/lib/admin/tabs";
import type {
  AdminFeatureTab,
  AdminTabKey,
  AttendanceItem,
  AttendanceStatus,
  AdmissionApplicationStatus,
  AdmissionPeriodStatus,
  AdmissionSelectionOption,
  AdmissionSelectionOptions,
  ApplicationListItem,
  BenchmarkListItem,
  BlockListItem,
  DynamicRow,
  GradeReportItem,
  GradeReportStatus,
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
    return `${value.length} mục`;
  }

  if (typeof value === "object") {
    return "Có dữ liệu";
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
  const scalarKeys = new Set<string>();
  const complexKeys = new Set<string>();

  for (const row of rows.slice(0, 50)) {
    for (const [key, value] of Object.entries(row)) {
      if (Array.isArray(value) || (value !== null && typeof value === "object")) {
        complexKeys.add(key);
        continue;
      }
      scalarKeys.add(key);
    }
  }

  const visibleKeys = [...scalarKeys].filter((key) => !complexKeys.has(key));
  const priority = priorityColumns.filter((key) => visibleKeys.includes(key));
  const others = visibleKeys
    .filter((key) => !priorityColumns.includes(key))
    .sort();

  return [...priority, ...others];
};

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

const admissionApplicationStatusOptions: AdmissionApplicationStatus[] = [
  "PENDING",
  "APPROVED",
  "ENROLLED",
  "REJECTED",
];

const admissionPeriodStatusOptions: AdmissionPeriodStatus[] = [
  "UPCOMING",
  "PAUSED",
  "OPEN",
  "CLOSED",
];

const gradeReportStatusOptions: GradeReportStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "LOCKED",
];

const attendanceStatusOptions: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

type DynamicCrudTabConfig = {
  title: string;
  basePath: string;
  listQuery?: Record<string, string | number | undefined>;
  fieldLookups?: Record<
    string,
    {
      path: string;
      query?: Record<string, string | number | undefined>;
      valueKey?: string;
      labelKeys?: string[];
      dependsOn?: string;
      pathTemplate?: string;
      disableUntilDependsOn?: boolean;
    }
  >;
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

type GradeComponentOption = {
  id: number;
  componentName: string;
  weightPercentage?: number;
};

type GradeDetailInputRow = {
  componentId: string;
  score: string;
};

type SelectionOptionItem = {
  id: number;
  label: string;
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

const toGradeComponentOptions = (rows: DynamicRow[]): GradeComponentOption[] => {
  return rows
    .map((row) => {
      const id = Number(row.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      const componentName =
        (typeof row.componentName === "string" && row.componentName.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        `Component #${id}`;

      const weight =
        typeof row.weightPercentage === "number"
          ? row.weightPercentage
          : Number(row.weightPercentage || 0) || undefined;

      const option: GradeComponentOption = {
        id,
        componentName,
      };

      if (weight !== undefined) {
        option.weightPercentage = weight;
      }

      return option;
    })
    .filter((item): item is GradeComponentOption => item !== null);
};

const toSelectionOptionItems = (
  rows: AdmissionSelectionOption[],
  fallbackLabel: string,
): SelectionOptionItem[] => {
  return rows
    .map((item) => {
      const record = item as Record<string, unknown>;
      const id = Number(item.id ?? record.value ?? 0);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      const labelParts = [
        typeof item.name === "string" ? item.name.trim() : "",
        typeof item.code === "string" ? item.code.trim() : "",
      ].filter(Boolean);

      const explicitLabel =
        typeof item.label === "string" && item.label.trim() ? item.label.trim() : "";
      const label = explicitLabel || labelParts.join(" - ") || `${fallbackLabel} #${id}`;

      return {
        id,
        label,
      };
    })
    .filter((item): item is SelectionOptionItem => item !== null);
};

const toCohortSelectionOptions = (rows: DynamicRow[]): SelectionOptionItem[] => {
  return rows
    .map((row) => {
      const id = Number(row.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      const label =
        (typeof row.cohortName === "string" && row.cohortName.trim()) ||
        `Niên khóa #${id}`;

      return {
        id,
        label,
      };
    })
    .filter((item): item is SelectionOptionItem => item !== null);
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
    fieldLookups: {
      facultyId: {
        path: "/api/v1/faculties",
        labelKeys: ["facultyName", "facultyCode", "id"],
      },
    },
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
    fieldLookups: {
      majorId: {
        path: "/api/v1/majors",
        labelKeys: ["majorName", "majorCode", "id"],
      },
    },
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
    fieldLookups: {
      facultyId: {
        path: "/api/v1/faculties",
        labelKeys: ["facultyName", "facultyCode", "id"],
      },
    },
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
    fieldLookups: {
      headLecturerId: {
        path: "/api/v1/lecturers",
        query: { page: 0, size: 100 },
        labelKeys: ["fullName", "email", "id"],
      },
      cohortId: {
        path: "/api/v1/cohorts",
        labelKeys: ["cohortName", "id"],
      },
      majorId: {
        path: "/api/v1/majors",
        labelKeys: ["majorName", "majorCode", "id"],
      },
    },
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
    fieldLookups: {
      classId: {
        path: "/api/v1/administrative-classes",
        labelKeys: ["className", "id"],
      },
      majorId: {
        path: "/api/v1/majors",
        labelKeys: ["majorName", "majorCode", "id"],
      },
      specializationId: {
        path: "/api/v1/specializations",
        dependsOn: "majorId",
        pathTemplate: "/api/v1/specializations/major/{value}",
        disableUntilDependsOn: true,
        labelKeys: ["specializationName", "id"],
      },
      guardianId: {
        path: "/api/v1/guardians",
        query: { page: 0, size: 100 },
        labelKeys: ["fullName", "phone", "id"],
      },
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
    fieldLookups: {
      courseId: {
        path: "/api/v1/courses",
        labelKeys: ["courseName", "courseCode", "id"],
      },
      lecturerId: {
        path: "/api/v1/lecturers",
        query: { page: 0, size: 100 },
        labelKeys: ["fullName", "email", "id"],
      },
    },
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
  const [, setTabMessage] = useState("");
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
  const [guardianAttendanceRows, setGuardianAttendanceRows] = useState<AttendanceItem[]>(
    [],
  );
  const [gradeDetail, setGradeDetail] = useState<GradeReportItem | null>(null);
  const [gradeComponentOptions, setGradeComponentOptions] = useState<
    GradeComponentOption[]
  >([]);
  const [gradeScoreByComponentId, setGradeScoreByComponentId] = useState<
    Record<number, string>
  >({});
  const [attendanceSessionRows, setAttendanceSessionRows] = useState<AttendanceItem[]>(
    [],
  );
  const [gradeSectionIdInput, setGradeSectionIdInput] = useState("");
  const [gradeStudentIdInput, setGradeStudentIdInput] = useState("");
  const [gradeCourseIdInput, setGradeCourseIdInput] = useState("");
  const [attendanceStudentIdInput, setAttendanceStudentIdInput] = useState("");
  const [attendanceGuardianIdInput, setAttendanceGuardianIdInput] = useState("");
  const [attendanceGuardianStudentIdInput, setAttendanceGuardianStudentIdInput] =
    useState("");
  const [gradeReportIdInput, setGradeReportIdInput] = useState("");
  const [gradeRegistrationIdInput, setGradeRegistrationIdInput] = useState("");
  const [gradeDetailInputRows, setGradeDetailInputRows] = useState<GradeDetailInputRow[]>(
    [{ componentId: "", score: "" }],
  );
  const [gradeStatusInput, setGradeStatusInput] =
    useState<GradeReportStatus>("DRAFT");
  const [attendanceSessionIdInput, setAttendanceSessionIdInput] = useState("");
  const [attendanceBatchSessionIdInput, setAttendanceBatchSessionIdInput] =
    useState("");
  const [attendanceActionIdInput, setAttendanceActionIdInput] = useState("");
  const [attendanceActionStatus, setAttendanceActionStatus] =
    useState<AttendanceStatus>("PRESENT");
  const [attendanceActionNote, setAttendanceActionNote] = useState("");
  const [admissionFormOptions, setAdmissionFormOptions] =
    useState<AdmissionSelectionOptions>({
      majors: [],
      blocks: [],
      periods: [],
    });
  const [admissionCohortOptions, setAdmissionCohortOptions] = useState<
    SelectionOptionItem[]
  >([]);
  const [admissionDetailIdInput, setAdmissionDetailIdInput] = useState("");
  const [admissionDetail, setAdmissionDetail] =
    useState<ApplicationListItem | null>(null);
  const [admissionReviewIdInput, setAdmissionReviewIdInput] = useState("");
  const [admissionReviewStatus, setAdmissionReviewStatus] =
    useState<AdmissionApplicationStatus>("APPROVED");
  const [admissionReviewNote, setAdmissionReviewNote] = useState("");
  const [admissionSelectedIds, setAdmissionSelectedIds] = useState<number[]>([]);
  const [admissionBulkStatus, setAdmissionBulkStatus] =
    useState<AdmissionApplicationStatus>("APPROVED");
  const [admissionBulkNote, setAdmissionBulkNote] = useState("");
  const [admissionAutoScreenPeriodId, setAdmissionAutoScreenPeriodId] =
    useState("");
  const [admissionOnboardPeriodId, setAdmissionOnboardPeriodId] = useState("");
  const [admissionOnboardCohortId, setAdmissionOnboardCohortId] = useState("");
  const [periodDetailIdInput, setPeriodDetailIdInput] = useState("");
  const [periodDetail, setPeriodDetail] = useState<PeriodListItem | null>(null);
  const [periodActionIdInput, setPeriodActionIdInput] = useState("");
  const [periodNameInput, setPeriodNameInput] = useState("");
  const [periodStartInput, setPeriodStartInput] = useState("");
  const [periodEndInput, setPeriodEndInput] = useState("");
  const [periodStatusInput, setPeriodStatusInput] =
    useState<AdmissionPeriodStatus>("UPCOMING");
  const [blockActionIdInput, setBlockActionIdInput] = useState("");
  const [blockNameInput, setBlockNameInput] = useState("");
  const [blockDescriptionInput, setBlockDescriptionInput] = useState("");
  const [benchmarkActionIdInput, setBenchmarkActionIdInput] = useState("");
  const [benchmarkMajorIdInput, setBenchmarkMajorIdInput] = useState("");
  const [benchmarkBlockIdInput, setBenchmarkBlockIdInput] = useState("");
  const [benchmarkPeriodIdInput, setBenchmarkPeriodIdInput] = useState("");
  const [benchmarkScoreInput, setBenchmarkScoreInput] = useState("");
  const [benchmarkBulkPeriodIdInput, setBenchmarkBulkPeriodIdInput] =
    useState("");
  const [benchmarkBulkRows, setBenchmarkBulkRows] = useState<
    Array<{ majorId: string; blockId: string; score: string }>
  >([{ majorId: "1", blockId: "1", score: "24.5" }]);
  const [attendanceBatchRows, setAttendanceBatchRows] = useState<
    Array<{ courseRegistrationId: string; status: AttendanceStatus; note: string }>
  >([{ courseRegistrationId: "1", status: "PRESENT", note: "" }]);
  const [majorFacultyFilterValue, setMajorFacultyFilterValue] = useState("");
  const [majorListPath, setMajorListPath] = useState("/api/v1/majors");
  const [specializationMajorFilterValue, setSpecializationMajorFilterValue] =
    useState("");
  const [specializationListPath, setSpecializationListPath] = useState(
    "/api/v1/specializations",
  );
  const [courseFacultyFilterValue, setCourseFacultyFilterValue] = useState("");
  const [courseListPath, setCourseListPath] = useState("/api/v1/courses");

  const activeTab = useMemo(
    () =>
      adminFeatureTabs.find((item) => item.key === activeTabKey) ||
      adminFeatureTabs[0],
    [activeTabKey],
  );

  const admissionMajorOptions = useMemo(
    () => toSelectionOptionItems(admissionFormOptions.majors, "Ngành"),
    [admissionFormOptions.majors],
  );
  const admissionBlockOptions = useMemo(
    () => toSelectionOptionItems(admissionFormOptions.blocks, "Khối"),
    [admissionFormOptions.blocks],
  );
  const admissionPeriodOptions = useMemo(
    () => toSelectionOptionItems(admissionFormOptions.periods, "Kỳ tuyển sinh"),
    [admissionFormOptions.periods],
  );
  const admissionApplicationOptions = useMemo(() => {
    return admissionApplications.rows
      .map((item) => {
        const id = Number(item.id || 0);
        if (!Number.isInteger(id) || id <= 0) {
          return null;
        }

        const label =
          (item.fullName && item.fullName.trim()) ||
          item.email ||
          item.phone ||
          `Hồ sơ #${id}`;

        return {
          id,
          label,
        };
      })
      .filter((item): item is SelectionOptionItem => item !== null);
  }, [admissionApplications.rows]);
  const visibleAdmissionIds = useMemo(() => {
    return admissionApplicationOptions.map((item) => item.id);
  }, [admissionApplicationOptions]);
  const areAllVisibleAdmissionsSelected = useMemo(() => {
    if (visibleAdmissionIds.length === 0) {
      return false;
    }
    return visibleAdmissionIds.every((id) => admissionSelectedIds.includes(id));
  }, [admissionSelectedIds, visibleAdmissionIds]);

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

  const parseDateTimeLocalToIso = (value: string, fieldLabel: string): string | null => {
    if (!value.trim()) {
      setTabError(`${fieldLabel} không duoc de trong.`);
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      setTabError(`${fieldLabel} không hop le.`);
      return null;
    }

    return parsed.toISOString();
  };

  const handleApplyMajorFacultyFilter = () => {
    const facultyId = parsePositiveInteger(majorFacultyFilterValue, "Mã khoa");
    if (!facultyId) {
      return;
    }

    setMajorListPath(`/api/v1/majors/faculty/${facultyId}`);
    setTabMessage(`Đang lọc ngành theo khoa #${facultyId}.`);
  };

  const handleResetMajorFacultyFilter = () => {
    setMajorFacultyFilterValue("");
    setMajorListPath("/api/v1/majors");
    setTabMessage("Đã xóa bộ lọc ngành theo khoa.");
  };

  const handleApplySpecializationMajorFilter = () => {
    const majorId = parsePositiveInteger(
      specializationMajorFilterValue,
      "Mã ngành",
    );
    if (!majorId) {
      return;
    }

    setSpecializationListPath(`/api/v1/specializations/major/${majorId}`);
    setTabMessage(`Đang lọc chuyên ngành theo ngành #${majorId}.`);
  };

  const handleResetSpecializationMajorFilter = () => {
    setSpecializationMajorFilterValue("");
    setSpecializationListPath("/api/v1/specializations");
    setTabMessage("Đã xóa bộ lọc chuyên ngành theo ngành.");
  };

  const handleApplyCourseFacultyFilter = () => {
    const facultyId = parsePositiveInteger(courseFacultyFilterValue, "Mã khoa");
    if (!facultyId) {
      return;
    }

    setCourseListPath(`/api/v1/courses/faculty/${facultyId}`);
    setTabMessage(`Đang lọc môn học theo khoa #${facultyId}.`);
  };

  const handleResetCourseFacultyFilter = () => {
    setCourseFacultyFilterValue("");
    setCourseListPath("/api/v1/courses");
    setTabMessage("Đã xóa bộ lọc môn học theo khoa.");
  };

  const toggleAdmissionSelection = (applicationId: number) => {
    setAdmissionSelectedIds((prev) =>
      prev.includes(applicationId)
        ? prev.filter((item) => item !== applicationId)
        : [...prev, applicationId],
    );
  };

  const toggleSelectAllVisibleAdmissions = () => {
    setAdmissionSelectedIds((prev) => {
      if (areAllVisibleAdmissionsSelected) {
        return prev.filter((id) => !visibleAdmissionIds.includes(id));
      }

      const merged = new Set([...prev, ...visibleAdmissionIds]);
      return [...merged];
    });
  };

  const clearAdmissionSelection = () => {
    setAdmissionSelectedIds([]);
  };

  const resolveSingleAdmissionId = (rawValue: string): number | null => {
    if (rawValue.trim()) {
      return parsePositiveInteger(rawValue, "Mã hồ sơ");
    }

    if (admissionSelectedIds.length === 1) {
      return admissionSelectedIds[0];
    }

    if (admissionSelectedIds.length > 1) {
      setTabError("Bạn đang chọn nhiều hồ sơ, vui lòng chọn 1 hồ sơ cụ thể.");
      return null;
    }

    setTabError("Vui lòng chọn một hồ sơ từ danh sách.");
    return null;
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

  const handleBenchmarkBulkRowChange = (
    index: number,
    field: "majorId" | "blockId" | "score",
    value: string,
  ) => {
    setBenchmarkBulkRows((prev) =>
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

  const addBenchmarkBulkRow = () => {
    const defaultMajorId = admissionMajorOptions[0]
      ? String(admissionMajorOptions[0].id)
      : "";
    const defaultBlockId = admissionBlockOptions[0]
      ? String(admissionBlockOptions[0].id)
      : "";

    setBenchmarkBulkRows((prev) => [
      ...prev,
      { majorId: defaultMajorId, blockId: defaultBlockId, score: "" },
    ]);
  };

  const removeBenchmarkBulkRow = (index: number) => {
    setBenchmarkBulkRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const loadAdmissionsData = async (authorization: string) => {
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
    const nextIds = applicationRows.rows
      .map((item) => Number(item.id || 0))
      .filter((id) => Number.isInteger(id) && id > 0);

    setAdmissionSelectedIds((prev) => prev.filter((id) => nextIds.includes(id)));

    const firstApplicationId = nextIds[0] ? String(nextIds[0]) : "";
    setAdmissionDetailIdInput((prev) =>
      prev && nextIds.includes(Number(prev)) ? prev : firstApplicationId,
    );
    setAdmissionReviewIdInput((prev) =>
      prev && nextIds.includes(Number(prev)) ? prev : firstApplicationId,
    );
    setTabMessage(
      `Đã tải tuyen sinh: ${periodRows.rows.length} periods, ${blockRows.length} blocks, ${benchmarkRows.rows.length} benchmarks, ${applicationRows.rows.length} applications.`,
    );
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
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu ngành, có thể lọc theo khoa.");
          break;
        }
        case "specializations": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu chuyen ngành, có thể lọc theo ngành.");
          break;
        }
        case "cohorts": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu niên khóa.");
          break;
        }
        case "courses": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu môn học, có thể lọc theo khoa.");
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
          await loadAdmissionsData(authorization);
          const [options, cohorts] = await Promise.all([
            getAdmissionFormOptions(authorization),
            getDynamicListByPath("/api/v1/cohorts", authorization),
          ]);
          const majorOptions = toSelectionOptionItems(options.majors, "Ngành");
          const blockOptions = toSelectionOptionItems(options.blocks, "Khối");
          const periodOptions = toSelectionOptionItems(options.periods, "Kỳ tuyển sinh");
          const cohortOptions = toCohortSelectionOptions(cohorts.rows);

          const firstMajorId = majorOptions[0] ? String(majorOptions[0].id) : "";
          const firstBlockId = blockOptions[0] ? String(blockOptions[0].id) : "";
          const firstPeriodId = periodOptions[0] ? String(periodOptions[0].id) : "";

          if (firstMajorId) {
            setBenchmarkMajorIdInput((prev) => prev || firstMajorId);
          }
          if (firstBlockId) {
            setBenchmarkBlockIdInput((prev) => prev || firstBlockId);
          }
          if (firstPeriodId) {
            setAdmissionAutoScreenPeriodId((prev) => prev || firstPeriodId);
            setAdmissionOnboardPeriodId((prev) => prev || firstPeriodId);
            setBenchmarkPeriodIdInput((prev) => prev || firstPeriodId);
            setBenchmarkBulkPeriodIdInput((prev) => prev || firstPeriodId);
          }
          if (cohortOptions[0]) {
            setAdmissionOnboardCohortId((prev) => prev || String(cohortOptions[0].id));
          }

          if (firstMajorId || firstBlockId) {
            setBenchmarkBulkRows((prev) =>
              prev.map((row) => ({
                ...row,
                majorId: row.majorId || firstMajorId,
                blockId: row.blockId || firstBlockId,
              })),
            );
          }

          setAdmissionFormOptions(options);
          setAdmissionCohortOptions(cohortOptions);
          setPeriodDetailIdInput((prev) => prev || firstPeriodId);
          setPeriodDetail(null);
          break;
        }
        case "grade-management": {
          setGradeRows([]);
          setGradeComponentOptions([]);
          setGradeScoreByComponentId({});
          setTabMessage("Nhập section ID rồi bam Tải diem theo lop hoc phan.");
          break;
        }
        case "attendance-management": {
          setAttendanceRows([]);
          setGuardianAttendanceRows([]);
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

  const handleLoadGradeReportsByStudent = async () => {
    const authorization = requireAuthorization();
    const studentId = parsePositiveInteger(gradeStudentIdInput, "Mã sinh viên");
    if (!authorization || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getStudentGradeReports(studentId, authorization);
      setGradeRows(data);
      setTabMessage(`Đã tải ${data.length} bản ghi diem cho student ${studentId}.`);
    });
  };

  const handleLoadGradeComponentsByCourse = async () => {
    const authorization = requireAuthorization();
    const courseId = parsePositiveInteger(gradeCourseIdInput, "Mã môn học");
    if (!authorization || !courseId) {
      return;
    }

    await runAction(async () => {
      const data = await getGradeComponentsByCourse(courseId, authorization);
      const options = toGradeComponentOptions(data);
      setGradeComponentOptions(options);
      setGradeScoreByComponentId((prev) => {
        const next: Record<number, string> = {};
        for (const item of options) {
          next[item.id] = prev[item.id] || "";
        }
        return next;
      });
      setTabMessage(
        `Đã tải ${options.length} thành phần điểm của môn học #${courseId}.`,
      );
    });
  };

  const handleGradeDetailInputRowChange = (
    index: number,
    field: "componentId" | "score",
    value: string,
  ) => {
    setGradeDetailInputRows((prev) =>
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

  const addGradeDetailInputRow = () => {
    setGradeDetailInputRows((prev) => [...prev, { componentId: "", score: "" }]);
  };

  const removeGradeDetailInputRow = (index: number) => {
    setGradeDetailInputRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index),
    );
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

  const handleLoadGuardianStudentAttendances = async () => {
    const authorization = requireAuthorization();
    const guardianId = parsePositiveInteger(
      attendanceGuardianIdInput,
      "Mã phụ huynh",
    );
    const studentId = parsePositiveInteger(
      attendanceGuardianStudentIdInput,
      "Mã sinh viên",
    );
    if (!authorization || !guardianId || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getGuardianStudentAttendances(
        guardianId,
        studentId,
        authorization,
      );
      setGuardianAttendanceRows(data);
      setTabMessage(
        `Đã tải ${data.length} bản ghi điểm danh cho phụ huynh #${guardianId} và sinh viên #${studentId}.`,
      );
    });
  };

  const handleLoadGradeDetail = async () => {
    const authorization = requireAuthorization();
    const gradeReportId = parsePositiveInteger(gradeReportIdInput, "Mã bảng điểm");
    if (!authorization || !gradeReportId) {
      return;
    }

    await runAction(async () => {
      const detail = await getGradeReportById(gradeReportId, authorization);
      setGradeDetail(detail);
      if (Array.isArray(detail.gradeDetails)) {
        const mappedScores: Record<number, string> = {};
        const manualRows: GradeDetailInputRow[] = [];
        for (const item of detail.gradeDetails) {
          if (!item || typeof item !== "object") {
            continue;
          }
          const casted = item as Record<string, unknown>;
          const componentId = Number(casted.componentId);
          const score = Number(casted.score);
          if (Number.isInteger(componentId) && componentId > 0 && Number.isFinite(score)) {
            mappedScores[componentId] = String(score);
            manualRows.push({
              componentId: String(componentId),
              score: String(score),
            });
          }
        }

        if (Object.keys(mappedScores).length > 0) {
          setGradeScoreByComponentId((prev) => ({
            ...prev,
            ...mappedScores,
          }));
        }

        if (manualRows.length > 0) {
          setGradeDetailInputRows(manualRows);
        }
      }
      setTabMessage(`Đã tải chi tiết bảng điểm #${gradeReportId}.`);
    });
  };

  const handleUpsertGradeReport = async () => {
    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    const registrationId = parsePositiveInteger(gradeRegistrationIdInput, "Mã đăng ký môn");
    if (!registrationId) {
      return;
    }

    let gradeDetails: Array<{ componentId: number; score: number }> = [];

    if (gradeComponentOptions.length > 0) {
      const detailsFromForm: Array<{ componentId: number; score: number }> = [];

      for (const component of gradeComponentOptions) {
        const rawScore = (gradeScoreByComponentId[component.id] || "").trim();
        if (!rawScore) {
          continue;
        }

        const parsedScore = Number(rawScore);
        if (!Number.isFinite(parsedScore)) {
          setTabError(
            `Điểm của thành phần "${component.componentName}" không hop le.`,
          );
          return;
        }

        detailsFromForm.push({
          componentId: component.id,
          score: parsedScore,
        });
      }

      gradeDetails = detailsFromForm;
    }

    if (gradeDetails.length === 0) {
      const detailsFromManualRows: Array<{ componentId: number; score: number }> = [];

      for (let index = 0; index < gradeDetailInputRows.length; index += 1) {
        const row = gradeDetailInputRows[index];
        const rawComponentId = row.componentId.trim();
        const rawScore = row.score.trim();

        if (!rawComponentId && !rawScore) {
          continue;
        }

        const componentId = Number(rawComponentId);
        const score = Number(rawScore);

        if (!Number.isInteger(componentId) || componentId <= 0) {
          setTabError(`Dòng #${index + 1}: component ID không hop le.`);
          return;
        }

        if (!Number.isFinite(score)) {
          setTabError(`Dòng #${index + 1}: điểm không hop le.`);
          return;
        }

        detailsFromManualRows.push({
          componentId,
          score,
        });
      }

      gradeDetails = detailsFromManualRows;
    }

    if (gradeDetails.length === 0) {
      setTabError("Grade details không duoc de trong.");
      return;
    }

    await runAction(async () => {
      const reportId = gradeReportIdInput.trim()
        ? parsePositiveInteger(gradeReportIdInput, "Mã bảng điểm")
        : null;
      if (gradeReportIdInput.trim() && !reportId) {
        return;
      }

      const payload = {
        registrationId,
        gradeDetails,
        status: gradeStatusInput,
      };

      if (reportId) {
        await updateGradeReport(reportId, payload, authorization);
        setTabMessage(`Đã cập nhật bảng điểm #${reportId}.`);
      } else {
        await createGradeReport(payload, authorization);
        setTabMessage("Đã tạo bảng điểm mới.");
      }

      if (gradeSectionIdInput.trim()) {
        const sectionId = parsePositiveInteger(gradeSectionIdInput, "Mã lớp học phần");
        if (sectionId) {
          const data = await getSectionGradeReports(sectionId, authorization);
          setGradeRows(data);
        }
      }
    });
  };

  const handleDeleteGradeReport = async () => {
    const authorization = requireAuthorization();
    const gradeReportId = parsePositiveInteger(gradeReportIdInput, "Mã bảng điểm");
    if (!authorization || !gradeReportId) {
      return;
    }

    await runAction(async () => {
      await deleteGradeReport(gradeReportId, authorization);
      setGradeDetail(null);
      if (gradeSectionIdInput.trim()) {
        const sectionId = parsePositiveInteger(gradeSectionIdInput, "Mã lớp học phần");
        if (sectionId) {
          const data = await getSectionGradeReports(sectionId, authorization);
          setGradeRows(data);
        }
      }
      setTabMessage(`Đã xóa bảng điểm #${gradeReportId}.`);
    });
  };

  const handleLoadAttendancesBySession = async () => {
    const authorization = requireAuthorization();
    const sessionId = parsePositiveInteger(attendanceSessionIdInput, "Mã buổi học");
    if (!authorization || !sessionId) {
      return;
    }

    await runAction(async () => {
      const data = await getAttendancesBySession(sessionId, authorization);
      setAttendanceSessionRows(data);
      setTabMessage(`Đã tải ${data.length} điểm danh theo session #${sessionId}.`);
    });
  };

  const handleCreateAttendancesBatch = async () => {
    const authorization = requireAuthorization();
    const sessionId = parsePositiveInteger(
      attendanceBatchSessionIdInput,
      "Mã buổi học cho batch",
    );
    if (!authorization || !sessionId) {
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
      setTabError("Danh sách batch không hop le hoặc đang để trống.");
      return;
    }

    await runAction(async () => {
      const data = await createAttendancesBatch(
        sessionId,
        {
          items,
        },
        authorization,
      );
      setAttendanceSessionRows(data);
      setTabMessage(`Đã tạo/cập nhật batch điểm danh cho session #${sessionId}.`);
    });
  };

  const handleUpdateAttendance = async () => {
    const authorization = requireAuthorization();
    const attendanceId = parsePositiveInteger(attendanceActionIdInput, "Mã attendance");
    if (!authorization || !attendanceId) {
      return;
    }

    await runAction(async () => {
      await updateAttendance(
        attendanceId,
        {
          status: attendanceActionStatus,
          note: attendanceActionNote.trim() || undefined,
        },
        authorization,
      );
      if (attendanceSessionIdInput.trim()) {
        const sessionId = parsePositiveInteger(attendanceSessionIdInput, "Mã buổi học");
        if (sessionId) {
          const data = await getAttendancesBySession(sessionId, authorization);
          setAttendanceSessionRows(data);
        }
      }
      setTabMessage(`Đã cập nhật attendance #${attendanceId}.`);
    });
  };

  const handleDeleteAttendance = async () => {
    const authorization = requireAuthorization();
    const attendanceId = parsePositiveInteger(attendanceActionIdInput, "Mã attendance");
    if (!authorization || !attendanceId) {
      return;
    }

    await runAction(async () => {
      await deleteAttendance(attendanceId, authorization);
      if (attendanceSessionIdInput.trim()) {
        const sessionId = parsePositiveInteger(attendanceSessionIdInput, "Mã buổi học");
        if (sessionId) {
          const data = await getAttendancesBySession(sessionId, authorization);
          setAttendanceSessionRows(data);
        }
      }
      setTabMessage(`Đã xóa attendance #${attendanceId}.`);
    });
  };

  const handleLoadAdmissionFormOptions = async () => {
    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      const [options, cohorts] = await Promise.all([
        getAdmissionFormOptions(authorization),
        getDynamicListByPath("/api/v1/cohorts", authorization),
      ]);
      const majorOptions = toSelectionOptionItems(options.majors, "Ngành");
      const blockOptions = toSelectionOptionItems(options.blocks, "Khối");
      const periodOptions = toSelectionOptionItems(options.periods, "Kỳ tuyển sinh");
      const cohortOptions = toCohortSelectionOptions(cohorts.rows);
      setAdmissionFormOptions(options);
      setAdmissionCohortOptions(cohortOptions);
      setPeriodDetail(null);

      const firstMajorId = majorOptions[0] ? String(majorOptions[0].id) : "";
      const firstBlockId = blockOptions[0] ? String(blockOptions[0].id) : "";
      const firstPeriodId = periodOptions[0] ? String(periodOptions[0].id) : "";

      if (firstMajorId) {
        setBenchmarkMajorIdInput((prev) => prev || firstMajorId);
      }
      if (firstBlockId) {
        setBenchmarkBlockIdInput((prev) => prev || firstBlockId);
      }
      if (firstPeriodId) {
        setAdmissionAutoScreenPeriodId((prev) => prev || firstPeriodId);
        setAdmissionOnboardPeriodId((prev) => prev || firstPeriodId);
        setBenchmarkPeriodIdInput((prev) => prev || firstPeriodId);
        setBenchmarkBulkPeriodIdInput((prev) => prev || firstPeriodId);
        setPeriodDetailIdInput((prev) => prev || firstPeriodId);
      }
      if (cohortOptions[0]) {
        setAdmissionOnboardCohortId((prev) => prev || String(cohortOptions[0].id));
      }

      if (firstMajorId || firstBlockId) {
        setBenchmarkBulkRows((prev) =>
          prev.map((row) => ({
            ...row,
            majorId: row.majorId || firstMajorId,
            blockId: row.blockId || firstBlockId,
          })),
        );
      }

      setTabMessage(
        `Đã tải form options: ${options.majors.length} majors, ${options.blocks.length} blocks, ${options.periods.length} periods.`,
      );
    });
  };

  const handleLoadAdmissionDetail = async () => {
    const authorization = requireAuthorization();
    const applicationId = resolveSingleAdmissionId(admissionDetailIdInput);
    if (!authorization || !applicationId) {
      return;
    }

    await runAction(async () => {
      const detail = await getAdmissionApplicationById(applicationId, authorization);
      setAdmissionDetail(detail);
      setTabMessage(`Đã tải chi tiết hồ sơ #${applicationId}.`);
    });
  };

  const handleReviewSingleAdmission = async () => {
    const authorization = requireAuthorization();
    const applicationId = resolveSingleAdmissionId(admissionReviewIdInput);
    if (!authorization || !applicationId) {
      return;
    }

    await runAction(async () => {
      await reviewAdmissionApplication(
        applicationId,
        {
          status: admissionReviewStatus,
          note: admissionReviewNote.trim() || undefined,
        },
        authorization,
      );
      await loadAdmissionsData(authorization);
      setAdmissionSelectedIds((prev) => prev.filter((id) => id !== applicationId));
      setTabMessage(`Đã duyet hồ sơ #${applicationId} thành ${admissionReviewStatus}.`);
    });
  };

  const handleBulkReviewAdmissions = async () => {
    const authorization = requireAuthorization();
    const applicationIds = admissionSelectedIds;
    if (!authorization) {
      return;
    }

    if (applicationIds.length === 0) {
      setTabError("Vui lòng chọn ít nhất một hồ sơ trong bảng ứng viên.");
      return;
    }

    await runAction(async () => {
      await reviewAdmissionApplicationsBulk(
        {
          applicationIds,
          status: admissionBulkStatus,
          note: admissionBulkNote.trim() || undefined,
        },
        authorization,
      );
      await loadAdmissionsData(authorization);
      setAdmissionSelectedIds([]);
      setTabMessage(
        `Đã duyet hàng loat ${applicationIds.length} hồ sơ thành ${admissionBulkStatus}.`,
      );
    });
  };

  const handleAutoScreenAdmissions = async () => {
    const authorization = requireAuthorization();
    const periodId = parsePositiveInteger(
      admissionAutoScreenPeriodId,
      "Mã kỳ tuyển sinh",
    );
    if (!authorization || !periodId) {
      return;
    }

    await runAction(async () => {
      await autoScreenAdmissionApplications(periodId, authorization);
      await loadAdmissionsData(authorization);
      setTabMessage(`Đã chạy auto-screen cho kỳ #${periodId}.`);
    });
  };

  const handleAdmissionOnboarding = async () => {
    const authorization = requireAuthorization();
    const periodId = parsePositiveInteger(admissionOnboardPeriodId, "Mã kỳ tuyển sinh");
    const cohortId = parsePositiveInteger(admissionOnboardCohortId, "Mã niên khóa");
    if (!authorization || !periodId || !cohortId) {
      return;
    }

    await runAction(async () => {
      await processAdmissionOnboarding(
        {
          periodId,
          cohortId,
        },
        authorization,
      );
      await loadAdmissionsData(authorization);
      setTabMessage(`Đã chạy onboarding cho kỳ #${periodId} và niên khóa #${cohortId}.`);
    });
  };

  const handleLoadPeriodDetail = async () => {
    const authorization = requireAuthorization();
    const periodId = parsePositiveInteger(periodDetailIdInput, "Mã kỳ tuyển sinh");
    if (!authorization || !periodId) {
      return;
    }

    await runAction(async () => {
      const detail = await getAdmissionPeriodById(periodId, authorization);
      setPeriodDetail(detail);
      setPeriodActionIdInput(String(periodId));
      setTabMessage(`Đã tải chi tiết kỳ tuyển sinh #${periodId}.`);
    });
  };

  const handleUpsertPeriod = async () => {
    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    const periodName = periodNameInput.trim();
    if (!periodName) {
      setTabError("Tên kỳ tuyển sinh không duoc de trong.");
      return;
    }

    const startTime = parseDateTimeLocalToIso(periodStartInput, "Thoi gian bat dau");
    const endTime = parseDateTimeLocalToIso(periodEndInput, "Thoi gian ket thuc");
    if (!startTime || !endTime) {
      return;
    }

    await runAction(async () => {
      const payload = {
        periodName,
        startTime,
        endTime,
        status: periodStatusInput,
      };
      const periodId = periodActionIdInput.trim()
        ? parsePositiveInteger(periodActionIdInput, "Mã kỳ tuyển sinh")
        : null;
      if (periodActionIdInput.trim() && !periodId) {
        return;
      }

      if (periodId) {
        await updateAdmissionPeriod(periodId, payload, authorization);
      } else {
        await createAdmissionPeriod(payload, authorization);
      }
      await loadAdmissionsData(authorization);
      setTabMessage(periodId ? `Đã cập nhật kỳ #${periodId}.` : "Đã tạo kỳ tuyển sinh mới.");
    });
  };

  const handleDeletePeriod = async () => {
    const authorization = requireAuthorization();
    const periodId = parsePositiveInteger(periodActionIdInput, "Mã kỳ tuyển sinh");
    if (!authorization || !periodId) {
      return;
    }

    await runAction(async () => {
      await deleteAdmissionPeriod(periodId, authorization);
      await loadAdmissionsData(authorization);
      setTabMessage(`Đã xóa kỳ tuyển sinh #${periodId}.`);
    });
  };

  const handleUpsertBlock = async () => {
    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    const blockName = blockNameInput.trim();
    if (!blockName) {
      setTabError("Tên khối xét tuyển không duoc de trong.");
      return;
    }

    await runAction(async () => {
      const payload = {
        blockName,
        description: blockDescriptionInput.trim() || undefined,
      };
      const blockId = blockActionIdInput.trim()
        ? parsePositiveInteger(blockActionIdInput, "Mã khối")
        : null;
      if (blockActionIdInput.trim() && !blockId) {
        return;
      }

      if (blockId) {
        await updateAdmissionBlock(blockId, payload, authorization);
      } else {
        await createAdmissionBlock(payload, authorization);
      }
      await loadAdmissionsData(authorization);
      setTabMessage(blockId ? `Đã cập nhật khối #${blockId}.` : "Đã tạo khối xét tuyển mới.");
    });
  };

  const handleDeleteBlock = async () => {
    const authorization = requireAuthorization();
    const blockId = parsePositiveInteger(blockActionIdInput, "Mã khối");
    if (!authorization || !blockId) {
      return;
    }

    await runAction(async () => {
      await deleteAdmissionBlock(blockId, authorization);
      await loadAdmissionsData(authorization);
      setTabMessage(`Đã xóa khối #${blockId}.`);
    });
  };

  const handleUpsertBenchmark = async () => {
    const authorization = requireAuthorization();
    const benchmarkId = parsePositiveInteger(benchmarkActionIdInput, "Mã benchmark");
    const majorId = parsePositiveInteger(benchmarkMajorIdInput, "Mã ngành");
    const blockId = parsePositiveInteger(benchmarkBlockIdInput, "Mã khối");
    const periodId = parsePositiveInteger(benchmarkPeriodIdInput, "Mã kỳ");
    if (!authorization || !benchmarkId || !majorId || !blockId || !periodId) {
      return;
    }

    const score = Number(benchmarkScoreInput);
    if (!Number.isFinite(score) || score < 0 || score > 30) {
      setTabError("Điểm chuẩn phải nằm trong khoảng 0 đến 30.");
      return;
    }

    await runAction(async () => {
      await updateAdmissionBenchmark(
        benchmarkId,
        {
          majorId,
          blockId,
          periodId,
          score,
        },
        authorization,
      );
      await loadAdmissionsData(authorization);
      setTabMessage(`Đã cập nhật benchmark #${benchmarkId}.`);
    });
  };

  const handleDeleteBenchmark = async () => {
    const authorization = requireAuthorization();
    const benchmarkId = parsePositiveInteger(benchmarkActionIdInput, "Mã benchmark");
    if (!authorization || !benchmarkId) {
      return;
    }

    await runAction(async () => {
      await deleteAdmissionBenchmark(benchmarkId, authorization);
      await loadAdmissionsData(authorization);
      setTabMessage(`Đã xóa benchmark #${benchmarkId}.`);
    });
  };

  const handleSaveBulkBenchmarks = async () => {
    const authorization = requireAuthorization();
    const periodId = parsePositiveInteger(benchmarkBulkPeriodIdInput, "Mã kỳ");
    if (!authorization || !periodId) {
      return;
    }

    const benchmarkItems = benchmarkBulkRows
      .map((row) => {
        const majorId = Number(row.majorId);
        const blockId = Number(row.blockId);
        const score = Number(row.score);
        if (!Number.isInteger(majorId) || majorId <= 0) {
          return null;
        }
        if (!Number.isInteger(blockId) || blockId <= 0) {
          return null;
        }
        if (!Number.isFinite(score) || score < 0 || score > 30) {
          return null;
        }
        return {
          majorId,
          blockId,
          score,
        };
      })
      .filter(
        (row): row is { majorId: number; blockId: number; score: number } => row !== null,
      );

    if (benchmarkItems.length === 0) {
      setTabError("Danh sách benchmark không duoc de trong.");
      return;
    }

    await runAction(async () => {
      await saveAdmissionBenchmarksBulk(
        {
          periodId,
          benchmarks: benchmarkItems,
        },
        authorization,
      );
      await loadAdmissionsData(authorization);
      setTabMessage(`Đã lưu bulk ${benchmarkItems.length} benchmark cho kỳ #${periodId}.`);
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
    activeTab.key === "cohorts" ||
    activeTab.key === "recurring-schedules" ||
    activeTab.key === "course-sections"
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

            {activeTab.key === "course-sections" ? (
              <CourseSectionPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "majors" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Lọc ngành theo khoa</h2>
                </div>
                <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px_140px]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                    placeholder="Nhập faculty ID"
                    value={majorFacultyFilterValue}
                    onChange={(event) => setMajorFacultyFilterValue(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleApplyMajorFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={handleResetMajorFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    Bỏ lọc
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab.key === "specializations" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Lọc chuyên ngành theo ngành</h2>
                </div>
                <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px_140px]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                    placeholder="Nhập major ID"
                    value={specializationMajorFilterValue}
                    onChange={(event) => setSpecializationMajorFilterValue(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleApplySpecializationMajorFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSpecializationMajorFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    Bỏ lọc
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab.key === "courses" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Lọc môn học theo khoa</h2>
                </div>
                <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px_140px]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                    placeholder="Nhập faculty ID"
                    value={courseFacultyFilterValue}
                    onChange={(event) => setCourseFacultyFilterValue(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCourseFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCourseFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    Bỏ lọc
                  </button>
                </div>
              </section>
            ) : null}

            {activeDynamicCrudConfig ? (
              <DynamicCrudPanel
                authorization={session?.authorization}
                title={activeDynamicCrudConfig.title}
                basePath={activeDynamicCrudConfig.basePath}
                listPath={
                  activeTab.key === "majors"
                    ? majorListPath
                    : activeTab.key === "specializations"
                      ? specializationListPath
                      : activeTab.key === "courses"
                        ? courseListPath
                    : undefined
                }
                listQuery={activeDynamicCrudConfig.listQuery}
                fieldLookups={activeDynamicCrudConfig.fieldLookups}
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
                  <div className="grid gap-4 px-4 py-4 xl:grid-cols-2">
                    <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
                      <h3 className="text-base font-semibold text-[#1a4f75]">
                        Tra cứu theo section / student
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-[220px_180px]">
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
                      <div className="grid gap-2 sm:grid-cols-[220px_180px]">
                        <input
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          placeholder="Mã sinh viên"
                          value={gradeStudentIdInput}
                          onChange={(event) => setGradeStudentIdInput(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadGradeReportsByStudent();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                        >
                          Tải theo sinh viên
                        </button>
                      </div>
                    </section>

                    <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
                      <h3 className="text-base font-semibold text-[#1a4f75]">CRUD Grade Report</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          placeholder="Mã bảng điểm (để update/delete/detail)"
                          value={gradeReportIdInput}
                          onChange={(event) => setGradeReportIdInput(event.target.value)}
                        />
                        <input
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          placeholder="Mã đăng ký môn"
                          value={gradeRegistrationIdInput}
                          onChange={(event) => setGradeRegistrationIdInput(event.target.value)}
                        />
                      </div>
                      <select
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        value={gradeStatusInput}
                        onChange={(event) =>
                          setGradeStatusInput(event.target.value as GradeReportStatus)
                        }
                      >
                        {gradeReportStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <div className="grid gap-2 sm:grid-cols-[220px_180px]">
                        <input
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          placeholder="Mã môn học (để tải components)"
                          value={gradeCourseIdInput}
                          onChange={(event) => setGradeCourseIdInput(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadGradeComponentsByCourse();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Tải components
                        </button>
                      </div>
                      {gradeComponentOptions.length > 0 ? (
                        <div className="space-y-2 rounded-[6px] border border-[#d7e7f3] bg-white p-2">
                          {gradeComponentOptions.map((component) => (
                            <label
                              key={component.id}
                              className="grid gap-2 sm:grid-cols-[1fr_140px]"
                            >
                              <span className="text-sm text-[#355970]">
                                {component.componentName}
                                {component.weightPercentage !== undefined
                                  ? ` (${component.weightPercentage}%)`
                                  : ""}
                              </span>
                              <input
                                className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                                placeholder="Điểm"
                                value={gradeScoreByComponentId[component.id] || ""}
                                onChange={(event) =>
                                  setGradeScoreByComponentId((prev) => ({
                                    ...prev,
                                    [component.id]: event.target.value,
                                  }))
                                }
                                inputMode="decimal"
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                      {gradeComponentOptions.length === 0 ? (
                        <div className="space-y-2 rounded-[6px] border border-[#d7e7f3] bg-white p-2">
                          <p className="text-xs text-[#5f7d93]">
                            Chưa tải components, nhập thủ công từng dòng `componentId + score`.
                          </p>
                          {gradeDetailInputRows.map((row, index) => (
                            <div
                              key={`grade-detail-input-row-${index + 1}`}
                              className="grid gap-2 sm:grid-cols-[1fr_1fr_36px]"
                            >
                              <input
                                className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                                placeholder="Component ID"
                                value={row.componentId}
                                onChange={(event) =>
                                  handleGradeDetailInputRowChange(
                                    index,
                                    "componentId",
                                    event.target.value,
                                  )
                                }
                                inputMode="numeric"
                              />
                              <input
                                className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                                placeholder="Điểm"
                                value={row.score}
                                onChange={(event) =>
                                  handleGradeDetailInputRowChange(
                                    index,
                                    "score",
                                    event.target.value,
                                  )
                                }
                                inputMode="decimal"
                              />
                              <button
                                type="button"
                                onClick={() => removeGradeDetailInputRow(index)}
                                disabled={gradeDetailInputRows.length === 1 || isWorking}
                                className="h-9 rounded-[4px] bg-[#cc3a3a] px-2 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                                aria-label="Xóa dòng điểm"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addGradeDetailInputRow}
                            disabled={isWorking}
                            className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                          >
                            Thêm dòng điểm
                          </button>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadGradeDetail();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Xem detail
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleUpsertGradeReport();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                        >
                          Tạo / cập nhật
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteGradeReport();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] bg-[#cc3a3a] px-3 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                      {gradeDetail ? (
                        <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-sm text-[#355970]">
                          <p>ID: {gradeDetail.id ?? "-"}</p>
                          <p>Student: {gradeDetail.studentName || "-"}</p>
                          <p>Course: {gradeDetail.courseName || "-"}</p>
                          <p>Status: {gradeDetail.status || "-"}</p>
                          <p>Final score: {gradeDetail.finalScore ?? "-"}</p>
                        </div>
                      ) : null}
                    </section>
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
                          onChange={(event) =>
                            setAttendanceGuardianIdInput(event.target.value)
                          }
                        />
                        <input
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          placeholder="Mã sinh viên của phụ huynh"
                          value={attendanceGuardianStudentIdInput}
                          onChange={(event) =>
                            setAttendanceGuardianStudentIdInput(event.target.value)
                          }
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
                          onChange={(event) =>
                            setAttendanceBatchSessionIdInput(event.target.value)
                          }
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
                                handleAttendanceBatchRowChange(
                                  index,
                                  "courseRegistrationId",
                                  event.target.value,
                                )
                              }
                            />
                            <select
                              className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                              value={row.status}
                              onChange={(event) =>
                                handleAttendanceBatchRowChange(
                                  index,
                                  "status",
                                  event.target.value,
                                )
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
                              ×
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
                          onChange={(event) =>
                            setAttendanceActionStatus(
                              event.target.value as AttendanceStatus,
                            )
                          }
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
                )}
                {renderDynamicTable(
                  "Bảng điểm danh theo phụ huynh - sinh viên",
                  guardianAttendanceRows as unknown as DynamicRow[],
                  buildColumns(guardianAttendanceRows as unknown as DynamicRow[], [
                    "id",
                    "studentId",
                    "studentCode",
                    "sessionId",
                    "sessionDate",
                    "status",
                    "note",
                  ]),
                )}
                {renderDynamicTable(
                  "Bạng điểm danh theo buổi học (session)",
                  attendanceSessionRows as unknown as DynamicRow[],
                  buildColumns(attendanceSessionRows as unknown as DynamicRow[], [
                    "id",
                    "sessionId",
                    "studentId",
                    "studentCode",
                    "status",
                    "note",
                  ]),
                )}
              </div>
            ) : null}


            {activeTab.key === "admissions" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Admission Action Center</h2>
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadAdmissionFormOptions();
                      }}
                      disabled={isWorking}
                      className="rounded-[4px] border border-[#9ec3dd] bg-white px-3 py-1.5 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
                    >
                      Tải form options
                    </button>
                  </div>
                  <div className="grid gap-4 px-4 py-4 xl:grid-cols-2">
                    <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
                      <h3 className="text-base font-semibold text-[#1a4f75]">Thao tác hồ sơ tuyển sinh</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={admissionDetailIdInput}
                          onChange={(event) => setAdmissionDetailIdInput(event.target.value)}
                        >
                          <option value="">Chọn hồ sơ để xem chi tiết</option>
                          {admissionApplicationOptions.map((option) => (
                            <option key={`detail-application-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadAdmissionDetail();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Xem chi tiết
                        </button>
                      </div>
                      {admissionDetail ? (
                        <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-sm text-[#355970]">
                          <p>ID: {admissionDetail.id}</p>
                          <p>Họ tên: {admissionDetail.fullName || "-"}</p>
                          <p>Email: {admissionDetail.email || "-"}</p>
                          <p>SĐT: {admissionDetail.phone || "-"}</p>
                          <p>Trạng thái: {admissionDetail.status || "-"}</p>
                        </div>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-[140px_1fr_140px]">
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={admissionReviewIdInput}
                          onChange={(event) => setAdmissionReviewIdInput(event.target.value)}
                        >
                          <option value="">Chọn hồ sơ</option>
                          {admissionApplicationOptions.map((option) => (
                            <option key={`review-application-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          placeholder="Ghi chú review (không bắt buộc)"
                          value={admissionReviewNote}
                          onChange={(event) => setAdmissionReviewNote(event.target.value)}
                        />
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={admissionReviewStatus}
                          onChange={(event) =>
                            setAdmissionReviewStatus(
                              event.target.value as AdmissionApplicationStatus,
                            )
                          }
                        >
                          {admissionApplicationStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleReviewSingleAdmission();
                        }}
                        disabled={isWorking}
                        className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                      >
                        Review hồ sơ đơn lẻ
                      </button>

                      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                        <div className="h-10 rounded-[4px] border border-[#c8d3dd] bg-white px-3 text-sm leading-[38px] text-[#355970]">
                          Đã chọn {admissionSelectedIds.length} hồ sơ để duyệt hàng loạt
                        </div>
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={admissionBulkStatus}
                          onChange={(event) =>
                            setAdmissionBulkStatus(
                              event.target.value as AdmissionApplicationStatus,
                            )
                          }
                        >
                          {admissionApplicationStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={clearAdmissionSelection}
                          disabled={isWorking || admissionSelectedIds.length === 0}
                          className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Bỏ chọn tất cả
                        </button>
                        {admissionSelectedIds.length > 0 ? (
                          <p className="self-center text-xs text-[#5f7d93]">
                            IDs: {admissionSelectedIds.join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <input
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        placeholder="Ghi chú bulk review (không bắt buộc)"
                        value={admissionBulkNote}
                        onChange={(event) => setAdmissionBulkNote(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void handleBulkReviewAdmissions();
                        }}
                        disabled={isWorking}
                        className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                      >
                        Bulk review hồ sơ
                      </button>
                    </section>

                    <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
                      <h3 className="text-base font-semibold text-[#1a4f75]">Auto-screen và Onboarding</h3>
                      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={admissionAutoScreenPeriodId}
                          onChange={(event) =>
                            setAdmissionAutoScreenPeriodId(event.target.value)
                          }
                        >
                          <option value="">Chọn kỳ tuyển sinh</option>
                          {admissionPeriodOptions.map((option) => (
                            <option key={`auto-period-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            void handleAutoScreenAdmissions();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                        >
                          Chạy auto-screen
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={admissionOnboardPeriodId}
                          onChange={(event) =>
                            setAdmissionOnboardPeriodId(event.target.value)
                          }
                        >
                          <option value="">Chọn kỳ tuyển sinh</option>
                          {admissionPeriodOptions.map((option) => (
                            <option key={`onboard-period-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={admissionOnboardCohortId}
                          onChange={(event) =>
                            setAdmissionOnboardCohortId(event.target.value)
                          }
                        >
                          <option value="">Chọn niên khóa</option>
                          {admissionCohortOptions.map((option) => (
                            <option key={`onboard-cohort-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleAdmissionOnboarding();
                        }}
                        disabled={isWorking}
                        className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                      >
                        Process onboarding
                      </button>

                      <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-sm text-[#355970]">
                        <p>Majors options: {admissionFormOptions.majors.length}</p>
                        <p>Blocks options: {admissionFormOptions.blocks.length}</p>
                        <p>Periods options: {admissionFormOptions.periods.length}</p>
                        <p>Cohorts options: {admissionCohortOptions.length}</p>
                      </div>
                    </section>
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Admissions Config Actions</h2>
                  </div>
                  <div className="grid gap-4 px-4 py-4 xl:grid-cols-3">
                    <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
                      <h3 className="text-base font-semibold text-[#1a4f75]">Kỳ tuyển sinh (period)</h3>
                      <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={periodDetailIdInput}
                          onChange={(event) => setPeriodDetailIdInput(event.target.value)}
                        >
                          <option value="">Chọn kỳ tuyển sinh để xem chi tiết</option>
                          {admissionPeriodOptions.map((option) => (
                            <option key={`period-detail-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadPeriodDetail();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Xem chi tiết
                        </button>
                      </div>
                      {periodDetail ? (
                        <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-sm text-[#355970]">
                          <p>ID: {periodDetail.id}</p>
                          <p>Tên kỳ: {periodDetail.periodName || "-"}</p>
                          <p>Bắt đầu: {formatDateTime(periodDetail.startTime)}</p>
                          <p>Kết thúc: {formatDateTime(periodDetail.endTime)}</p>
                          <p>Trạng thái: {periodDetail.status || "-"}</p>
                        </div>
                      ) : null}
                      <input
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        placeholder="Mã kỳ (để trống = tạo mới)"
                        value={periodActionIdInput}
                        onChange={(event) => setPeriodActionIdInput(event.target.value)}
                      />
                      <input
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        placeholder="Tên kỳ"
                        value={periodNameInput}
                        onChange={(event) => setPeriodNameInput(event.target.value)}
                      />
                      <input
                        type="datetime-local"
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        value={periodStartInput}
                        onChange={(event) => setPeriodStartInput(event.target.value)}
                      />
                      <input
                        type="datetime-local"
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        value={periodEndInput}
                        onChange={(event) => setPeriodEndInput(event.target.value)}
                      />
                      <select
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        value={periodStatusInput}
                        onChange={(event) =>
                          setPeriodStatusInput(event.target.value as AdmissionPeriodStatus)
                        }
                      >
                        {admissionPeriodStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleUpsertPeriod();
                          }}
                          disabled={isWorking}
                          className="h-10 flex-1 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                        >
                          Tạo / cập nhật
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeletePeriod();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] bg-[#cc3a3a] px-3 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                    </section>

                    <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
                      <h3 className="text-base font-semibold text-[#1a4f75]">Khối xét tuyển (block)</h3>
                      <input
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        placeholder="Mã block (để trống = tạo mới)"
                        value={blockActionIdInput}
                        onChange={(event) => setBlockActionIdInput(event.target.value)}
                      />
                      <input
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        placeholder="Tên block (vd: A00)"
                        value={blockNameInput}
                        onChange={(event) => setBlockNameInput(event.target.value)}
                      />
                      <input
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        placeholder="Mô tả"
                        value={blockDescriptionInput}
                        onChange={(event) =>
                          setBlockDescriptionInput(event.target.value)
                        }
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleUpsertBlock();
                          }}
                          disabled={isWorking}
                          className="h-10 flex-1 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                        >
                          Tạo / cập nhật
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteBlock();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] bg-[#cc3a3a] px-3 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                    </section>

                    <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
                      <h3 className="text-base font-semibold text-[#1a4f75]">Benchmark</h3>
                      <input
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        placeholder="Mã benchmark (để update/delete)"
                        value={benchmarkActionIdInput}
                        onChange={(event) =>
                          setBenchmarkActionIdInput(event.target.value)
                        }
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={benchmarkMajorIdInput}
                          onChange={(event) =>
                            setBenchmarkMajorIdInput(event.target.value)
                          }
                        >
                          <option value="">Chọn ngành</option>
                          {admissionMajorOptions.map((option) => (
                            <option key={`benchmark-major-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={benchmarkBlockIdInput}
                          onChange={(event) =>
                            setBenchmarkBlockIdInput(event.target.value)
                          }
                        >
                          <option value="">Chọn khối</option>
                          {admissionBlockOptions.map((option) => (
                            <option key={`benchmark-block-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          value={benchmarkPeriodIdInput}
                          onChange={(event) =>
                            setBenchmarkPeriodIdInput(event.target.value)
                          }
                        >
                          <option value="">Chọn kỳ tuyển sinh</option>
                          {admissionPeriodOptions.map((option) => (
                            <option key={`benchmark-period-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                          placeholder="Score (0-30)"
                          value={benchmarkScoreInput}
                          onChange={(event) =>
                            setBenchmarkScoreInput(event.target.value)
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleUpsertBenchmark();
                          }}
                          disabled={isWorking}
                          className="h-10 flex-1 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                        >
                          Cập nhật
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteBenchmark();
                          }}
                          disabled={isWorking}
                          className="h-10 rounded-[4px] bg-[#cc3a3a] px-3 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                      <select
                        className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                        value={benchmarkBulkPeriodIdInput}
                        onChange={(event) =>
                          setBenchmarkBulkPeriodIdInput(event.target.value)
                        }
                      >
                        <option value="">Chọn kỳ tuyển sinh cho bulk</option>
                        {admissionPeriodOptions.map((option) => (
                          <option key={`benchmark-bulk-period-${option.id}`} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="space-y-2 rounded-[6px] border border-[#d7e7f3] bg-white p-2">
                        {benchmarkBulkRows.map((row, index) => (
                          <div
                            key={`benchmark-bulk-row-${index + 1}`}
                            className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_36px]"
                          >
                            <select
                              className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                              value={row.majorId}
                              onChange={(event) =>
                                handleBenchmarkBulkRowChange(
                                  index,
                                  "majorId",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Chọn ngành</option>
                              {admissionMajorOptions.map((option) => (
                                <option
                                  key={`benchmark-bulk-major-${index}-${option.id}`}
                                  value={option.id}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                              value={row.blockId}
                              onChange={(event) =>
                                handleBenchmarkBulkRowChange(
                                  index,
                                  "blockId",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Chọn khối</option>
                              {admissionBlockOptions.map((option) => (
                                <option
                                  key={`benchmark-bulk-block-${index}-${option.id}`}
                                  value={option.id}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <input
                              className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                              placeholder="Score"
                              value={row.score}
                              onChange={(event) =>
                                handleBenchmarkBulkRowChange(index, "score", event.target.value)
                              }
                              inputMode="decimal"
                            />
                            <button
                              type="button"
                              onClick={() => removeBenchmarkBulkRow(index)}
                              disabled={benchmarkBulkRows.length === 1 || isWorking}
                              className="h-9 rounded-[4px] bg-[#cc3a3a] px-2 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                              aria-label="Xóa dòng benchmark"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addBenchmarkBulkRow}
                          disabled={isWorking}
                          className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                        >
                          Thêm dòng benchmark
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveBulkBenchmarks();
                        }}
                        disabled={isWorking}
                        className="h-10 w-full rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                      >
                        Save bulk benchmarks
                      </button>
                    </section>
                  </div>
                </section>

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
                          <th className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={areAllVisibleAdmissionsSelected}
                              onChange={toggleSelectAllVisibleAdmissions}
                              aria-label="Chọn tất cả hồ sơ hiển thị"
                            />
                          </th>
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
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={admissionSelectedIds.includes(item.id)}
                                onChange={() => toggleAdmissionSelection(item.id)}
                                aria-label={`Chọn hồ sơ ${item.id}`}
                              />
                            </td>
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
                            <td colSpan={8} className="px-2 py-4 text-center text-[#577086]">
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
