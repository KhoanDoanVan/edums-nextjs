"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import {
  createDynamicByPath,
  deleteDynamicByPath,
  getDynamicListByPath,
  patchDynamicByPath,
  updateDynamicByPath,
} from "@/lib/admin/service";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { formatDateTime, toErrorMessage } from "@/components/admin/format-utils";
import type { DynamicRow } from "@/lib/admin/types";

interface CourseSectionPanelProps {
  authorization?: string;
}

type SectionStatus = "DRAFT" | "OPEN" | "ONGOING" | "FINISHED" | "CANCELLED";

interface CourseSectionRow {
  id: number;
  sectionCode?: string;
  displayName?: string;
  courseId?: number;
  courseCode?: string;
  courseName?: string;
  lecturerId?: number;
  lecturerName?: string;
  semesterId?: number;
  semesterNumber?: number;
  academicYear?: string;
  maxCapacity?: number;
  status?: SectionStatus;
  createdAt?: string;
}

interface ScheduleRow {
  id: number;
  classroomId?: number;
  classroomName?: string;
  dayOfWeek?: number;
  dayOfWeekName?: string;
  startPeriod?: number;
  startPeriodTime?: string;
  endPeriod?: number;
  endPeriodTime?: string;
}

interface CourseSectionFormState {
  displayName: string;
  courseId: string;
  lecturerId: string;
  semesterId: string;
  maxCapacity: string;
  status: SectionStatus;
}

const emptyForm: CourseSectionFormState = {
  displayName: "",
  courseId: "",
  lecturerId: "",
  semesterId: "",
  maxCapacity: "60",
  status: "DRAFT",
};

const statusOptions: Array<{ value: SectionStatus; label: string }> = [
  { value: "DRAFT", label: "Nháp" },
  { value: "OPEN", label: "Mở đăng ký" },
  { value: "ONGOING", label: "Đang học" },
  { value: "FINISHED", label: "Kết thúc" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const weekdayLabels: Record<number, string> = {
  1: "Chủ nhật",
  2: "Thứ 2",
  3: "Thứ 3",
  4: "Thứ 4",
  5: "Thứ 5",
  6: "Thứ 6",
  7: "Thứ 7",
};

const formatSectionStatus = (status?: SectionStatus): string => {
  switch (status) {
    case "DRAFT":
      return "Nháp";
    case "OPEN":
      return "Mở đăng ký";
    case "ONGOING":
      return "Đang học";
    case "FINISHED":
      return "Kết thúc";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return "-";
  }
};

const getStatusBadgeClass = (status?: SectionStatus): string => {
  switch (status) {
    case "OPEN":
      return "border-[#8ed3ab] bg-[#eefbf2] text-[#1f7a43]";
    case "ONGOING":
      return "border-[#9bc7ec] bg-[#eef6ff] text-[#155c8f]";
    case "FINISHED":
      return "border-[#d3dce6] bg-[#f4f7fa] text-[#5f7282]";
    case "CANCELLED":
      return "border-[#efb0b0] bg-[#fff3f3] text-[#b24646]";
    default:
      return "border-[#d8c89c] bg-[#fff9eb] text-[#8a6714]";
  }
};

const getSemesterLabel = (
  semesterNumber?: number,
  academicYear?: string,
  semesterId?: number,
): string => {
  if (semesterNumber && academicYear) {
    return `Học kỳ ${semesterNumber} - ${academicYear}`;
  }

  if (semesterId) {
    return `Học kỳ #${semesterId}`;
  }

  return "Chưa gán học kỳ";
};

const normalizeKeyword = (value: string): string => {
  return value.trim().toLowerCase();
};

const toCourseSectionRow = (row: DynamicRow): CourseSectionRow | null => {
  const id = typeof row.id === "number" ? row.id : Number(row.id || 0);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return {
    id,
    sectionCode: typeof row.sectionCode === "string" ? row.sectionCode : undefined,
    displayName: typeof row.displayName === "string" ? row.displayName : undefined,
    courseId:
      typeof row.courseId === "number" ? row.courseId : Number(row.courseId || 0) || undefined,
    courseCode: typeof row.courseCode === "string" ? row.courseCode : undefined,
    courseName: typeof row.courseName === "string" ? row.courseName : undefined,
    lecturerId:
      typeof row.lecturerId === "number"
        ? row.lecturerId
        : Number(row.lecturerId || 0) || undefined,
    lecturerName:
      typeof row.lecturerName === "string" ? row.lecturerName : undefined,
    semesterId:
      typeof row.semesterId === "number"
        ? row.semesterId
        : Number(row.semesterId || 0) || undefined,
    semesterNumber:
      typeof row.semesterNumber === "number"
        ? row.semesterNumber
        : Number(row.semesterNumber || 0) || undefined,
    academicYear:
      typeof row.academicYear === "string" ? row.academicYear : undefined,
    maxCapacity:
      typeof row.maxCapacity === "number"
        ? row.maxCapacity
        : Number(row.maxCapacity || 0) || undefined,
    status: typeof row.status === "string" ? (row.status as SectionStatus) : undefined,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
  };
};

const toScheduleRow = (row: DynamicRow): ScheduleRow | null => {
  const id = typeof row.id === "number" ? row.id : Number(row.id || 0);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return {
    id,
    classroomId:
      typeof row.classroomId === "number"
        ? row.classroomId
        : Number(row.classroomId || 0) || undefined,
    classroomName:
      typeof row.classroomName === "string" ? row.classroomName : undefined,
    dayOfWeek:
      typeof row.dayOfWeek === "number"
        ? row.dayOfWeek
        : Number(row.dayOfWeek || 0) || undefined,
    dayOfWeekName:
      typeof row.dayOfWeekName === "string" ? row.dayOfWeekName : undefined,
    startPeriod:
      typeof row.startPeriod === "number"
        ? row.startPeriod
        : Number(row.startPeriod || 0) || undefined,
    startPeriodTime:
      typeof row.startPeriodTime === "string" ? row.startPeriodTime : undefined,
    endPeriod:
      typeof row.endPeriod === "number"
        ? row.endPeriod
        : Number(row.endPeriod || 0) || undefined,
    endPeriodTime:
      typeof row.endPeriodTime === "string" ? row.endPeriodTime : undefined,
  };
};

const buildScheduleLabel = (row: ScheduleRow): string => {
  const weekday =
    row.dayOfWeekName ||
    (row.dayOfWeek ? weekdayLabels[row.dayOfWeek] : undefined) ||
    "Chưa rõ ngày";
  const periods =
    row.startPeriod && row.endPeriod
      ? `Tiết ${row.startPeriod}-${row.endPeriod}`
      : "Chưa có tiết";
  const room = row.classroomName ? `Phòng ${row.classroomName}` : "Chưa có phòng";

  return [weekday, periods, room].join(" | ");
};

const hydrateFormFromRow = (row: CourseSectionRow | null): CourseSectionFormState => {
  if (!row) {
    return emptyForm;
  }

  return {
    displayName: row.displayName || "",
    courseId: row.courseId ? String(row.courseId) : "",
    lecturerId: row.lecturerId ? String(row.lecturerId) : "",
    semesterId: row.semesterId ? String(row.semesterId) : "",
    maxCapacity:
      typeof row.maxCapacity === "number" && row.maxCapacity > 0
        ? String(row.maxCapacity)
        : "60",
    status: row.status || "DRAFT",
  };
};

export const CourseSectionPanel = ({
  authorization,
}: CourseSectionPanelProps) => {
  const [rows, setRows] = useState<CourseSectionRow[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [courseOptions, setCourseOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [lecturerOptions, setLecturerOptions] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const [semesterOptions, setSemesterOptions] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [form, setForm] = useState<CourseSectionFormState>(emptyForm);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<CourseSectionRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const selectedSectionIdRef = useRef<number | null>(null);

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Thao tác lớp học phần thất bại",
    successTitle: "Thao tác lớp học phần thành công",
  });

  const selectedRow = useMemo(() => {
    return rows.find((row) => row.id === selectedSectionId) || null;
  }, [rows, selectedSectionId]);

  const semesterLabelMap = useMemo(() => {
    const entries = new Map<number, string>();

    semesterOptions.forEach((option) => {
      entries.set(option.id, option.label);
    });

    rows.forEach((row) => {
      if (row.semesterId && !entries.has(row.semesterId)) {
        entries.set(
          row.semesterId,
          getSemesterLabel(row.semesterNumber, row.academicYear, row.semesterId),
        );
      }
    });

    return entries;
  }, [rows, semesterOptions]);

  const filteredRows = useMemo(() => {
    const normalized = normalizeKeyword(keyword);

    return rows.filter((row) => {
      const matchesKeyword =
        !normalized ||
        [
          row.sectionCode,
          row.displayName,
          row.courseCode,
          row.courseName,
          row.lecturerName,
          row.semesterId ? String(row.semesterId) : "",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));

      const matchesStatus = !statusFilter || row.status === statusFilter;
      const matchesCourse = !courseFilter || String(row.courseId || "") === courseFilter;
      const matchesSemester =
        !semesterFilter || String(row.semesterId || "") === semesterFilter;

      return matchesKeyword && matchesStatus && matchesCourse && matchesSemester;
    });
  }, [courseFilter, keyword, rows, semesterFilter, statusFilter]);

  const loadReferenceData = useCallback(async () => {
    if (!authorization) {
      return;
    }

    try {
      const [courses, lecturers, periods] = await Promise.all([
        getDynamicListByPath("/api/v1/courses", authorization),
        getDynamicListByPath("/api/v1/lecturers", authorization, { page: 0, size: 100 }),
        getDynamicListByPath("/api/v1/semesters", authorization),
      ]);

      setCourseOptions(
        courses.rows
          .map((row) => {
            const id = Number(row.id || 0);
            if (!Number.isInteger(id) || id <= 0) {
              return null;
            }

            const courseCode =
              typeof row.courseCode === "string" ? row.courseCode.trim() : "";
            const courseName =
              typeof row.courseName === "string" ? row.courseName.trim() : "";

            return {
              id,
              label: [courseCode, courseName].filter(Boolean).join(" - ") || `Môn học #${id}`,
            };
          })
          .filter((row): row is { id: number; label: string } => row !== null),
      );

      setLecturerOptions(
        lecturers.rows
          .map((row) => {
            const id = Number(row.id || 0);
            if (!Number.isInteger(id) || id <= 0) {
              return null;
            }

            const fullName =
              typeof row.fullName === "string" ? row.fullName.trim() : "";
            const email = typeof row.email === "string" ? row.email.trim() : "";

            return {
              id,
              label: [fullName, email].filter(Boolean).join(" - ") || `Giảng viên #${id}`,
            };
          })
          .filter((row): row is { id: number; label: string } => row !== null),
      );

      const semesterMap = new Map<number, string>();
      periods.rows.forEach((row) => {
        const semesterId = Number(row.id || 0);
        if (!Number.isInteger(semesterId) || semesterId <= 0 || semesterMap.has(semesterId)) {
          return;
        }

        const semesterNumber =
          typeof row.semesterNumber === "number"
            ? row.semesterNumber
            : Number(row.semesterNumber || 0) || undefined;
        const academicYear =
          typeof row.academicYear === "string" ? row.academicYear : undefined;
        const displayName =
          typeof row.displayName === "string" ? row.displayName.trim() : "";
        const semesterLabel =
          displayName || getSemesterLabel(semesterNumber, academicYear, semesterId);

        semesterMap.set(semesterId, semesterLabel);
      });

      setSemesterOptions(
        Array.from(semesterMap.entries())
          .map(([id, label]) => ({ id, label }))
          .sort((first, second) => first.label.localeCompare(second.label, "vi")),
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }, [authorization]);

  const loadRows = useCallback(async (options?: {
    sectionIdToKeep?: number | null;
    courseFilterValue?: string;
    semesterFilterValue?: string;
  }) => {
    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");

      const sectionIdToKeep = options?.sectionIdToKeep;
      const selectedCourseId = Number(options?.courseFilterValue ?? "");
      const selectedSemesterId = Number(options?.semesterFilterValue ?? "");

      let path = "/api/v1/course-sections";
      if (Number.isInteger(selectedCourseId) && selectedCourseId > 0) {
        path = `/api/v1/course-sections/course/${selectedCourseId}`;
      } else if (Number.isInteger(selectedSemesterId) && selectedSemesterId > 0) {
        path = `/api/v1/course-sections/semester/${selectedSemesterId}`;
      }

      const response = await getDynamicListByPath(path, authorization);
      const nextRows = response.rows
        .map((row) => toCourseSectionRow(row))
        .filter((row): row is CourseSectionRow => row !== null)
        .sort((first, second) => {
          const semesterCompare = (second.semesterId || 0) - (first.semesterId || 0);
          if (semesterCompare !== 0) {
            return semesterCompare;
          }

          return (first.sectionCode || "").localeCompare(second.sectionCode || "", "vi");
        });

      setRows(nextRows);

      const nextSelectedId =
        sectionIdToKeep && nextRows.some((row) => row.id === sectionIdToKeep)
          ? sectionIdToKeep
          : selectedSectionIdRef.current &&
              nextRows.some((row) => row.id === selectedSectionIdRef.current)
            ? selectedSectionIdRef.current
            : nextRows[0]?.id || null;

      setSelectedSectionId(nextSelectedId);
    } catch (error) {
      setRows([]);
      setSelectedSectionId(null);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authorization]);

  const loadSchedules = useCallback(async (sectionId: number | null) => {
    if (!authorization || !sectionId) {
      setScheduleRows([]);
      return;
    }

    try {
      setIsScheduleLoading(true);
      const response = await getDynamicListByPath(
        `/api/v1/recurring-schedules/section/${sectionId}`,
        authorization,
      );
      const nextRows = response.rows
        .map((row) => toScheduleRow(row))
        .filter((row): row is ScheduleRow => row !== null)
        .sort((first, second) => {
          if ((first.dayOfWeek || 0) === (second.dayOfWeek || 0)) {
            return (first.startPeriod || 0) - (second.startPeriod || 0);
          }

          return (first.dayOfWeek || 0) - (second.dayOfWeek || 0);
        });
      setScheduleRows(nextRows);
    } catch (error) {
      setScheduleRows([]);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsScheduleLoading(false);
    }
  }, [authorization]);

  useEffect(() => {
    void loadReferenceData();
    void loadRows();
  }, [loadReferenceData, loadRows]);

  useEffect(() => {
    if (!selectedRow) {
      setEditingRowId(null);
      setForm(emptyForm);
      return;
    }

    setEditingRowId(selectedRow.id);
    setForm(hydrateFormFromRow(selectedRow));
  }, [selectedRow]);

  useEffect(() => {
    selectedSectionIdRef.current = selectedSectionId;
  }, [selectedSectionId]);

  useEffect(() => {
    void loadSchedules(selectedSectionId);
  }, [loadSchedules, selectedSectionId]);

  const handleApplyFilters = () => {
    void loadRows({
      sectionIdToKeep: selectedSectionId,
      courseFilterValue: courseFilter,
      semesterFilterValue: semesterFilter,
    });
  };

  const handleResetFilters = () => {
    setCourseFilter("");
    setSemesterFilter("");
    setStatusFilter("");
    setKeyword("");
    void loadRows({
      sectionIdToKeep: selectedSectionId,
      courseFilterValue: "",
      semesterFilterValue: "",
    });
  };

  const handleStartCreate = () => {
    setSelectedSectionId(null);
    setEditingRowId(null);
    setForm(emptyForm);
    setScheduleRows([]);
    setErrorMessage("");
  };

  const handleSelectRow = (row: CourseSectionRow) => {
    setSelectedSectionId(row.id);
    setEditingRowId(row.id);
    setForm(hydrateFormFromRow(row));
    setErrorMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      setErrorMessage("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    const courseId = Number(form.courseId);
    const semesterId = Number(form.semesterId);
    const lecturerId = Number(form.lecturerId);
    const maxCapacity = Number(form.maxCapacity);

    if (!Number.isInteger(courseId) || courseId <= 0) {
      setErrorMessage("Vui lòng chọn môn học hợp lệ.");
      return;
    }

    if (!Number.isInteger(semesterId) || semesterId <= 0) {
      setErrorMessage("Vui lòng nhập học kỳ hợp lệ.");
      return;
    }

    if (!Number.isInteger(maxCapacity) || maxCapacity <= 0) {
      setErrorMessage("Sĩ số tối đa phải lớn hơn 0.");
      return;
    }

    const payload: Record<string, unknown> = {
      displayName: form.displayName.trim(),
      courseId,
      semesterId,
      maxCapacity,
      status: form.status,
    };

    if (Number.isInteger(lecturerId) && lecturerId > 0) {
      payload.lecturerId = lecturerId;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");

      if (editingRowId) {
        await updateDynamicByPath(
          `/api/v1/course-sections/${editingRowId}`,
          payload,
          authorization,
        );
        setSuccessMessage("Đã cập nhật lớp học phần.");
        await loadRows({
          sectionIdToKeep: editingRowId,
          courseFilterValue: courseFilter,
          semesterFilterValue: semesterFilter,
        });
        return;
      }

      const created = await createDynamicByPath("/api/v1/course-sections", payload, authorization);
      const createdId = Number(created.id || 0) || null;
      setSuccessMessage("Đã tạo lớp học phần mới.");
      await loadRows({
        sectionIdToKeep: createdId,
        courseFilterValue: courseFilter,
        semesterFilterValue: semesterFilter,
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatchStatus = async () => {
    if (!authorization || !selectedRow) {
      setErrorMessage("Vui lòng chọn lớp học phần cần cập nhật trạng thái.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      await patchDynamicByPath(
        `/api/v1/course-sections/${selectedRow.id}/status`,
        { status: form.status },
        authorization,
      );
      setSuccessMessage(`Đã cập nhật trạng thái sang "${formatSectionStatus(form.status)}".`);
      await loadRows({
        sectionIdToKeep: selectedRow.id,
        courseFilterValue: courseFilter,
        semesterFilterValue: semesterFilter,
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!authorization || !selectedRow) {
      setErrorMessage("Vui lòng chọn lớp học phần cần xóa.");
      return;
    }

    if (!["DRAFT", "CANCELLED"].includes(selectedRow.status || "")) {
      setErrorMessage("Chỉ có thể xóa lớp học phần ở trạng thái Nháp hoặc Đã hủy.");
      return;
    }

    setConfirmDeleteRow(selectedRow);
  };

  const handleConfirmDelete = async () => {
    if (!authorization || !confirmDeleteRow) {
      return;
    }

    const selectedRow = confirmDeleteRow;
    setConfirmDeleteRow(null);

    try {
      setIsLoading(true);
      setErrorMessage("");
      await deleteDynamicByPath(`/api/v1/course-sections/${selectedRow.id}`, authorization);
      setSuccessMessage("Đã xóa lớp học phần.");
      setSelectedSectionId(null);
      await loadRows({
        sectionIdToKeep: null,
        courseFilterValue: courseFilter,
        semesterFilterValue: semesterFilter,
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
        <div className="border-b border-[#c5dced] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[22px] font-semibold text-[#1a4f75]">
                Quản lý lớp học phần
              </h2>
              <p className="mt-1 text-sm text-[#5d778c]">
                Quản lý danh sách lớp học phần theo đúng API, đồng thời theo dõi lịch
                học lặp lại của lớp đang chọn.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartCreate}
                disabled={isLoading}
                className="rounded-[8px] border border-[#9fc4dd] bg-white px-4 py-2 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
              >
                Tạo lớp mới
              </button>
              <button
                type="button"
                onClick={() => {
                  void loadRows({
                    sectionIdToKeep: selectedSectionId,
                    courseFilterValue: courseFilter,
                    semesterFilterValue: semesterFilter,
                  });
                }}
                disabled={isLoading}
                className="rounded-[8px] bg-[#0d6ea6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                {isLoading ? "Đang tải..." : "Làm mới danh sách"}
              </button>
            </div>
          </div>
        </div>

      </section>

      <section className="rounded-[10px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
        <div className="border-b border-[#c5dced] px-4 py-3">
          <h3 className="text-lg font-semibold text-[#1a4f75]">Bộ lọc và danh sách</h3>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-xs text-[#688296]">
            API hiện hỗ trợ lọc danh sách lớp học phần theo môn học hoặc theo học kỳ.
            Khi chọn đồng thời cả hai điều kiện, hệ thống ưu tiên gọi API theo môn học
            rồi lọc học kỳ thêm ở giao diện.
          </p>

          <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_0.9fr_auto_auto]">
            <input
              className="h-11 rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
              placeholder="Tìm theo mã lớp, tên lớp, môn học, giảng viên..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <select
              className="h-11 rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
            >
              <option value="">Tất cả môn học</option>
              {courseOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
              value={semesterFilter}
              onChange={(event) => setSemesterFilter(event.target.value)}
            >
              <option value="">Tất cả học kỳ</option>
              {semesterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={isLoading}
              className="h-11 rounded-[8px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
            >
              Áp dụng
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={isLoading}
              className="h-11 rounded-[8px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
            >
              Xóa lọc
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.95fr)]">
            <div className="overflow-hidden rounded-[10px] border border-[#d7e5f0]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f4f9fd] text-[#2d5a77]">
                    <tr>
                      <th className="px-3 py-3">Lớp học phần</th>
                      <th className="px-3 py-3">Môn học</th>
                      <th className="px-3 py-3">Giảng viên</th>
                      <th className="px-3 py-3">Học kỳ</th>
                      <th className="px-3 py-3 text-center">Sĩ số</th>
                      <th className="px-3 py-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-sm text-[#688296]"
                        >
                          Chưa có lớp học phần phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const active = row.id === selectedSectionId;

                        return (
                          <tr
                            key={row.id}
                            className={`cursor-pointer border-t border-[#e0ebf4] align-top transition ${
                              active ? "bg-[#eef6fd]" : "hover:bg-[#f8fbfe]"
                            }`}
                            onClick={() => handleSelectRow(row)}
                          >
                            <td className="px-3 py-3">
                              <p className="font-semibold text-[#184f74]">
                                {row.sectionCode || `#${row.id}`}
                              </p>
                              <p className="mt-1 text-xs text-[#688296]">
                                {row.displayName || "Chưa đặt tên hiển thị"}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-[#234d69]">
                                {row.courseName || "-"}
                              </p>
                              <p className="mt-1 text-xs text-[#688296]">
                                {row.courseCode || `Môn #${row.courseId || "-"}`}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-[#365f7b]">
                              {row.lecturerName || "Chưa phân công"}
                            </td>
                            <td className="px-3 py-3 text-[#365f7b]">
                              {semesterLabelMap.get(row.semesterId || 0) ||
                                getSemesterLabel(
                                  row.semesterNumber,
                                  row.academicYear,
                                  row.semesterId,
                                )}
                            </td>
                            <td className="px-3 py-3 text-center font-semibold text-[#184f74]">
                              {row.maxCapacity || "-"}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(row.status)}`}
                              >
                                {formatSectionStatus(row.status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[10px] border border-[#d7e5f0] bg-[#f8fbfe] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-[#1a4f75]">
                      {selectedRow ? "Chi tiết lớp đang chọn" : "Tạo lớp học phần mới"}
                    </h4>
                    <p className="mt-1 text-xs text-[#688296]">
                      {selectedRow
                        ? "Cập nhật nhanh thông tin lớp học phần và trạng thái vận hành."
                        : "Nhập thông tin cơ bản theo đúng payload của API course-sections."}
                    </p>
                  </div>
                  {selectedRow ? (
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(selectedRow.status)}`}
                    >
                      {formatSectionStatus(selectedRow.status)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-[#dbe7f1] bg-white px-3 py-2">
                    <p className="text-xs text-[#688296]">Mã lớp</p>
                    <p className="mt-1 font-semibold text-[#184f74]">
                      {selectedRow?.sectionCode || "Tạo mới"}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#dbe7f1] bg-white px-3 py-2">
                    <p className="text-xs text-[#688296]">Tạo lúc</p>
                    <p className="mt-1 font-semibold text-[#184f74]">
                      {formatDateTime(selectedRow?.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              <form
                className="space-y-3 rounded-[10px] border border-[#d7e5f0] bg-white p-4"
                onSubmit={handleSubmit}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-[#335a72]">
                      Tên hiển thị lớp học phần
                    </label>
                    <input
                      className="h-11 w-full rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
                      placeholder="Ví dụ: Java nâng cao - Nhóm 02"
                      value={form.displayName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          displayName: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-[#335a72]">Môn học</label>
                    <select
                      className="h-11 w-full rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
                      value={form.courseId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          courseId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Chọn môn học</option>
                      {courseOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-[#335a72]">
                      Giảng viên phụ trách
                    </label>
                    <select
                      className="h-11 w-full rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
                      value={form.lecturerId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          lecturerId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Chưa phân công</option>
                      {lecturerOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-[#335a72]">
                      Học kỳ (semesterId)
                    </label>
                    <input
                      list="course-section-semesters"
                      className="h-11 w-full rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
                      placeholder="Nhập semesterId"
                      value={form.semesterId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          semesterId: event.target.value,
                        }))
                      }
                    />
                    <datalist id="course-section-semesters">
                      {semesterOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </datalist>
                    <p className="text-xs text-[#688296]">
                      Gợi ý học kỳ đang lấy từ các kỳ đăng ký hiện có trong hệ thống.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-[#335a72]">Sĩ số tối đa</label>
                    <input
                      type="number"
                      min={1}
                      className="h-11 w-full rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
                      value={form.maxCapacity}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxCapacity: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-[#335a72]">Trạng thái</label>
                    <select
                      className="h-11 w-full rounded-[8px] border border-[#c8d3dd] px-3 text-sm text-[#234d69] outline-none focus:border-[#6aa8cf]"
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as SectionStatus,
                        }))
                      }
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="rounded-[8px] bg-[#0d6ea6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    {editingRowId ? "Lưu thay đổi" : "Tạo lớp học phần"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePatchStatus}
                    disabled={isLoading || !selectedRow}
                    className="rounded-[8px] border border-[#9ec3dd] bg-white px-4 py-2 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    Cập nhật trạng thái
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isLoading || !selectedRow}
                    className="rounded-[8px] border border-[#e5b0b0] bg-white px-4 py-2 text-sm font-semibold text-[#b24646] transition hover:bg-[#fff5f5] disabled:opacity-60"
                  >
                    Xóa lớp học phần
                  </button>
                </div>
              </form>

              <div className="rounded-[10px] border border-[#d7e5f0] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-[#1a4f75]">
                      Lịch học lặp lại của lớp đang chọn
                    </h4>
                    <p className="mt-1 text-xs text-[#688296]">
                      Dữ liệu lấy từ API `GET /api/v1/recurring-schedules/section/{"{sectionId}"}`.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void loadSchedules(selectedSectionId);
                    }}
                    disabled={isScheduleLoading || !selectedSectionId}
                    className="rounded-[8px] border border-[#9ec3dd] bg-white px-3 py-2 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    {isScheduleLoading ? "Đang tải..." : "Làm mới lịch"}
                  </button>
                </div>

                {!selectedRow ? (
                  <p className="mt-4 text-sm text-[#688296]">
                    Chọn một lớp học phần ở bảng bên trái để xem lịch học lặp lại.
                  </p>
                ) : scheduleRows.length === 0 ? (
                  <p className="mt-4 text-sm text-[#688296]">
                    Lớp học phần này chưa có lịch học lặp lại.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {scheduleRows.map((row) => (
                        <span
                          key={row.id}
                          className="inline-flex rounded-full border border-[#cfe0ee] bg-[#f8fbfe] px-3 py-1 text-xs font-medium text-[#315d79]"
                        >
                          {buildScheduleLabel(row)}
                        </span>
                      ))}
                    </div>

                    <div className="overflow-x-auto rounded-[8px] border border-[#dbe7f1]">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#f7fbfe] text-[#2d5a77]">
                          <tr>
                            <th className="px-3 py-2">Thứ</th>
                            <th className="px-3 py-2">Tiết</th>
                            <th className="px-3 py-2">Giờ học</th>
                            <th className="px-3 py-2">Phòng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduleRows.map((row) => (
                            <tr key={row.id} className="border-t border-[#e0ebf4] text-[#365f7b]">
                              <td className="px-3 py-2">
                                {row.dayOfWeekName ||
                                  (row.dayOfWeek ? weekdayLabels[row.dayOfWeek] : "-")}
                              </td>
                              <td className="px-3 py-2">
                                {row.startPeriod && row.endPeriod
                                  ? `${row.startPeriod} - ${row.endPeriod}`
                                  : "-"}
                              </td>
                              <td className="px-3 py-2">
                                {row.startPeriodTime && row.endPeriodTime
                                  ? `${row.startPeriodTime} - ${row.endPeriodTime}`
                                  : "-"}
                              </td>
                              <td className="px-3 py-2">
                                {row.classroomName ||
                                  (row.classroomId ? `Phòng #${row.classroomId}` : "-")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirmDeleteRow)}
        title="Xác nhận xóa lớp học phần"
        message={
          confirmDeleteRow
            ? `Xóa lớp học phần ${confirmDeleteRow.sectionCode || `#${confirmDeleteRow.id}`}?`
            : ""
        }
        confirmText="Xóa"
        isProcessing={isLoading}
        onCancel={() => setConfirmDeleteRow(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </div>
  );
};
