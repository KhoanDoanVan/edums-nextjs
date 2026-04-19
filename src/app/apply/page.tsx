"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import {
  getPublicAdmissionActivePeriods,
  getPublicAdmissionBlocksByPeriodMajor,
  getPublicAdmissionMajorsByPeriod,
  submitPublicAdmissionApplication,
} from "@/lib/public-admission/service";
import type {
  PublicAdmissionApplyPayload,
  PublicSelectOption,
} from "@/lib/public-admission/types";
import { toErrorMessage as toSharedErrorMessage } from "@/components/admin/format-utils";

const toErrorMessage = (error: unknown): string => {
  return toSharedErrorMessage(error);
};

const hasApiStatus = (error: unknown, statusCode: number): boolean => {
  return (
    error instanceof Error &&
    new RegExp(`\\[API\\s+${statusCode}\\]`, "i").test(error.message)
  );
};

const emptyApplyForm = {
  fullName: "",
  dateOfBirth: "",
  gender: true,
  email: "",
  phone: "",
  guardianPhone: "",
  nationalId: "",
  address: "",
  totalScore: "",
};

const nationalIdRegex = /^\d{12}$/;
const phoneRegex = /^(0[35789])[0-9]{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const apiStatusPattern = /\[API (\d{3})]/i;

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const normalizeMessage = (value: string): string => {
  return value
    .replace(/^Error:\s*/i, "")
    .replace(/^-\s*/, "")
    .trim();
};

const parseApiJsonFromErrorMessage = (message: string): Record<string, unknown> | null => {
  const jsonStart = message.indexOf("{");
  const jsonEnd = message.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return null;
  }

  const jsonPart = message.slice(jsonStart, jsonEnd + 1);
  try {
    const parsed = JSON.parse(jsonPart) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getFieldValidationMessage = (payload: Record<string, unknown>): string | null => {
  const data = payload.data;
  if (!isObject(data)) {
    return null;
  }

  const fieldLabels: Record<string, string> = {
    fullName: "Họ và tên",
    dateOfBirth: "Ngày sinh",
    gender: "Giới tính",
    email: "Email",
    phone: "Số điện thoại",
    guardianPhone: "Số điện thoại phụ huynh",
    nationalId: "CCCD",
    address: "Địa chỉ",
    periodId: "Kỳ tuyển sinh",
    majorId: "Ngành",
    blockId: "Khối",
    totalScore: "Tổng điểm",
  };

  const entries = Object.entries(data)
    .map(([key, value]) => {
      if (typeof value !== "string" || !value.trim()) {
        return null;
      }

      const label = fieldLabels[key] || key;
      return `${label}: ${value.trim()}`;
    })
    .filter((item): item is string => item !== null);

  if (entries.length === 0) {
    return null;
  }

  return entries.join(" | ");
};

const getPublicApplyBusinessMessage = (
  rawMessage: string,
  payload?: Record<string, unknown> | null,
): string | null => {
  const message = normalizeMessage(rawMessage).toLowerCase();
  const payloadMessage =
    payload && typeof payload.message === "string"
      ? normalizeMessage(payload.message).toLowerCase()
      : "";
  const merged = `${message} ${payloadMessage}`;

  if (
    merged.includes("existsbynationalidandadmissionperiodid") ||
    merged.includes("đã nộp") ||
    (merged.includes("national") && merged.includes("period") && merged.includes("exist"))
  ) {
    return "CCCD này đã nộp hồ sơ trong kỳ tuyển sinh đã chọn.";
  }

  if (
    merged.includes("illegal_state") ||
    merged.includes("đợt đã đóng") ||
    merged.includes("hết hạn") ||
    (merged.includes("period") && (merged.includes("closed") || merged.includes("expired")))
  ) {
    return "Đợt tuyển sinh không còn mở hoặc đã hết hạn nộp hồ sơ.";
  }

  if (merged.includes("period") && merged.includes("not found")) {
    return "Kỳ tuyển sinh không tồn tại.";
  }

  if (merged.includes("major") && merged.includes("not found")) {
    return "Ngành tuyển sinh không tồn tại.";
  }

  if (
    (merged.includes("block") || merged.includes("admission block")) &&
    merged.includes("not found")
  ) {
    return "Khối xét tuyển không tồn tại.";
  }

  if (
    merged.includes("benchmark") ||
    merged.includes("tổ hợp") ||
    merged.includes("combination")
  ) {
    return "Tổ hợp ngành - khối chưa được mở benchmark cho kỳ tuyển sinh này.";
  }

  return null;
};

const toApplyErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error) || !error.message) {
    return "Nộp hồ sơ thất bại. Vui lòng thử lại.";
  }

  const rawMessage = error.message;
  const payload = parseApiJsonFromErrorMessage(rawMessage);

  const fieldMessage = payload ? getFieldValidationMessage(payload) : null;
  if (fieldMessage) {
    return fieldMessage;
  }

  const businessMessage = getPublicApplyBusinessMessage(rawMessage, payload);
  if (businessMessage) {
    return businessMessage;
  }

  const payloadMessage =
    payload && typeof payload.message === "string"
      ? normalizeMessage(payload.message)
      : "";
  if (payloadMessage) {
    return payloadMessage;
  }

  const statusMatch = rawMessage.match(apiStatusPattern);
  if (statusMatch?.[1] === "409") {
    return "Yêu cầu bị từ chối do trạng thái dữ liệu hiện tại không hợp lệ.";
  }

  return toErrorMessage(error);
};

const findOptionLabelById = (rows: PublicSelectOption[], selectedId: string): string => {
  if (!selectedId) {
    return "-";
  }

  const matched = rows.find((item) => String(item.id) === selectedId);
  return matched?.label || "-";
};

export default function PublicAdmissionApplyPage() {
  const [periodOptions, setPeriodOptions] = useState<PublicSelectOption[]>([]);
  const [majorOptions, setMajorOptions] = useState<PublicSelectOption[]>([]);
  const [blockOptions, setBlockOptions] = useState<PublicSelectOption[]>([]);

  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedMajorId, setSelectedMajorId] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [applyForm, setApplyForm] = useState(emptyApplyForm);

  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Nộp hồ sơ tuyển sinh thất bại",
    successTitle: "Nộp hồ sơ tuyển sinh thành công",
  });

  useEffect(() => {
    let cancelled = false;

    const loadPeriods = async () => {
      try {
        setIsLoadingOptions(true);
        setErrorMessage("");
        const periods = await getPublicAdmissionActivePeriods();
        if (cancelled) {
          return;
        }

        setPeriodOptions(periods);
        setSelectedPeriodId((prev) => {
          if (prev && periods.some((item) => String(item.id) === prev)) {
            return prev;
          }
          return periods[0] ? String(periods[0].id) : "";
        });
        if (periods.length === 0) {
          setErrorMessage(
            "Hiện chưa có kỳ tuyển sinh đang mở hoặc sắp mở. Vui lòng liên hệ quản trị để cấu hình kỳ tuyển sinh.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          const message = toErrorMessage(error);
          if (hasApiStatus(error, 404)) {
            setErrorMessage(
              "Hệ thống chưa cấu hình API kỳ tuyển sinh công khai. Vui lòng liên hệ quản trị.",
            );
            return;
          }
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadPeriods();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMajors = async () => {
      const periodId = Number(selectedPeriodId);
      if (!Number.isInteger(periodId) || periodId <= 0) {
        setMajorOptions([]);
        setSelectedMajorId("");
        return;
      }

      try {
        setIsLoadingOptions(true);
        const majors = await getPublicAdmissionMajorsByPeriod(periodId);
        if (cancelled) {
          return;
        }

        setMajorOptions(majors);
        setSelectedMajorId((prev) => {
          if (prev && majors.some((item) => String(item.id) === prev)) {
            return prev;
          }
          return "";
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadMajors();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriodId]);

  useEffect(() => {
    let cancelled = false;

    const loadBlocks = async () => {
      const periodId = Number(selectedPeriodId);
      const majorId = Number(selectedMajorId);

      if (
        !Number.isInteger(periodId) ||
        periodId <= 0 ||
        !Number.isInteger(majorId) ||
        majorId <= 0
      ) {
        setBlockOptions([]);
        setSelectedBlockId("");
        return;
      }

      try {
        setIsLoadingOptions(true);
        const blocks = await getPublicAdmissionBlocksByPeriodMajor(periodId, majorId);
        if (cancelled) {
          return;
        }

        setBlockOptions(blocks);
        setSelectedBlockId((prev) => {
          if (prev && blocks.some((item) => String(item.id) === prev)) {
            return prev;
          }
          return "";
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadBlocks();

    return () => {
      cancelled = true;
    };
  }, [selectedMajorId, selectedPeriodId]);

  const validateApplyPayload = (
    payload: PublicAdmissionApplyPayload,
  ): string | null => {
    if (!payload.fullName.trim()) {
      return "Họ và tên không được để trống.";
    }
    if (payload.fullName.trim().length > 255) {
      return "Họ và tên không được vượt quá 255 ký tự.";
    }
    if (!payload.dateOfBirth) {
      return "Vui lòng chọn ngày sinh.";
    }

    const birthDate = new Date(payload.dateOfBirth);
    if (Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) {
      return "Ngày sinh phải là ngày trong quá khứ.";
    }
    if (typeof payload.gender !== "boolean") {
      return "Vui lòng chọn giới tính.";
    }
    if (!emailRegex.test(payload.email)) {
      return "Email không hợp lệ.";
    }
    if (!phoneRegex.test(payload.phone)) {
      return "Số điện thoại không hợp lệ (03/05/07/08/09 + 8 số).";
    }
    if (!phoneRegex.test(payload.guardianPhone)) {
      return "Số điện thoại phụ huynh không hợp lệ (03/05/07/08/09 + 8 số).";
    }
    if (!nationalIdRegex.test(payload.nationalId)) {
      return "CCCD phải gồm đúng 12 chữ số.";
    }
    if (!payload.address.trim()) {
      return "Địa chỉ không được để trống.";
    }
    if (!Number.isFinite(payload.totalScore) || payload.totalScore < 0 || payload.totalScore > 30) {
      return "Tổng điểm phải nằm trong khoảng 0 đến 30.";
    }
    return null;
  };

  const canSubmitApply = useMemo(() => {
    return Boolean(
      selectedPeriodId &&
        selectedMajorId &&
        selectedBlockId &&
        applyForm.fullName.trim() &&
        applyForm.dateOfBirth &&
        typeof applyForm.gender === "boolean" &&
        applyForm.email.trim() &&
        applyForm.phone.trim() &&
        applyForm.guardianPhone.trim() &&
        applyForm.nationalId.trim() &&
        applyForm.address.trim() &&
        applyForm.totalScore.trim(),
    );
  }, [applyForm, selectedBlockId, selectedMajorId, selectedPeriodId]);

  const missingApplyFields = useMemo(() => {
    const missing: string[] = [];
    if (!selectedPeriodId) {
      missing.push("kỳ tuyển sinh");
    }
    if (!selectedMajorId) {
      missing.push("ngành");
    }
    if (!selectedBlockId) {
      missing.push("khối");
    }
    if (!applyForm.fullName.trim()) {
      missing.push("họ và tên");
    }
    if (!applyForm.dateOfBirth) {
      missing.push("ngày sinh");
    }
    if (!applyForm.email.trim()) {
      missing.push("email");
    }
    if (!applyForm.phone.trim()) {
      missing.push("số điện thoại");
    }
    if (!applyForm.guardianPhone.trim()) {
      missing.push("số điện thoại phụ huynh");
    }
    if (!applyForm.nationalId.trim()) {
      missing.push("CCCD");
    }
    if (!applyForm.address.trim()) {
      missing.push("địa chỉ");
    }
    if (!applyForm.totalScore.trim()) {
      missing.push("tổng điểm");
    }
    return missing;
  }, [applyForm, selectedBlockId, selectedMajorId, selectedPeriodId]);

  const handleSubmitApply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const periodId = Number(selectedPeriodId);
    const majorId = Number(selectedMajorId);
    const blockId = Number(selectedBlockId);
    const totalScore = Number(applyForm.totalScore);

    if (
      !Number.isInteger(periodId) ||
      periodId <= 0 ||
      !Number.isInteger(majorId) ||
      majorId <= 0 ||
      !Number.isInteger(blockId) ||
      blockId <= 0
    ) {
      setErrorMessage("Vui lòng chọn kỳ tuyển sinh, ngành và khối hợp lệ.");
      return;
    }

    const payload: PublicAdmissionApplyPayload = {
      fullName: applyForm.fullName.trim(),
      dateOfBirth: applyForm.dateOfBirth,
      gender: applyForm.gender,
      email: applyForm.email.trim(),
      phone: applyForm.phone.trim(),
      guardianPhone: applyForm.guardianPhone.trim(),
      nationalId: applyForm.nationalId.trim(),
      address: applyForm.address.trim(),
      periodId,
      majorId,
      blockId,
      totalScore,
    };

    const validationMessage = validateApplyPayload(payload);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      await submitPublicAdmissionApplication(payload);
      setApplyForm(emptyApplyForm);
      setSuccessMessage("Nộp hồ sơ thành công. Vui lòng dùng mục tra cứu để theo dõi kết quả.");
    } catch (error) {
      setErrorMessage(toApplyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPeriodLabel = findOptionLabelById(periodOptions, selectedPeriodId);
  const selectedMajorLabel = findOptionLabelById(majorOptions, selectedMajorId);
  const selectedBlockLabel = findOptionLabelById(blockOptions, selectedBlockId);

  return (
    <main className="min-h-screen bg-[#edf1f5] px-4 py-6">
      <div className="mx-auto w-full max-w-[1100px] space-y-4">
        <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c5dced] px-4 py-3">
            <div>
              <h1 className="text-[24px] font-semibold text-[#1a4f75]">Nộp Hồ Sơ Tuyển Sinh</h1>
              <p className="mt-1 text-sm text-[#4f6d82]">
                Cổng nộp hồ sơ công khai. Không cần đăng nhập.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admissions"
                className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-2 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
              >
                Tra cứu hồ sơ
              </Link>
              <Link
                href="/login"
                className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-2 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
              >
                Đăng nhập quản trị
              </Link>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
              {(errorMessage || successMessage) && (
                <div className="mb-3 space-y-2 text-sm">
                  {errorMessage ? (
                    <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                      {errorMessage}
                    </p>
                  ) : null}
                  {successMessage ? (
                    <p className="rounded-[4px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                      {successMessage}
                    </p>
                  ) : null}
                </div>
              )}

              <form className="space-y-2" onSubmit={handleSubmitApply}>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={selectedPeriodId}
                    onChange={(event) => setSelectedPeriodId(event.target.value)}
                    disabled={isLoadingOptions}
                  >
                    <option value="">Chọn kỳ tuyển sinh</option>
                    {periodOptions.map((item) => (
                      <option key={`period-${item.id}`} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={selectedMajorId}
                    onChange={(event) => setSelectedMajorId(event.target.value)}
                    disabled={isLoadingOptions || !selectedPeriodId}
                  >
                    <option value="">Chọn ngành</option>
                    {majorOptions.map((item) => (
                      <option key={`major-${item.id}`} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={selectedBlockId}
                    onChange={(event) => setSelectedBlockId(event.target.value)}
                    disabled={isLoadingOptions || !selectedMajorId}
                  >
                    <option value="">Chọn khối xét tuyển</option>
                    {blockOptions.map((item) => (
                      <option key={`block-${item.id}`} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Họ và tên"
                    value={applyForm.fullName}
                    onChange={(event) =>
                      setApplyForm((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                  />
                  <input
                    type="date"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={applyForm.dateOfBirth}
                    onChange={(event) =>
                      setApplyForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    value={applyForm.gender ? "male" : "female"}
                    onChange={(event) =>
                      setApplyForm((prev) => ({
                        ...prev,
                        gender: event.target.value === "male",
                      }))
                    }
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Số điện thoại phụ huynh"
                    value={applyForm.guardianPhone}
                    onChange={(event) =>
                      setApplyForm((prev) => ({ ...prev, guardianPhone: event.target.value }))
                    }
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Email"
                    value={applyForm.email}
                    onChange={(event) =>
                      setApplyForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Số điện thoại"
                    value={applyForm.phone}
                    onChange={(event) =>
                      setApplyForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="CCCD (12 số)"
                    value={applyForm.nationalId}
                    onChange={(event) =>
                      setApplyForm((prev) => ({ ...prev, nationalId: event.target.value }))
                    }
                    inputMode="numeric"
                    maxLength={12}
                  />
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Tổng điểm (0-30)"
                    value={applyForm.totalScore}
                    onChange={(event) =>
                      setApplyForm((prev) => ({ ...prev, totalScore: event.target.value }))
                    }
                    inputMode="decimal"
                  />
                </div>

                <input
                  className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                  placeholder="Địa chỉ liên hệ"
                  value={applyForm.address}
                  onChange={(event) =>
                    setApplyForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {isSubmitting ? "Đang gửi hồ sơ..." : "Nộp hồ sơ"}
                </button>
                {!canSubmitApply ? (
                  <p className="text-xs text-[#8a5a1f]">
                    Còn thiếu: {missingApplyFields.join(", ")}.
                  </p>
                ) : null}
              </form>
            </section>

            <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
              <h2 className="text-base font-semibold text-[#1a4f75]">Thông tin đã chọn</h2>
              <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-sm text-[#355970]">
                <p>Kỳ tuyển sinh: {selectedPeriodLabel}</p>
                <p>Ngành: {selectedMajorLabel}</p>
                <p>Khối: {selectedBlockLabel}</p>
              </div>

              <div className="rounded-[6px] border border-[#d7e7f3] bg-white px-3 py-2 text-xs text-[#4f6d82]">
                <p>Số kỳ đang mở public: {periodOptions.length}</p>
                <p>Số ngành theo kỳ đã chọn: {majorOptions.length}</p>
                <p>Số khối theo ngành đã chọn: {blockOptions.length}</p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
