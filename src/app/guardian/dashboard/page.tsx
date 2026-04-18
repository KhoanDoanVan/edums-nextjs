"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
import {
  shouldHideFeedbackMessage,
  useToastFeedback,
} from "@/hooks/use-toast-feedback";
import {
  getGradeReportById,
  getGuardianStudentAttendances,
  getMyProfile,
  getStudentById,
  getStudentGradeReports,
} from "@/lib/guardian/service";
import { guardianFeatureTabs } from "@/lib/guardian/tabs";
import { toErrorMessage as toSharedErrorMessage } from "@/components/admin/format-utils";
import type {
  AttendanceResponse,
  AttendanceStatus,
  GradeReportResponse,
  GuardianFeatureTab,
  GuardianProfileResponse,
  GuardianStudentItem,
} from "@/lib/guardian/types";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  const normalized = toSharedErrorMessage(error).trim();
  return normalized || fallback;
};

const normalizeTextValue = (value?: string): string => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const decodeJwtPayload = (token?: string): Record<string, unknown> => {
  if (!token) {
    return {};
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const parsePositiveInteger = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const normalized = normalizeTextValue(value);
    return normalized || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const pickNumber = (
  source: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    const value = toNumberValue(source[key]);
    if (typeof value === "number") {
      return value;
    }
  }

  return undefined;
};

const pickText = (
  source: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = toStringValue(source[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const toGuardianStudentItem = (value: unknown): GuardianStudentItem | null => {
  if (!isObject(value)) {
    return null;
  }

  const student: GuardianStudentItem = {
    id: pickNumber(value, ["id", "studentId"]),
    guardianId: pickNumber(value, ["guardianId", "parentId"]),
    studentCode: pickText(value, ["studentCode", "code"]),
    fullName: pickText(value, ["fullName", "studentName", "name"]),
    className: pickText(value, ["className", "administrativeClassName"]),
    majorName: pickText(value, ["majorName"]),
  };

  if (!student.id && !student.studentCode && !student.fullName) {
    return null;
  }

  return student;
};

const dedupeStudents = (items: GuardianStudentItem[]): GuardianStudentItem[] => {
  const byKey = new Map<string, GuardianStudentItem>();

  items.forEach((item) => {
    const key =
      (item.id && `id-${item.id}`) ||
      (item.studentCode && `code-${item.studentCode.toLowerCase()}`) ||
      `name-${normalizeTextValue(item.fullName).toLowerCase()}`;

    if (!key || key === "name-") {
      return;
    }

    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, item);
      return;
    }

    byKey.set(key, {
      ...previous,
      ...item,
      id: item.id || previous.id,
      guardianId: item.guardianId || previous.guardianId,
      studentCode: item.studentCode || previous.studentCode,
      fullName: item.fullName || previous.fullName,
      className: item.className || previous.className,
      majorName: item.majorName || previous.majorName,
    });
  });

  return [...byKey.values()];
};

const extractStudentsFromGuardian = (
  source: Record<string, unknown>,
): GuardianStudentItem[] => {
  const candidates = [
    "students",
    "studentList",
    "studentResponses",
    "children",
    "childrens",
    "wards",
  ];

  const collected: GuardianStudentItem[] = [];

  candidates.forEach((key) => {
    const value = source[key];
    if (!Array.isArray(value)) {
      return;
    }

    value.forEach((item) => {
      const mapped = toGuardianStudentItem(item);
      if (mapped) {
        collected.push(mapped);
      }
    });
  });

  if (collected.length === 0) {
    const selfMapped = toGuardianStudentItem(source);
    if (selfMapped) {
      collected.push(selfMapped);
    }
  }

  return dedupeStudents(collected);
};

const parseGuardianProfile = (
  guardianRaw: Record<string, unknown>,
  profileRaw: Record<string, unknown>,
): GuardianProfileResponse => {
  const merged = {
    ...profileRaw,
    ...guardianRaw,
  };
  const students = extractStudentsFromGuardian(merged);
  const profileGuardianId =
    pickNumber(merged, ["guardianId", "guardianID", "parentId", "profileId"]) ??
    students.find((item) => typeof item.guardianId === "number")?.guardianId ??
    pickNumber(merged, ["id"]);

  return {
    id: profileGuardianId,
    fullName: pickText(merged, ["fullName", "guardianName", "name"]),
    phone: pickText(merged, ["phone", "phoneNumber"]),
    relationship: pickText(merged, ["relationship"]),
    address: pickText(merged, ["address"]),
    students,
    raw: merged,
  };
};

const formatDate = (value?: string): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("vi-VN");
};

const formatScore = (value?: number): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(2);
};

const getAttendanceStatusLabel = (status?: AttendanceStatus): string => {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "LATE":
      return "Đi muộn";
    case "EXCUSED":
      return "Có phép";
    case "ABSENT":
      return "Vắng";
    default:
      return "-";
  }
};

const getAttendanceStatusClass = (status?: AttendanceStatus): string => {
  switch (status) {
    case "PRESENT":
      return "bg-[#eef8f1] text-[#1d7a46]";
    case "LATE":
      return "bg-[#fff7e8] text-[#a16a00]";
    case "EXCUSED":
      return "bg-[#eef4fb] text-[#1f4f84]";
    case "ABSENT":
      return "bg-[#fff0f0] text-[#bf4e4e]";
    default:
      return "bg-[#eef4f8] text-[#47677e]";
  }
};

const getGradeStatusLabel = (status?: string): string => {
  switch (status) {
    case "PUBLISHED":
      return "Đã công bố";
    case "LOCKED":
      return "Đã chốt";
    case "DRAFT":
      return "Nháp";
    default:
      return status || "-";
  }
};

const getGradeStatusClass = (status?: string): string => {
  switch (status) {
    case "PUBLISHED":
      return "bg-[#eef8f1] text-[#1d7a46]";
    case "LOCKED":
      return "bg-[#eef4fb] text-[#1f4f84]";
    case "DRAFT":
      return "bg-[#fff7e8] text-[#a16a00]";
    default:
      return "bg-[#eef4f8] text-[#47677e]";
  }
};

const attendanceStatusOptions: AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "EXCUSED",
  "ABSENT",
];

export default function GuardianDashboardPage() {
  const { session, logout } = useAuth();

  const [activeTabKey, setActiveTabKey] =
    useState<GuardianFeatureTab["key"]>("profile");

  const [tabError, setTabError] = useState("");
  const [tabMessage, setTabMessage] = useState("");

  const [hasAutoLoadedProfile, setHasAutoLoadedProfile] = useState(false);
  const [guardianProfile, setGuardianProfile] = useState<GuardianProfileResponse | null>(
    null,
  );
  const [isGuardianLoading, setIsGuardianLoading] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentDetailsById, setStudentDetailsById] = useState<
    Record<number, GuardianStudentItem | null>
  >({});
  const [loadingStudentDetailId, setLoadingStudentDetailId] = useState<number | null>(
    null,
  );

  const [attendanceItems, setAttendanceItems] = useState<AttendanceResponse[]>([]);
  const [attendanceKeyword, setAttendanceKeyword] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("");
  const [attendanceDateFrom, setAttendanceDateFrom] = useState("");
  const [attendanceDateTo, setAttendanceDateTo] = useState("");
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  const [gradeReports, setGradeReports] = useState<GradeReportResponse[]>([]);
  const [gradeKeyword, setGradeKeyword] = useState("");
  const [gradeStatusFilter, setGradeStatusFilter] = useState("");
  const [selectedGradeReportId, setSelectedGradeReportId] = useState<number | null>(
    null,
  );
  const [gradeReportDetailsById, setGradeReportDetailsById] = useState<
    Record<number, GradeReportResponse | null>
  >({});
  const [loadingGradeReportId, setLoadingGradeReportId] = useState<number | null>(
    null,
  );
  const [isGradeLoading, setIsGradeLoading] = useState(false);

  useToastFeedback({
    errorMessage: tabError,
    successMessage: tabMessage,
    errorTitle: "Thao tác phụ huynh thất bại",
    successTitle: "Thao tác phụ huynh thành công",
  });

  const activeTab = useMemo(
    () =>
      guardianFeatureTabs.find((tab) => tab.key === activeTabKey) ||
      guardianFeatureTabs[0],
    [activeTabKey],
  );

  const selectedStudentIdValue = parsePositiveInteger(selectedStudentId);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentIdValue || !guardianProfile) {
      return null;
    }

    const fromProfile =
      guardianProfile.students.find((item) => item.id === selectedStudentIdValue) ||
      null;

    const fromDetail = studentDetailsById[selectedStudentIdValue];

    return {
      ...fromProfile,
      ...fromDetail,
      id: selectedStudentIdValue,
    } as GuardianStudentItem;
  }, [guardianProfile, selectedStudentIdValue, studentDetailsById]);

  const selectableStudents = useMemo(
    () =>
      (guardianProfile?.students || []).filter(
        (
          student,
        ): student is GuardianStudentItem & {
          id: number;
        } => typeof student.id === "number" && student.id > 0,
      ),
    [guardianProfile?.students],
  );

  const attendanceDateRangeInvalid =
    attendanceDateFrom &&
    attendanceDateTo &&
    attendanceDateFrom > attendanceDateTo;

  const filteredAttendanceItems = useMemo(() => {
    const keyword = normalizeTextValue(attendanceKeyword).toLowerCase();

    return attendanceItems.filter((item) => {
      if (attendanceStatusFilter && item.status !== attendanceStatusFilter) {
        return false;
      }

      const date = item.sessionDate || "";
      if (attendanceDateFrom && date && date < attendanceDateFrom) {
        return false;
      }
      if (attendanceDateTo && date && date > attendanceDateTo) {
        return false;
      }
      if (attendanceDateRangeInvalid) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const text = [
        item.studentCode,
        item.studentName,
        getAttendanceStatusLabel(item.status),
        item.note,
        formatDate(item.sessionDate),
      ]
        .map((value) => normalizeTextValue(value).toLowerCase())
        .join(" ");

      return text.includes(keyword);
    });
  }, [
    attendanceDateFrom,
    attendanceDateRangeInvalid,
    attendanceDateTo,
    attendanceItems,
    attendanceKeyword,
    attendanceStatusFilter,
  ]);

  const attendanceSummary = useMemo(() => {
    const summary = {
      total: filteredAttendanceItems.length,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    };

    filteredAttendanceItems.forEach((item) => {
      if (item.status === "PRESENT") {
        summary.present += 1;
      } else if (item.status === "LATE") {
        summary.late += 1;
      } else if (item.status === "EXCUSED") {
        summary.excused += 1;
      } else if (item.status === "ABSENT") {
        summary.absent += 1;
      }
    });

    return summary;
  }, [filteredAttendanceItems]);

  const filteredGradeReports = useMemo(() => {
    const keyword = normalizeTextValue(gradeKeyword).toLowerCase();

    return gradeReports.filter((report) => {
      if (gradeStatusFilter && report.status !== gradeStatusFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const text = [
        report.courseName,
        report.studentCode,
        report.studentName,
        report.letterGrade,
        report.status,
        String(report.finalScore ?? ""),
      ]
        .map((value) => normalizeTextValue(value).toLowerCase())
        .join(" ");

      return text.includes(keyword);
    });
  }, [gradeKeyword, gradeReports, gradeStatusFilter]);

  const selectedGradeReport = useMemo(() => {
    if (!selectedGradeReportId) {
      return null;
    }

    return (
      gradeReportDetailsById[selectedGradeReportId] ||
      gradeReports.find((item) => item.id === selectedGradeReportId) ||
      null
    );
  }, [gradeReportDetailsById, gradeReports, selectedGradeReportId]);

  const isSelectedGradeReportLoading =
    selectedGradeReportId !== null && loadingGradeReportId === selectedGradeReportId;

  const handleLoadGuardianProfile = useCallback(async () => {
    const authorization = session?.authorization;

    if (!authorization) {
      setTabError("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    setIsGuardianLoading(true);
    setTabError("");
    setTabMessage("");

    try {
      let myProfileRaw: Record<string, unknown> = {};
      let profileRequestError = "";
      const jwtPayload = decodeJwtPayload(session?.token);

      try {
        myProfileRaw = await getMyProfile(authorization);
      } catch (error) {
        profileRequestError = toErrorMessage(error, "Không thể tải hồ sơ đăng nhập.");
      }

      if (Object.keys(myProfileRaw).length === 0 && profileRequestError) {
        throw new Error(profileRequestError);
      }

      const parsedProfile = parseGuardianProfile({}, myProfileRaw);
      const profileGuardianId =
        parsedProfile.id ??
        pickNumber(myProfileRaw, ["guardianId", "guardianID", "parentId", "profileId"]) ??
        pickNumber(jwtPayload, ["guardianId", "guardianID", "parentId", "profileId"]) ??
        parsedProfile.students.find((item) => typeof item.guardianId === "number")?.guardianId;
      const normalizedProfile: GuardianProfileResponse = {
        ...parsedProfile,
        id: profileGuardianId,
      };
      const students = normalizedProfile.students;
      const defaultStudentId =
        students.find((item) => typeof item.id === "number" && item.id > 0)?.id ??
        undefined;

      setGuardianProfile(normalizedProfile);
      setSelectedStudentId(defaultStudentId ? String(defaultStudentId) : "");
      setAttendanceItems([]);
      setGradeReports([]);
      setSelectedGradeReportId(null);
      setGradeReportDetailsById({});
      setStudentDetailsById({});
      setTabMessage(
        students.length > 0
          ? `Đã tải hồ sơ phụ huynh và ${students.length} học sinh liên kết.`
          : "Đã tải hồ sơ phụ huynh. Hiện chưa thấy học sinh liên kết trong dữ liệu.",
      );

      if (profileRequestError) {
        setTabMessage(
          students.length > 0
            ? `Đã tải hồ sơ phụ huynh (fallback, bỏ qua lỗi /profile/me) và ${students.length} học sinh liên kết.`
            : "Đã tải hồ sơ phụ huynh theo chế độ fallback (bỏ qua lỗi /profile/me).",
        );
      }

      if (!profileGuardianId) {
        setTabError(
          "Không xác định được mã hồ sơ phụ huynh từ phiên đăng nhập. Một số API như điểm danh có thể chưa dùng được.",
        );
      }
    } catch (error) {
      setGuardianProfile(null);
      setSelectedStudentId("");
      setAttendanceItems([]);
      setGradeReports([]);
      setSelectedGradeReportId(null);
      setGradeReportDetailsById({});
      setStudentDetailsById({});
      setTabError(toErrorMessage(error, "Không thể tải hồ sơ phụ huynh."));
    } finally {
      setIsGuardianLoading(false);
    }
  }, [session?.authorization, session?.token]);

  useEffect(() => {
    setHasAutoLoadedProfile(false);
    setGuardianProfile(null);
    setSelectedStudentId("");
    setStudentDetailsById({});
    setAttendanceItems([]);
    setGradeReports([]);
    setSelectedGradeReportId(null);
    setGradeReportDetailsById({});
    setTabError("");
    setTabMessage("");
  }, [session?.authorization]);

  useEffect(() => {
    if (!session?.authorization) {
      return;
    }

    if (hasAutoLoadedProfile || isGuardianLoading) {
      return;
    }

    setHasAutoLoadedProfile(true);
    void handleLoadGuardianProfile();
  }, [
    handleLoadGuardianProfile,
    hasAutoLoadedProfile,
    isGuardianLoading,
    session?.authorization,
  ]);

  useEffect(() => {
    if (!session?.authorization || !selectedStudentIdValue) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(studentDetailsById, selectedStudentIdValue)) {
      return;
    }

    let cancelled = false;
    setLoadingStudentDetailId(selectedStudentIdValue);

    const loadStudentDetail = async () => {
      try {
        const raw = await getStudentById(selectedStudentIdValue, session.authorization);

        if (cancelled) {
          return;
        }

        const detail = toGuardianStudentItem(raw);
        setStudentDetailsById((current) => ({
          ...current,
          [selectedStudentIdValue]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setStudentDetailsById((current) => ({
          ...current,
          [selectedStudentIdValue]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingStudentDetailId((current) =>
            current === selectedStudentIdValue ? null : current,
          );
        }
      }
    };

    void loadStudentDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedStudentIdValue, session?.authorization, studentDetailsById]);

  useEffect(() => {
    if (activeTabKey !== "attendance") {
      return;
    }

    const authorization = session?.authorization;
    const studentId = selectedStudentIdValue;

    if (!authorization || !studentId) {
      setAttendanceItems([]);
      return;
    }

    let cancelled = false;
    setIsAttendanceLoading(true);

    const loadAttendances = async () => {
      try {
        const data = await getGuardianStudentAttendances(studentId, authorization);

        if (cancelled) {
          return;
        }

        setAttendanceItems(data);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAttendanceItems([]);
        setTabError(
          toErrorMessage(error, "Không thể tải dữ liệu điểm danh của học sinh."),
        );
      } finally {
        if (!cancelled) {
          setIsAttendanceLoading(false);
        }
      }
    };

    void loadAttendances();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    selectedStudentIdValue,
    session?.authorization,
  ]);

  useEffect(() => {
    if (activeTabKey !== "grades") {
      return;
    }

    const authorization = session?.authorization;
    const studentId = selectedStudentIdValue;

    if (!authorization || !studentId) {
      setGradeReports([]);
      setSelectedGradeReportId(null);
      return;
    }

    let cancelled = false;
    setIsGradeLoading(true);

    const loadGradeReports = async () => {
      try {
        const data = await getStudentGradeReports(studentId, authorization);

        if (cancelled) {
          return;
        }

        setGradeReports(data);
        setSelectedGradeReportId(data.length > 0 ? data[0].id : null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setGradeReports([]);
        setSelectedGradeReportId(null);
        setTabError(toErrorMessage(error, "Không thể tải bảng điểm học sinh."));
      } finally {
        if (!cancelled) {
          setIsGradeLoading(false);
        }
      }
    };

    void loadGradeReports();

    return () => {
      cancelled = true;
    };
  }, [activeTabKey, selectedStudentIdValue, session?.authorization]);

  useEffect(() => {
    if (activeTabKey !== "grades" || !selectedGradeReportId || !session?.authorization) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(gradeReportDetailsById, selectedGradeReportId)) {
      return;
    }

    let cancelled = false;
    setLoadingGradeReportId(selectedGradeReportId);

    const loadGradeDetail = async () => {
      try {
        const detail = await getGradeReportById(selectedGradeReportId, session.authorization);

        if (cancelled) {
          return;
        }

        setGradeReportDetailsById((current) => ({
          ...current,
          [selectedGradeReportId]: detail,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setGradeReportDetailsById((current) => ({
          ...current,
          [selectedGradeReportId]: null,
        }));
      } finally {
        if (!cancelled) {
          setLoadingGradeReportId((current) =>
            current === selectedGradeReportId ? null : current,
          );
        }
      }
    };

    void loadGradeDetail();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    gradeReportDetailsById,
    selectedGradeReportId,
    session?.authorization,
  ]);

  const contentCardClass =
    "rounded-[10px] border border-[#6da8c9] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

  return (
    <AuthGuard allowedRoles={["GUARDIAN", "PARENT"]}>
      <main className="min-h-screen bg-[#edf3f8] px-4 py-6">
        <div className="mx-auto w-full max-w-[1260px] space-y-4">
          <section className={contentCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c5dced] px-4 py-3">
              <div>
                <h1 className="text-[22px] font-semibold text-[#1a4f75]">
                  Dashboard phụ huynh
                </h1>
                <p className="mt-1 text-sm text-[#4f6d82]">
                  Theo dõi hồ sơ phụ huynh, điểm danh và bảng điểm của học sinh.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link
                  href="/login"
                  className="rounded-[6px] border border-[#9ec3dd] bg-white px-3 py-2 font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
                >
                  Về đăng nhập
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-[6px] bg-[#0d6ea6] px-3 py-2 font-semibold text-white transition hover:bg-[#085d90]"
                >
                  Đăng xuất
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="rounded-[6px] border border-[#dbe7f1] bg-[#f7fbff] px-3 py-2 text-sm text-[#355970]">
                <span className="text-[#69849a]">Mã phụ huynh:</span>{" "}
                <span className="font-semibold text-[#1f567b]">
                  {guardianProfile?.id || "-"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleLoadGuardianProfile();
                }}
                disabled={isGuardianLoading}
                className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
              >
                {isGuardianLoading ? "Đang tải..." : "Làm mới dữ liệu phụ huynh"}
              </button>
            </div>

            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {guardianFeatureTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTabKey(tab.key);
                      setTabError("");
                      setTabMessage("");
                    }}
                    className={`rounded-[8px] border px-3 py-2 text-sm font-semibold transition ${
                      activeTabKey === tab.key
                        ? "border-[#0d6ea6] bg-[#0d6ea6] text-white"
                        : "border-[#9ec3dd] bg-white text-[#245977] hover:bg-[#edf6fd]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-[#5e7a8f]">{activeTab.description}</p>
            </div>

            {(tabError || tabMessage) && (
              <div className="space-y-2 px-4 pb-3 text-sm">
                {tabError ? (
                  <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                    {tabError}
                  </p>
                ) : null}
                {tabMessage && !shouldHideFeedbackMessage(tabMessage) ? (
                  <p className="rounded-[6px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                    {tabMessage}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {activeTab.key === "profile" ? (
            <section className={contentCardClass}>
              <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-3">
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] p-3">
                    <h3 className="text-sm font-semibold text-[#1f567b]">
                      Thông tin phụ huynh
                    </h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Mã phụ huynh</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {guardianProfile?.id || "-"}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Họ tên</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {guardianProfile?.fullName || "-"}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Số điện thoại</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {guardianProfile?.phone || "-"}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                        <p className="text-xs text-[#69849a]">Quan hệ</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {guardianProfile?.relationship || "-"}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2 sm:col-span-2">
                        <p className="text-xs text-[#69849a]">Địa chỉ</p>
                        <p className="text-sm font-semibold text-[#1f567b]">
                          {guardianProfile?.address || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f9fcff] p-3">
                  <h3 className="text-sm font-semibold text-[#1f567b]">
                    Danh sách học sinh liên kết
                  </h3>
                  <div className="mt-2 overflow-x-auto rounded-[8px] border border-[#dbe7f1]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-white">
                        <tr className="border-b border-[#e0ebf4] text-[#335a72]">
                          <th className="px-2 py-2">Mã SV</th>
                          <th className="px-2 py-2">Họ tên</th>
                          <th className="px-2 py-2">Lớp</th>
                          <th className="px-2 py-2">Ngành</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(guardianProfile?.students || []).map((student) => (
                          <tr key={student.id || student.studentCode} className="border-b border-[#eef4f8] text-[#3f6178]">
                            <td className="px-2 py-2">{student.studentCode || "-"}</td>
                            <td className="px-2 py-2">{student.fullName || "-"}</td>
                            <td className="px-2 py-2">{student.className || "-"}</td>
                            <td className="px-2 py-2">{student.majorName || "-"}</td>
                          </tr>
                        ))}
                        {(guardianProfile?.students || []).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-center text-[#5d7b91]">
                              Chưa có dữ liệu học sinh liên kết.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab.key === "attendance" ? (
            <section className={contentCardClass}>
              <div className="border-b border-[#c5dced] px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_170px_170px_auto]">
                  <select
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    disabled={selectableStudents.length === 0}
                  >
                    {selectableStudents.length === 0 ? (
                      <option value="">Chưa có học sinh có mã hợp lệ</option>
                    ) : null}
                    {selectableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.studentCode
                          ? `${student.studentCode} - ${student.fullName || "Học sinh"}`
                          : student.fullName || `Học sinh #${student.id}`}
                      </option>
                    ))}
                  </select>

                  <select
                    value={attendanceStatusFilter}
                    onChange={(event) => setAttendanceStatusFilter(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  >
                    <option value="">Tất cả trạng thái</option>
                    {attendanceStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {getAttendanceStatusLabel(status)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={attendanceDateFrom}
                    onChange={(event) => setAttendanceDateFrom(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  />

                  <input
                    type="date"
                    value={attendanceDateTo}
                    onChange={(event) => setAttendanceDateTo(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  />

                  <input
                    value={attendanceKeyword}
                    onChange={(event) => setAttendanceKeyword(event.target.value)}
                    placeholder="Tìm nhanh..."
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  />
                </div>
              </div>

              <div className="space-y-4 px-4 py-4">
                {selectedStudent ? (
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2 text-sm text-[#355970]">
                    <p>
                      Học sinh:{" "}
                      <span className="font-semibold text-[#1f567b]">
                        {selectedStudent.fullName || "-"}
                      </span>{" "}
                      ({selectedStudent.studentCode || "-"})
                      {selectedStudent.className ? ` - ${selectedStudent.className}` : ""}
                      {selectedStudent.majorName ? ` - ${selectedStudent.majorName}` : ""}
                    </p>
                    {loadingStudentDetailId === selectedStudent.id ? (
                      <p className="mt-1 text-xs text-[#5f7e93]">
                        Đang tải bổ sung thông tin học sinh...
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {attendanceDateRangeInvalid ? (
                  <p className="rounded-[6px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-sm text-[#b03d3d]">
                    Khoảng ngày không hợp lệ: ngày bắt đầu lớn hơn ngày kết thúc.
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Tổng buổi</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.total}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Có mặt</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.present}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Đi muộn</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.late}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Có phép</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.excused}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f6fbff] px-3 py-2">
                    <p className="text-xs text-[#648095]">Vắng</p>
                    <p className="mt-1 text-xl font-semibold text-[#1e4d6f]">
                      {attendanceSummary.absent}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f7fbff]">
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Ngày học</th>
                        <th className="px-2 py-2">Session ID</th>
                        <th className="px-2 py-2">Trạng thái</th>
                        <th className="px-2 py-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendanceItems.map((item) => (
                        <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                          <td className="px-2 py-2">{formatDate(item.sessionDate)}</td>
                          <td className="px-2 py-2">{item.sessionId || "-"}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAttendanceStatusClass(
                                item.status,
                              )}`}
                            >
                              {getAttendanceStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-2 py-2">{item.note || "-"}</td>
                        </tr>
                      ))}
                      {!isAttendanceLoading && filteredAttendanceItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-[#577086]">
                            Chưa có dữ liệu điểm danh phù hợp.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  {isAttendanceLoading ? (
                    <p className="px-3 py-3 text-sm text-[#5d7b91]">
                      Đang tải dữ liệu điểm danh...
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab.key === "grades" ? (
            <section className={contentCardClass}>
              <div className="border-b border-[#c5dced] px-4 py-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_200px_auto]">
                  <select
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                    disabled={selectableStudents.length === 0}
                  >
                    {selectableStudents.length === 0 ? (
                      <option value="">Chưa có học sinh có mã hợp lệ</option>
                    ) : null}
                    {selectableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.studentCode
                          ? `${student.studentCode} - ${student.fullName || "Học sinh"}`
                          : student.fullName || `Học sinh #${student.id}`}
                      </option>
                    ))}
                  </select>

                  <input
                    value={gradeKeyword}
                    onChange={(event) => setGradeKeyword(event.target.value)}
                    placeholder="Tìm môn học, điểm chữ..."
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  />

                  <select
                    value={gradeStatusFilter}
                    onChange={(event) => setGradeStatusFilter(event.target.value)}
                    className="h-10 rounded-[6px] border border-[#c8d3dd] bg-white px-3 text-sm text-[#244d67] outline-none focus:border-[#6aa8cf]"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="PUBLISHED">Đã công bố</option>
                    <option value="LOCKED">Đã chốt</option>
                    <option value="DRAFT">Nháp</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setGradeKeyword("");
                      setGradeStatusFilter("");
                    }}
                    className="h-10 rounded-[6px] border border-[#6da8c9] bg-white px-3 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff]"
                  >
                    Xóa lọc
                  </button>
                </div>
              </div>

              <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="overflow-x-auto rounded-[8px] border border-[#d5e4ef]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f7fbff]">
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Môn học</th>
                        <th className="px-2 py-2">Điểm tổng</th>
                        <th className="px-2 py-2">Điểm chữ</th>
                        <th className="px-2 py-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGradeReports.map((report) => (
                        <tr
                          key={report.id}
                          className={`cursor-pointer border-b border-[#e0ebf4] text-[#3f6178] transition ${
                            selectedGradeReportId === report.id
                              ? "bg-[#eaf5fd]"
                              : "hover:bg-[#f8fbff]"
                          }`}
                          onClick={() => setSelectedGradeReportId(report.id)}
                        >
                          <td className="px-2 py-2">{report.courseName || "-"}</td>
                          <td className="px-2 py-2">{formatScore(report.finalScore)}</td>
                          <td className="px-2 py-2">{report.letterGrade || "-"}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getGradeStatusClass(
                                report.status,
                              )}`}
                            >
                              {getGradeStatusLabel(report.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!isGradeLoading && filteredGradeReports.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-[#577086]">
                            Chưa có dữ liệu bảng điểm phù hợp.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  {isGradeLoading ? (
                    <p className="px-3 py-3 text-sm text-[#5d7b91]">
                      Đang tải bảng điểm học sinh...
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[8px] border border-[#d5e4ef] bg-[#f9fcff] p-3">
                  <h4 className="text-sm font-semibold text-[#1a4f75]">
                    Chi tiết bảng điểm
                  </h4>
                  {!selectedGradeReport ? (
                    <p className="mt-3 text-sm text-[#5d7b91]">
                      Chọn một bản ghi bên trái để xem chi tiết điểm thành phần.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Môn học</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {selectedGradeReport.courseName || "-"}
                          </p>
                        </div>
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Điểm tổng</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {formatScore(selectedGradeReport.finalScore)}
                          </p>
                        </div>
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Điểm chữ</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {selectedGradeReport.letterGrade || "-"}
                          </p>
                        </div>
                        <div className="rounded-[6px] border border-[#dbe7f1] bg-white px-3 py-2">
                          <p className="text-xs text-[#69849a]">Trạng thái</p>
                          <p className="text-sm font-semibold text-[#1f567b]">
                            {getGradeStatusLabel(selectedGradeReport.status)}
                          </p>
                        </div>
                      </div>

                      {isSelectedGradeReportLoading ? (
                        <p className="text-sm text-[#5d7b91]">
                          Đang tải chi tiết điểm thành phần...
                        </p>
                      ) : null}

                      <div className="overflow-x-auto rounded-[8px] border border-[#dbe7f1]">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-white">
                            <tr className="border-b border-[#e0ebf4] text-[#335a72]">
                              <th className="px-2 py-2">Thành phần</th>
                              <th className="px-2 py-2">Trọng số (%)</th>
                              <th className="px-2 py-2">Điểm</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedGradeReport.gradeDetails || []).map((detail) => (
                              <tr key={detail.id || `${detail.componentId}-${detail.componentName}`} className="border-b border-[#eef4f8] text-[#3f6178]">
                                <td className="px-2 py-2">{detail.componentName || "-"}</td>
                                <td className="px-2 py-2">
                                  {typeof detail.weightPercentage === "number"
                                    ? detail.weightPercentage
                                    : "-"}
                                </td>
                                <td className="px-2 py-2">{formatScore(detail.score)}</td>
                              </tr>
                            ))}
                            {(selectedGradeReport.gradeDetails || []).length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-2 py-3 text-center text-[#5d7b91]">
                                  Chưa có chi tiết điểm thành phần.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </AuthGuard>
  );
}
