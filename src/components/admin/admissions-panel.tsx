"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  autoScreenAdmissionApplications,
  createAdmissionBlock,
  createAdmissionPeriod,
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
  getDynamicListByPath,
  processAdmissionOnboarding,
  reviewAdmissionApplication,
  reviewAdmissionApplicationsBulk,
  saveAdmissionBenchmarksBulk,
  updateAdmissionBenchmark,
  updateAdmissionBlock,
  updateAdmissionPeriod,
} from "@/lib/admin/service";
import { formatDateTime, toErrorMessage } from "@/components/admin/format-utils";
import { submitPublicAdmissionApplication } from "@/lib/public-admission/service";
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
import type { PublicAdmissionApplyPayload } from "@/lib/public-admission/types";

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

const admissionReviewStatusOptions: AdmissionApplicationStatus[] = [
  "APPROVED",
  "REJECTED",
];

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

const toAdmissionPeriodStatus = (value?: string): AdmissionPeriodStatus => {
  const normalized = value as AdmissionPeriodStatus | undefined;
  return normalized && admissionPeriodStatusOptions.includes(normalized)
    ? normalized
    : "UPCOMING";
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

const toAdmissionPeriodStatusLabel = (value?: string): string => {
  if (!value) {
    return "-";
  }
  return admissionPeriodStatusLabels[value as AdmissionPeriodStatus] || value;
};

const normalizeImportHeader = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

const mapImportHeaderToKey = (
  header: string,
): keyof PublicAdmissionApplyPayload | null => {
  const normalized = normalizeImportHeader(header);
  const mapping: Record<string, keyof PublicAdmissionApplyPayload> = {
    fullname: "fullName",
    hoten: "fullName",
    hovaten: "fullName",
    dateofbirth: "dateOfBirth",
    ngaysinh: "dateOfBirth",
    dob: "dateOfBirth",
    email: "email",
    phone: "phone",
    sodienthoai: "phone",
    dienthoai: "phone",
    nationalid: "nationalId",
    cccd: "nationalId",
    socccd: "nationalId",
    address: "address",
    diachi: "address",
    periodid: "periodId",
    kyid: "periodId",
    dottuyensinhid: "periodId",
    majorid: "majorId",
    nganhid: "majorId",
    blockid: "blockId",
    khoiid: "blockId",
    totalscore: "totalScore",
    tongdiem: "totalScore",
  };

  return mapping[normalized] || null;
};

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let currentValue = "";
  let isInQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (isInQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        isInQuotes = !isInQuotes;
      }
      continue;
    }

    if (character === "," && !isInQuotes) {
      cells.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  cells.push(currentValue);
  return cells;
};

type CsvImportFailure = {
  lineNumber: number;
  reason: string;
  fullName?: string;
};

type CsvImportRow = PublicAdmissionApplyPayload & {
  lineNumber: number;
};

type CsvImportParseResult = {
  totalRows: number;
  validRows: CsvImportRow[];
  failures: CsvImportFailure[];
};

type CsvImportSummary = {
  totalRows: number;
  importedRows: number;
  failedRows: number;
};

type AdmissionOnboardingReadiness = {
  approvedCount: number;
  requiredMajorCount: number;
  coveredMajorCount: number;
  missingMajorNames: string[];
};

const admissionCsvRequiredColumns: Array<{
  key: keyof PublicAdmissionApplyPayload;
  label: string;
}> = [
  { key: "fullName", label: "fullName" },
  { key: "dateOfBirth", label: "dateOfBirth" },
  { key: "email", label: "email" },
  { key: "phone", label: "phone" },
  { key: "nationalId", label: "nationalId" },
  { key: "address", label: "address" },
  { key: "periodId", label: "periodId" },
  { key: "majorId", label: "majorId" },
  { key: "blockId", label: "blockId" },
  { key: "totalScore", label: "totalScore" },
];

const parseAdmissionImportCsv = (content: string): CsvImportParseResult => {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const firstLine = lines[0] || "";
  const headerCells = parseCsvLine(firstLine);
  const headerIndexes = new Map<keyof PublicAdmissionApplyPayload, number>();

  headerCells.forEach((headerCell, index) => {
    const mappedKey = mapImportHeaderToKey(headerCell);
    if (!mappedKey || headerIndexes.has(mappedKey)) {
      return;
    }
    headerIndexes.set(mappedKey, index);
  });

  const missingColumns = admissionCsvRequiredColumns.filter(
    (column) => !headerIndexes.has(column.key),
  );
  if (missingColumns.length > 0) {
    return {
      totalRows: 0,
      validRows: [],
      failures: [
        {
          lineNumber: 1,
          reason: `Thiếu cột bắt buộc: ${missingColumns
            .map((column) => column.label)
            .join(", ")}`,
        },
      ],
    };
  }

  let totalRows = 0;
  const validRows: CsvImportRow[] = [];
  const failures: CsvImportFailure[] = [];

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const rawLine = lines[rowIndex];
    if (!rawLine || !rawLine.trim()) {
      continue;
    }

    totalRows += 1;
    const lineNumber = rowIndex + 1;
    const rowCells = parseCsvLine(rawLine);
    const getCellValue = (key: keyof PublicAdmissionApplyPayload): string => {
      const cellIndex = headerIndexes.get(key);
      if (cellIndex === undefined) {
        return "";
      }
      return (rowCells[cellIndex] || "").trim();
    };

    const fullName = getCellValue("fullName");
    const dateOfBirth = getCellValue("dateOfBirth");
    const email = getCellValue("email");
    const phone = getCellValue("phone");
    const nationalId = getCellValue("nationalId");
    const address = getCellValue("address");
    const periodId = Number(getCellValue("periodId"));
    const majorId = Number(getCellValue("majorId"));
    const blockId = Number(getCellValue("blockId"));
    const totalScore = Number(getCellValue("totalScore"));

    if (!fullName || !dateOfBirth || !email || !phone || !nationalId || !address) {
      failures.push({
        lineNumber,
        fullName: fullName || undefined,
        reason: "Thiếu trường bắt buộc.",
      });
      continue;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      failures.push({
        lineNumber,
        fullName,
        reason: "Ngày sinh phải có định dạng YYYY-MM-DD.",
      });
      continue;
    }

    if (!/^\d{12}$/.test(nationalId)) {
      failures.push({
        lineNumber,
        fullName,
        reason: "CCCD phải gồm đúng 12 chữ số.",
      });
      continue;
    }

    if (!/^(0[35789])[0-9]{8}$/.test(phone)) {
      failures.push({
        lineNumber,
        fullName,
        reason: "Số điện thoại không hợp lệ.",
      });
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      failures.push({
        lineNumber,
        fullName,
        reason: "Email không hợp lệ.",
      });
      continue;
    }

    if (!Number.isInteger(periodId) || periodId <= 0) {
      failures.push({
        lineNumber,
        fullName,
        reason: "periodId không hợp lệ.",
      });
      continue;
    }

    if (!Number.isInteger(majorId) || majorId <= 0) {
      failures.push({
        lineNumber,
        fullName,
        reason: "majorId không hợp lệ.",
      });
      continue;
    }

    if (!Number.isInteger(blockId) || blockId <= 0) {
      failures.push({
        lineNumber,
        fullName,
        reason: "blockId không hợp lệ.",
      });
      continue;
    }

    if (!Number.isFinite(totalScore) || totalScore < 0 || totalScore > 30) {
      failures.push({
        lineNumber,
        fullName,
        reason: "Tổng điểm phải trong khoảng 0-30.",
      });
      continue;
    }

    validRows.push({
      lineNumber,
      fullName,
      dateOfBirth,
      email,
      phone,
      nationalId,
      address,
      periodId,
      majorId,
      blockId,
      totalScore,
    });
  }

  return {
    totalRows,
    validRows,
    failures,
  };
};

type SelectionOptionItem = {
  id: number;
  label: string;
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
  const [admissionImportFileName, setAdmissionImportFileName] = useState("");
  const [admissionImportRows, setAdmissionImportRows] = useState<CsvImportRow[]>([]);
  const [admissionImportRowsPreview, setAdmissionImportRowsPreview] = useState<CsvImportRow[]>([]);
  const [admissionImportParseFailures, setAdmissionImportParseFailures] = useState<
    CsvImportFailure[]
  >([]);
  const [admissionImportFailures, setAdmissionImportFailures] = useState<CsvImportFailure[]>([]);
  const [admissionImportSummary, setAdmissionImportSummary] = useState<CsvImportSummary | null>(
    null,
  );
  const [admissionAutoScreenPeriodId, setAdmissionAutoScreenPeriodId] = useState("");
  const [admissionOnboardPeriodId, setAdmissionOnboardPeriodId] = useState("");
  const [admissionOnboardCohortId, setAdmissionOnboardCohortId] = useState("");
  const [admissionOnboardingReadiness, setAdmissionOnboardingReadiness] =
    useState<AdmissionOnboardingReadiness | null>(null);
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
  const visibleAdmissionIds = useMemo(() => {
    return admissionApplicationOptions.map((item) => item.id);
  }, [admissionApplicationOptions]);
  const areAllVisibleAdmissionsSelected = useMemo(() => {
    if (visibleAdmissionIds.length === 0) {
      return false;
    }
    return visibleAdmissionIds.every((id) => admissionSelectedIds.includes(id));
  }, [admissionSelectedIds, visibleAdmissionIds]);

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

  const parseDateTimeLocalToIso = (value: string, fieldLabel: string): string | null => {
    if (!value.trim()) {
      setErrorMessage(`${fieldLabel} không duoc de trong.`);
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      setErrorMessage(`${fieldLabel} không hop le.`);
      return null;
    }

    return parsed.toISOString();
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

  const handleSelectPeriodForEdit = (periodIdValue: string) => {
    setPeriodActionIdInput(periodIdValue);
    if (!periodIdValue) {
      setPeriodNameInput("");
      setPeriodStartInput("");
      setPeriodEndInput("");
      setPeriodStatusInput("UPCOMING");
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

  const clearAdmissionImportData = () => {
    setAdmissionImportFileName("");
    setAdmissionImportRows([]);
    setAdmissionImportRowsPreview([]);
    setAdmissionImportParseFailures([]);
    setAdmissionImportFailures([]);
    setAdmissionImportSummary(null);
  };

  const handleAdmissionImportFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      clearAdmissionImportData();
      return;
    }

    setAdmissionImportFileName(selectedFile.name);
    event.target.value = "";

    void runAction(async () => {
      const content = await selectedFile.text();
      const parsed = parseAdmissionImportCsv(content);

      setAdmissionImportRows(parsed.validRows);
      setAdmissionImportRowsPreview(parsed.validRows.slice(0, 5));
      setAdmissionImportParseFailures(parsed.failures);
      setAdmissionImportFailures(parsed.failures);
      setAdmissionImportSummary({
        totalRows: parsed.totalRows,
        importedRows: 0,
        failedRows: parsed.failures.length,
      });

      if (parsed.totalRows === 0) {
        setErrorMessage("File CSV không có dữ liệu.");
        return;
      }

      if (parsed.validRows.length === 0) {
        setErrorMessage("Không có dòng hợp lệ để import. Vui lòng kiểm tra lại file CSV.");
        return;
      }

      if (parsed.failures.length > 0) {
        setErrorMessage(
          `${parsed.failures.length} dòng không hợp lệ, vui lòng xem chi tiết bên dưới.`,
        );
      }

      setSuccessMessage(
        `Đã đọc ${parsed.totalRows} dòng từ CSV. Sẵn sàng import ${parsed.validRows.length} hồ sơ.`,
      );
    });
  };

  const handleImportAdmissionCsvRows = async () => {
    if (admissionImportRows.length === 0) {
      setErrorMessage("Vui lòng chọn file CSV hợp lệ trước khi import.");
      return;
    }

    await runAction(async () => {
      const submitFailures: CsvImportFailure[] = [];
      let importedRows = 0;

      for (const row of admissionImportRows) {
        const payload: PublicAdmissionApplyPayload = {
          fullName: row.fullName,
          dateOfBirth: row.dateOfBirth,
          email: row.email,
          phone: row.phone,
          nationalId: row.nationalId,
          address: row.address,
          periodId: row.periodId,
          majorId: row.majorId,
          blockId: row.blockId,
          totalScore: row.totalScore,
        };

        try {
          await submitPublicAdmissionApplication(payload);
          importedRows += 1;
        } catch (error) {
          submitFailures.push({
            lineNumber: row.lineNumber,
            fullName: row.fullName,
            reason: toErrorMessage(error),
          });
        }
      }

      const combinedFailures = [...admissionImportParseFailures, ...submitFailures];
      const totalRows = admissionImportRows.length + admissionImportParseFailures.length;

      setAdmissionImportFailures(combinedFailures);
      setAdmissionImportSummary({
        totalRows,
        importedRows,
        failedRows: combinedFailures.length,
      });

      if (authorization) {
        await loadAdmissionsData(authorization);
      }

      if (combinedFailures.length > 0) {
        setErrorMessage(`${combinedFailures.length} dòng import thất bại. Xem chi tiết bên dưới.`);
      }

      setSuccessMessage(`Đã import thành công ${importedRows}/${totalRows} hồ sơ từ CSV.`);
    });
  };

  const loadAdmissionsData = async (
    token: string,
    filterOverrides?: {
      keyword: string;
      periodId: string;
      majorId: string;
      status: AdmissionApplicationStatus | "";
    },
  ) => {
    const keywordInput = (filterOverrides?.keyword ?? admissionFilterKeywordInput).trim();
    const periodIdInput = filterOverrides?.periodId ?? admissionFilterPeriodIdInput;
    const majorIdInput = filterOverrides?.majorId ?? admissionFilterMajorIdInput;
    const statusInput = filterOverrides?.status ?? admissionFilterStatusInput;
    const [periodRows, blockRows, benchmarkRows, applicationRows] = await Promise.all([
      getAdmissionPeriods(token),
      getAdmissionBlocks(token),
      getAdmissionBenchmarks(token),
      getAdmissionApplications(token, {
        keyword: keywordInput || undefined,
        periodId: parseOptionalPositiveInteger(periodIdInput),
        majorId: parseOptionalPositiveInteger(majorIdInput),
        status: statusInput || undefined,
        page: 0,
        size: 100,
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

  const handleApplyAdmissionFilters = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
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
    };
    setAdmissionFilterKeywordInput("");
    setAdmissionFilterPeriodIdInput("");
    setAdmissionFilterMajorIdInput("");
    setAdmissionFilterStatusInput("");

    await runAction(async () => {
      await loadAdmissionsData(authorization, resetFilters);
      setSuccessMessage("Đã xóa bộ lọc hồ sơ tuyển sinh.");
    });
  };

  const setActiveApplicationForActions = (applicationId: number) => {
    setAdmissionDetailIdInput(String(applicationId));
    setAdmissionReviewIdInput(String(applicationId));
    setAdmissionSelectedIds([applicationId]);
  };

  useEffect(() => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    void (async () => {
      await runAction(async () => {
        const [periodRows, blockRows, benchmarkRows, applicationRows, options, cohorts] =
          await Promise.all([
            getAdmissionPeriods(authorization),
            getAdmissionBlocks(authorization),
            getAdmissionBenchmarks(authorization),
            getAdmissionApplications(authorization, { page: 0, size: 100 }),
            getAdmissionFormOptions(authorization),
            getDynamicListByPath("/api/v1/cohorts", authorization),
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

    const applicationId = resolveSingleAdmissionId(admissionDetailIdInput);
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

    const applicationId = resolveSingleAdmissionId(admissionReviewIdInput);
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
      setSuccessMessage(`Đã duyet hồ sơ #${applicationId} thành ${admissionReviewStatus}.`);
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
        `Đã duyet hàng loat ${applicationIds.length} hồ sơ thành ${admissionBulkStatus}.`,
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
      setSuccessMessage(`Đã duyệt tự động hồ sơ của kỳ #${periodId}.`);
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
        setErrorMessage("Kỳ tuyển sinh hiện chưa có hồ sơ APPROVED để chốt nhập học.");
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
        `Đủ điều kiện chốt nhập học: ${readiness.approvedCount} hồ sơ APPROVED, ${readiness.coveredMajorCount}/${readiness.requiredMajorCount} ngành đã có lớp.`,
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
        setErrorMessage("Kỳ tuyển sinh hiện chưa có hồ sơ APPROVED để chốt nhập học.");
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

      await processAdmissionOnboarding(
        { periodId, cohortId },
        authorization,
      ).catch((error: unknown) => {
        const message = toErrorMessage(error);
        if (message.includes("[API 500]")) {
          throw new Error(
            `${message} Gợi ý: backend đang lỗi nội bộ khi tạo sinh viên (thường do chưa gán class_id).`,
          );
        }
        throw error;
      });
      await loadAdmissionsData(authorization);
      setSuccessMessage(`Đã chốt nhập học cho kỳ #${periodId}, niên khóa #${cohortId}.`);
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
      setSuccessMessage(periodId ? `Đã cập nhật kỳ #${periodId}.` : "Đã tạo kỳ tuyển sinh mới.");
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
          <h2>Quản lý tuyển sinh</h2>
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
            Thiết lập dữ liệu tuyển sinh, duyệt hồ sơ và chốt nhập học trong cùng một màn hình.
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
        <div className="grid gap-4 px-4 py-4 xl:grid-cols-3">
          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <h3 className="text-base font-semibold text-[#1a4f75]">Xét duyệt hồ sơ tuyển sinh</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Tìm theo tên, email, SĐT"
                value={admissionFilterKeywordInput}
                onChange={(event) => setAdmissionFilterKeywordInput(event.target.value)}
              />
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={admissionFilterPeriodIdInput}
                onChange={(event) => setAdmissionFilterPeriodIdInput(event.target.value)}
              >
                <option value="">Lọc theo kỳ tuyển sinh</option>
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
                <option value="">Lọc theo ngành</option>
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
                <option value="">Lọc theo trạng thái</option>
                {admissionApplicationStatusOptions.map((status) => (
                  <option key={`filter-status-${status}`} value={status}>
                    {toAdmissionApplicationStatusLabel(status)}
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
            </div>
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
                  setAdmissionReviewStatus(event.target.value as AdmissionApplicationStatus)
                }
              >
                {admissionReviewStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {toAdmissionApplicationStatusLabel(status)}
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
              Duyệt hồ sơ
            </button>

            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <div className="h-10 rounded-[4px] border border-[#c8d3dd] bg-white px-3 text-sm leading-[38px] text-[#355970]">
                Đã chọn {admissionSelectedIds.length} hồ sơ để duyệt hàng loạt
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
              placeholder="Ghi chú duyệt hàng loạt (không bắt buộc)"
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
              Duyệt hàng loạt
            </button>
          </section>

          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <h3 className="text-base font-semibold text-[#1a4f75]">Import hồ sơ từ CSV</h3>
            <p className="text-xs text-[#4f6d82]">
              Cột bắt buộc: `fullName,dateOfBirth,email,phone,nationalId,address,periodId,majorId,blockId,totalScore`
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/samples/admission-applications-sample.csv"
                download
                className="inline-flex h-9 items-center rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
              >
                Tải CSV mẫu
              </a>
              <label className="inline-flex h-9 cursor-pointer items-center rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd]">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleAdmissionImportFileChange}
                  disabled={isWorking}
                />
                Chọn file CSV
              </label>
              <button
                type="button"
                onClick={clearAdmissionImportData}
                disabled={isWorking}
                className="h-9 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Xóa file
              </button>
            </div>

            {admissionImportFileName ? (
              <p className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                File đã chọn: {admissionImportFileName}
              </p>
            ) : null}

            {admissionImportSummary ? (
              <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-sm text-[#355970]">
                <p>Tổng dòng dữ liệu: {admissionImportSummary.totalRows}</p>
                <p>Dòng hợp lệ đã import: {admissionImportSummary.importedRows}</p>
                <p>Dòng lỗi: {admissionImportSummary.failedRows}</p>
              </div>
            ) : null}

            {admissionImportRowsPreview.length > 0 ? (
              <div className="overflow-x-auto rounded-[6px] border border-[#d7e7f3] bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e0ebf4] text-[#305970]">
                      <th className="px-2 py-2">Dòng</th>
                      <th className="px-2 py-2">Họ tên</th>
                      <th className="px-2 py-2">CCCD</th>
                      <th className="px-2 py-2">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admissionImportRowsPreview.map((row) => (
                      <tr key={`import-preview-${row.lineNumber}`} className="border-b border-[#eef4f9] text-[#3f6178]">
                        <td className="px-2 py-2">{row.lineNumber}</td>
                        <td className="px-2 py-2">{row.fullName}</td>
                        <td className="px-2 py-2">{row.nationalId}</td>
                        <td className="px-2 py-2">{row.totalScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {admissionImportFailures.length > 0 ? (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-[6px] border border-[#f0d2d2] bg-[#fff8f8] px-3 py-2 text-xs text-[#9f2f2f]">
                {admissionImportFailures.slice(0, 12).map((failure, index) => (
                  <p key={`import-failure-${failure.lineNumber}-${index}`}>
                    Dòng {failure.lineNumber}
                    {failure.fullName ? ` (${failure.fullName})` : ""}: {failure.reason}
                  </p>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void handleImportAdmissionCsvRows();
              }}
              disabled={isWorking || admissionImportRows.length === 0}
              className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
            >
              Import hồ sơ từ CSV
            </button>
          </section>

          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <h3 className="text-base font-semibold text-[#1a4f75]">Duyệt tự động và chốt nhập học</h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={admissionAutoScreenPeriodId}
                onChange={(event) => setAdmissionAutoScreenPeriodId(event.target.value)}
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
                Duyệt tự động theo điểm chuẩn
              </button>
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
              Kiểm tra điều kiện chốt nhập học
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
                Nên kiểm tra điều kiện trước khi chốt để tránh lỗi backend.
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
      </section>

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
              onChange={(event) => setPeriodStatusInput(event.target.value as AdmissionPeriodStatus)}
            >
              {admissionPeriodStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {toAdmissionPeriodStatusLabel(status)}
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
                Lưu
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
              {admissionPeriods.rows.map((item, index) => (
                <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                  <td className="px-2 py-2">{index + 1}</td>
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
              {admissionBlocks.map((item, index) => (
                <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                  <td className="px-2 py-2">{index + 1}</td>
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
              {admissionBenchmarks.rows.map((item, index) => (
                <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                  <td className="px-2 py-2">{index + 1}</td>
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
      </section>

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
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {admissionApplications.rows.map((item, index) => (
                <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
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
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getAdmissionApplicationStatusBadgeClass(item.status)}`}
                    >
                      {toAdmissionApplicationStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setActiveApplicationForActions(item.id)}
                      className="rounded-[4px] border border-[#9ec3dd] bg-white px-2 py-1 text-xs font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                    >
                      Chọn thao tác
                    </button>
                  </td>
                </tr>
              ))}
              {admissionApplications.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-center text-[#577086]">
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
