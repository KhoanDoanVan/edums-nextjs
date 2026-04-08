"use client";

import { useEffect, useMemo, useState } from "react";
import {
  autoScreenAdmissionApplications,
  createAdmissionCampaign,
  createAdmissionBlock,
  deleteAdmissionBenchmark,
  deleteAdmissionBlock,
  deleteAdmissionPeriod,
  getAdmissionApplicationById,
  getAdmissionApplications,
  getAdmissionBenchmarks,
  getAdmissionBlocks,
  getAdmissionFormOptions,
  getAdmissionPeriodById,
  getAdmissionPeriods,
  getDynamicByPath,
  getDynamicListByPath,
  processAdmissionOnboarding,
  reviewAdmissionApplication,
  reviewAdmissionApplicationsBulk,
  saveAdmissionBenchmarksBulk,
  updateAdmissionBenchmark,
  updateAdmissionBlock,
  updateAdmissionPeriod,
} from "@/lib/admin/service";
import { TablePaginationControls } from "@/components/admin/table-pagination-controls";
import { formatDateTime, toErrorMessage } from "@/components/admin/format-utils";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { loginRequest } from "@/lib/auth/service";
import type {
  AdmissionApplicationStatus,
  AdmissionPeriodStatus,
  AdmissionSelectionOption,
  AdmissionSelectionOptions,
  ApplicationListItem,
  BenchmarkListItem,
  BlockListItem,
  DynamicRow,
  PagedRows,
  PeriodListItem,
} from "@/lib/admin/types";

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

const SHOW_ADVANCED_ADMISSION_INSIGHTS = false;
const SHOW_ADMISSION_CONFIGURATION_PANELS = true;
const SHOW_ADMISSION_POST_REVIEW_ACTIONS = false;

const admissionApplicationStatusOptions: AdmissionApplicationStatus[] = [
  "PENDING",
  "APPROVED",
  "ENROLLED",
  "REJECTED",
];

const admissionReviewStatusOptions: AdmissionApplicationStatus[] = [
  "APPROVED",
  "REJECTED",
];

const admissionSortDirectionOptions = ["DESC", "ASC"] as const;
type AdmissionSortDirection = (typeof admissionSortDirectionOptions)[number];

const admissionApplicationSortByOptions = [
  { value: "", label: "Mặc định hệ thống" },
  { value: "createdAt", label: "Ngày tạo hồ sơ" },
  { value: "approvalDate", label: "Ngày duyệt" },
  { value: "totalScore", label: "Tổng điểm" },
  { value: "status", label: "Trạng thái" },
  { value: "fullName", label: "Họ tên" },
] as const;

const admissionPeriodStatusOptions: AdmissionPeriodStatus[] = [
  "UPCOMING",
  "PAUSED",
  "OPEN",
  "CLOSED",
];

const admissionApplicationStatusLabels: Record<AdmissionApplicationStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  ENROLLED: "Đã nhập học",
  REJECTED: "Từ chối",
};

const admissionPeriodStatusLabels: Record<AdmissionPeriodStatus, string> = {
  UPCOMING: "Sắp mở",
  PAUSED: "Tạm dừng",
  OPEN: "Đang mở",
  CLOSED: "Đã đóng",
};

const getAdmissionApplicationStatusBadgeClass = (status?: string): string => {
  switch (status) {
    case "APPROVED":
      return "border-[#9ccfad] bg-[#f0f9f3] text-[#1f6f3c]";
    case "ENROLLED":
      return "border-[#87c4e5] bg-[#edf7fd] text-[#185d85]";
    case "REJECTED":
      return "border-[#e4a5a5] bg-[#fff1f1] text-[#9f2f2f]";
    case "PENDING":
    default:
      return "border-[#c8d3dd] bg-[#f8fafc] text-[#4a6578]";
  }
};

const toDateTimeLocalInputValue = (value?: string): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const admissionPeriodStatusByOrdinal: Record<number, AdmissionPeriodStatus> = {
  0: "UPCOMING",
  1: "PAUSED",
  2: "OPEN",
  3: "CLOSED",
};

const normalizePeriodStatusToken = (value: string): string => {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
};

const toAdmissionPeriodStatus = (value: unknown): AdmissionPeriodStatus => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return admissionPeriodStatusByOrdinal[value] || "UPCOMING";
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (admissionPeriodStatusOptions.includes(normalized as AdmissionPeriodStatus)) {
      return normalized as AdmissionPeriodStatus;
    }

    const parsedOrdinal = Number(normalized);
    if (Number.isInteger(parsedOrdinal)) {
      return admissionPeriodStatusByOrdinal[parsedOrdinal] || "UPCOMING";
    }

    const token = normalizePeriodStatusToken(value);
    if (token === "OPEN" || token === "DANG_MO" || token === "MO") {
      return "OPEN";
    }
    if (token === "UPCOMING" || token === "SAP_MO") {
      return "UPCOMING";
    }
    if (token === "PAUSED" || token === "TAM_DUNG") {
      return "PAUSED";
    }
    if (token === "CLOSED" || token === "DA_DONG") {
      return "CLOSED";
    }
  }

  return "UPCOMING";
};

const toAdmissionApplicationStatusLabel = (value?: string): string => {
  if (!value) {
    return "-";
  }
  return (
    admissionApplicationStatusLabels[value as AdmissionApplicationStatus] ||
    value
  );
};

const toAdmissionPeriodStatusLabel = (value: unknown): string => {
  const status = toAdmissionPeriodStatus(value);
  return admissionPeriodStatusLabels[status] || "-";
};

const dateTimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const localizedDateTimePattern =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:,)?\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;

const toLocalDateTimePayload = (
  year: string,
  month: string,
  day: string,
  hours: string,
  minutes: string,
  seconds?: string,
): { value: string; timestamp: number } | null => {
  const normalizedSeconds = seconds || "00";
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = Number(hours);
  const minuteNumber = Number(minutes);
  const secondNumber = Number(normalizedSeconds);

  const parsedDate = new Date(
    yearNumber,
    monthNumber - 1,
    dayNumber,
    hourNumber,
    minuteNumber,
    secondNumber,
    0,
  );

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== yearNumber ||
    parsedDate.getMonth() + 1 !== monthNumber ||
    parsedDate.getDate() !== dayNumber ||
    parsedDate.getHours() !== hourNumber ||
    parsedDate.getMinutes() !== minuteNumber ||
    parsedDate.getSeconds() !== secondNumber
  ) {
    return null;
  }

  return {
    value: `${year}-${month}-${day}T${hours}:${minutes}:${normalizedSeconds}`,
    timestamp: parsedDate.getTime(),
  };
};

const parseDateTimeLocalValue = (
  rawValue: string,
): { value: string; timestamp: number } | null => {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return null;
  }

  const directMatch = trimmedValue.match(dateTimeLocalPattern);
  if (directMatch) {
    const [, year, month, day, hours, minutes, seconds] = directMatch;
    return toLocalDateTimePayload(year, month, day, hours, minutes, seconds);
  }

  const localizedMatch = trimmedValue.match(localizedDateTimePattern);
  if (localizedMatch) {
    const [, day, month, year, hours, minutes, seconds] = localizedMatch;
    return toLocalDateTimePayload(year, month, day, hours, minutes, seconds);
  }

  const parsed = new Date(trimmedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = String(parsed.getFullYear()).padStart(4, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");

  return {
    value: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`,
    timestamp: parsed.getTime(),
  };
};

const addMonthsToDateTimeLocalValue = (rawValue: string, months: number): string | null => {
  const parsed = parseDateTimeLocalValue(rawValue);
  if (!parsed) {
    return null;
  }

  const date = new Date(parsed.timestamp);
  const expectedDay = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== expectedDay) {
    date.setDate(0);
  }

  return toDateTimeLocalInputValue(date.toISOString());
};

type AdmissionOnboardingReadiness = {
  approvedCount: number;
  requiredMajorCount: number;
  coveredMajorCount: number;
  missingMajorNames: string[];
};

type AdmissionFlowChecklist = {
  hasStudentRole: boolean;
  hasGuardianRole: boolean;
  periodCount: number;
  activeOpenPeriodCount: number;
  blockCount: number;
  majorCount: number;
  benchmarkCount: number;
  cohortCount: number;
  administrativeClassCount: number;
  lecturerCount: number;
  readyForPublicApply: boolean;
  readyForOnboarding: boolean;
};

type AdmissionPostOnboardingVerification = {
  enrolledApplicationCount: number;
  studentAccountCount: number;
  guardianAccountCount: number;
  studentProfileCount: number;
  guardianProfileCount: number;
  hasGeneratedAccounts: boolean;
};

type AdmissionGeneratedProfileCheck = {
  username: string;
  role: string;
  accountId: number;
  displayName: string;
  checkedAt: string;
};

type AdmissionOperationalSnapshot = {
  totalApplications: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  enrolledCount: number;
  openPeriodCount: number;
  activeOpenPeriodCount: number;
  completionRate: number;
  lastUpdatedAt: string;
};

type SelectionOptionItem = {
  id: number;
  label: string;
};

const toNonEmptyText = (value: unknown): string => {
  return typeof value === "string" && value.trim() ? value.trim() : "";
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

      const explicitLabel = toNonEmptyText(item.label);

      const nameCandidate =
        toNonEmptyText(item.name) ||
        toNonEmptyText(record.periodName) ||
        toNonEmptyText(record.majorName) ||
        toNonEmptyText(record.blockName) ||
        toNonEmptyText(record.displayName) ||
        toNonEmptyText(record.title) ||
        toNonEmptyText(record.period_name) ||
        toNonEmptyText(record.major_name) ||
        toNonEmptyText(record.block_name);

      const codeCandidate =
        toNonEmptyText(item.code) ||
        toNonEmptyText(record.majorCode) ||
        toNonEmptyText(record.blockCode) ||
        toNonEmptyText(record.periodCode) ||
        toNonEmptyText(record.code) ||
        toNonEmptyText(record.major_code) ||
        toNonEmptyText(record.block_code) ||
        toNonEmptyText(record.period_code);

      const label = explicitLabel
        ? explicitLabel
        : nameCandidate && codeCandidate
          ? `${nameCandidate} - ${codeCandidate}`
          : nameCandidate || codeCandidate || `${fallbackLabel} #${id}`;

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

const toNormalizedUpperText = (value: unknown): string => {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
};

const toSafeDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const resolvePagedCount = <TItem,>(value: PagedRows<TItem>): number => {
  if (typeof value.totalElements === "number" && Number.isFinite(value.totalElements)) {
    return value.totalElements;
  }

  return value.rows.length;
};

export function AdmissionsPanel({ authorization }: { authorization?: string }) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
  const [admissionDetail, setAdmissionDetail] = useState<ApplicationListItem | null>(null);
  const [admissionReviewIdInput, setAdmissionReviewIdInput] = useState("");
  const [admissionReviewStatus, setAdmissionReviewStatus] =
    useState<AdmissionApplicationStatus>("APPROVED");
  const [admissionReviewNote, setAdmissionReviewNote] = useState("");
  const [admissionSelectedIds, setAdmissionSelectedIds] = useState<number[]>([]);
  const [admissionBulkStatus, setAdmissionBulkStatus] =
    useState<AdmissionApplicationStatus>("APPROVED");
  const [admissionBulkNote, setAdmissionBulkNote] = useState("");
  const [admissionFilterKeywordInput, setAdmissionFilterKeywordInput] = useState("");
  const [admissionFilterPeriodIdInput, setAdmissionFilterPeriodIdInput] = useState("");
  const [admissionFilterMajorIdInput, setAdmissionFilterMajorIdInput] = useState("");
  const [admissionFilterStatusInput, setAdmissionFilterStatusInput] = useState<
    AdmissionApplicationStatus | ""
  >("");
  const [admissionFilterPageInput, setAdmissionFilterPageInput] = useState("0");
  const [admissionFilterSizeInput, setAdmissionFilterSizeInput] = useState("100");
  const [admissionFilterSortByInput, setAdmissionFilterSortByInput] =
    useState<string>("");
  const [admissionFilterSortDirectionInput, setAdmissionFilterSortDirectionInput] =
    useState<AdmissionSortDirection>("DESC");
  const [admissionAutoScreenPeriodId, setAdmissionAutoScreenPeriodId] = useState("");
  const [admissionOnboardPeriodId, setAdmissionOnboardPeriodId] = useState("");
  const [admissionOnboardCohortId, setAdmissionOnboardCohortId] = useState("");
  const [admissionOnboardingReadiness, setAdmissionOnboardingReadiness] =
    useState<AdmissionOnboardingReadiness | null>(null);
  const [admissionFlowChecklist, setAdmissionFlowChecklist] =
    useState<AdmissionFlowChecklist | null>(null);
  const [admissionOperationalSnapshot, setAdmissionOperationalSnapshot] =
    useState<AdmissionOperationalSnapshot | null>(null);
  const [admissionPostOnboardingVerification, setAdmissionPostOnboardingVerification] =
    useState<AdmissionPostOnboardingVerification | null>(null);
  const [generatedProfileCheckUsername, setGeneratedProfileCheckUsername] = useState("");
  const [generatedProfileCheckPassword, setGeneratedProfileCheckPassword] = useState("");
  const [generatedProfileCheckResult, setGeneratedProfileCheckResult] =
    useState<AdmissionGeneratedProfileCheck | null>(null);
  const [periodDetailIdInput, setPeriodDetailIdInput] = useState("");
  const [periodDetail, setPeriodDetail] = useState<PeriodListItem | null>(null);
  const [periodActionIdInput, setPeriodActionIdInput] = useState("");
  const [periodNameInput, setPeriodNameInput] = useState("");
  const [periodStartInput, setPeriodStartInput] = useState("");
  const [periodEndInput, setPeriodEndInput] = useState("");
  const [periodStatusInput, setPeriodStatusInput] =
    useState<AdmissionPeriodStatus>("OPEN");
  const [blockActionIdInput, setBlockActionIdInput] = useState("");
  const [blockNameInput, setBlockNameInput] = useState("");
  const [blockDescriptionInput, setBlockDescriptionInput] = useState("");
  const [benchmarkActionIdInput, setBenchmarkActionIdInput] = useState("");
  const [benchmarkMajorIdInput, setBenchmarkMajorIdInput] = useState("");
  const [benchmarkBlockIdInput, setBenchmarkBlockIdInput] = useState("");
  const [benchmarkPeriodIdInput, setBenchmarkPeriodIdInput] = useState("");
  const [benchmarkScoreInput, setBenchmarkScoreInput] = useState("");
  const [benchmarkBulkPeriodIdInput, setBenchmarkBulkPeriodIdInput] = useState("");
  const [benchmarkBulkRows, setBenchmarkBulkRows] = useState<
    Array<{ majorId: string; blockId: string; score: string }>
  >([{ majorId: "", blockId: "", score: "" }]);

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
          (item.fullName && item.fullName.trim()) || item.email || item.phone || `Hồ sơ #${id}`;

        return {
          id,
          label,
        };
      })
      .filter((item): item is SelectionOptionItem => item !== null);
  }, [admissionApplications.rows]);
  const admissionBlockCrudOptions = useMemo(() => {
    return admissionBlocks
      .map((item) => {
        const id = Number(item.id || 0);
        if (!Number.isInteger(id) || id <= 0) {
          return null;
        }

        const blockName = typeof item.blockName === "string" ? item.blockName.trim() : "";
        return {
          id,
          label: blockName || `Khối #${id}`,
        };
      })
      .filter((item): item is SelectionOptionItem => item !== null);
  }, [admissionBlocks]);
  const admissionBenchmarkOptions = useMemo(() => {
    return admissionBenchmarks.rows
      .map((item) => {
        const id = Number(item.id || 0);
        if (!Number.isInteger(id) || id <= 0) {
          return null;
        }

        const labelParts = [
          item.majorName ? String(item.majorName).trim() : "",
          item.blockName ? String(item.blockName).trim() : "",
          item.periodName ? String(item.periodName).trim() : "",
        ].filter(Boolean);

        const scoreLabel = typeof item.score === "number" ? `- ${item.score}` : "";

        return {
          id,
          label:
            (labelParts.length > 0 ? `${labelParts.join(" / ")} ${scoreLabel}`.trim() : "") ||
            `Benchmark #${id}`,
        };
      })
      .filter((item): item is SelectionOptionItem => item !== null);
  }, [admissionBenchmarks.rows]);
  const periodTablePagination = useTablePagination(admissionPeriods.rows);
  const blockTablePagination = useTablePagination(admissionBlocks);
  const benchmarkTablePagination = useTablePagination(admissionBenchmarks.rows);
  const visibleAdmissionIds = useMemo(() => {
    return admissionApplicationOptions.map((item) => item.id);
  }, [admissionApplicationOptions]);
  const areAllVisibleAdmissionsSelected = useMemo(() => {
    if (visibleAdmissionIds.length === 0) {
      return false;
    }
    return visibleAdmissionIds.every((id) => admissionSelectedIds.includes(id));
  }, [admissionSelectedIds, visibleAdmissionIds]);
  const selectedAdmissionRows = useMemo(() => {
    if (admissionSelectedIds.length === 0) {
      return [];
    }

    const selectedSet = new Set(admissionSelectedIds);
    return admissionApplications.rows.filter((row) => selectedSet.has(Number(row.id || 0)));
  }, [admissionApplications.rows, admissionSelectedIds]);
  const singleSelectedAdmission = useMemo(() => {
    return selectedAdmissionRows.length === 1 ? selectedAdmissionRows[0] : null;
  }, [selectedAdmissionRows]);
  const admissionStatusSummary = useMemo(() => {
    const summary: Record<AdmissionApplicationStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      ENROLLED: 0,
    };

    admissionApplications.rows.forEach((row) => {
      const status = toNormalizedUpperText(row.status) as AdmissionApplicationStatus;
      if (status in summary) {
        summary[status] += 1;
      }
    });

    return summary;
  }, [admissionApplications.rows]);
  const admissionOperationalRecommendations = useMemo(() => {
    if (!admissionOperationalSnapshot) {
      return [];
    }

    const recommendations: string[] = [];
    if (admissionOperationalSnapshot.activeOpenPeriodCount === 0) {
      recommendations.push(
        "Chưa có kỳ tuyển sinh đang mở trong khung giờ hiện tại. Người học chưa thể nộp hồ sơ mới.",
      );
    }
    if (admissionOperationalSnapshot.pendingCount > 0) {
      recommendations.push(
        `Có ${admissionOperationalSnapshot.pendingCount} hồ sơ chờ duyệt, nên duyệt tay hoặc duyệt tự động theo ngưỡng điểm.`,
      );
    }
    if (admissionOperationalSnapshot.approvedCount > 0) {
      recommendations.push(
        `Có ${admissionOperationalSnapshot.approvedCount} hồ sơ đã duyệt, nên kiểm tra điều kiện lớp rồi chốt nhập học.`,
      );
    }
    if (
      admissionOperationalSnapshot.totalApplications > 0 &&
      admissionOperationalSnapshot.enrolledCount === 0 &&
      admissionOperationalSnapshot.approvedCount === 0 &&
      admissionOperationalSnapshot.pendingCount === 0
    ) {
      recommendations.push(
        "Không còn hồ sơ chờ duyệt hoặc đã duyệt, nhưng chưa có hồ sơ nhập học. Cần rà lại trạng thái từ chối hoặc ngưỡng điểm.",
      );
    }
    if (admissionOperationalSnapshot.enrolledCount > 0) {
      recommendations.push(
        "Đã có hồ sơ nhập học. Nên chạy hậu kiểm để đối soát tài khoản và hồ sơ đã tạo.",
      );
    }

    return recommendations;
  }, [admissionOperationalSnapshot]);

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

  const parsePositiveInteger = (rawValue: string, fieldLabel: string): number | null => {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setErrorMessage(`${fieldLabel} không hop le.`);
      return null;
    }

    return parsed;
  };

  const parseDateTimeLocalForPayload = (
    value: string,
    fieldLabel: string,
  ): { value: string; timestamp: number } | null => {
    if (!value.trim()) {
      setErrorMessage(`${fieldLabel} không được để trống.`);
      return null;
    }

    const normalized = parseDateTimeLocalValue(value);
    if (!normalized) {
      setErrorMessage(`${fieldLabel} không hợp lệ.`);
      return null;
    }

    return normalized;
  };

  const handlePeriodStartInputChange = (nextValue: string) => {
    setPeriodStartInput(nextValue);

    const startDateTime = parseDateTimeLocalValue(nextValue);
    if (!startDateTime) {
      return;
    }

    const suggestedEndInput = addMonthsToDateTimeLocalValue(nextValue, 6);
    if (!suggestedEndInput) {
      return;
    }

    const currentEndDateTime = parseDateTimeLocalValue(periodEndInput);
    if (
      !periodEndInput.trim() ||
      !currentEndDateTime ||
      currentEndDateTime.timestamp <= startDateTime.timestamp
    ) {
      setPeriodEndInput(suggestedEndInput);
    }
  };

  const parseOptionalPositiveInteger = (rawValue: string): number | undefined => {
    if (!rawValue.trim()) {
      return undefined;
    }

    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  };

  const parseOptionalNonNegativeInteger = (rawValue: string): number | undefined => {
    if (!rawValue.trim()) {
      return undefined;
    }

    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return undefined;
    }

    return parsed;
  };

  const resolveSingleAdmissionId = (rawValue: string): number | null => {
    if (rawValue.trim()) {
      return parsePositiveInteger(rawValue, "Mã hồ sơ");
    }

    if (admissionSelectedIds.length === 1) {
      return admissionSelectedIds[0];
    }

    if (admissionSelectedIds.length > 1) {
      setErrorMessage("Bạn đang chọn nhiều hồ sơ, vui lòng chọn 1 hồ sơ cụ thể.");
      return null;
    }

    setErrorMessage("Vui lòng chọn một hồ sơ từ danh sách.");
    return null;
  };

  const formatMissingMajorNames = (missingMajorNames: string[]): string => {
    const cleaned = missingMajorNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (cleaned.length === 0) {
      return "";
    }

    if (cleaned.length <= 3) {
      return cleaned.join(", ");
    }

    return `${cleaned.slice(0, 3).join(", ")} và ${cleaned.length - 3} ngành khác`;
  };

  const getAdmissionOnboardingReadiness = async (
    token: string,
    periodId: number,
    cohortId: number,
  ): Promise<AdmissionOnboardingReadiness> => {
    const [approvedApplications, administrativeClasses] = await Promise.all([
      getAdmissionApplications(token, {
        periodId,
        status: "APPROVED",
        page: 0,
        size: 500,
      }),
      getDynamicListByPath("/api/v1/administrative-classes", token, {
        page: 0,
        size: 500,
      }),
    ]);

    const requiredMajors = new Map<number, string>();
    approvedApplications.rows.forEach((row) => {
      const majorId = Number(row.majorId || 0);
      if (!Number.isInteger(majorId) || majorId <= 0) {
        return;
      }

      const majorName =
        (typeof row.majorName === "string" && row.majorName.trim()) ||
        `Ngành #${majorId}`;
      requiredMajors.set(majorId, majorName);
    });

    const coveredMajorIds = new Set<number>();
    administrativeClasses.rows.forEach((row) => {
      const classCohortId = Number(row.cohortId || 0);
      const classMajorId = Number(row.majorId || 0);
      if (
        Number.isInteger(classCohortId) &&
        Number.isInteger(classMajorId) &&
        classCohortId === cohortId &&
        classMajorId > 0
      ) {
        coveredMajorIds.add(classMajorId);
      }
    });

    const missingMajorNames = [...requiredMajors.entries()]
      .filter(([majorId]) => !coveredMajorIds.has(majorId))
      .map(([, majorName]) => majorName);

    return {
      approvedCount: approvedApplications.rows.length,
      requiredMajorCount: requiredMajors.size,
      coveredMajorCount: requiredMajors.size - missingMajorNames.length,
      missingMajorNames,
    };
  };

  const getAdmissionFlowChecklist = async (
    token: string,
  ): Promise<AdmissionFlowChecklist> => {
    const now = new Date();
    const [roleRows, periodRows, benchmarkRows, formOptions, cohortRows, classRows, lecturerRows] =
      await Promise.all([
        getDynamicListByPath("/api/v1/roles", token),
        getDynamicListByPath("/api/v1/admin/admissions/config/periods", token, {
          page: 0,
          size: 200,
        }),
        getDynamicListByPath("/api/v1/admin/admissions/config/benchmarks", token, {
          page: 0,
          size: 500,
        }),
        getAdmissionFormOptions(token),
        getDynamicListByPath("/api/v1/cohorts", token, {
          page: 0,
          size: 200,
        }),
        getDynamicListByPath("/api/v1/administrative-classes", token, {
          page: 0,
          size: 500,
        }),
        getDynamicListByPath("/api/v1/lecturers", token, {
          page: 0,
          size: 200,
        }),
      ]);

    const roleNames = new Set(
      roleRows.rows
        .map((row) => toNormalizedUpperText(row.roleName ?? row.role ?? row.name))
        .filter((name) => name.length > 0),
    );

    const activeOpenPeriodCount = periodRows.rows.filter((row) => {
      const startTime = toSafeDate(row.startTime ?? row.startDate);
      const endTime = toSafeDate(row.endTime ?? row.endDate);

      if (toAdmissionPeriodStatus(row.status) !== "OPEN" || !startTime || !endTime) {
        return false;
      }

      return now >= startTime && now <= endTime;
    }).length;

    const hasStudentRole = roleNames.has("STUDENT");
    const hasGuardianRole = roleNames.has("GUARDIAN");
    const periodCount = resolvePagedCount(periodRows);
    const blockCount = formOptions.blocks.length;
    const majorCount = formOptions.majors.length;
    const benchmarkCount = resolvePagedCount(benchmarkRows);
    const cohortCount = resolvePagedCount(cohortRows);
    const administrativeClassCount = resolvePagedCount(classRows);
    const lecturerCount = resolvePagedCount(lecturerRows);

    return {
      hasStudentRole,
      hasGuardianRole,
      periodCount,
      activeOpenPeriodCount,
      blockCount,
      majorCount,
      benchmarkCount,
      cohortCount,
      administrativeClassCount,
      lecturerCount,
      readyForPublicApply:
        activeOpenPeriodCount > 0 &&
        majorCount > 0 &&
        blockCount > 0 &&
        benchmarkCount > 0,
      readyForOnboarding:
        hasStudentRole &&
        hasGuardianRole &&
        cohortCount > 0 &&
        lecturerCount > 0 &&
        administrativeClassCount > 0,
    };
  };

  const getAdmissionOperationalSnapshot = async (
    token: string,
  ): Promise<AdmissionOperationalSnapshot> => {
    const now = new Date();
    const [
      totalRows,
      pendingRows,
      approvedRows,
      rejectedRows,
      enrolledRows,
      periodRows,
    ] = await Promise.all([
      getAdmissionApplications(token, { page: 0, size: 1 }),
      getAdmissionApplications(token, { status: "PENDING", page: 0, size: 1 }),
      getAdmissionApplications(token, { status: "APPROVED", page: 0, size: 1 }),
      getAdmissionApplications(token, { status: "REJECTED", page: 0, size: 1 }),
      getAdmissionApplications(token, { status: "ENROLLED", page: 0, size: 1 }),
      getDynamicListByPath("/api/v1/admin/admissions/config/periods", token, {
        page: 0,
        size: 200,
      }),
    ]);

    const openPeriods = periodRows.rows.filter((row) => {
      return toAdmissionPeriodStatus(row.status) === "OPEN";
    });

    const activeOpenPeriodCount = openPeriods.filter((row) => {
      const startTime = toSafeDate(row.startTime ?? row.startDate);
      const endTime = toSafeDate(row.endTime ?? row.endDate);

      if (!startTime || !endTime) {
        return false;
      }

      return now >= startTime && now <= endTime;
    }).length;

    const totalApplications = resolvePagedCount(totalRows);
    const enrolledCount = resolvePagedCount(enrolledRows);
    const completionRate =
      totalApplications > 0 ? Math.round((enrolledCount / totalApplications) * 100) : 0;

    return {
      totalApplications,
      pendingCount: resolvePagedCount(pendingRows),
      approvedCount: resolvePagedCount(approvedRows),
      rejectedCount: resolvePagedCount(rejectedRows),
      enrolledCount,
      openPeriodCount: openPeriods.length,
      activeOpenPeriodCount,
      completionRate,
      lastUpdatedAt: new Date().toISOString(),
    };
  };

  const getAdmissionPostOnboardingVerification = async (
    token: string,
    periodId?: number,
  ): Promise<AdmissionPostOnboardingVerification> => {
    const [studentAccounts, guardianAccounts, studentProfiles, guardianProfiles, enrolledRows] =
      await Promise.all([
        getDynamicListByPath("/api/v1/accounts", token, {
          prefix: "sv_",
          page: 0,
          size: 200,
        }),
        getDynamicListByPath("/api/v1/accounts", token, {
          prefix: "ph_",
          page: 0,
          size: 200,
        }),
        getDynamicListByPath("/api/v1/students", token, {
          page: 0,
          size: 200,
        }),
        getDynamicListByPath("/api/v1/guardians", token, {
          page: 0,
          size: 200,
        }),
        getAdmissionApplications(token, {
          periodId,
          status: "ENROLLED",
          page: 0,
          size: 500,
        }),
      ]);

    const studentAccountCount = resolvePagedCount(studentAccounts);
    const guardianAccountCount = resolvePagedCount(guardianAccounts);

    return {
      enrolledApplicationCount: resolvePagedCount(enrolledRows),
      studentAccountCount,
      guardianAccountCount,
      studentProfileCount: resolvePagedCount(studentProfiles),
      guardianProfileCount: resolvePagedCount(guardianProfiles),
      hasGeneratedAccounts: studentAccountCount > 0 && guardianAccountCount > 0,
    };
  };

  const getAdmissionChecklistMissingItems = (
    checklist: AdmissionFlowChecklist,
  ): string[] => {
    const missingItems: string[] = [];
    if (!checklist.hasStudentRole) {
      missingItems.push("Thiếu role STUDENT");
    }
    if (!checklist.hasGuardianRole) {
      missingItems.push("Thiếu role GUARDIAN");
    }
    if (checklist.periodCount === 0) {
      missingItems.push("Chưa có đợt tuyển sinh");
    }
    if (checklist.activeOpenPeriodCount === 0) {
      missingItems.push("Chưa có period OPEN trong khung thời gian hiện tại");
    }
    if (checklist.blockCount === 0) {
      missingItems.push("Chưa có khối xét tuyển");
    }
    if (checklist.majorCount === 0) {
      missingItems.push("Chưa có ngành đào tạo");
    }
    if (checklist.benchmarkCount === 0) {
      missingItems.push("Chưa có benchmark");
    }
    if (checklist.cohortCount === 0) {
      missingItems.push("Chưa có niên khóa");
    }
    if (checklist.lecturerCount === 0) {
      missingItems.push("Chưa có giảng viên");
    }
    if (checklist.administrativeClassCount === 0) {
      missingItems.push("Chưa có lớp hành chính");
    }
    return missingItems;
  };

  const handleSelectPeriodForEdit = (periodIdValue: string) => {
    setPeriodActionIdInput(periodIdValue);
    if (!periodIdValue) {
      setPeriodNameInput("");
      setPeriodStartInput("");
      setPeriodEndInput("");
      setPeriodStatusInput("OPEN");
      return;
    }

    const periodId = Number(periodIdValue);
    if (!Number.isInteger(periodId) || periodId <= 0) {
      return;
    }

    const selectedPeriod = admissionPeriods.rows.find((item) => item.id === periodId);
    if (!selectedPeriod) {
      return;
    }

    setPeriodNameInput(selectedPeriod.periodName || "");
    setPeriodStartInput(toDateTimeLocalInputValue(selectedPeriod.startTime));
    setPeriodEndInput(toDateTimeLocalInputValue(selectedPeriod.endTime));
    setPeriodStatusInput(toAdmissionPeriodStatus(selectedPeriod.status));
  };

  const handleSelectBlockForEdit = (blockIdValue: string) => {
    setBlockActionIdInput(blockIdValue);
    if (!blockIdValue) {
      setBlockNameInput("");
      setBlockDescriptionInput("");
      return;
    }

    const blockId = Number(blockIdValue);
    if (!Number.isInteger(blockId) || blockId <= 0) {
      return;
    }

    const selectedBlock = admissionBlocks.find((item) => item.id === blockId);
    if (!selectedBlock) {
      return;
    }

    setBlockNameInput(selectedBlock.blockName || "");
    setBlockDescriptionInput(selectedBlock.description || "");
  };

  const handleSelectBenchmarkForEdit = (benchmarkIdValue: string) => {
    setBenchmarkActionIdInput(benchmarkIdValue);
    if (!benchmarkIdValue) {
      setBenchmarkMajorIdInput("");
      setBenchmarkBlockIdInput("");
      setBenchmarkPeriodIdInput("");
      setBenchmarkScoreInput("");
      return;
    }

    const benchmarkId = Number(benchmarkIdValue);
    if (!Number.isInteger(benchmarkId) || benchmarkId <= 0) {
      return;
    }

    const selectedBenchmark = admissionBenchmarks.rows.find((item) => item.id === benchmarkId);
    if (!selectedBenchmark) {
      return;
    }

    const benchmarkMajorId = Number(selectedBenchmark.majorId || 0);
    const benchmarkBlockId = Number(selectedBenchmark.blockId || 0);
    const benchmarkPeriodId = Number(selectedBenchmark.periodId || 0);

    const nextMajorOption =
      benchmarkMajorId > 0
        ? admissionMajorOptions.find((option) => option.id === benchmarkMajorId)
        : admissionMajorOptions.find(
            (option) =>
              option.label === selectedBenchmark.majorName ||
              (selectedBenchmark.majorName
                ? option.label.toLowerCase().includes(String(selectedBenchmark.majorName).toLowerCase())
                : false),
          );
    const nextBlockOption =
      benchmarkBlockId > 0
        ? admissionBlockOptions.find((option) => option.id === benchmarkBlockId)
        : admissionBlockOptions.find(
            (option) =>
              option.label === selectedBenchmark.blockName ||
              (selectedBenchmark.blockName
                ? option.label.toLowerCase().includes(String(selectedBenchmark.blockName).toLowerCase())
                : false),
          );
    const nextPeriodOption =
      benchmarkPeriodId > 0
        ? admissionPeriodOptions.find((option) => option.id === benchmarkPeriodId)
        : admissionPeriodOptions.find(
            (option) =>
              option.label === selectedBenchmark.periodName ||
              (selectedBenchmark.periodName
                ? option.label.toLowerCase().includes(String(selectedBenchmark.periodName).toLowerCase())
                : false),
          );

    if (nextMajorOption) {
      setBenchmarkMajorIdInput(String(nextMajorOption.id));
    }
    if (nextBlockOption) {
      setBenchmarkBlockIdInput(String(nextBlockOption.id));
    }
    if (nextPeriodOption) {
      setBenchmarkPeriodIdInput(String(nextPeriodOption.id));
    }
    if (typeof selectedBenchmark.score === "number") {
      setBenchmarkScoreInput(String(selectedBenchmark.score));
    }
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
    const defaultMajorId = admissionMajorOptions[0] ? String(admissionMajorOptions[0].id) : "";
    const defaultBlockId = admissionBlockOptions[0] ? String(admissionBlockOptions[0].id) : "";

    setBenchmarkBulkRows((prev) => [
      ...prev,
      { majorId: defaultMajorId, blockId: defaultBlockId, score: "" },
    ]);
  };

  const removeBenchmarkBulkRow = (index: number) => {
    setBenchmarkBulkRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
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

  const loadAdmissionsData = async (
    token: string,
    filterOverrides?: {
      keyword: string;
      periodId: string;
      majorId: string;
      status: AdmissionApplicationStatus | "";
      page: string;
      size: string;
      sortBy: string;
      sortDirection: AdmissionSortDirection;
    },
  ) => {
    const keywordInput = (filterOverrides?.keyword ?? admissionFilterKeywordInput).trim();
    const periodIdInput = filterOverrides?.periodId ?? admissionFilterPeriodIdInput;
    const majorIdInput = filterOverrides?.majorId ?? admissionFilterMajorIdInput;
    const statusInput = filterOverrides?.status ?? admissionFilterStatusInput;
    const pageInput = filterOverrides?.page ?? admissionFilterPageInput;
    const sizeInput = filterOverrides?.size ?? admissionFilterSizeInput;
    const sortByInput = filterOverrides?.sortBy ?? admissionFilterSortByInput;
    const sortDirectionInput =
      filterOverrides?.sortDirection ?? admissionFilterSortDirectionInput;
    const [periodRows, blockRows, benchmarkRows, applicationRows] = await Promise.all([
      getAdmissionPeriods(token),
      getAdmissionBlocks(token),
      getAdmissionBenchmarks(token),
      getAdmissionApplications(token, {
        keyword: keywordInput || undefined,
        periodId: parseOptionalPositiveInteger(periodIdInput),
        majorId: parseOptionalPositiveInteger(majorIdInput),
        status: statusInput || undefined,
        page: parseOptionalNonNegativeInteger(pageInput) ?? 0,
        size: parseOptionalPositiveInteger(sizeInput) ?? 100,
        sortBy: sortByInput || undefined,
        sortDirection: sortByInput ? sortDirectionInput : undefined,
      }),
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
    setAdmissionOnboardingReadiness(null);
    setAdmissionFlowChecklist(null);
    setAdmissionPostOnboardingVerification(null);
    setGeneratedProfileCheckResult(null);
  };

  const handleLoadAdmissionFormOptions = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
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
      setAdmissionOnboardingReadiness(null);
      setAdmissionFlowChecklist(null);
      setGeneratedProfileCheckResult(null);
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

      setSuccessMessage(
        "Đã cập nhật danh mục tuyển sinh.",
      );
    });
  };

  const refreshAllAdmissionData = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      await loadAdmissionsData(authorization);
      await handleLoadAdmissionFormOptions();
      setSuccessMessage("Đã làm mới toàn bộ dữ liệu tuyển sinh.");
    });
  };

  const handleCheckAdmissionFlowChecklist = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const checklist = await getAdmissionFlowChecklist(authorization);
      setAdmissionFlowChecklist(checklist);

      const missingItems = getAdmissionChecklistMissingItems(checklist);
      if (missingItems.length > 0) {
        setErrorMessage(`Checklist dữ liệu nền chưa đạt: ${missingItems.join("; ")}.`);
        return;
      }

      setSuccessMessage(
        "Checklist dữ liệu nền đạt yêu cầu: có thể mở public apply và sẵn sàng onboarding.",
      );
    });
  };

  const handleVerifyPostOnboarding = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = parseOptionalPositiveInteger(admissionOnboardPeriodId);

    await runAction(async () => {
      const verification = await getAdmissionPostOnboardingVerification(
        authorization,
        periodId,
      );
      setAdmissionPostOnboardingVerification(verification);

      const warnings: string[] = [];
      if (!verification.hasGeneratedAccounts) {
        warnings.push("chưa thấy account sv_/ph_ được sinh");
      }
      if (
        verification.enrolledApplicationCount > 0 &&
        verification.studentProfileCount < verification.enrolledApplicationCount
      ) {
        warnings.push(
          `hồ sơ students (${verification.studentProfileCount}) thấp hơn hồ sơ ENROLLED (${verification.enrolledApplicationCount})`,
        );
      }
      if (
        verification.enrolledApplicationCount > 0 &&
        verification.guardianProfileCount < verification.enrolledApplicationCount
      ) {
        warnings.push(
          `hồ sơ guardians (${verification.guardianProfileCount}) thấp hơn hồ sơ ENROLLED (${verification.enrolledApplicationCount})`,
        );
      }

      if (warnings.length > 0) {
        setErrorMessage(`Hậu kiểm sau onboarding phát hiện cảnh báo: ${warnings.join("; ")}.`);
        return;
      }

      setSuccessMessage(
        "Hậu kiểm sau onboarding hoàn tất: số lượng account/hồ sơ đang khớp kỳ vọng.",
      );
    });
  };

  const handleVerifyGeneratedAccountProfile = async () => {
    const username = generatedProfileCheckUsername.trim();
    const password = generatedProfileCheckPassword.trim();

    if (!username || !password) {
      setErrorMessage("Vui lòng nhập username và password để kiểm tra profile account mới.");
      return;
    }

    await runAction(async () => {
      const login = await loginRequest({
        username,
        password,
      });
      const profile = await getDynamicByPath("/api/v1/profile/me", login.token);
      const displayName =
        (typeof profile.fullName === "string" && profile.fullName.trim()) ||
        (typeof profile.studentName === "string" && profile.studentName.trim()) ||
        (typeof profile.guardianName === "string" && profile.guardianName.trim()) ||
        login.username;

      setGeneratedProfileCheckResult({
        username: login.username,
        role: login.role,
        accountId: login.accountId,
        displayName,
        checkedAt: new Date().toISOString(),
      });
      setSuccessMessage(
        `Đăng nhập và kiểm tra hồ sơ tài khoản thành công: ${login.username} (${login.role}).`,
      );
    });
  };

  const handleApplyAdmissionFilters = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const trimmedPage = admissionFilterPageInput.trim();
    if (trimmedPage && parseOptionalNonNegativeInteger(trimmedPage) === undefined) {
      setErrorMessage("Bộ lọc trang phải là số nguyên >= 0.");
      return;
    }

    const trimmedSize = admissionFilterSizeInput.trim();
    if (trimmedSize && parseOptionalPositiveInteger(trimmedSize) === undefined) {
      setErrorMessage("Bộ lọc số lượng phải là số nguyên > 0.");
      return;
    }

    if (!admissionApplicationSortByOptions.some((option) => option.value === admissionFilterSortByInput)) {
      setErrorMessage("Tiêu chí sắp xếp không hợp lệ cho bộ lọc hồ sơ.");
      return;
    }

    if (
      admissionFilterSortByInput &&
      !admissionSortDirectionOptions.includes(admissionFilterSortDirectionInput)
    ) {
      setErrorMessage("Thứ tự sắp xếp không hợp lệ cho bộ lọc hồ sơ.");
      return;
    }

    await runAction(async () => {
      await loadAdmissionsData(authorization);
      setSuccessMessage("Đã áp dụng bộ lọc hồ sơ tuyển sinh.");
    });
  };

  const handleResetAdmissionFilters = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const resetFilters = {
      keyword: "",
      periodId: "",
      majorId: "",
      status: "" as AdmissionApplicationStatus | "",
      page: "0",
      size: "100",
      sortBy: "",
      sortDirection: "DESC" as AdmissionSortDirection,
    };
    setAdmissionFilterKeywordInput("");
    setAdmissionFilterPeriodIdInput("");
    setAdmissionFilterMajorIdInput("");
    setAdmissionFilterStatusInput("");
    setAdmissionFilterPageInput("0");
    setAdmissionFilterSizeInput("100");
    setAdmissionFilterSortByInput("");
    setAdmissionFilterSortDirectionInput("DESC");

    await runAction(async () => {
      await loadAdmissionsData(authorization, resetFilters);
      setSuccessMessage("Đã xóa bộ lọc hồ sơ tuyển sinh.");
    });
  };

  const handleQuickAdmissionStatusFilter = async (
    status: AdmissionApplicationStatus | "",
  ) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    setAdmissionFilterStatusInput(status);
    setAdmissionFilterPageInput("0");

    await runAction(async () => {
      await loadAdmissionsData(authorization, {
        keyword: admissionFilterKeywordInput,
        periodId: admissionFilterPeriodIdInput,
        majorId: admissionFilterMajorIdInput,
        status,
        page: "0",
        size: admissionFilterSizeInput,
        sortBy: admissionFilterSortByInput,
        sortDirection: admissionFilterSortDirectionInput,
      });
      setSuccessMessage(
        status
          ? `Đã lọc nhanh trạng thái ${toAdmissionApplicationStatusLabel(status)}.`
          : "Đã bỏ lọc trạng thái.",
      );
    });
  };

  const setActiveApplicationForActions = (applicationId: number) => {
    const selectedFromTable =
      admissionApplications.rows.find((item) => Number(item.id || 0) === applicationId) || null;
    setAdmissionDetailIdInput(String(applicationId));
    setAdmissionReviewIdInput(String(applicationId));
    setAdmissionSelectedIds([applicationId]);
    setAdmissionDetail(selectedFromTable);
  };

  useEffect(() => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    void (async () => {
      await runAction(async () => {
        const [
          periodRows,
          blockRows,
          benchmarkRows,
          applicationRows,
          options,
          cohorts,
          operationalSnapshot,
        ] =
          await Promise.all([
            getAdmissionPeriods(authorization),
            getAdmissionBlocks(authorization),
            getAdmissionBenchmarks(authorization),
            getAdmissionApplications(authorization, {
              page: 0,
              size: 100,
            }),
            getAdmissionFormOptions(authorization),
            getDynamicListByPath("/api/v1/cohorts", authorization),
            SHOW_ADVANCED_ADMISSION_INSIGHTS
              ? getAdmissionOperationalSnapshot(authorization)
              : Promise.resolve(null),
          ]);

        setAdmissionPeriods(periodRows);
        setAdmissionBlocks(blockRows);
        setAdmissionBenchmarks(benchmarkRows);
        setAdmissionApplications(applicationRows);
        setAdmissionOperationalSnapshot(operationalSnapshot);

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

        const [majorOptions, blockOptions, periodOptions] = [
          toSelectionOptionItems(options.majors, "Ngành"),
          toSelectionOptionItems(options.blocks, "Khối"),
          toSelectionOptionItems(options.periods, "Kỳ tuyển sinh"),
        ];
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

        setAdmissionFormOptions(options);
        setAdmissionCohortOptions(cohortOptions);
        setAdmissionOnboardingReadiness(null);
        setAdmissionFlowChecklist(null);
        setAdmissionPostOnboardingVerification(null);
        setGeneratedProfileCheckResult(null);
        setPeriodDetailIdInput((prev) => prev || firstPeriodId);
        setPeriodDetail(null);
      });
    })();
  }, [authorization]);

  const handleLoadAdmissionDetail = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const preferredSelectedId =
      admissionSelectedIds.length === 1 ? admissionSelectedIds[0] : null;
    const applicationId = preferredSelectedId ?? resolveSingleAdmissionId(admissionDetailIdInput);
    if (!applicationId) {
      return;
    }

    await runAction(async () => {
      const detail = await getAdmissionApplicationById(applicationId, authorization);
      setAdmissionDetail(detail);
      setSuccessMessage(`Đã tải chi tiết hồ sơ #${applicationId}.`);
    });
  };

  const handleReviewSingleAdmission = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const preferredSelectedId =
      admissionSelectedIds.length === 1 ? admissionSelectedIds[0] : null;
    const applicationId = preferredSelectedId ?? resolveSingleAdmissionId(admissionReviewIdInput);
    if (!applicationId) {
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
      setSuccessMessage(
        `Đã cập nhật hồ sơ #${applicationId} sang trạng thái ${toAdmissionApplicationStatusLabel(admissionReviewStatus)}.`,
      );
    });
  };

  const handleQuickReviewAdmission = async (
    applicationId: number,
    status: Extract<AdmissionApplicationStatus, "APPROVED" | "REJECTED">,
  ) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      await reviewAdmissionApplication(
        applicationId,
        {
          status,
          note: undefined,
        },
        authorization,
      );
      await loadAdmissionsData(authorization);
      setAdmissionSelectedIds((prev) => prev.filter((id) => id !== applicationId));
      setSuccessMessage(
        `Đã cập nhật hồ sơ #${applicationId} sang trạng thái ${toAdmissionApplicationStatusLabel(status)}.`,
      );
    });
  };

  const handleBulkReviewAdmissions = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const applicationIds = admissionSelectedIds;
    if (applicationIds.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất một hồ sơ trong bảng ứng viên.");
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
      setSuccessMessage(
        `Đã cập nhật ${applicationIds.length} hồ sơ sang trạng thái ${toAdmissionApplicationStatusLabel(admissionBulkStatus)}.`,
      );
    });
  };

  const handleAutoScreenAdmissions = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = parsePositiveInteger(admissionAutoScreenPeriodId, "Mã kỳ tuyển sinh");
    if (!periodId) {
      return;
    }

    await runAction(async () => {
      await autoScreenAdmissionApplications(periodId, authorization);
      await loadAdmissionsData(authorization);
      setSuccessMessage(
        `Đã chạy duyệt tự động cho kỳ #${periodId}. Các hồ sơ đủ điều kiện đã được cập nhật trạng thái.`,
      );
    });
  };

  const handleCheckOnboardingReadiness = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = parsePositiveInteger(admissionOnboardPeriodId, "Mã kỳ tuyển sinh");
    const cohortId = parsePositiveInteger(admissionOnboardCohortId, "Mã niên khóa");
    if (!periodId || !cohortId) {
      return;
    }

    await runAction(async () => {
      const readiness = await getAdmissionOnboardingReadiness(
        authorization,
        periodId,
        cohortId,
      );
      setAdmissionOnboardingReadiness(readiness);

      if (readiness.approvedCount === 0) {
        setErrorMessage("Kỳ tuyển sinh hiện chưa có hồ sơ đã duyệt để chốt nhập học.");
        return;
      }

      if (readiness.missingMajorNames.length > 0) {
        setErrorMessage(
          `Thiếu lớp hành chính cho niên khóa đã chọn ở các ngành: ${formatMissingMajorNames(
            readiness.missingMajorNames,
          )}.`,
        );
        return;
      }

      setSuccessMessage(
        `Đủ điều kiện chốt nhập học: ${readiness.approvedCount} hồ sơ đã duyệt, ${readiness.coveredMajorCount}/${readiness.requiredMajorCount} ngành đã có lớp.`,
      );
    });
  };

  const handleAdmissionOnboarding = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = parsePositiveInteger(admissionOnboardPeriodId, "Mã kỳ tuyển sinh");
    const cohortId = parsePositiveInteger(admissionOnboardCohortId, "Mã niên khóa");
    if (!periodId || !cohortId) {
      return;
    }

    await runAction(async () => {
      const readiness = await getAdmissionOnboardingReadiness(
        authorization,
        periodId,
        cohortId,
      );
      setAdmissionOnboardingReadiness(readiness);

      if (readiness.approvedCount === 0) {
        setErrorMessage("Kỳ tuyển sinh hiện chưa có hồ sơ đã duyệt để chốt nhập học.");
        return;
      }

      if (readiness.missingMajorNames.length > 0) {
        setErrorMessage(
          `Chưa thể chốt nhập học vì thiếu lớp hành chính cho các ngành: ${formatMissingMajorNames(
            readiness.missingMajorNames,
          )}.`,
        );
        return;
      }

      await processAdmissionOnboarding(periodId, authorization).catch((error: unknown) => {
        const message = toErrorMessage(error);
        if (message.includes("500")) {
          throw new Error(
            "Hệ thống gặp lỗi khi chốt nhập học. Vui lòng kiểm tra dữ liệu lớp và thử lại.",
          );
        }
        throw error;
      });
      await loadAdmissionsData(authorization);
      setSuccessMessage(
        `Đã chốt nhập học kỳ #${periodId}, niên khóa #${cohortId}. Các hồ sơ đủ điều kiện đã được chuyển sang trạng thái đã nhập học.`,
      );
    });
  };

  const handleLoadPeriodDetail = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = parsePositiveInteger(periodDetailIdInput, "Mã kỳ tuyển sinh");
    if (!periodId) {
      return;
    }

    await runAction(async () => {
      const detail = await getAdmissionPeriodById(periodId, authorization);
      setPeriodDetail(detail);
      setPeriodActionIdInput(String(periodId));
      setPeriodNameInput(detail.periodName || "");
      setPeriodStartInput(toDateTimeLocalInputValue(detail.startTime));
      setPeriodEndInput(toDateTimeLocalInputValue(detail.endTime));
      setPeriodStatusInput(toAdmissionPeriodStatus(detail.status));
      setSuccessMessage(`Đã tải chi tiết kỳ tuyển sinh #${periodId}.`);
    });
  };

  const handleUpsertPeriod = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodName = periodNameInput.trim();
    if (!periodName) {
      setErrorMessage("Tên kỳ tuyển sinh không duoc de trong.");
      return;
    }

    const startDateTime = parseDateTimeLocalForPayload(periodStartInput, "Thời gian bắt đầu");
    if (!startDateTime) {
      return;
    }

    let nextEndInput = periodEndInput;
    if (!nextEndInput.trim()) {
      const suggestedEndInput = addMonthsToDateTimeLocalValue(periodStartInput, 6);
      if (suggestedEndInput) {
        nextEndInput = suggestedEndInput;
        setPeriodEndInput(suggestedEndInput);
      }
    }

    const endDateTime = parseDateTimeLocalForPayload(nextEndInput, "Thời gian kết thúc");
    if (!endDateTime) {
      return;
    }

    if (endDateTime.timestamp <= startDateTime.timestamp) {
      setErrorMessage("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    await runAction(async () => {
      const startTime = startDateTime.value;
      const endTime = endDateTime.value;
      const periodId = periodActionIdInput.trim()
        ? parsePositiveInteger(periodActionIdInput, "Mã kỳ tuyển sinh")
        : null;
      if (periodActionIdInput.trim() && !periodId) {
        return;
      }

      if (periodId) {
        await updateAdmissionPeriod(
          periodId,
          {
            periodName,
            startTime,
            endTime,
            status: periodStatusInput,
          },
          authorization,
        );
      } else {
        let createdPeriodId: number | null = null;
        const campaignBenchmarks = benchmarkBulkRows
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
            (row): row is { majorId: number; blockId: number; score: number } =>
              row !== null,
          );

        if (campaignBenchmarks.length === 0) {
          setErrorMessage(
            "Khi tạo kỳ tuyển sinh mới, vui lòng nhập ít nhất 1 benchmark hợp lệ trong bảng benchmark bulk.",
          );
          return;
        }

        const createdPeriod = await createAdmissionCampaign(
          {
            periodName,
            startTime,
            endTime,
            benchmarks: campaignBenchmarks,
          },
          authorization,
        );

        const createdPeriodIdCandidate = Number(createdPeriod?.id);
        if (Number.isInteger(createdPeriodIdCandidate) && createdPeriodIdCandidate > 0) {
          createdPeriodId = createdPeriodIdCandidate;
        }

        if (!createdPeriodId) {
          const latestPeriods = await getAdmissionPeriods(authorization);
          const matchedPeriod = latestPeriods.rows.find((item) => {
            if ((item.periodName || "").trim() !== periodName) {
              return false;
            }

            const matchedStartTime = toDateTimeLocalInputValue(item.startTime);
            const matchedEndTime = toDateTimeLocalInputValue(item.endTime);
            const expectedStartTime = toDateTimeLocalInputValue(startTime);
            const expectedEndTime = toDateTimeLocalInputValue(endTime);

            return matchedStartTime === expectedStartTime && matchedEndTime === expectedEndTime;
          });

          if (matchedPeriod?.id) {
            createdPeriodId = matchedPeriod.id;
          }
        }

        if (createdPeriodId) {
          await updateAdmissionPeriod(
            createdPeriodId,
            {
              periodName,
              startTime,
              endTime,
              status: periodStatusInput,
            },
            authorization,
          );
        }
      }
      await loadAdmissionsData(authorization);
      setSuccessMessage(
        periodId
          ? `Đã cập nhật kỳ #${periodId}.`
          : "Đã tạo kỳ tuyển sinh mới kèm danh sách benchmark.",
      );
    });
  };

  const handleDeletePeriod = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = parsePositiveInteger(periodActionIdInput, "Mã kỳ tuyển sinh");
    if (!periodId) {
      return;
    }

    await runAction(async () => {
      await deleteAdmissionPeriod(periodId, authorization);
      await loadAdmissionsData(authorization);
      setSuccessMessage(`Đã xóa kỳ tuyển sinh #${periodId}.`);
    });
  };

  const handleUpsertBlock = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const blockName = blockNameInput.trim();
    if (!blockName) {
      setErrorMessage("Tên khối xét tuyển không duoc de trong.");
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
      setSuccessMessage(blockId ? `Đã cập nhật khối #${blockId}.` : "Đã tạo khối xét tuyển mới.");
    });
  };

  const handleDeleteBlock = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const blockId = parsePositiveInteger(blockActionIdInput, "Mã khối");
    if (!blockId) {
      return;
    }

    await runAction(async () => {
      await deleteAdmissionBlock(blockId, authorization);
      await loadAdmissionsData(authorization);
      setSuccessMessage(`Đã xóa khối #${blockId}.`);
    });
  };

  const handleUpsertBenchmark = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const benchmarkId = parsePositiveInteger(benchmarkActionIdInput, "Mã điểm chuẩn");
    const majorId = parsePositiveInteger(benchmarkMajorIdInput, "Mã ngành");
    const blockId = parsePositiveInteger(benchmarkBlockIdInput, "Mã khối");
    const periodId = parsePositiveInteger(benchmarkPeriodIdInput, "Mã kỳ");
    if (!benchmarkId || !majorId || !blockId || !periodId) {
      return;
    }

    const score = Number(benchmarkScoreInput);
    if (!Number.isFinite(score) || score < 0 || score > 30) {
      setErrorMessage("Điểm chuẩn phải nằm trong khoảng 0 đến 30.");
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
      setSuccessMessage(`Đã cập nhật điểm chuẩn #${benchmarkId}.`);
    });
  };

  const handleDeleteBenchmark = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const benchmarkId = parsePositiveInteger(benchmarkActionIdInput, "Mã điểm chuẩn");
    if (!benchmarkId) {
      return;
    }

    await runAction(async () => {
      await deleteAdmissionBenchmark(benchmarkId, authorization);
      await loadAdmissionsData(authorization);
      setSuccessMessage(`Đã xóa điểm chuẩn #${benchmarkId}.`);
    });
  };

  const handleSaveBulkBenchmarks = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = parsePositiveInteger(benchmarkBulkPeriodIdInput, "Mã kỳ");
    if (!periodId) {
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
      setErrorMessage("Danh sách điểm chuẩn không được để trống.");
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
      setSuccessMessage(`Đã lưu ${benchmarkItems.length} dòng điểm chuẩn cho kỳ #${periodId}.`);
    });
  };

  return (
    <div className="space-y-4">
      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>Xử lý hồ sơ tuyển sinh</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void handleLoadAdmissionFormOptions();
              }}
              disabled={isWorking}
              className="rounded-[4px] border border-[#9ec3dd] bg-white px-3 py-1.5 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
            >
              Đồng bộ danh mục
            </button>
            <button
              type="button"
              onClick={() => {
                void refreshAllAdmissionData();
              }}
              disabled={isWorking}
              className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
            >
              Làm mới dữ liệu
            </button>
          </div>
        </div>
        <div className="space-y-2 px-4 pt-3 text-sm">
          <p className="rounded-[6px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-[#355970]">
            Màn hình tác nghiệp dành cho admin: lọc hồ sơ, xem chi tiết và duyệt hồ sơ.
          </p>
          {errorMessage ? (
            <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="rounded-[6px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
              {successMessage}
            </p>
          ) : null}
        </div>
        {SHOW_ADVANCED_ADMISSION_INSIGHTS ? (
          <div className="px-4 pb-0">
            <section className="space-y-3 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#1a4f75]">
                  Flow tuyển sinh toàn trình
                </h3>
                <p className="text-xs text-[#4f6d82]">
                  Kiểm tra dữ liệu bắt buộc trước tuyển sinh và hậu kiểm sau nhập học theo đúng quy trình.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleCheckAdmissionFlowChecklist();
                  }}
                  disabled={isWorking}
                  className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Kiểm tra dữ liệu nền
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleVerifyPostOnboarding();
                  }}
                  disabled={isWorking}
                  className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Hậu kiểm sau onboarding
                </button>
              </div>
            </div>

            {admissionOperationalSnapshot ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">Total hồ sơ</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.totalApplications}</p>
                    <p className="text-[11px] text-[#5a7589]">Tổng pipeline đang xử lý.</p>
                  </div>
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">PENDING</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.pendingCount}</p>
                    <p className="text-[11px] text-[#5a7589]">Khối lượng review cần xử lý ngay.</p>
                  </div>
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">APPROVED</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.approvedCount}</p>
                    <p className="text-[11px] text-[#5a7589]">Nguồn đầu vào cho onboarding.</p>
                  </div>
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">ENROLLED</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.enrolledCount}</p>
                    <p className="text-[11px] text-[#5a7589]">Số hồ sơ đã chốt nhập học.</p>
                  </div>
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">REJECTED</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.rejectedCount}</p>
                    <p className="text-[11px] text-[#5a7589]">Theo dõi chất lượng benchmark.</p>
                  </div>
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">Period OPEN</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.openPeriodCount}</p>
                    <p className="text-[11px] text-[#5a7589]">Số đợt đang cấu hình mở.</p>
                  </div>
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">OPEN active</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.activeOpenPeriodCount}</p>
                    <p className="text-[11px] text-[#5a7589]">Quyết định public form có nộp được không.</p>
                  </div>
                  <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                    <p className="font-semibold text-[#1a4f75]">Tỷ lệ ENROLLED</p>
                    <p className="text-base font-semibold">{admissionOperationalSnapshot.completionRate}%</p>
                    <p className="text-[11px] text-[#5a7589]">Mức hoàn tất toàn pipeline tuyển sinh.</p>
                  </div>
                </div>
                <p className="text-[11px] text-[#5a7589]">
                  Cập nhật lần cuối: {formatDateTime(admissionOperationalSnapshot.lastUpdatedAt)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#4f6d82]">
                Chưa có snapshot vận hành. Bấm &quot;Làm mới dữ liệu&quot; để tải góc nhìn quản trị.
              </p>
            )}

            {admissionOperationalRecommendations.length > 0 ? (
              <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                <p className="font-semibold text-[#1a4f75]">Gợi ý hành động cho admin</p>
                {admissionOperationalRecommendations.map((recommendation, index) => (
                  <p key={`admission-recommendation-${index + 1}`}>
                    {index + 1}. {recommendation}
                  </p>
                ))}
              </div>
            ) : null}

            {admissionFlowChecklist ? (
              <div className="grid gap-2 rounded-[6px] border border-[#d7e7f3] bg-white p-3 text-sm text-[#355970] sm:grid-cols-2 lg:grid-cols-5">
                <p>Role STUDENT/GUARDIAN: {admissionFlowChecklist.hasStudentRole && admissionFlowChecklist.hasGuardianRole ? "Đủ" : "Thiếu"}</p>
                <p>Period OPEN đang active: {admissionFlowChecklist.activeOpenPeriodCount}</p>
                <p>Ngành/Khối/Benchmark: {admissionFlowChecklist.majorCount}/{admissionFlowChecklist.blockCount}/{admissionFlowChecklist.benchmarkCount}</p>
                <p>Cohort/Lecturer/Class: {admissionFlowChecklist.cohortCount}/{admissionFlowChecklist.lecturerCount}/{admissionFlowChecklist.administrativeClassCount}</p>
                <p>
                  Sẵn sàng public/onboarding:{" "}
                  {admissionFlowChecklist.readyForPublicApply && admissionFlowChecklist.readyForOnboarding
                    ? "Đạt"
                    : "Chưa đạt"}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#4f6d82]">
                Chạy &quot;Kiểm tra dữ liệu nền&quot; để biết hệ thống đã đủ điều kiện mở tuyển sinh hay chưa.
              </p>
            )}

            {admissionPostOnboardingVerification ? (
              <div className="grid gap-2 rounded-[6px] border border-[#d7e7f3] bg-white p-3 text-sm text-[#355970] sm:grid-cols-2 lg:grid-cols-5">
                <p>Hồ sơ ENROLLED: {admissionPostOnboardingVerification.enrolledApplicationCount}</p>
                <p>Account `sv_`: {admissionPostOnboardingVerification.studentAccountCount}</p>
                <p>Account `ph_`: {admissionPostOnboardingVerification.guardianAccountCount}</p>
                <p>Profile students: {admissionPostOnboardingVerification.studentProfileCount}</p>
                <p>Profile guardians: {admissionPostOnboardingVerification.guardianProfileCount}</p>
              </div>
            ) : null}

            <div className="rounded-[6px] border border-[#d7e7f3] bg-white p-3">
              <p className="text-xs text-[#4f6d82]">
                Thử đăng nhập bằng tài khoản vừa tạo để xác nhận truy cập hồ sơ cá nhân (gợi ý mật khẩu mặc định là ngày sinh `YYYY-MM-DD`).
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_180px]">
                <input
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Username (ví dụ: sv_2600150)"
                  value={generatedProfileCheckUsername}
                  onChange={(event) => setGeneratedProfileCheckUsername(event.target.value)}
                />
                <input
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Password"
                  value={generatedProfileCheckPassword}
                  onChange={(event) => setGeneratedProfileCheckPassword(event.target.value)}
                  type="password"
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleVerifyGeneratedAccountProfile();
                  }}
                  disabled={isWorking}
                  className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  Kiểm tra login + profile
                </button>
              </div>
              {generatedProfileCheckResult ? (
                <div className="mt-2 rounded-[6px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-xs text-[#355970]">
                  <p>Username: {generatedProfileCheckResult.username}</p>
                  <p>Role: {generatedProfileCheckResult.role}</p>
                  <p>Account ID: {generatedProfileCheckResult.accountId}</p>
                  <p>Tên hiển thị profile: {generatedProfileCheckResult.displayName}</p>
                  <p>Thời điểm kiểm tra: {formatDateTime(generatedProfileCheckResult.checkedAt)}</p>
                </div>
              ) : null}
            </div>
            </section>
          </div>
        ) : null}
        <div className="space-y-4 px-4 py-4">
          <section className="space-y-3 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <div>
              <h3 className="text-base font-semibold text-[#1a4f75]">
                Xét duyệt hồ sơ tuyển sinh
              </h3>
              <p className="text-xs text-[#4f6d82]">
                Tập trung vào lọc danh sách, duyệt từng hồ sơ hoặc duyệt nhanh hàng loạt.
              </p>
            </div>
            <div className="grid gap-2 rounded-[6px] border border-[#d7e7f3] bg-white p-3 text-xs text-[#355970] sm:grid-cols-2 lg:grid-cols-5">
              <p>Tổng hiển thị: {admissionApplications.rows.length}</p>
              <p>Chờ duyệt: {admissionStatusSummary.PENDING}</p>
              <p>Đã duyệt: {admissionStatusSummary.APPROVED}</p>
              <p>Từ chối: {admissionStatusSummary.REJECTED}</p>
              <p>Đã nhập học: {admissionStatusSummary.ENROLLED}</p>
            </div>

            <div className="space-y-2 rounded-[6px] border border-[#d7e7f3] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f75]">
                Danh sách và bộ lọc hồ sơ
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Tìm theo họ tên, email, số điện thoại"
                  value={admissionFilterKeywordInput}
                  onChange={(event) => setAdmissionFilterKeywordInput(event.target.value)}
                />
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionFilterPeriodIdInput}
                  onChange={(event) => setAdmissionFilterPeriodIdInput(event.target.value)}
                >
                  <option value="">Chọn kỳ tuyển sinh</option>
                  {admissionPeriodOptions.map((option) => (
                    <option key={`filter-period-${option.id}`} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionFilterMajorIdInput}
                  onChange={(event) => setAdmissionFilterMajorIdInput(event.target.value)}
                >
                  <option value="">Chọn ngành</option>
                  {admissionMajorOptions.map((option) => (
                    <option key={`filter-major-${option.id}`} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionFilterStatusInput}
                  onChange={(event) =>
                    setAdmissionFilterStatusInput(event.target.value as AdmissionApplicationStatus | "")
                  }
                >
                  <option value="">Chọn trạng thái</option>
                  {admissionApplicationStatusOptions.map((status) => (
                    <option key={`filter-status-${status}`} value={status}>
                      {toAdmissionApplicationStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Trang (bắt đầu từ 0)"
                  value={admissionFilterPageInput}
                  onChange={(event) => setAdmissionFilterPageInput(event.target.value)}
                  inputMode="numeric"
                />
                <input
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Số hồ sơ mỗi trang"
                  value={admissionFilterSizeInput}
                  onChange={(event) => setAdmissionFilterSizeInput(event.target.value)}
                  inputMode="numeric"
                />
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionFilterSortByInput}
                  onChange={(event) => setAdmissionFilterSortByInput(event.target.value)}
                >
                  {admissionApplicationSortByOptions.map((option) => (
                    <option key={`admission-sort-by-${option.value}`} value={option.value}>
                      Sắp xếp theo: {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionFilterSortDirectionInput}
                  onChange={(event) =>
                    setAdmissionFilterSortDirectionInput(event.target.value as AdmissionSortDirection)
                  }
                >
                  {admissionSortDirectionOptions.map((option) => (
                    <option key={`admission-sort-direction-${option}`} value={option}>
                      Thứ tự: {option === "DESC" ? "Mới đến cũ" : "Cũ đến mới"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleApplyAdmissionFilters();
                  }}
                  disabled={isWorking}
                  className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Áp dụng bộ lọc
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleResetAdmissionFilters();
                  }}
                  disabled={isWorking}
                  className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Xóa bộ lọc
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleQuickAdmissionStatusFilter("PENDING");
                  }}
                  disabled={isWorking}
                  className="h-9 rounded-[4px] border border-[#f0bf72] bg-[#fff7ea] px-3 text-sm font-semibold text-[#91611f] transition hover:bg-[#ffefcf] disabled:opacity-60"
                >
                  Lọc nhanh: Chờ duyệt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleQuickAdmissionStatusFilter("APPROVED");
                  }}
                  disabled={isWorking}
                  className="h-9 rounded-[4px] border border-[#78bf93] bg-[#ecf8f0] px-3 text-sm font-semibold text-[#2f7b4f] transition hover:bg-[#dff2e6] disabled:opacity-60"
                >
                  Lọc nhanh: Đã duyệt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleQuickAdmissionStatusFilter("");
                  }}
                  disabled={isWorking}
                  className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Bỏ lọc trạng thái
                </button>
              </div>
              <p className="text-xs text-[#4f6d82]">
                Kết quả hiện tại: trang {admissionApplications.page ?? 0}, số lượng/trang{" "}
                {admissionApplications.size ?? admissionApplications.rows.length}, tổng{" "}
                {admissionApplications.totalElements ?? admissionApplications.rows.length} hồ sơ.
              </p>
            </div>

            <div className="space-y-2 rounded-[6px] border border-[#d7e7f3] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f75]">
                Duyệt một hồ sơ
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <div className="h-10 rounded-[4px] border border-[#c8d3dd] bg-[#f8fcff] px-3 text-sm leading-[38px] text-[#355970]">
                  {singleSelectedAdmission
                    ? `Đang chọn #${singleSelectedAdmission.id} - ${singleSelectedAdmission.fullName || singleSelectedAdmission.email || singleSelectedAdmission.phone || "Ứng viên"}`
                    : "Vui lòng chọn đúng 1 hồ sơ trong bảng để duyệt từng hồ sơ."}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleLoadAdmissionDetail();
                  }}
                  disabled={isWorking || !singleSelectedAdmission}
                  className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Tải chi tiết
                </button>
              </div>
              {admissionDetail ? (
                <div className="rounded-[6px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-sm text-[#355970]">
                  <p>ID: {admissionDetail.id}</p>
                  <p>Họ tên: {admissionDetail.fullName || "-"}</p>
                  <p>Email: {admissionDetail.email || "-"}</p>
                  <p>SĐT: {admissionDetail.phone || "-"}</p>
                  <p>Ngày duyệt: {formatDateTime(admissionDetail.approvalDate)}</p>
                  <p>
                    Trạng thái:
                    <span
                      className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getAdmissionApplicationStatusBadgeClass(admissionDetail.status)}`}
                    >
                      {toAdmissionApplicationStatusLabel(admissionDetail.status)}
                    </span>
                  </p>
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_220px]">
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionReviewStatus}
                  onChange={(event) =>
                    setAdmissionReviewStatus(event.target.value as AdmissionApplicationStatus)
                  }
                >
                  {admissionReviewStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {toAdmissionApplicationStatusLabel(status)}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="note (không bắt buộc)"
                  value={admissionReviewNote}
                  onChange={(event) => setAdmissionReviewNote(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleReviewSingleAdmission();
                  }}
                  disabled={isWorking || !singleSelectedAdmission}
                  className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  Cập nhật hồ sơ đã chọn
                </button>
              </div>
              <p className="text-xs text-[#4f6d82]">
                Lưu ý: ghi chú chỉ dùng cho thao tác hiện tại.
              </p>
            </div>

            <div className="space-y-2 rounded-[6px] border border-[#d7e7f3] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f75]">
                Duyệt hàng loạt
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <div className="h-10 rounded-[4px] border border-[#c8d3dd] bg-[#f8fcff] px-3 text-sm leading-[38px] text-[#355970]">
                  Đã chọn {admissionSelectedIds.length} hồ sơ
                </div>
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionBulkStatus}
                  onChange={(event) =>
                    setAdmissionBulkStatus(event.target.value as AdmissionApplicationStatus)
                  }
                >
                  {admissionReviewStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {toAdmissionApplicationStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              {admissionSelectedIds.length > 0 ? (
                <p className="text-xs text-[#4f6d82]">
                  ID đã chọn:{" "}
                  {admissionSelectedIds.length <= 8
                    ? admissionSelectedIds.join(", ")
                    : `${admissionSelectedIds.slice(0, 8).join(", ")} ... (+${
                        admissionSelectedIds.length - 8
                      })`}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearAdmissionSelection}
                  disabled={isWorking || admissionSelectedIds.length === 0}
                  className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
              <input
                className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="note duyệt hàng loạt (không bắt buộc)"
                value={admissionBulkNote}
                onChange={(event) => setAdmissionBulkNote(event.target.value)}
              />
              <p className="text-xs text-[#4f6d82]">
                Lưu ý: ghi chú hàng loạt chỉ dùng cho thao tác hiện tại.
              </p>
              <button
                type="button"
                onClick={() => {
                  void handleBulkReviewAdmissions();
                }}
                disabled={isWorking || admissionSelectedIds.length === 0}
                className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Duyệt hàng loạt
              </button>
            </div>
          </section>

          {SHOW_ADMISSION_POST_REVIEW_ACTIONS ? (
            <div className="grid gap-4 xl:grid-cols-2">
            <section className="space-y-3 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
              <div>
                <h3 className="text-base font-semibold text-[#1a4f75]">
                  Duyệt tự động (tùy chọn)
                </h3>
                <p className="text-xs text-[#4f6d82]">
                  Hệ thống tự đối chiếu điểm hồ sơ với ngưỡng xét tuyển của kỳ đã chọn.
                </p>
              </div>
              <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                <p>1. Lấy các hồ sơ chờ duyệt của kỳ đã chọn.</p>
                <p>2. Đối chiếu ngưỡng xét tuyển theo ngành và tổ hợp.</p>
                <p>3. Đủ điểm: chuyển sang Đã duyệt.</p>
                <p>4. Chưa đủ điểm: chuyển sang Từ chối.</p>
                <p>5. Thiếu ngưỡng xét tuyển: giữ nguyên Chờ duyệt.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionAutoScreenPeriodId}
                  onChange={(event) => setAdmissionAutoScreenPeriodId(event.target.value)}
                >
                  <option value="">Chọn kỳ tuyển sinh để duyệt tự động</option>
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
                  Chạy duyệt tự động
                </button>
              </div>
            </section>

            <section className="space-y-3 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
              <div>
                <h3 className="text-base font-semibold text-[#1a4f75]">
                  Chốt nhập học
                </h3>
                <p className="text-xs text-[#4f6d82]">
                  Tạo tài khoản và hồ sơ cho các thí sinh đã được duyệt.
                </p>
              </div>
              <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                <p>Kỳ tuyển sinh và niên khóa là hai thông tin bắt buộc.</p>
                <p>Chỉ xử lý các hồ sơ đã duyệt của kỳ đã chọn.</p>
                <p>Nếu đã có hồ sơ sinh viên theo CCCD thì hồ sơ đó sẽ được bỏ qua.</p>
                <p>Tài khoản được tạo tự động theo quy ước mã chung của trường.</p>
                <p>Mật khẩu mặc định dùng ngày sinh `YYYY-MM-DD`.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  value={admissionOnboardPeriodId}
                  onChange={(event) => {
                    setAdmissionOnboardPeriodId(event.target.value);
                    setAdmissionOnboardingReadiness(null);
                  }}
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
                  onChange={(event) => {
                    setAdmissionOnboardCohortId(event.target.value);
                    setAdmissionOnboardingReadiness(null);
                  }}
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
                  void handleCheckOnboardingReadiness();
                }}
                disabled={isWorking}
                className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Kiểm tra điều kiện trước khi onboard
              </button>
              {admissionOnboardingReadiness ? (
                <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-sm text-[#355970]">
                  <p>Hồ sơ APPROVED: {admissionOnboardingReadiness.approvedCount}</p>
                  <p>
                    Ngành có lớp phù hợp: {admissionOnboardingReadiness.coveredMajorCount}/
                    {admissionOnboardingReadiness.requiredMajorCount}
                  </p>
                  {admissionOnboardingReadiness.missingMajorNames.length > 0 ? (
                    <p className="text-[#9f2f2f]">
                      Thiếu lớp hành chính cho:{" "}
                      {formatMissingMajorNames(admissionOnboardingReadiness.missingMajorNames)}
                    </p>
                  ) : (
                    <p className="text-[#2f7b4f]">Đủ điều kiện dữ liệu để chốt nhập học.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#4f6d82]">
                  Nên kiểm tra điều kiện trước khi chốt nhập học để tránh thiếu dữ liệu lớp.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  void handleAdmissionOnboarding();
                }}
                disabled={
                  isWorking ||
                  (admissionOnboardingReadiness
                    ? admissionOnboardingReadiness.approvedCount === 0 ||
                      admissionOnboardingReadiness.missingMajorNames.length > 0
                    : false)
                }
                className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Chốt nhập học
              </button>
            </section>
            </div>
          ) : null}

        </div>
      </section>

      {SHOW_ADMISSION_CONFIGURATION_PANELS ? (
        <>
          <section className={contentCardClass}>
            <div className={sectionTitleClass}>
              <h2>Thiết lập dữ liệu tuyển sinh</h2>
            </div>
            <div className="grid gap-4 px-4 py-4 xl:grid-cols-3">
          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <h3 className="text-base font-semibold text-[#1a4f75]">Đợt tuyển sinh</h3>
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
                <p>Trạng thái: {toAdmissionPeriodStatusLabel(periodDetail.status)}</p>
              </div>
            ) : null}
            <select
              className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
              value={periodActionIdInput}
              onChange={(event) => handleSelectPeriodForEdit(event.target.value)}
            >
              <option value="">Tạo kỳ mới</option>
              {admissionPeriodOptions.map((option) => (
                <option key={`period-action-${option.id}`} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#4f6d82]">
              <p className="font-semibold text-[#2d607f]">
                {periodActionIdInput.trim()
                  ? `Đang chỉnh sửa kỳ #${periodActionIdInput}.`
                  : "Đang tạo kỳ tuyển sinh mới."}
              </p>
              <p className="mt-1">
                Vui lòng nhập đủ ngày và giờ. Thời gian kết thúc phải lớn hơn thời gian bắt
                đầu.
              </p>
              {!periodActionIdInput.trim() ? (
                <p className="mt-1 text-[#8a5a1f]">
                  Muốn cập nhật kỳ đã có: chọn kỳ ở danh sách ngay phía trên (không để "Tạo kỳ
                  mới").
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label
                htmlFor="admission-period-name-input"
                className="text-xs font-semibold text-[#2d607f]"
              >
                Tên kỳ tuyển sinh
              </label>
              <input
                id="admission-period-name-input"
                className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Ví dụ: Tuyển sinh Đại học chính quy Đợt 1 - Năm 2026"
                value={periodNameInput}
                onChange={(event) => setPeriodNameInput(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="admission-period-start-input"
                className="text-xs font-semibold text-[#2d607f]"
              >
                Thời gian bắt đầu
              </label>
              <input
                id="admission-period-start-input"
                type="datetime-local"
                step={60}
                className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={periodStartInput}
                onChange={(event) => handlePeriodStartInputChange(event.target.value)}
              />
              <p className="text-xs text-[#4f6d82]">Hệ thống lưu theo giờ địa phương (UTC+7).</p>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="admission-period-end-input"
                className="text-xs font-semibold text-[#2d607f]"
              >
                Thời gian kết thúc
              </label>
              <input
                id="admission-period-end-input"
                type="datetime-local"
                step={60}
                className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={periodEndInput}
                onChange={(event) => setPeriodEndInput(event.target.value)}
              />
              <p className="text-xs text-[#4f6d82]">
                Nếu để trống, hệ thống tự gán = thời gian bắt đầu + 6 tháng.
              </p>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="admission-period-status-input"
                className="text-xs font-semibold text-[#2d607f]"
              >
                Trạng thái kỳ
              </label>
              <select
                id="admission-period-status-input"
                className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={periodStatusInput}
                onChange={(event) =>
                  setPeriodStatusInput(event.target.value as AdmissionPeriodStatus)
                }
              >
                {admissionPeriodStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {toAdmissionPeriodStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleUpsertPeriod();
                }}
                disabled={isWorking}
                className="h-10 flex-1 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                {periodActionIdInput.trim() ? "Cập nhật kỳ" : "Tạo kỳ"}
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
            <h3 className="text-base font-semibold text-[#1a4f75]">Khối xét tuyển</h3>
            <select
              className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
              value={blockActionIdInput}
              onChange={(event) => handleSelectBlockForEdit(event.target.value)}
            >
              <option value="">Tạo block mới</option>
              {admissionBlockCrudOptions.map((option) => (
                <option key={`block-action-${option.id}`} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
              placeholder="Tên khối (ví dụ: A00)"
              value={blockNameInput}
              onChange={(event) => setBlockNameInput(event.target.value)}
            />
            <input
              className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
              placeholder="Mô tả"
              value={blockDescriptionInput}
              onChange={(event) => setBlockDescriptionInput(event.target.value)}
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
                Lưu
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
            <h3 className="text-base font-semibold text-[#1a4f75]">Điểm chuẩn</h3>
            <select
              className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
              value={benchmarkActionIdInput}
              onChange={(event) => handleSelectBenchmarkForEdit(event.target.value)}
            >
              <option value="">Chọn dòng điểm chuẩn cần cập nhật/xóa</option>
              {admissionBenchmarkOptions.map((option) => (
                <option key={`benchmark-action-${option.id}`} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={benchmarkMajorIdInput}
                onChange={(event) => setBenchmarkMajorIdInput(event.target.value)}
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
                onChange={(event) => setBenchmarkBlockIdInput(event.target.value)}
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
                onChange={(event) => setBenchmarkPeriodIdInput(event.target.value)}
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
                placeholder="Điểm chuẩn (0-30)"
                value={benchmarkScoreInput}
                onChange={(event) => setBenchmarkScoreInput(event.target.value)}
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
              onChange={(event) => setBenchmarkBulkPeriodIdInput(event.target.value)}
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
                      handleBenchmarkBulkRowChange(index, "majorId", event.target.value)
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
                      handleBenchmarkBulkRowChange(index, "blockId", event.target.value)
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
                    onChange={(event) => handleBenchmarkBulkRowChange(index, "score", event.target.value)}
                    inputMode="decimal"
                  />
                  <button
                    type="button"
                    onClick={() => removeBenchmarkBulkRow(index)}
                    disabled={benchmarkBulkRows.length === 1 || isWorking}
                    className="h-9 rounded-[4px] bg-[#cc3a3a] px-2 text-sm font-semibold text-white transition hover:bg-[#aa2e2e] disabled:opacity-60"
                    aria-label="Xóa dòng điểm chuẩn"
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
                Thêm dòng điểm chuẩn
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
              Lưu điểm chuẩn hàng loạt
            </button>
          </section>
            </div>
          </section>

          <section className={contentCardClass}>
            <div className={sectionTitleClass}>
              <h2>Danh sách kỳ tuyển sinh</h2>
              <button
                type="button"
                onClick={() => {
                  void refreshAllAdmissionData();
                }}
                disabled={isWorking}
                className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Làm mới tất cả
              </button>
            </div>
            <div className="overflow-x-auto px-4 py-4">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    <th className="px-2 py-2">STT</th>
                    <th className="px-2 py-2">Ten ky</th>
                    <th className="px-2 py-2">Bat dau</th>
                    <th className="px-2 py-2">Ket thuc</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Tổng ho so</th>
                    <th className="px-2 py-2">Da duyet</th>
                  </tr>
                </thead>
                <tbody>
                  {periodTablePagination.paginatedRows.map((item, index) => (
                    <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                      <td className="px-2 py-2">{periodTablePagination.startItem + index}</td>
                      <td className="px-2 py-2">{item.periodName || "-"}</td>
                      <td className="px-2 py-2">{formatDateTime(item.startTime)}</td>
                      <td className="px-2 py-2">{formatDateTime(item.endTime)}</td>
                      <td className="px-2 py-2">{toAdmissionPeriodStatusLabel(item.status)}</td>
                      <td className="px-2 py-2">{item.totalApplications ?? "-"}</td>
                      <td className="px-2 py-2">{item.approvedApplications ?? "-"}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleSelectPeriodForEdit(String(item.id))}
                          className="rounded-[4px] border border-[#9ec3dd] bg-white px-2 py-1 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                  {admissionPeriods.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-[#577086]">
                        Chưa có dữ liệu kỳ tuyển sinh.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <TablePaginationControls
              pageIndex={periodTablePagination.pageIndex}
              pageSize={periodTablePagination.pageSize}
              totalItems={periodTablePagination.totalItems}
              totalPages={periodTablePagination.totalPages}
              startItem={periodTablePagination.startItem}
              endItem={periodTablePagination.endItem}
              onPageChange={periodTablePagination.setPageIndex}
              onPageSizeChange={periodTablePagination.setPageSize}
            />
          </section>

          <section className={contentCardClass}>
            <div className={sectionTitleClass}>
              <h2>Danh sách khối xét tuyển</h2>
              <span className="text-sm font-medium text-[#396786]">{admissionBlocks.length} khối</span>
            </div>
            <div className="overflow-x-auto px-4 py-4">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    <th className="px-2 py-2">STT</th>
                    <th className="px-2 py-2">Block</th>
                    <th className="px-2 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {blockTablePagination.paginatedRows.map((item, index) => (
                    <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                      <td className="px-2 py-2">{blockTablePagination.startItem + index}</td>
                      <td className="px-2 py-2">{item.blockName || "-"}</td>
                      <td className="px-2 py-2">{item.description || "-"}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleSelectBlockForEdit(String(item.id))}
                          className="rounded-[4px] border border-[#9ec3dd] bg-white px-2 py-1 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                  {admissionBlocks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-[#577086]">
                        Chưa có dữ liệu khối xét tuyển.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <TablePaginationControls
              pageIndex={blockTablePagination.pageIndex}
              pageSize={blockTablePagination.pageSize}
              totalItems={blockTablePagination.totalItems}
              totalPages={blockTablePagination.totalPages}
              startItem={blockTablePagination.startItem}
              endItem={blockTablePagination.endItem}
              onPageChange={blockTablePagination.setPageIndex}
              onPageSizeChange={blockTablePagination.setPageSize}
            />
          </section>

          <section className={contentCardClass}>
            <div className={sectionTitleClass}>
              <h2>Danh sách điểm chuẩn</h2>
              <span className="text-sm font-medium text-[#396786]">{admissionBenchmarks.rows.length} dòng</span>
            </div>
            <div className="overflow-x-auto px-4 py-4">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cfdfec] text-[#305970]">
                    <th className="px-2 py-2">STT</th>
                    <th className="px-2 py-2">Nganh</th>
                    <th className="px-2 py-2">Block</th>
                    <th className="px-2 py-2">Period</th>
                    <th className="px-2 py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkTablePagination.paginatedRows.map((item, index) => (
                    <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                      <td className="px-2 py-2">{benchmarkTablePagination.startItem + index}</td>
                      <td className="px-2 py-2">{item.majorName || "-"}</td>
                      <td className="px-2 py-2">{item.blockName || "-"}</td>
                      <td className="px-2 py-2">{item.periodName || "-"}</td>
                      <td className="px-2 py-2">{item.score ?? "-"}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleSelectBenchmarkForEdit(String(item.id))}
                          className="rounded-[4px] border border-[#9ec3dd] bg-white px-2 py-1 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                  {admissionBenchmarks.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-[#577086]">
                        Chưa có dữ liệu điểm chuẩn.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <TablePaginationControls
              pageIndex={benchmarkTablePagination.pageIndex}
              pageSize={benchmarkTablePagination.pageSize}
              totalItems={benchmarkTablePagination.totalItems}
              totalPages={benchmarkTablePagination.totalPages}
              startItem={benchmarkTablePagination.startItem}
              endItem={benchmarkTablePagination.endItem}
              onPageChange={benchmarkTablePagination.setPageIndex}
              onPageSizeChange={benchmarkTablePagination.setPageSize}
            />
          </section>
        </>
      ) : null}

      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>Danh sách hồ sơ dự tuyển</h2>
          <span className="text-sm font-medium text-[#396786]">{admissionApplications.rows.length} hồ sơ</span>
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
                <th className="px-2 py-2">STT</th>
                <th className="px-2 py-2">Ho ten</th>
                <th className="px-2 py-2">Nganh</th>
                <th className="px-2 py-2">Block</th>
                <th className="px-2 py-2">Period</th>
                <th className="px-2 py-2">Tổng diem</th>
                <th className="px-2 py-2">Ngày duyệt</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {admissionApplications.rows.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-b border-[#e0ebf4] text-[#3f6178] ${
                    admissionSelectedIds.includes(item.id) ? "bg-[#eef7ff]" : ""
                  }`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={admissionSelectedIds.includes(item.id)}
                      onChange={() => toggleAdmissionSelection(item.id)}
                      aria-label={`Chọn hồ sơ ${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-2">{index + 1}</td>
                  <td className="px-2 py-2">{item.fullName || "-"}</td>
                  <td className="px-2 py-2">{item.majorName || "-"}</td>
                  <td className="px-2 py-2">{item.blockName || "-"}</td>
                  <td className="px-2 py-2">{item.periodName || "-"}</td>
                  <td className="px-2 py-2">{item.totalScore ?? "-"}</td>
                  <td className="px-2 py-2">{formatDateTime(item.approvalDate)}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getAdmissionApplicationStatusBadgeClass(item.status)}`}
                    >
                      {toAdmissionApplicationStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveApplicationForActions(item.id)}
                        className="rounded-[4px] border border-[#9ec3dd] bg-white px-2 py-1 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                      >
                        Chọn
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleQuickReviewAdmission(item.id, "APPROVED");
                        }}
                        disabled={isWorking || toNormalizedUpperText(item.status) === "ENROLLED"}
                        className="rounded-[4px] border border-[#78bf93] bg-[#ecf8f0] px-2 py-1 text-xs font-semibold text-[#2f7b4f] transition hover:bg-[#dff2e6] disabled:opacity-60"
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleQuickReviewAdmission(item.id, "REJECTED");
                        }}
                        disabled={isWorking || toNormalizedUpperText(item.status) === "ENROLLED"}
                        className="rounded-[4px] border border-[#dc9d9d] bg-[#fff1f1] px-2 py-1 text-xs font-semibold text-[#b03d3d] transition hover:bg-[#ffe4e4] disabled:opacity-60"
                      >
                        Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {admissionApplications.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-4 text-center text-[#577086]">
                    Chưa có dữ liệu hồ sơ tuyển sinh.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
