"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [admissionAutoScreenPeriodId, setAdmissionAutoScreenPeriodId] = useState("");
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
  const [benchmarkBulkPeriodIdInput, setBenchmarkBulkPeriodIdInput] = useState("");
  const [benchmarkBulkRows, setBenchmarkBulkRows] = useState<
    Array<{ majorId: string; blockId: string; score: string }>
  >([{ majorId: "1", blockId: "1", score: "24.5" }]);

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

  const loadAdmissionsData = async (token: string) => {
    const [periodRows, blockRows, benchmarkRows, applicationRows] = await Promise.all([
      getAdmissionPeriods(token),
      getAdmissionBlocks(token),
      getAdmissionBenchmarks(token),
      getAdmissionApplications(token),
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
        `Đã tải form options: ${options.majors.length} majors, ${options.blocks.length} blocks, ${options.periods.length} periods.`,
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

  useEffect(() => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    void (async () => {
      await runAction(async () => {
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
      setSuccessMessage(`Đã chạy auto-screen cho kỳ #${periodId}.`);
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
      await processAdmissionOnboarding(
        {
          periodId,
          cohortId,
        },
        authorization,
      );
      await loadAdmissionsData(authorization);
      setSuccessMessage(`Đã chạy onboarding cho kỳ #${periodId} và niên khóa #${cohortId}.`);
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

    const benchmarkId = parsePositiveInteger(benchmarkActionIdInput, "Mã benchmark");
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
      setSuccessMessage(`Đã cập nhật benchmark #${benchmarkId}.`);
    });
  };

  const handleDeleteBenchmark = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const benchmarkId = parsePositiveInteger(benchmarkActionIdInput, "Mã benchmark");
    if (!benchmarkId) {
      return;
    }

    await runAction(async () => {
      await deleteAdmissionBenchmark(benchmarkId, authorization);
      await loadAdmissionsData(authorization);
      setSuccessMessage(`Đã xóa benchmark #${benchmarkId}.`);
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
      setErrorMessage("Danh sách benchmark không duoc de trong.");
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
      setSuccessMessage(`Đã lưu bulk ${benchmarkItems.length} benchmark cho kỳ #${periodId}.`);
    });
  };

  return (
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
        <div className="space-y-2 px-4 pt-3 text-sm">
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
                  setAdmissionReviewStatus(event.target.value as AdmissionApplicationStatus)
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
                  setAdmissionBulkStatus(event.target.value as AdmissionApplicationStatus)
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
                <p className="self-center text-xs text-[#5f7d93]">IDs: {admissionSelectedIds.join(", ")}</p>
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
                Chạy auto-screen
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={admissionOnboardPeriodId}
                onChange={(event) => setAdmissionOnboardPeriodId(event.target.value)}
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
                onChange={(event) => setAdmissionOnboardCohortId(event.target.value)}
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
              onChange={(event) => setPeriodStatusInput(event.target.value as AdmissionPeriodStatus)}
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
              onChange={(event) => setBenchmarkActionIdInput(event.target.value)}
            />
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
                placeholder="Score (0-30)"
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
              void refreshAllAdmissionData();
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
  );
}
