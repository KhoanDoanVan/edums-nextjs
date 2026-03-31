"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  getPublicAdmissionActivePeriods,
  getPublicAdmissionBlocksByPeriodMajor,
  getPublicAdmissionMajorsByPeriod,
  lookupPublicAdmissions,
  submitPublicAdmissionApplication,
} from "@/lib/public-admission/service";
import type {
  PublicAdmissionApplyPayload,
  PublicLookupResult,
  PublicSelectOption,
} from "@/lib/public-admission/types";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Thao tác thất bại. Vui lòng thử lại.";
};

const emptyApplyForm = {
  fullName: "",
  dateOfBirth: "",
  email: "",
  phone: "",
  nationalId: "",
  address: "",
  totalScore: "",
};

export default function PublicAdmissionsPage() {
  const [periodOptions, setPeriodOptions] = useState<PublicSelectOption[]>([]);
  const [majorOptions, setMajorOptions] = useState<PublicSelectOption[]>([]);
  const [blockOptions, setBlockOptions] = useState<PublicSelectOption[]>([]);

  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedMajorId, setSelectedMajorId] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");

  const [applyForm, setApplyForm] = useState(emptyApplyForm);
  const [lookupNationalId, setLookupNationalId] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupRows, setLookupRows] = useState<PublicLookupResult[]>([]);

  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác tuyển sinh thất bại",
    successTitle: "Thao tác tuyển sinh thành công",
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
          return majors[0] ? String(majors[0].id) : "";
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
          return blocks[0] ? String(blocks[0].id) : "";
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

  const canSubmitApply = useMemo(() => {
    return (
      selectedPeriodId &&
      selectedMajorId &&
      selectedBlockId &&
      applyForm.fullName.trim() &&
      applyForm.dateOfBirth &&
      applyForm.email.trim() &&
      applyForm.phone.trim() &&
      applyForm.nationalId.trim() &&
      applyForm.address.trim() &&
      applyForm.totalScore.trim()
    );
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
      !Number.isInteger(majorId) ||
      !Number.isInteger(blockId)
    ) {
      setErrorMessage("Vui lòng chọn kỳ tuyển sinh, ngành và khối hợp lệ.");
      return;
    }

    if (!Number.isFinite(totalScore) || totalScore < 0 || totalScore > 30) {
      setErrorMessage("Tổng điểm phải nằm trong khoảng 0 đến 30.");
      return;
    }

    const payload: PublicAdmissionApplyPayload = {
      fullName: applyForm.fullName.trim(),
      dateOfBirth: applyForm.dateOfBirth,
      email: applyForm.email.trim(),
      phone: applyForm.phone.trim(),
      nationalId: applyForm.nationalId.trim(),
      address: applyForm.address.trim(),
      periodId,
      majorId,
      blockId,
      totalScore,
    };

    try {
      setIsSubmitting(true);
      await submitPublicAdmissionApplication(payload);
      setSuccessMessage("Nộp hồ sơ thành công. Vui lòng theo dõi trạng thái ở phần tra cứu.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const nationalId = lookupNationalId.trim();
    const phone = lookupPhone.trim();

    if (!nationalId || !phone) {
      setErrorMessage("Vui lòng nhập đủ CCCD và số điện thoại để tra cứu.");
      return;
    }

    try {
      setIsSubmitting(true);
      const rows = await lookupPublicAdmissions(nationalId, phone);
      setLookupRows(rows);
      setSuccessMessage(`Đã tìm thấy ${rows.length} hồ sơ phù hợp.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#edf1f5] px-4 py-6">
      <div className="mx-auto w-full max-w-[1100px] space-y-4">
        <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c5dced] px-4 py-3">
            <div>
              <h1 className="text-[24px] font-semibold text-[#1a4f75]">Cổng tuyển sinh công khai</h1>
              <p className="mt-1 text-sm text-[#4f6d82]">
                Nộp hồ sơ trực tuyến và tra cứu trạng thái theo CCCD + số điện thoại.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Link
                href="/login"
                className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-2 text-[#245977] transition hover:bg-[#edf6fd]"
              >
                Đăng nhập
              </Link>
            </div>
          </div>

          {(errorMessage || successMessage) && (
            <div className="space-y-2 px-4 py-3 text-sm">
              {errorMessage ? (
                <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                  {errorMessage}
                </p>
              ) : null}
              {successMessage && !shouldHideFeedbackMessage(successMessage) ? (
                <p className="rounded-[4px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                  {successMessage}
                </p>
              ) : null}
            </div>
          )}

          <div className="grid gap-4 px-4 py-4 xl:grid-cols-2">
            <section className="rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
              <h2 className="text-base font-semibold text-[#1a4f75]">Nộp hồ sơ tuyển sinh</h2>
              <form className="mt-3 space-y-2" onSubmit={handleSubmitApply}>
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
                  disabled={!canSubmitApply || isSubmitting}
                  className="h-10 w-full rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                >
                  {isSubmitting ? "Đang gửi hồ sơ..." : "Nộp hồ sơ"}
                </button>
              </form>
            </section>

            <section className="rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
              <h2 className="text-base font-semibold text-[#1a4f75]">Tra cứu hồ sơ</h2>
              <form className="mt-3 space-y-2" onSubmit={handleLookup}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="CCCD"
                    value={lookupNationalId}
                    onChange={(event) => setLookupNationalId(event.target.value)}
                  />
                  <input
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Số điện thoại"
                    value={lookupPhone}
                    onChange={(event) => setLookupPhone(event.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-[4px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                >
                  {isSubmitting ? "Đang tra cứu..." : "Tra cứu hồ sơ"}
                </button>
              </form>

              <div className="mt-3 rounded-[6px] border border-[#d7e7f3] bg-white p-2 text-sm text-[#355970]">
                <p>Periods: {periodOptions.length}</p>
                <p>Majors: {majorOptions.length}</p>
                <p>Blocks: {blockOptions.length}</p>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#cfdfec] text-[#305970]">
                      <th className="px-2 py-2">Họ tên</th>
                      <th className="px-2 py-2">CCCD</th>
                      <th className="px-2 py-2">Trạng thái</th>
                      <th className="px-2 py-2">Kỳ</th>
                      <th className="px-2 py-2">Ngành</th>
                      <th className="px-2 py-2">Khối</th>
                      <th className="px-2 py-2">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookupRows.map((item, index) => (
                      <tr
                        key={`lookup-row-${index + 1}`}
                        className="border-b border-[#e0ebf4] text-[#3f6178]"
                      >
                        <td className="px-2 py-2">{item.fullName || "-"}</td>
                        <td className="px-2 py-2">{item.nationalId || "-"}</td>
                        <td className="px-2 py-2">{item.status || "-"}</td>
                        <td className="px-2 py-2">{item.periodName || "-"}</td>
                        <td className="px-2 py-2">{item.majorName || "-"}</td>
                        <td className="px-2 py-2">{item.blockName || "-"}</td>
                        <td className="px-2 py-2">{item.totalScore ?? "-"}</td>
                      </tr>
                    ))}
                    {lookupRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-3 text-center text-[#577086]">
                          Chưa có dữ liệu tra cứu.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
