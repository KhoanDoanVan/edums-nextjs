"use client";

import { useMemo, useState } from "react";
import {
  createGradeReport,
  deleteGradeReport,
  getGradeComponentsByCourse,
  getGradeReportById,
  getSectionGradeReports,
  getStudentGradeReports,
  updateGradeReport,
} from "@/lib/admin/service";
import { toErrorMessage } from "@/components/admin/format-utils";
import { buildColumns, toColumnLabel, toDisplayValue } from "@/components/admin/table-utils";
import type {
  DynamicRow,
  GradeReportItem,
  GradeReportStatus,
} from "@/lib/admin/types";

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

const gradeReportStatusOptions: GradeReportStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "LOCKED",
];

type GradeComponentOption = {
  id: number;
  componentName: string;
  weightPercentage?: number;
};

type GradeDetailInputRow = {
  componentId: string;
  score: string;
};

const toGradeComponentOptions = (rows: DynamicRow[]): GradeComponentOption[] => {
  return rows
    .map((row) => {
      const id = Number(row.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      const weight =
        typeof row.weightPercentage === "number"
          ? row.weightPercentage
          : Number(row.weightPercentage || 0) || undefined;

      const option: GradeComponentOption = {
        id,
        componentName:
          (typeof row.componentName === "string" && row.componentName.trim()) ||
          `Component #${id}`,
      };

      if (weight !== undefined) {
        option.weightPercentage = weight;
      }

      return option;
    })
    .filter((item): item is GradeComponentOption => item !== null);
};

export function GradeManagementPanel({
  authorization,
}: {
  authorization?: string;
}) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [gradeRows, setGradeRows] = useState<DynamicRow[]>([]);
  const [gradeDetail, setGradeDetail] = useState<GradeReportItem | null>(null);
  const [gradeComponentOptions, setGradeComponentOptions] = useState<
    GradeComponentOption[]
  >([]);
  const [gradeScoreByComponentId, setGradeScoreByComponentId] = useState<
    Record<number, string>
  >({});
  const [gradeSectionIdInput, setGradeSectionIdInput] = useState("");
  const [gradeStudentIdInput, setGradeStudentIdInput] = useState("");
  const [gradeCourseIdInput, setGradeCourseIdInput] = useState("");
  const [gradeReportIdInput, setGradeReportIdInput] = useState("");
  const [gradeRegistrationIdInput, setGradeRegistrationIdInput] = useState("");
  const [gradeDetailInputRows, setGradeDetailInputRows] = useState<GradeDetailInputRow[]>(
    [{ componentId: "", score: "" }],
  );
  const [gradeStatusInput, setGradeStatusInput] = useState<GradeReportStatus>("DRAFT");

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

  const requireAuthorization = (): string | null => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return null;
    }

    return authorization;
  };

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

  const parsePositiveInteger = (
    rawValue: string,
    fieldLabel: string,
  ): number | null => {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setErrorMessage(`${fieldLabel} không hop le.`);
      return null;
    }

    return parsed;
  };

  const handleLoadGradeReports = async () => {
    const token = requireAuthorization();
    const sectionId = parsePositiveInteger(gradeSectionIdInput, "Mã lớp học phần");
    if (!token || !sectionId) {
      return;
    }

    await runAction(async () => {
      const data = await getSectionGradeReports(sectionId, token);
      setGradeRows(data);
      setSuccessMessage(`Đã tải ${data.length} bản ghi diem cho section ${sectionId}.`);
    });
  };

  const handleLoadGradeReportsByStudent = async () => {
    const token = requireAuthorization();
    const studentId = parsePositiveInteger(gradeStudentIdInput, "Mã sinh viên");
    if (!token || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getStudentGradeReports(studentId, token);
      setGradeRows(data);
      setSuccessMessage(`Đã tải ${data.length} bản ghi diem cho student ${studentId}.`);
    });
  };

  const handleLoadGradeComponentsByCourse = async () => {
    const token = requireAuthorization();
    const courseId = parsePositiveInteger(gradeCourseIdInput, "Mã môn học");
    if (!token || !courseId) {
      return;
    }

    await runAction(async () => {
      const data = await getGradeComponentsByCourse(courseId, token);
      const options = toGradeComponentOptions(data);
      setGradeComponentOptions(options);
      setGradeScoreByComponentId((prev) => {
        const next: Record<number, string> = {};
        for (const item of options) {
          next[item.id] = prev[item.id] || "";
        }
        return next;
      });
      setSuccessMessage(`Đã tải ${options.length} thành phần điểm của môn học #${courseId}.`);
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

  const handleLoadGradeDetail = async () => {
    const token = requireAuthorization();
    const gradeReportId = parsePositiveInteger(gradeReportIdInput, "Mã bảng điểm");
    if (!token || !gradeReportId) {
      return;
    }

    await runAction(async () => {
      const detail = await getGradeReportById(gradeReportId, token);
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
      setSuccessMessage(`Đã tải chi tiết bảng điểm #${gradeReportId}.`);
    });
  };

  const handleUpsertGradeReport = async () => {
    const token = requireAuthorization();
    if (!token) {
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
          setErrorMessage(`Điểm của thành phần "${component.componentName}" không hop le.`);
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
          setErrorMessage(`Dòng #${index + 1}: component ID không hop le.`);
          return;
        }

        if (!Number.isFinite(score)) {
          setErrorMessage(`Dòng #${index + 1}: điểm không hop le.`);
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
      setErrorMessage("Grade details không duoc de trong.");
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
        await updateGradeReport(reportId, payload, token);
        setSuccessMessage(`Đã cập nhật bảng điểm #${reportId}.`);
      } else {
        await createGradeReport(payload, token);
        setSuccessMessage("Đã tạo bảng điểm mới.");
      }

      if (gradeSectionIdInput.trim()) {
        const sectionId = parsePositiveInteger(gradeSectionIdInput, "Mã lớp học phần");
        if (sectionId) {
          const data = await getSectionGradeReports(sectionId, token);
          setGradeRows(data);
        }
      }
    });
  };

  const handleDeleteGradeReport = async () => {
    const token = requireAuthorization();
    const gradeReportId = parsePositiveInteger(gradeReportIdInput, "Mã bảng điểm");
    if (!token || !gradeReportId) {
      return;
    }

    await runAction(async () => {
      await deleteGradeReport(gradeReportId, token);
      setGradeDetail(null);
      if (gradeSectionIdInput.trim()) {
        const sectionId = parsePositiveInteger(gradeSectionIdInput, "Mã lớp học phần");
        if (sectionId) {
          const data = await getSectionGradeReports(sectionId, token);
          setGradeRows(data);
        }
      }
      setSuccessMessage(`Đã xóa bảng điểm #${gradeReportId}.`);
    });
  };

  return (
    <div className="space-y-4">
      {(errorMessage || successMessage) && (
        <section className={contentCardClass}>
          <div className="space-y-2 px-4 py-3 text-sm">
            {errorMessage ? (
              <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p className="rounded-[4px] border border-[#bad9bd] bg-[#f2fff2] px-3 py-2 text-[#2f6d37]">
                {successMessage}
              </p>
            ) : null}
          </div>
        </section>
      )}

      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>Quản lý diem theo lop hoc phan</h2>
        </div>
        <div className="grid gap-4 px-4 py-4 xl:grid-cols-2">
          <section className="space-y-2 rounded-[8px] border border-[#c7dceb] bg-[#f8fcff] p-3">
            <h3 className="text-base font-semibold text-[#1a4f75]">Tra cứu theo section / student</h3>
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
              onChange={(event) => setGradeStatusInput(event.target.value as GradeReportStatus)}
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
                  <label key={component.id} className="grid gap-2 sm:grid-cols-[1fr_140px]">
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
                  Chưa tải components, nhập thủ công từng dòng componentId + score.
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
                        handleGradeDetailInputRowChange(index, "componentId", event.target.value)
                      }
                      inputMode="numeric"
                    />
                    <input
                      className="h-9 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Điểm"
                      value={row.score}
                      onChange={(event) =>
                        handleGradeDetailInputRowChange(index, "score", event.target.value)
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
                      x
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

      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>Bạng diem theo lop hoc phan</h2>
          <span className="text-sm font-medium text-[#396786]">{gradeRows.length} bản ghi</span>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#cfdfec] text-[#305970]">
                <th className="w-16 px-2 py-2">STT</th>
                {gradeColumns.map((column) => (
                  <th key={column} className="px-2 py-2">
                    {toColumnLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradeRows.map((row, index) => (
                <tr key={`dynamic-row-${index}`} className="border-b border-[#e0ebf4] text-[#3f6178]">
                  <td className="px-2 py-2 font-medium text-[#355970]">{index + 1}</td>
                  {gradeColumns.map((column) => (
                    <td key={`${index}-${column}`} className="max-w-[260px] px-2 py-2">
                      <span className="line-clamp-2">{toDisplayValue(row[column])}</span>
                    </td>
                  ))}
                </tr>
              ))}
              {gradeRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(gradeColumns.length + 1, 1)} className="px-2 py-4 text-center text-[#577086]">
                    Chưa co dữ liệu.
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
