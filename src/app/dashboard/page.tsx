"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/context/toast-context";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import {
  changeMyPassword,
  getCourseSections,
  getMyAttendance,
  getMyGradeReports,
  getMyProfile,
  registerCourseSection,
  updateMyProfile,
} from "@/lib/student/service";
import {
  studentFeatureTabs,
  studentTopHeaderTabs,
} from "@/lib/student/tabs";
import type {
  AttendanceResponse,
  CourseSectionResponse,
  GradeReportResponse,
  ProfileResponse,
  StudentFeatureTab,
} from "@/lib/student/types";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Thao tác thất bại. Vui lòng thử lại.";
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

interface RegistrationNotice {
  title: string;
  message: string;
  detail?: string;
}

interface RegisteredCourseItem {
  registrationId: number;
  registrationTime?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "DROPPED";
  section: CourseSectionResponse;
}

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

const getSectionDisplayName = (section: CourseSectionResponse): string => {
  return section.displayName || section.sectionCode || `Lớp ${section.id}`;
};

const getCourseDisplayName = (section: CourseSectionResponse): string => {
  return section.courseName || section.courseCode || "Chưa cập nhật";
};

const getGroupLabel = (section: CourseSectionResponse): string => {
  const matched = section.sectionCode?.match(/(\d+)$/);
  return matched?.[1] || "-";
};

const getCreditsLabel = (section: CourseSectionResponse): string => {
  void section;
  return "-";
};

const getScheduleLabel = (section: CourseSectionResponse): string => {
  const term = [
    section.semesterNumber ? `Học kỳ ${section.semesterNumber}` : null,
    section.academicYear || null,
  ]
    .filter(Boolean)
    .join(" - ");

  const lecturer = section.lecturerName ? `GV ${section.lecturerName}` : "";

  return [term, lecturer].filter(Boolean).join(", ") || "Chưa có thời khóa biểu";
};

const getRegistrationStatusLabel = (status?: string): string => {
  switch (status) {
    case "OPEN":
      return "Đang mở";
    case "ONGOING":
      return "Đang diễn ra";
    case "FINISHED":
      return "Đã kết thúc";
    case "CANCELLED":
      return "Đã hủy";
    case "PENDING":
      return "Chờ xác nhận";
    case "CONFIRMED":
      return "Đã xác nhận";
    case "DROPPED":
      return "Đã hủy đăng ký";
    default:
      return status || "-";
  }
};

const getRegistrationStatusClass = (status?: string): string => {
  switch (status) {
    case "OPEN":
    case "CONFIRMED":
      return "bg-[#eef8f1] text-[#1d7a46]";
    case "PENDING":
    case "ONGOING":
      return "bg-[#fff7e8] text-[#a16a00]";
    case "CANCELLED":
    case "DROPPED":
      return "bg-[#fff0f0] text-[#bf4e4e]";
    default:
      return "bg-[#eef4f8] text-[#47677e]";
  }
};

const getTopHeaderDisplayLabel = (label: string): string => {
  if (label === "Thông báo") {
    return "Thông báo";
  }

  if (label === "Quy dinh - quy che") {
    return "Quy định - quy chế";
  }

  if (label === "Thông tin cập nhật") {
    return "Thông tin cập nhật";
  }

  return label;
};

const getStudentTabDisplayLabel = (
  item: Pick<StudentFeatureTab, "key" | "label">,
): string => {
  if (item.key === "course-registration") {
    return "Đăng ký môn học";
  }

  return item.label;
};

const getStudentTabDescription = (
  item: Pick<StudentFeatureTab, "key" | "description">,
): string => {
  if (item.key === "course-registration") {
    return "Tra cứu học phần đang mở, lọc theo môn học và gửi yêu cầu đăng ký ngay trên trang này.";
  }

  return item.description;
};

const parseRegistrationError = (error: unknown): RegistrationNotice => {
  const fallback: RegistrationNotice = {
    title: "Không thể đăng ký học phần",
    message: "Đăng ký học phần thất bại. Vui lòng thử lại.",
  };

  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const separatorIndex = error.message.indexOf(" - ");
  if (separatorIndex >= 0) {
    const payloadText = error.message.slice(separatorIndex + 3).trim();

    try {
      const payload = JSON.parse(payloadText) as {
        status?: number;
        message?: string;
        path?: string;
      };

      if (
        payload.status === 400 &&
        typeof payload.path === "string" &&
        payload.path.includes("schedule conflicts with section")
      ) {
        const matched = payload.path.match(/section\s+([A-Za-z0-9_-]+)/i);

        return {
          title: "Không thể đăng ký học phần",
          message: matched
            ? `Lớp học phần bạn chọn bị trùng lịch với lớp ${matched[1]} đã đăng ký. Vui lòng chọn lớp khác hoặc hủy lớp đang bị trùng trước khi đăng ký lại.`
            : "Lớp học phần bạn chọn đang bị trùng lịch với một lớp đã đăng ký. Vui lòng kiểm tra lại thời khóa biểu trước khi đăng ký.",
          detail: payload.path,
        };
      }
    } catch {
      return {
        title: fallback.title,
        message: error.message,
      };
    }
  }

  return {
    title: fallback.title,
    message: error.message,
  };
};

export default function DashboardPage() {
  const { session, logout } = useAuth();
  const toast = useToast();

  const [activeTabKey, setActiveTabKey] =
    useState<StudentFeatureTab["key"]>("home");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [tabError, setTabError] = useState("");
  const [tabMessage, setTabMessage] = useState("");
  useToastFeedback({
    errorMessage: tabError,
    errorTitle: "Thao tác sinh viên thất bại",
  });

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    dateOfBirth: "",
  });

  const [gradeReports, setGradeReports] = useState<GradeReportResponse[]>([]);
  const [attendanceItems, setAttendanceItems] = useState<AttendanceResponse[]>([]);
  const [courseSections, setCourseSections] = useState<CourseSectionResponse[]>(
    [],
  );
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [courseKeyword, setCourseKeyword] = useState("");
  const [selectedCourseName, setSelectedCourseName] = useState("");
  const [registrationNotice, setRegistrationNotice] =
    useState<RegistrationNotice | null>(null);
  const [registeredSections, setRegisteredSections] = useState<
    RegisteredCourseItem[]
  >([]);

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (!studentIdInput) {
      setStudentIdInput(String(session.accountId));
    }
  }, [session, studentIdInput]);

  const activeTab = useMemo(
    () =>
      studentFeatureTabs.find((item) => item.key === activeTabKey) ||
      studentFeatureTabs[0],
    [activeTabKey],
  );

  const selectedSection = useMemo(() => {
    return (
      courseSections.find((section) => String(section.id) === selectedSectionId) ||
      null
    );
  }, [courseSections, selectedSectionId]);

  const courseNameOptions = useMemo(() => {
    return Array.from(
      new Set(courseSections.map((section) => getCourseDisplayName(section))),
    );
  }, [courseSections]);

  const filteredSections = useMemo(() => {
    const normalizedKeyword = courseKeyword.trim().toLowerCase();

    return courseSections.filter((section) => {
      const matchesCourse =
        !selectedCourseName ||
        getCourseDisplayName(section) === selectedCourseName;

      const matchesKeyword =
        !normalizedKeyword ||
        [
          section.courseCode,
          getCourseDisplayName(section),
          getSectionDisplayName(section),
          section.sectionCode,
          section.lecturerName,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedKeyword),
          );

      return matchesCourse && matchesKeyword;
    });
  }, [courseKeyword, courseSections, selectedCourseName]);

  const requireSession = (): string | null => {
    if (!session?.authorization) {
      setTabError("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
      return null;
    }

    return session.authorization;
  };

  const getStudentIdValue = (): number | null => {
    const parsed = Number(studentIdInput);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setTabError("Mã sinh viên không hợp le.");
      return null;
    }

    return parsed;
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

  const buildFallbackProfile = (): ProfileResponse => {
    return {
      username: session?.username,
      role: session?.role,
      studentCode: studentIdInput || undefined,
    };
  };

  const handleLoadProfile = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    setIsWorking(true);
    setTabError("");
    setTabMessage("");

    try {
      const data = await getMyProfile(authorization);
      setProfile(data);
      setProfileForm({
        fullName: data.fullName || "",
        phone: data.phone || "",
        address: data.address || "",
        dateOfBirth: data.dateOfBirth || "",
      });
      setTabMessage("Đã tải thông tin hồ sơ.");
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (
        errorMessage.includes("[API 403]") ||
        errorMessage.includes("[API 404]")
      ) {
        const fallbackProfile = buildFallbackProfile();
        setProfile(fallbackProfile);
        setProfileForm({
          fullName: fallbackProfile.fullName || "",
          phone: fallbackProfile.phone || "",
          address: fallbackProfile.address || "",
          dateOfBirth: fallbackProfile.dateOfBirth || "",
        });
        setTabMessage(
          "Tài khoản hiện tại chưa có dữ liệu hồ sơ đầy đủ. Đang hiển thị thông tin cơ bản.",
        );
        return;
      }

      setTabError(errorMessage);
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      const data = await updateMyProfile(
        {
          fullName: profileForm.fullName.trim(),
          phone: profileForm.phone.trim() || undefined,
          address: profileForm.address.trim() || undefined,
          dateOfBirth: profileForm.dateOfBirth || undefined,
        },
        authorization,
      );
      setProfile(data);
      setTabMessage("Cập nhật hồ sơ thành công.");
      toast.success("Cập nhật hồ sơ thành công.", "Thành công");
    });
  };

  const handleLoadGrades = async () => {
    const authorization = requireSession();
    const studentId = getStudentIdValue();

    if (!authorization || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getMyGradeReports(studentId, authorization);
      setGradeReports(data);
      setTabMessage(`Đã tải ${data.length} bản ghi diem.`);
    });
  };

  const handleLoadAttendance = async () => {
    const authorization = requireSession();
    const studentId = getStudentIdValue();

    if (!authorization || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getMyAttendance(studentId, authorization);
      setAttendanceItems(data);
      setTabMessage(`Đã tải ${data.length} bản ghi chuyên cần.`);
    });
  };

  const handleLoadCourseSections = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      setRegistrationNotice(null);
      const data = await getCourseSections(authorization);
      setCourseSections(data);
      if (data.length > 0) {
        setSelectedSectionId(String(data[0].id));
      }
      setTabMessage(`Đã tải ${data.length} lop hoc phan.`);
    });
  };

  const handleRegisterSection = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    const parsedSectionId = Number(selectedSectionId);
    if (!Number.isInteger(parsedSectionId) || parsedSectionId <= 0) {
      const notice = {
        title: "Chưa chọn lớp học phần",
        message: "Vui lòng chọn một lớp học phần trước khi đăng ký.",
      };
      setRegistrationNotice(notice);
      toast.error(notice.message, notice.title);
      return;
    }

    const parsedStudentId = Number(studentIdInput);

    try {
      setIsWorking(true);
      setTabError("");
      setTabMessage("");
      setRegistrationNotice(null);

      const response = await registerCourseSection(
        {
          courseSectionId: parsedSectionId,
          studentId:
            Number.isInteger(parsedStudentId) && parsedStudentId > 0
              ? parsedStudentId
              : undefined,
        },
        authorization,
      );

      if (selectedSection) {
        setRegisteredSections((currentItems) => {
          const nextItem: RegisteredCourseItem = {
            registrationId: response.id,
            registrationTime: response.registrationTime,
            status: response.status,
            section: selectedSection,
          };

          return [
            nextItem,
            ...currentItems.filter(
              (item) => item.section.id !== selectedSection.id,
            ),
          ];
        });
      }

      setTabMessage("Đăng ký học phần thành công.");
      toast.success("Đăng ký học phần thành công.", "Thành công");
    } catch (error) {
      const notice = parseRegistrationError(error);
      setRegistrationNotice(notice);
      toast.error(notice.message, notice.title);
    } finally {
      setIsWorking(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    if (
      !passwordForm.oldPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setTabError("Vui lòng nhập đầy đủ thông tin đổi mật khẩu.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setTabError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }

    await runAction(async () => {
      await changeMyPassword(passwordForm, authorization);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTabMessage("Đổi mật khẩu thành công.");
      toast.success("Đổi mật khẩu thành công.", "Thành công");
    });
  };

  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <div className="min-h-screen bg-[#e9edf2]">
        <header className="flex h-[52px] items-center justify-between bg-[#0a6ca0] px-3 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/45 text-sm font-semibold">
              SG
            </div>
            <nav className="flex items-center gap-6 text-lg font-semibold">
              {studentTopHeaderTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="text-base transition hover:text-[#d7f0ff]"
                >
                  {getTopHeaderDisplayLabel(item)}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold">
              {(session?.username || "S").slice(0, 1).toUpperCase()}
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{session?.username || "-"}</p>
              <p className="text-xs opacity-90">
                Mã sinh viên: {studentIdInput || "-"}
              </p>
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

        <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 lg:grid-cols-[255px_minmax(0,1fr)]">
          <aside className="border-r border-[#b9cfe0] bg-[#f2f5f8]">
            <div className="border-b border-[#c7d8e5] px-4 py-3 text-[17px] font-semibold text-[#1c587f]">
              Menu sinh viên
            </div>
            <nav className="px-2 py-2">
              {studentFeatureTabs.map((item) => {
                const active = item.key === activeTabKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTabKey(item.key);
                      setTabError("");
                      setTabMessage("");
                      if (item.key !== "course-registration") {
                        setRegistrationNotice(null);
                      }
                      if (item.key === "profile") {
                        void handleLoadProfile();
                      }
                      if (
                        item.key === "course-registration" ||
                        item.key === "schedule"
                      ) {
                        void handleLoadCourseSections();
                      }
                    }}
                    className={`mb-1 flex w-full items-center justify-between rounded-[4px] px-3 py-2 text-left text-[17px] transition ${
                      active
                        ? "bg-[#d6e9f7] font-semibold text-[#0d517a]"
                        : "text-[#234d69] hover:bg-[#e5eef6]"
                    }`}
                  >
                    <span>{getStudentTabDisplayLabel(item)}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-5 border-t border-[#d0dce6] px-3 py-3 text-sm text-[#516b7f]">
              <p className="font-semibold text-[#2d5672]">Điều hướng nhanh</p>
              <p className="mt-2">
                <Link className="font-semibold text-[#0a5f92] hover:underline" href="/login">
                  Về trang đăng nhập
                </Link>
              </p>
            </div>
          </aside>

          <main className="space-y-4 p-3 sm:p-4">
            <section className={contentCardClass}>
              <div className={sectionTitleClass}>
                <h1>{getStudentTabDisplayLabel(activeTab)}</h1>
              </div>
              <div className="space-y-2 px-4 py-3 text-sm text-[#355970]">
                <p>{getStudentTabDescription(activeTab)}</p>
                {tabError ? (
                  <p className="rounded-[4px] border border-[#e8b2b2] bg-[#fff4f4] px-3 py-2 text-[#b03d3d]">
                    {tabError}
                  </p>
                ) : null}
                {tabMessage ? (
                  <p className="rounded-[4px] border border-[#b3dbc1] bg-[#f2fbf5] px-3 py-2 text-[#2f7b4f]">
                    {tabMessage}
                  </p>
                ) : null}
              </div>
            </section>

            {activeTab.key === "home" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Thông báo</h2>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#0a6aa1] hover:underline"
                    >
                      Xem tiep
                    </button>
                  </div>
                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                    {[
                      "Đăng ký môn học học kỳ moi",
                      "Lich cong bo ket qua hoc tap",
                      "Hướng dẫn cập nhật hồ sơ",
                    ].map((item, index) => (
                      <article
                        key={item}
                        className="rounded-[8px] border border-[#c0d8ea] bg-[#f4fbff] p-3"
                      >
                        <p className="text-base font-semibold text-[#1d5b82]">{item}</p>
                        <p className="mt-2 text-sm text-[#4b6a7f]">
                          Cập nhật {formatDateTime(new Date().toISOString())}
                        </p>
                        <p className="mt-2 text-sm text-[#4b6a7f]">
                          Danh muc #{index + 1}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Chuc nang sinh viên</h2>
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
                        {studentFeatureTabs
                          .filter((item) => item.key !== "home")
                          .map((item) => (
                            <tr
                              key={item.key}
                              className="border-b border-[#e0ebf4] text-[#3f6178]"
                            >
                              <td className="px-2 py-2 font-semibold text-[#1f567b]">
                                {item.label}
                              </td>
                              <td className="px-2 py-2">{item.description}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab.key === "profile" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Ho so ca nhan sinh viên</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLoadProfile();
                    }}
                    disabled={isWorking}
                    className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Làm mới
                  </button>
                </div>
                <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-3">
                    <div className="rounded-[6px] border border-[#c8dceb] bg-[#f5fbff] p-3 text-sm text-[#335a72]">
                      {isWorking && !profile ? (
                        <p className="text-[#4c6e86]">Đang tải thông tin hồ sơ...</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Username</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.username || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Vai trò</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.role || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Student code</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.studentCode || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Major</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.majorName || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Email</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.email || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Phone</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.phone || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2 sm:col-span-2">
                            <p className="text-xs text-[#6f8798]">Address</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.address || "-"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <form className="space-y-2" onSubmit={handleSaveProfile}>
                    <input
                      className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Full name"
                      value={profileForm.fullName}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          fullName: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Phone"
                      value={profileForm.phone}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Address"
                      value={profileForm.address}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          address: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="date"
                      className="h-10 w-full rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={profileForm.dateOfBirth}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          dateOfBirth: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="submit"
                      disabled={isWorking}
                      className="rounded-[4px] bg-[#0d6ea6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Cập nhật hồ sơ
                    </button>
                  </form>
                </div>
              </section>
            ) : null}

            {activeTab.key === "course-registration" ? (
              <section className="rounded-[10px] border border-[#6da8c9] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
                <div className="border-b border-[#c5dced] px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3 text-[#185678]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#8ebed9] bg-[#edf7fc] text-sm font-bold">
                        *
                      </span>
                      <div>
                        <h2 className="text-[24px] font-semibold uppercase tracking-[0.01em]">
                          Đăng ký môn học học kỳ 3 - năm học 2025 - 2026
                        </h2>
                        <p className="mt-1 text-sm text-[#5f7e93]">
                          Chọn học phần mở đăng ký và gửi yêu cầu ngay trên bảng bên dưới.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadCourseSections();
                      }}
                      disabled={isWorking}
                      className="h-10 rounded-[8px] border border-[#0d6ea6] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Tải danh sách lớp
                    </button>
                  </div>
                </div>

                <div className="space-y-5 px-4 py-4">
                  {registrationNotice ? (
                    <div className="rounded-[8px] border border-[#efbcbc] bg-[#fff5f5] px-4 py-3 text-[#a94242]">
                      <p className="text-sm font-semibold">{registrationNotice.title}</p>
                      <p className="mt-1 text-sm">{registrationNotice.message}</p>
                      {registrationNotice.detail ? (
                        <p className="mt-1 text-xs text-[#b86a6a]">
                          Chi tiết: {registrationNotice.detail}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <input
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      placeholder="Lọc theo môn học"
                      value={courseKeyword}
                      onChange={(event) => setCourseKeyword(event.target.value)}
                    />
                    <select
                      className="h-11 rounded-[8px] border border-[#d4e2ec] bg-white px-4 text-sm text-[#214b66] outline-none focus:border-[#5fa7d0]"
                      value={selectedCourseName}
                      onChange={(event) => setSelectedCourseName(event.target.value)}
                    >
                      <option value="">Tất cả môn học</option>
                      {courseNameOptions.map((courseName) => (
                        <option key={courseName} value={courseName}>
                          {courseName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[12px] border border-[#6da8c9]">
                    <div className="border-b border-[#c5dced] px-4 py-3">
                      <h3 className="text-[18px] font-semibold text-[#1a4f75]">
                        Danh sách môn học mở cho đăng ký
                      </h3>
                    </div>

                    <div className="max-h-[430px] overflow-auto">
                      <table className="min-w-[1120px] text-left text-sm">
                        <thead className="bg-white">
                          <tr className="border-b border-[#2a7da9] text-[#2d5067]">
                            <th className="w-10 px-3 py-3"></th>
                            <th className="px-3 py-3">Mã MH</th>
                            <th className="px-3 py-3">Tên môn học</th>
                            <th className="px-3 py-3">Nhóm</th>
                            <th className="px-3 py-3">Tổ</th>
                            <th className="px-3 py-3">Số TC</th>
                            <th className="px-3 py-3">Lớp</th>
                            <th className="px-3 py-3">Số lượng</th>
                            <th className="px-3 py-3">Còn lại</th>
                            <th className="px-3 py-3">Thời khóa biểu</th>
                          </tr>
                          <tr className="border-b border-[#2a7da9] bg-[#fbfdfe]">
                            <th className="px-3 py-2 text-[#2a7da9]">Q</th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value={courseKeyword}
                                onChange={(event) =>
                                  setCourseKeyword(event.target.value)
                                }
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value={courseKeyword}
                                onChange={(event) =>
                                  setCourseKeyword(event.target.value)
                                }
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value=""
                                readOnly
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value=""
                                readOnly
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value=""
                                readOnly
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value=""
                                readOnly
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value=""
                                readOnly
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value=""
                                readOnly
                                placeholder="..."
                              />
                            </th>
                            <th className="px-1 py-2">
                              <input
                                className="h-8 w-full rounded-[4px] border border-[#d4e2ec] px-2 text-xs outline-none"
                                value=""
                                readOnly
                                placeholder="..."
                              />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSections.map((section) => {
                            const selected = String(section.id) === selectedSectionId;
                            const capacity = section.maxCapacity ?? "-";
                            const groupLabel = getGroupLabel(section);

                            return (
                              <tr
                                key={section.id}
                                className={`border-b border-[#d7e7f1] text-[#375d75] ${
                                  selected ? "bg-[#edf7fc]" : "bg-white"
                                }`}
                              >
                                <td className="px-3 py-3 align-top">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() =>
                                      setSelectedSectionId(String(section.id))
                                    }
                                    className="mt-1 h-4 w-4 rounded border-[#a9c6d8] accent-[#0d6ea6]"
                                  />
                                </td>
                                <td className="px-3 py-3 align-top font-semibold text-[#1b547a]">
                                  {section.courseCode || "-"}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <p className="max-w-[260px] leading-5">
                                    {getCourseDisplayName(section)}
                                  </p>
                                </td>
                                <td className="px-3 py-3 align-top">{groupLabel}</td>
                                <td className="px-3 py-3 align-top">{groupLabel}</td>
                                <td className="px-3 py-3 align-top">
                                  {getCreditsLabel(section)}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {section.sectionCode || getSectionDisplayName(section)}
                                </td>
                                <td className="px-3 py-3 align-top">{capacity}</td>
                                <td className="px-3 py-3 align-top text-[#d67676]">
                                  {capacity}
                                </td>
                                <td className="px-3 py-3 align-top text-[#58758a]">
                                  {getScheduleLabel(section)}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredSections.length === 0 ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="px-3 py-8 text-center text-[#5d7b91]"
                              >
                                Chưa có học phần phù hợp với bộ lọc hiện tại.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-[12px] border border-[#6da8c9]">
                    <div className="border-b border-[#c5dced] px-4 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <h3 className="text-[18px] font-semibold text-[#1a4f75]">
                          Danh sách môn học đã đăng ký: {registeredSections.length} môn
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleRegisterSection();
                            }}
                            disabled={isWorking || !selectedSectionId}
                            className="h-10 rounded-[8px] border border-[#0d6ea6] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                          >
                            Đăng ký học phần đã chọn
                          </button>
                          <button
                            type="button"
                            className="h-10 rounded-[8px] border border-[#6da8c9] bg-white px-4 text-sm font-semibold text-[#0d6ea6] transition hover:bg-[#f4fbff]"
                          >
                            Xuất phiếu đăng ký
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[980px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#2a7da9] text-[#2d5067]">
                            <th className="px-3 py-3">Xóa</th>
                            <th className="px-3 py-3">Mã MH</th>
                            <th className="px-3 py-3">Tên môn học</th>
                            <th className="px-3 py-3">Nhóm tổ</th>
                            <th className="px-3 py-3">Số TC</th>
                            <th className="px-3 py-3">Lớp</th>
                            <th className="px-3 py-3">Ngày đăng ký</th>
                            <th className="px-3 py-3">Trạng thái</th>
                            <th className="px-3 py-3">Thời khóa biểu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registeredSections.map((item) => (
                            <tr
                              key={item.registrationId}
                              className="border-b border-[#d7e7f1] text-[#375d75]"
                            >
                              <td className="px-3 py-3 align-top text-[#d16d6d]">x</td>
                              <td className="px-3 py-3 align-top font-semibold text-[#1b547a]">
                                {item.section.courseCode || "-"}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {getCourseDisplayName(item.section)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {getGroupLabel(item.section)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {getCreditsLabel(item.section)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {item.section.sectionCode || getSectionDisplayName(item.section)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {formatDateTime(item.registrationTime)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRegistrationStatusClass(
                                    item.status,
                                  )}`}
                                >
                                  {getRegistrationStatusLabel(item.status)}
                                </span>
                              </td>
                              <td className="px-3 py-3 align-top text-[#58758a]">
                                {getScheduleLabel(item.section)}
                              </td>
                            </tr>
                          ))}
                          {registeredSections.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                className="px-3 py-8 text-center text-[#5d7b91]"
                              >
                                Chưa có học phần nào được đăng ký trong phiên hiện tại.
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

            {activeTab.key === "schedule" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Thời khóa biểu sinh viên</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLoadCourseSections();
                    }}
                    disabled={isWorking}
                    className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Làm mới
                  </button>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">Section</th>
                          <th className="px-2 py-2">Môn học</th>
                          <th className="px-2 py-2">Giang vien</th>
                          <th className="px-2 py-2">Học kỳ</th>
                          <th className="px-2 py-2">Nam hoc</th>
                          <th className="px-2 py-2">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseSections.slice(0, 60).map((section) => (
                          <tr
                            key={section.id}
                            className="border-b border-[#e0ebf4] text-[#3f6178]"
                          >
                            <td className="px-2 py-2">
                              {section.displayName || section.sectionCode || section.id}
                            </td>
                            <td className="px-2 py-2">
                              {section.courseName || section.courseCode || "-"}
                            </td>
                            <td className="px-2 py-2">{section.lecturerName || "-"}</td>
                            <td className="px-2 py-2">{section.semesterNumber || "-"}</td>
                            <td className="px-2 py-2">{section.academicYear || "-"}</td>
                            <td className="px-2 py-2">{section.status || "-"}</td>
                          </tr>
                        ))}
                        {courseSections.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-2 py-4 text-center text-[#577086]">
                              Chưa có dữ liệu thời khóa biểu.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab.key === "grades" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Bạng diem sinh viên</h2>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 w-[180px] rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Mã sinh viên"
                      value={studentIdInput}
                      onChange={(event) => setStudentIdInput(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadGrades();
                      }}
                      disabled={isWorking}
                      className="h-9 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Tải diem
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto px-4 py-4">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Môn học</th>
                        <th className="px-2 py-2">Điểm</th>
                        <th className="px-2 py-2">Điểm chu</th>
                        <th className="px-2 py-2">Trạng thái</th>
                        <th className="px-2 py-2">Ngay tao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeReports.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[#e0ebf4] text-[#3f6178]"
                        >
                          <td className="px-2 py-2">{item.courseName || "-"}</td>
                          <td className="px-2 py-2">{item.finalScore ?? "-"}</td>
                          <td className="px-2 py-2">{item.letterGrađể || "-"}</td>
                          <td className="px-2 py-2">{item.status || "-"}</td>
                          <td className="px-2 py-2">{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))}
                      {gradeReports.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-2 py-4 text-center text-[#577086]">
                            Chưa có dữ liệu diem.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeTab.key === "attendance" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Chuyên cần sinh viên</h2>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 w-[180px] rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Mã sinh viên"
                      value={studentIdInput}
                      onChange={(event) => setStudentIdInput(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadAttendance();
                      }}
                      disabled={isWorking}
                      className="h-9 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Tải chuyên cần
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto px-4 py-4">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Ngay hoc</th>
                        <th className="px-2 py-2">Session ID</th>
                        <th className="px-2 py-2">Trạng thái</th>
                        <th className="px-2 py-2">Ghi chu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceItems.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[#e0ebf4] text-[#3f6178]"
                        >
                          <td className="px-2 py-2">{formatDate(item.sessionDate)}</td>
                          <td className="px-2 py-2">{item.sessionId || "-"}</td>
                          <td className="px-2 py-2">{item.status || "-"}</td>
                          <td className="px-2 py-2">{item.note || "-"}</td>
                        </tr>
                      ))}
                      {attendanceItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-[#577086]">
                            Chưa có dữ liệu chuyên cần.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeTab.key === "password" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Đổi mật khẩu</h2>
                </div>
                <form
                  className="grid max-w-[520px] gap-2 px-4 py-4"
                  onSubmit={handleChangePassword}
                >
                  <input
                    type="password"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Mật khẩu hiện tại"
                    value={passwordForm.oldPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        oldPassword: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="password"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Mật khẩu mới"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="password"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Xác nhận mật khẩu mới"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={isWorking}
                    className="mt-1 h-10 rounded-[4px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Lưu mật khẩu mới
                  </button>
                </form>
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}






