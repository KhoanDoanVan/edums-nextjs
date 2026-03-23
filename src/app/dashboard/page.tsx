"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
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

  return "Thao tac that bai. Vui long thu lai.";
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

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

export default function DashboardPage() {
  const { session, logout } = useAuth();

  const [activeTabKey, setActiveTabKey] =
    useState<StudentFeatureTab["key"]>("home");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [tabError, setTabError] = useState("");
  const [tabMessage, setTabMessage] = useState("");

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

  const requireSession = (): string | null => {
    if (!session?.authorization) {
      setTabError("Khong tim thay token dang nhap. Vui long dang nhap lai.");
      return null;
    }

    return session.authorization;
  };

  const getStudentIdValue = (): number | null => {
    const parsed = Number(studentIdInput);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setTabError("Student ID khong hop le.");
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
      setTabMessage("Da tai thong tin profile.");
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
          "Tai khoan hien tai chua co du lieu ho so day du. Dang hien thi thong tin co ban.",
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
      setTabMessage("Cap nhat profile thanh cong.");
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
      setTabMessage(`Da tai ${data.length} ban ghi diem.`);
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
      setTabMessage(`Da tai ${data.length} ban ghi chuyen can.`);
    });
  };

  const handleLoadCourseSections = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      const data = await getCourseSections(authorization);
      setCourseSections(data);
      if (data.length > 0) {
        setSelectedSectionId(String(data[0].id));
      }
      setTabMessage(`Da tai ${data.length} lop hoc phan.`);
    });
  };

  const handleRegisterSection = async () => {
    const authorization = requireSession();
    if (!authorization) {
      return;
    }

    const parsedSectionId = Number(selectedSectionId);
    if (!Number.isInteger(parsedSectionId) || parsedSectionId <= 0) {
      setTabError("Vui long chon lop hoc phan.");
      return;
    }

    const parsedStudentId = Number(studentIdInput);

    await runAction(async () => {
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

      setTabMessage(
        `Dang ky thanh cong. Registration ID: ${response.id}, status: ${response.status || "-"}.`,
      );
    });
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
      setTabError("Vui long nhap day du thong tin doi mat khau.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setTabError("Mat khau moi va xac nhan mat khau khong khop.");
      return;
    }

    await runAction(async () => {
      await changeMyPassword(passwordForm, authorization);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTabMessage("Doi mat khau thanh cong.");
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
                  {item}
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
                Student ID: {studentIdInput || "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-[4px] border border-white/40 px-2 py-1 text-sm font-semibold transition hover:bg-white/15"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 lg:grid-cols-[255px_minmax(0,1fr)]">
          <aside className="border-r border-[#b9cfe0] bg-[#f2f5f8]">
            <div className="border-b border-[#c7d8e5] px-4 py-3 text-[17px] font-semibold text-[#1c587f]">
              Student Menu
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
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-5 border-t border-[#d0dce6] px-3 py-3 text-sm text-[#516b7f]">
              <p className="font-semibold text-[#2d5672]">Dieu huong nhanh</p>
              <p className="mt-2">
                <Link className="font-semibold text-[#0a5f92] hover:underline" href="/login">
                  Ve trang dang nhap
                </Link>
              </p>
            </div>
          </aside>

          <main className="space-y-4 p-3 sm:p-4">
            <section className={contentCardClass}>
              <div className={sectionTitleClass}>
                <h1>{activeTab.label}</h1>
              </div>
              <div className="space-y-2 px-4 py-3 text-sm text-[#355970]">
                <p>{activeTab.description}</p>
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
                    <h2>Thong bao</h2>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#0a6aa1] hover:underline"
                    >
                      Xem tiep
                    </button>
                  </div>
                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                    {[
                      "Dang ky mon hoc hoc ky moi",
                      "Lich cong bo ket qua hoc tap",
                      "Huong dan cap nhat profile",
                    ].map((item, index) => (
                      <article
                        key={item}
                        className="rounded-[8px] border border-[#c0d8ea] bg-[#f4fbff] p-3"
                      >
                        <p className="text-base font-semibold text-[#1d5b82]">{item}</p>
                        <p className="mt-2 text-sm text-[#4b6a7f]">
                          Cap nhat {formatDateTime(new Date().toISOString())}
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
                    <h2>Chuc nang sinh vien</h2>
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
                  <h2>Ho so ca nhan sinh vien</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLoadProfile();
                    }}
                    disabled={isWorking}
                    className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Lam moi
                  </button>
                </div>
                <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-3">
                    <div className="rounded-[6px] border border-[#c8dceb] bg-[#f5fbff] p-3 text-sm text-[#335a72]">
                      {isWorking && !profile ? (
                        <p className="text-[#4c6e86]">Dang tai thong tin profile...</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Username</p>
                            <p className="font-semibold text-[#1c4f72]">
                              {profile?.username || "-"}
                            </p>
                          </div>
                          <div className="rounded-[4px] border border-[#d4e6f2] bg-white px-3 py-2">
                            <p className="text-xs text-[#6f8798]">Role</p>
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
                      Cap nhat profile
                    </button>
                  </form>
                </div>
              </section>
            ) : null}

            {activeTab.key === "course-registration" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Dang ky mon hoc</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLoadCourseSections();
                    }}
                    disabled={isWorking}
                    className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Tai danh sach lop
                  </button>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <div className="grid gap-2 md:grid-cols-[220px_1fr_180px]">
                    <input
                      className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Student ID"
                      value={studentIdInput}
                      onChange={(event) => setStudentIdInput(event.target.value)}
                    />
                    <select
                      className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      value={selectedSectionId}
                      onChange={(event) => setSelectedSectionId(event.target.value)}
                    >
                      <option value="">Chon lop hoc phan</option>
                      {courseSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.displayName || section.sectionCode || `Section ${section.id}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        void handleRegisterSection();
                      }}
                      disabled={isWorking}
                      className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Dang ky lop
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">Section</th>
                          <th className="px-2 py-2">Course</th>
                          <th className="px-2 py-2">Lecturer</th>
                          <th className="px-2 py-2">Hoc ky</th>
                          <th className="px-2 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseSections.slice(0, 40).map((section) => (
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
                            <td className="px-2 py-2">
                              {section.semesterNumber || "-"} / {section.academicYear || "-"}
                            </td>
                            <td className="px-2 py-2">{section.status || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab.key === "schedule" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Thoi khoa bieu sinh vien</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLoadCourseSections();
                    }}
                    disabled={isWorking}
                    className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Lam moi
                  </button>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">Section</th>
                          <th className="px-2 py-2">Mon hoc</th>
                          <th className="px-2 py-2">Giang vien</th>
                          <th className="px-2 py-2">Hoc ky</th>
                          <th className="px-2 py-2">Nam hoc</th>
                          <th className="px-2 py-2">Trang thai</th>
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
                              Chua co du lieu thoi khoa bieu.
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
                  <h2>Bang diem sinh vien</h2>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 w-[180px] rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Student ID"
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
                      Tai diem
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto px-4 py-4">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Mon hoc</th>
                        <th className="px-2 py-2">Diem</th>
                        <th className="px-2 py-2">Diem chu</th>
                        <th className="px-2 py-2">Trang thai</th>
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
                          <td className="px-2 py-2">{item.letterGrade || "-"}</td>
                          <td className="px-2 py-2">{item.status || "-"}</td>
                          <td className="px-2 py-2">{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))}
                      {gradeReports.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-2 py-4 text-center text-[#577086]">
                            Chua co du lieu diem.
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
                  <h2>Chuyen can sinh vien</h2>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 w-[180px] rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Student ID"
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
                      Tai chuyen can
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto px-4 py-4">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">Ngay hoc</th>
                        <th className="px-2 py-2">Session ID</th>
                        <th className="px-2 py-2">Trang thai</th>
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
                            Chua co du lieu chuyen can.
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
                  <h2>Doi mat khau</h2>
                </div>
                <form
                  className="grid max-w-[520px] gap-2 px-4 py-4"
                  onSubmit={handleChangePassword}
                >
                  <input
                    type="password"
                    className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                    placeholder="Mat khau hien tai"
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
                    placeholder="Mat khau moi"
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
                    placeholder="Xac nhan mat khau moi"
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
                    Luu mat khau moi
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
