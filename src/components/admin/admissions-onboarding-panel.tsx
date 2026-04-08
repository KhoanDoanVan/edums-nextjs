"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime, toErrorMessage } from "@/components/admin/format-utils";
import {
  getAdmissionApplications,
  getAdmissionFormOptions,
  getAdmissionPeriodById,
  getDynamicListByPath,
  processAdmissionOnboarding,
} from "@/lib/admin/service";
import type {
  AdmissionApplicationStatus,
  ApplicationListItem,
  AdmissionSelectionOption,
  PagedRows,
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

const admissionApplicationStatusLabels: Record<AdmissionApplicationStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  ENROLLED: "Đã nhập học",
  REJECTED: "Từ chối",
};

type SelectionOptionItem = {
  id: number;
  label: string;
};

type AdmissionOnboardingReadiness = {
  periodId: number;
  periodStatus: string;
  isPeriodClosed: boolean;
  approvedCount: number;
  hasStudentRole: boolean;
  hasGuardianRole: boolean;
  hasLecturerRole: boolean;
  checkedAt: string;
  canOnboard: boolean;
};

type OnboardingRunSummary = {
  periodId: number;
  enrolledCount: number;
  approvedRemaining: number;
  executedAt: string;
};

const toNormalizedUpperText = (value: unknown): string => {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
};

const parsePositiveInteger = (
  rawValue: string,
  fieldLabel: string,
): { value: number | null; message?: string } => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      value: null,
      message: `${fieldLabel} không hợp lệ.`,
    };
  }

  return { value: parsed };
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

const resolvePagedCount = <TItem,>(value: PagedRows<TItem>): number => {
  if (typeof value.totalElements === "number" && Number.isFinite(value.totalElements)) {
    return value.totalElements;
  }

  return value.rows.length;
};

const toSelectionOptionItems = (
  rows: AdmissionSelectionOption[],
  fallbackPrefix: string,
): SelectionOptionItem[] => {
  return rows
    .map((row) => {
      const id = Number(row.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      const label =
        (typeof row.periodName === "string" && row.periodName.trim()) ||
        (typeof row.cohortName === "string" && row.cohortName.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        (typeof row.label === "string" && row.label.trim()) ||
        (typeof row.code === "string" && row.code.trim()) ||
        `${fallbackPrefix} #${id}`;

      return { id, label };
    })
    .filter((item): item is SelectionOptionItem => item !== null);
};

const toAdmissionApplicationStatusLabel = (value?: string): string => {
  if (!value) {
    return "-";
  }

  const normalized = toNormalizedUpperText(value) as AdmissionApplicationStatus;
  return admissionApplicationStatusLabels[normalized] || value;
};

const getAdmissionApplicationStatusBadgeClass = (status?: string): string => {
  const normalized = toNormalizedUpperText(status);

  if (normalized === "APPROVED" || normalized === "ENROLLED") {
    return "border-[#9fd6b7] bg-[#eefaf3] text-[#2f7b4f]";
  }

  if (normalized === "REJECTED") {
    return "border-[#e3b1b1] bg-[#fff2f2] text-[#b03d3d]";
  }

  return "border-[#f1d18d] bg-[#fff8ea] text-[#9a6c22]";
};

const getOnboardingReadiness = async (
  token: string,
  periodId: number,
): Promise<AdmissionOnboardingReadiness> => {
  const [approvedApplications, roles, periodDetail] = await Promise.all([
    getAdmissionApplications(token, {
      periodId,
      status: "APPROVED",
      page: 0,
      size: 500,
    }),
    getDynamicListByPath("/api/v1/roles", token),
    getAdmissionPeriodById(periodId, token),
  ]);

  const roleNames = new Set(
    roles.rows
      .map((row) => toNormalizedUpperText(row.roleName ?? row.role ?? row.name))
      .filter((name) => name.length > 0),
  );

  const approvedCount = resolvePagedCount(approvedApplications);
  const hasStudentRole = roleNames.has("STUDENT");
  const hasGuardianRole = roleNames.has("GUARDIAN");
  const hasLecturerRole = roleNames.has("LECTURER");
  const rawPeriodStatus = periodDetail.status;
  const periodStatus =
    typeof rawPeriodStatus === "number"
      ? rawPeriodStatus === 3
        ? "CLOSED"
        : rawPeriodStatus === 2
          ? "OPEN"
          : rawPeriodStatus === 1
            ? "PAUSED"
            : rawPeriodStatus === 0
              ? "UPCOMING"
              : "UNKNOWN"
      : toNormalizedUpperText(rawPeriodStatus || "");
  const isPeriodClosed = periodStatus === "CLOSED";
  const canOnboard =
    approvedCount > 0 &&
    hasStudentRole &&
    hasGuardianRole &&
    hasLecturerRole &&
    isPeriodClosed;

  return {
    periodId,
    periodStatus: periodStatus || "UNKNOWN",
    isPeriodClosed,
    approvedCount,
    hasStudentRole,
    hasGuardianRole,
    hasLecturerRole,
    checkedAt: new Date().toISOString(),
    canOnboard,
  };
};

export function AdmissionsOnboardingPanel({
  authorization,
  onNavigateToAdmissions,
}: {
  authorization?: string;
  onNavigateToAdmissions?: () => void;
}) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [periodOptions, setPeriodOptions] = useState<SelectionOptionItem[]>([]);
  const [majorOptions, setMajorOptions] = useState<SelectionOptionItem[]>([]);
  const [applicationRows, setApplicationRows] = useState<PagedRows<ApplicationListItem>>({
    rows: [],
  });
  const [periodIdInput, setPeriodIdInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [majorIdInput, setMajorIdInput] = useState("");
  const [statusInput, setStatusInput] = useState<AdmissionApplicationStatus | "">("APPROVED");
  const [pageInput, setPageInput] = useState("0");
  const [sizeInput, setSizeInput] = useState("20");
  const [readiness, setReadiness] = useState<AdmissionOnboardingReadiness | null>(null);
  const [runSummary, setRunSummary] = useState<OnboardingRunSummary | null>(null);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const selectedPeriodLabel = useMemo(() => {
    const selected = periodOptions.find((item) => String(item.id) === periodIdInput);
    return selected ? selected.label : "-";
  }, [periodIdInput, periodOptions]);

  const onboardingStatusSummary = useMemo(() => {
    const summary: Record<AdmissionApplicationStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      ENROLLED: 0,
      REJECTED: 0,
    };

    applicationRows.rows.forEach((row) => {
      const normalized = toNormalizedUpperText(row.status) as AdmissionApplicationStatus;
      if (normalized in summary) {
        summary[normalized] += 1;
      }
    });

    return summary;
  }, [applicationRows.rows]);

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

  const resolveSelectedPeriodId = (): number | null => {
    const periodParsed = parsePositiveInteger(periodIdInput, "Kỳ tuyển sinh");
    if (!periodParsed.value) {
      setErrorMessage(periodParsed.message || "Kỳ tuyển sinh không hợp lệ.");
      return null;
    }

    return periodParsed.value;
  };

  const loadOnboardingApplications = async (
    overrides?: {
      periodId?: string;
      keyword?: string;
      majorId?: string;
      status?: AdmissionApplicationStatus | "";
      page?: string;
      size?: string;
    },
  ) => {
    if (!authorization) {
      throw new Error("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
    }

    const periodRaw = overrides?.periodId ?? periodIdInput;
    const periodParsed = parsePositiveInteger(periodRaw, "Kỳ tuyển sinh");
    if (!periodParsed.value) {
      throw new Error(periodParsed.message || "Kỳ tuyển sinh không hợp lệ.");
    }

    const keywordValue = (overrides?.keyword ?? keywordInput).trim();
    const majorValue = overrides?.majorId ?? majorIdInput;
    const statusValue = overrides?.status ?? statusInput;
    const pageValue = overrides?.page ?? pageInput;
    const sizeValue = overrides?.size ?? sizeInput;

    const parsedPage = parseOptionalNonNegativeInteger(pageValue);
    if (pageValue.trim() && parsedPage === undefined) {
      throw new Error("Trang phải là số nguyên >= 0.");
    }

    const parsedSize = parseOptionalPositiveInteger(sizeValue);
    if (sizeValue.trim() && parsedSize === undefined) {
      throw new Error("Số lượng mỗi trang phải là số nguyên > 0.");
    }

    const rows = await getAdmissionApplications(authorization, {
      periodId: periodParsed.value,
      keyword: keywordValue || undefined,
      majorId: parseOptionalPositiveInteger(majorValue),
      status: statusValue || undefined,
      page: parsedPage ?? 0,
      size: parsedSize ?? 20,
      sortBy: "approvalDate",
      sortDirection: "DESC",
    });

    setApplicationRows(rows);
  };

  useEffect(() => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    void runAction(async () => {
      const formOptions = await getAdmissionFormOptions(authorization);

      const nextPeriodOptions = toSelectionOptionItems(formOptions.periods, "Kỳ tuyển sinh");
      const nextMajorOptions = toSelectionOptionItems(formOptions.majors, "Ngành");
      const seedPeriodId = nextPeriodOptions[0] ? String(nextPeriodOptions[0].id) : "";

      setPeriodOptions(nextPeriodOptions);
      setMajorOptions(nextMajorOptions);
      setPeriodIdInput((prev) => prev || seedPeriodId);

      if (seedPeriodId) {
        const initialRows = await getAdmissionApplications(authorization, {
          periodId: Number(seedPeriodId),
          status: "APPROVED",
          page: 0,
          size: 20,
          sortBy: "approvalDate",
          sortDirection: "DESC",
        });
        setApplicationRows(initialRows);
      } else {
        setApplicationRows({ rows: [] });
      }
    });
  }, [authorization]);

  const handleCheckReadiness = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const periodId = resolveSelectedPeriodId();
    if (!periodId) {
      return;
    }

    await runAction(async () => {
      const nextReadiness = await getOnboardingReadiness(authorization, periodId);
      setReadiness(nextReadiness);
      setRunSummary(null);
      setShowConfirmStep(false);
      setConfirmChecked(false);

      if (nextReadiness.approvedCount === 0) {
        setErrorMessage("Kỳ tuyển sinh hiện chưa có hồ sơ đã duyệt để chốt nhập học.");
        return;
      }

      if (!nextReadiness.hasStudentRole || !nextReadiness.hasGuardianRole) {
        setErrorMessage(
          "Thiếu role bắt buộc STUDENT hoặc GUARDIAN. Vui lòng kiểm tra dữ liệu hệ thống.",
        );
        return;
      }

      if (!nextReadiness.hasLecturerRole) {
        setErrorMessage(
          "Thiếu role bắt buộc LECTURER. Vui lòng kiểm tra dữ liệu hệ thống.",
        );
        return;
      }

      if (!nextReadiness.isPeriodClosed) {
        setErrorMessage("Chỉ có thể chốt nhập học khi kỳ tuyển sinh đã đóng (CLOSED).");
        return;
      }

      setSuccessMessage(
        `Đủ điều kiện chốt nhập học: ${nextReadiness.approvedCount} hồ sơ đã duyệt, kỳ hiện tại ở trạng thái CLOSED.`,
      );
    });
  };

  const handleOpenConfirmStep = () => {
    if (!readiness?.canOnboard) {
      setErrorMessage("Chưa đủ điều kiện để mở bước xác nhận chốt.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setShowConfirmStep(true);
  };

  const handleRefreshData = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    await runAction(async () => {
      const formOptions = await getAdmissionFormOptions(authorization);

      const nextPeriodOptions = toSelectionOptionItems(formOptions.periods, "Kỳ tuyển sinh");
      const nextMajorOptions = toSelectionOptionItems(formOptions.majors, "Ngành");

      setPeriodOptions(nextPeriodOptions);
      setMajorOptions(nextMajorOptions);

      const selectedPeriodId = Number(periodIdInput);
      if (Number.isInteger(selectedPeriodId) && selectedPeriodId > 0) {
        const latestReadiness = await getOnboardingReadiness(authorization, selectedPeriodId);
        setReadiness(latestReadiness);
        await loadOnboardingApplications();
      }

      setShowConfirmStep(false);
      setConfirmChecked(false);
      setSuccessMessage("Đã làm mới dữ liệu.");
    });
  };

  const handleApplyFilters = async () => {
    await runAction(async () => {
      await loadOnboardingApplications({
        page: pageInput,
        size: sizeInput,
      });
      setSuccessMessage("Đã cập nhật danh sách hồ sơ.");
    });
  };

  const handleResetFilters = async () => {
    setKeywordInput("");
    setMajorIdInput("");
    setStatusInput("APPROVED");
    setPageInput("0");
    setSizeInput("20");

    await runAction(async () => {
      await loadOnboardingApplications({
        keyword: "",
        majorId: "",
        status: "APPROVED",
        page: "0",
        size: "20",
      });
      setSuccessMessage("Đã đưa bộ lọc về mặc định cho chốt nhập học.");
    });
  };

  const handleOnboarding = async () => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    if (!confirmChecked) {
      setErrorMessage("Vui lòng xác nhận trước khi chốt nhập học.");
      return;
    }

    const periodId = resolveSelectedPeriodId();
    if (!periodId) {
      return;
    }

    await runAction(async () => {
      const latestReadiness = await getOnboardingReadiness(authorization, periodId);
      setReadiness(latestReadiness);

      if (!latestReadiness.canOnboard) {
        if (latestReadiness.approvedCount === 0) {
          setErrorMessage("Kỳ tuyển sinh hiện chưa có hồ sơ đã duyệt để chốt nhập học.");
          return;
        }

        if (!latestReadiness.hasStudentRole || !latestReadiness.hasGuardianRole) {
          setErrorMessage(
            "Thiếu role bắt buộc STUDENT hoặc GUARDIAN. Vui lòng kiểm tra dữ liệu hệ thống.",
          );
          return;
        }

        if (!latestReadiness.hasLecturerRole) {
          setErrorMessage(
            "Thiếu role bắt buộc LECTURER. Vui lòng kiểm tra dữ liệu hệ thống.",
          );
          return;
        }

        if (!latestReadiness.isPeriodClosed) {
          setErrorMessage("Chỉ có thể chốt nhập học khi kỳ tuyển sinh đã đóng (CLOSED).");
          return;
        }
      }

      await processAdmissionOnboarding(periodId, authorization).catch((error: unknown) => {
        const message = toErrorMessage(error);
        const rawMessage = error instanceof Error ? error.message.toLowerCase() : "";
        const normalizedMessage = message.toLowerCase();

        if (
          rawMessage.includes("[api 500]") ||
          rawMessage.includes("internal server error") ||
          normalizedMessage.includes("500")
        ) {
          throw new Error(
            "Hệ thống đang lỗi khi chốt nhập học (500). Vui lòng kiểm tra điều kiện kỳ CLOSED, role và log backend.",
          );
        }
        throw error;
      });

      const [enrolledRows, approvedRows] = await Promise.all([
        getAdmissionApplications(authorization, {
          periodId,
          status: "ENROLLED",
          page: 0,
          size: 500,
        }),
        getAdmissionApplications(authorization, {
          periodId,
          status: "APPROVED",
          page: 0,
          size: 500,
        }),
      ]);

      setRunSummary({
        periodId,
        enrolledCount: resolvePagedCount(enrolledRows),
        approvedRemaining: resolvePagedCount(approvedRows),
        executedAt: new Date().toISOString(),
      });
      await loadOnboardingApplications({
        periodId: String(periodId),
      });
      setShowConfirmStep(false);
      setConfirmChecked(false);
      setSuccessMessage(`Đã chốt nhập học kỳ #${periodId}.`);
    });
  };

  return (
    <div className="space-y-4">
      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>Chốt Nhập Học Tuyển Sinh</h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="rounded-[6px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-sm text-[#355970]">
            Màn hình chuyên biệt để chuyển hồ sơ đã duyệt sang trạng thái nhập học và sinh tài
            khoản/hồ sơ sinh viên - phụ huynh.
          </p>

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

          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f75]">
              Thông Tin Chốt
            </p>
            <div className="grid gap-2 sm:grid-cols-1">
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={periodIdInput}
                onChange={(event) => {
                  const nextPeriodId = event.target.value;
                  setPeriodIdInput(nextPeriodId);
                  setPageInput("0");
                  setReadiness(null);
                  setRunSummary(null);
                  setShowConfirmStep(false);
                  setConfirmChecked(false);

                  if (!nextPeriodId) {
                    setApplicationRows({ rows: [] });
                    return;
                  }

                  void runAction(async () => {
                    await loadOnboardingApplications({
                      periodId: nextPeriodId,
                      page: "0",
                    });
                  });
                }}
              >
                <option value="">Chọn kỳ tuyển sinh</option>
                {periodOptions.map((option) => (
                  <option key={`onboard-period-${option.id}`} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCheckReadiness();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Kiểm tra điều kiện
              </button>
              <button
                type="button"
                onClick={handleOpenConfirmStep}
                disabled={isWorking || !readiness?.canOnboard}
                className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                Chốt nhập học
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f75]">
                Danh Sách Hồ Sơ Để Chốt
              </p>
              <p className="text-xs text-[#4f6d82]">
                Kỳ đang lọc: <span className="font-semibold text-[#1a4f75]">{selectedPeriodLabel}</span>
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Từ khóa (họ tên, email, SĐT, CCCD)"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
              />
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={majorIdInput}
                onChange={(event) => setMajorIdInput(event.target.value)}
              >
                <option value="">Tất cả ngành</option>
                {majorOptions.map((option) => (
                  <option key={`onboard-major-${option.id}`} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                value={statusInput}
                onChange={(event) =>
                  setStatusInput(event.target.value as AdmissionApplicationStatus | "")
                }
              >
                <option value="">Tất cả trạng thái</option>
                {admissionApplicationStatusOptions.map((status) => (
                  <option key={`onboard-status-${status}`} value={status}>
                    {toAdmissionApplicationStatusLabel(status)}
                  </option>
                ))}
              </select>
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Trang (>= 0)"
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
              />
              <input
                className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                placeholder="Số dòng (> 0)"
                value={sizeInput}
                onChange={(event) => setSizeInput(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleApplyFilters();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Áp dụng bộ lọc
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleResetFilters();
                }}
                disabled={isWorking}
                className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Đặt lại mặc định
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <p className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                Chờ duyệt:{" "}
                <span className="font-semibold text-[#1a4f75]">{onboardingStatusSummary.PENDING}</span>
              </p>
              <p className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                Đã duyệt:{" "}
                <span className="font-semibold text-[#1a4f75]">{onboardingStatusSummary.APPROVED}</span>
              </p>
              <p className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                Đã nhập học:{" "}
                <span className="font-semibold text-[#1a4f75]">{onboardingStatusSummary.ENROLLED}</span>
              </p>
              <p className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#355970]">
                Từ chối:{" "}
                <span className="font-semibold text-[#1a4f75]">{onboardingStatusSummary.REJECTED}</span>
              </p>
            </div>

            <p className="text-xs text-[#4f6d82]">
              Hiển thị {applicationRows.rows.length} hồ sơ, tổng {resolvePagedCount(applicationRows)} hồ
              sơ phù hợp bộ lọc.
            </p>

            <div className="overflow-x-auto rounded-[6px] border border-[#d7e7f3] bg-white">
              <table className="min-w-full divide-y divide-[#d7e7f3] text-left text-sm">
                <thead className="bg-[#f0f7fc] text-[#1a4f75]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Mã</th>
                    <th className="px-3 py-2 font-semibold">Họ tên</th>
                    <th className="px-3 py-2 font-semibold">Ngành / Khối</th>
                    <th className="px-3 py-2 font-semibold">Tổng điểm</th>
                    <th className="px-3 py-2 font-semibold">Trạng thái</th>
                    <th className="px-3 py-2 font-semibold">Ngày duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef4f8]">
                  {applicationRows.rows.length ? (
                    applicationRows.rows.map((row) => (
                      <tr key={`onboard-application-${row.id}`} className="text-[#355970]">
                        <td className="px-3 py-2 font-medium text-[#1a4f75]">#{row.id}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-[#1a4f75]">{row.fullName || "-"}</p>
                          <p className="text-xs text-[#5a7589]">{row.phone || row.email || "-"}</p>
                        </td>
                        <td className="px-3 py-2">
                          <p>{row.majorName || "-"}</p>
                          <p className="text-xs text-[#5a7589]">{row.blockName || "-"}</p>
                        </td>
                        <td className="px-3 py-2">
                          {typeof row.totalScore === "number" ? row.totalScore : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex min-w-[98px] items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold ${getAdmissionApplicationStatusBadgeClass(
                              row.status,
                            )}`}
                          >
                            {toAdmissionApplicationStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#5a7589]">
                          {formatDateTime(row.approvalDate || "")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-4 text-sm text-[#4f6d82]" colSpan={6}>
                        Không có hồ sơ phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {readiness ? (
            <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3 text-sm text-[#355970]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f75]">
                Sẵn Sàng Chốt
              </p>
              <p>Kỳ tuyển sinh: {selectedPeriodLabel}</p>
              <p>Trạng thái kỳ: {readiness.periodStatus}</p>
              <p>Hồ sơ đã duyệt: {readiness.approvedCount}</p>
              <p>
                Role bắt buộc: STUDENT {readiness.hasStudentRole ? "OK" : "Thiếu"} - GUARDIAN{" "}
                {readiness.hasGuardianRole ? "OK" : "Thiếu"} - LECTURER{" "}
                {readiness.hasLecturerRole ? "OK" : "Thiếu"}
              </p>
              <p className={readiness.isPeriodClosed ? "text-[#2f7b4f]" : "text-[#9f2f2f]"}>
                {readiness.isPeriodClosed
                  ? "Kỳ tuyển sinh đã CLOSED, có thể chốt nhập học."
                  : "Kỳ tuyển sinh chưa CLOSED, chưa thể chốt nhập học."}
              </p>
              <p className="text-xs text-[#5a7589]">
                Thời điểm kiểm tra: {formatDateTime(readiness.checkedAt)}
              </p>
            </section>
          ) : null}

          {runSummary ? (
            <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3 text-sm text-[#355970]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f75]">
                Kết Quả Sau Chốt
              </p>
              <p>Đã chạy cho kỳ #{runSummary.periodId}</p>
              <p>Hồ sơ ENROLLED hiện tại: {runSummary.enrolledCount}</p>
              <p>Hồ sơ APPROVED còn lại: {runSummary.approvedRemaining}</p>
              <p className="text-[#9f2f2f]">
                Cảnh báo: Có thể có hồ sơ bị bỏ qua do trùng `national_id`. Nếu APPROVED còn lại
                &gt; 0, vui lòng rà soát thủ công.
              </p>
              <p className="text-xs text-[#5a7589]">
                Thời điểm chạy: {formatDateTime(runSummary.executedAt)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleRefreshData();
                  }}
                  disabled={isWorking}
                  className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Làm mới dữ liệu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToAdmissions?.();
                  }}
                  disabled={isWorking || !onNavigateToAdmissions}
                  className="h-10 rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  Quay lại duyệt hồ sơ
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      {showConfirmStep ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
          onClick={() => {
            if (isWorking) {
              return;
            }
            setShowConfirmStep(false);
            setConfirmChecked(false);
          }}
        >
          <div
            className="w-full max-w-[620px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
              <h3 className="text-[20px] font-semibold text-[#154f75]">Xác nhận chốt nhập học</h3>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmStep(false);
                  setConfirmChecked(false);
                }}
                className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                disabled={isWorking}
                aria-label="Đóng popup xác nhận chốt"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 px-5 py-4 text-sm text-[#284a60]">
              <p>
                Bạn sắp chạy chốt nhập học cho <span className="font-semibold">{selectedPeriodLabel}</span>.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <p className="rounded-[6px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-xs">
                  APPROVED hiện tại: <span className="font-semibold">{readiness?.approvedCount ?? 0}</span>
                </p>
                <p className="rounded-[6px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-xs">
                  Trạng thái kỳ: <span className="font-semibold">{readiness?.periodStatus ?? "-"}</span>
                </p>
                <p className="rounded-[6px] border border-[#d7e7f3] bg-[#f8fcff] px-3 py-2 text-xs">
                  Sẵn sàng chốt: <span className="font-semibold">{readiness?.canOnboard ? "Có" : "Không"}</span>
                </p>
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(event) => setConfirmChecked(event.target.checked)}
                  disabled={isWorking}
                />
                Tôi xác nhận đã kiểm tra điều kiện kỳ tuyển sinh và đồng ý chốt nhập học
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#d2e4f1] px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmStep(false);
                  setConfirmChecked(false);
                }}
                disabled={isWorking}
                className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleOnboarding();
                }}
                disabled={isWorking || !confirmChecked}
                className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                {isWorking ? "Đang xử lý..." : "Xác nhận chốt"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
