"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/context/auth-context";
import { normalizeRole } from "@/lib/auth/role";
import {
  getAccounts,
  getAdministrativeClasses,
  getAdmissionApplications,
  getAdmissionBenchmarks,
  getAdmissionBlocks,
  getAdmissionPeriods,
  getClassrooms,
  getCohorts,
  getCourseSections,
  getCourses,
  getFaculties,
  getGuardians,
  getLecturers,
  getMajors,
  getRolePermissions,
  getRoles,
  getSectionGradeReports,
  getSpecializations,
  getStudentAttendances,
  getStudents,
  updateAccountStatus,
} from "@/lib/admin/service";
import { adminFeatureTabs, adminTopHeaderTabs } from "@/lib/admin/tabs";
import type {
  AccountListItem,
  AdminFeatureTab,
  AdminTabKey,
  ApplicationListItem,
  BenchmarkListItem,
  BlockListItem,
  CourseSectionListItem,
  DynamicRow,
  PagedRows,
  PeriodListItem,
  RoleListItem,
} from "@/lib/admin/types";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Thao tac that bai. Vui long thu lai.";
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

const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map((item) => toDisplayValue(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }

  return String(value);
};

const toColumnLabel = (field: string): string => {
  const spaced = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  return spaced ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : field;
};

const buildColumns = (
  rows: DynamicRow[],
  priorityColumns: string[],
): string[] => {
  const keys = new Set<string>();

  for (const row of rows.slice(0, 50)) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }

  const priority = priorityColumns.filter((key) => keys.has(key));
  const others = [...keys].filter((key) => !priorityColumns.includes(key)).sort();

  return [...priority, ...others];
};

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

export default function AdminDashboardPage() {
  const { session, logout, registerAccount } = useAuth();

  const [activeTabKey, setActiveTabKey] = useState<AdminTabKey>("home");
  const [tabError, setTabError] = useState("");
  const [tabMessage, setTabMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [accounts, setAccounts] = useState<PagedRows<AccountListItem>>({ rows: [] });
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [students, setStudents] = useState<PagedRows<DynamicRow>>({ rows: [] });
  const [lecturers, setLecturers] = useState<PagedRows<DynamicRow>>({ rows: [] });
  const [guardians, setGuardians] = useState<PagedRows<DynamicRow>>({ rows: [] });
  const [courseSections, setCourseSections] = useState<CourseSectionListItem[]>([]);

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
  const [catalogRows, setCatalogRows] = useState<DynamicRow[]>([]);
  const [gradeRows, setGradeRows] = useState<DynamicRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<DynamicRow[]>([]);
  const [gradeSectionIdInput, setGradeSectionIdInput] = useState("");
  const [attendanceStudentIdInput, setAttendanceStudentIdInput] = useState("");
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);
  const [studentAccountForm, setStudentAccountForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    avatarUrl: "",
  });

  const activeTab = useMemo(
    () =>
      adminFeatureTabs.find((item) => item.key === activeTabKey) ||
      adminFeatureTabs[0],
    [activeTabKey],
  );

  const studentColumns = useMemo(
    () =>
      buildColumns(students.rows, [
        "id",
        "studentCode",
        "fullName",
        "email",
        "phone",
        "status",
      ]),
    [students.rows],
  );

  const lecturerColumns = useMemo(
    () =>
      buildColumns(lecturers.rows, [
        "id",
        "fullName",
        "email",
        "academicDegree",
        "phone",
      ]),
    [lecturers.rows],
  );

  const guardianColumns = useMemo(
    () => buildColumns(guardians.rows, ["id", "fullName", "phone", "relationship"]),
    [guardians.rows],
  );

  const catalogColumns = useMemo(
    () =>
      buildColumns(catalogRows, [
        "id",
        "code",
        "name",
        "displayName",
        "fullName",
        "status",
      ]),
    [catalogRows],
  );

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

  const attendanceColumns = useMemo(
    () =>
      buildColumns(attendanceRows, [
        "id",
        "studentId",
        "sessionId",
        "sessionDate",
        "status",
        "note",
      ]),
    [attendanceRows],
  );

  const requireAuthorization = (): string | null => {
    if (!session?.authorization) {
      setTabError("Khong tim thay token dang nhap. Vui long dang nhap lai.");
      return null;
    }

    return session.authorization;
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

  const parsePositiveInteger = (
    rawValue: string,
    fieldLabel: string,
  ): number | null => {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setTabError(`${fieldLabel} khong hop le.`);
      return null;
    }

    return parsed;
  };

  const resolveStudentRoleId = async (authorization: string): Promise<number> => {
    const cachedRole = roles.find(
      (role) => normalizeRole(role.roleName) === "STUDENT",
    );
    if (cachedRole?.id) {
      return cachedRole.id;
    }

    const roleRows = await getRoles(authorization);
    setRoles(roleRows);
    const studentRole = roleRows.find(
      (role) => normalizeRole(role.roleName) === "STUDENT",
    );

    if (!studentRole?.id) {
      throw new Error(
        "Khong tim thay role STUDENT. Vui long kiem tra danh sach role tren backend.",
      );
    }

    return studentRole.id;
  };

  const handleCreateStudentAccount = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setTabError("");

    const username = studentAccountForm.username.trim();
    const password = studentAccountForm.password;
    const confirmPassword = studentAccountForm.confirmPassword;
    const avatarUrl = studentAccountForm.avatarUrl.trim();

    if (!username || !password || !confirmPassword) {
      setTabError("Vui long nhap day du username, password va xac nhan.");
      return;
    }

    if (password.length < 6) {
      setTabError("Password toi thieu 6 ky tu.");
      return;
    }

    if (password !== confirmPassword) {
      setTabError("Password va xac nhan password khong khop.");
      return;
    }

    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      const studentRoleId = await resolveStudentRoleId(authorization);
      const createdAccount = await registerAccount({
        username,
        password,
        roleId: studentRoleId,
        avatarUrl: avatarUrl || undefined,
      });

      let activated = true;
      try {
        await updateAccountStatus(createdAccount.id, "ACTIVE", authorization);
      } catch {
        activated = false;
      }

      setStudentAccountForm({
        username: "",
        password: "",
        confirmPassword: "",
        avatarUrl: "",
      });

      const accountRows = await getAccounts(authorization);
      setAccounts(accountRows);
      setTabMessage(
        activated
          ? `Tao tai khoan STUDENT thanh cong: ${createdAccount.username} (ID ${createdAccount.id}), trang thai ACTIVE.`
          : `Da tao tai khoan STUDENT ${createdAccount.username} (ID ${createdAccount.id}) nhung chua kich hoat ACTIVE.`,
      );
      setIsCreateStudentModalOpen(false);
    });
  };

  const loadTabData = async (tabKey: AdminTabKey) => {
    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      switch (tabKey) {
        case "accounts": {
          const data = await getAccounts(authorization);
          setAccounts(data);
          setTabMessage(`Da tai ${data.rows.length} tai khoan.`);
          break;
        }
        case "roles": {
          const [roleRows, permissionRows] = await Promise.all([
            getRoles(authorization),
            getRolePermissions(authorization),
          ]);
          setRoles(roleRows);
          setPermissions(permissionRows);
          setTabMessage(
            `Da tai ${roleRows.length} role va ${permissionRows.length} quyen.`,
          );
          break;
        }
        case "faculties": {
          const data = await getFaculties(authorization);
          setCatalogRows(data.rows);
          setTabMessage(`Da tai ${data.rows.length} khoa.`);
          break;
        }
        case "majors": {
          const data = await getMajors(authorization);
          setCatalogRows(data.rows);
          setTabMessage(`Da tai ${data.rows.length} nganh.`);
          break;
        }
        case "specializations": {
          const data = await getSpecializations(authorization);
          setCatalogRows(data.rows);
          setTabMessage(`Da tai ${data.rows.length} chuyen nganh.`);
          break;
        }
        case "cohorts": {
          const data = await getCohorts(authorization);
          setCatalogRows(data.rows);
          setTabMessage(`Da tai ${data.rows.length} nien khoa.`);
          break;
        }
        case "courses": {
          const data = await getCourses(authorization);
          setCatalogRows(data.rows);
          setTabMessage(`Da tai ${data.rows.length} mon hoc.`);
          break;
        }
        case "classrooms": {
          const data = await getClassrooms(authorization);
          setCatalogRows(data.rows);
          setTabMessage(`Da tai ${data.rows.length} phong hoc.`);
          break;
        }
        case "administrative-classes": {
          const data = await getAdministrativeClasses(authorization);
          setCatalogRows(data.rows);
          setTabMessage(`Da tai ${data.rows.length} lop chu nhiem.`);
          break;
        }
        case "students": {
          const data = await getStudents(authorization);
          setStudents(data);
          setTabMessage(`Da tai ${data.rows.length} sinh vien.`);
          break;
        }
        case "lecturers": {
          const data = await getLecturers(authorization);
          setLecturers(data);
          setTabMessage(`Da tai ${data.rows.length} giang vien.`);
          break;
        }
        case "guardians": {
          const data = await getGuardians(authorization);
          setGuardians(data);
          setTabMessage(`Da tai ${data.rows.length} phu huynh.`);
          break;
        }
        case "course-sections": {
          const data = await getCourseSections(authorization);
          setCourseSections(data);
          setTabMessage(`Da tai ${data.length} lop hoc phan.`);
          break;
        }
        case "admissions": {
          const [periodRows, blockRows, benchmarkRows, applicationRows] =
            await Promise.all([
              getAdmissionPeriods(authorization),
              getAdmissionBlocks(authorization),
              getAdmissionBenchmarks(authorization),
              getAdmissionApplications(authorization),
            ]);

          setAdmissionPeriods(periodRows);
          setAdmissionBlocks(blockRows);
          setAdmissionBenchmarks(benchmarkRows);
          setAdmissionApplications(applicationRows);
          setTabMessage(
            `Da tai tuyen sinh: ${periodRows.rows.length} periods, ${blockRows.length} blocks, ${benchmarkRows.rows.length} benchmarks, ${applicationRows.rows.length} applications.`,
          );
          break;
        }
        case "grade-management": {
          setGradeRows([]);
          setTabMessage("Nhap section ID roi bam Tai diem theo lop hoc phan.");
          break;
        }
        case "attendance-management": {
          setAttendanceRows([]);
          setTabMessage("Nhap student ID roi bam Tai diem danh.");
          break;
        }
        case "home":
        default:
          break;
      }
    });
  };

  const handleTabChange = (tab: AdminFeatureTab) => {
    setActiveTabKey(tab.key);
    setTabError("");
    setTabMessage("");

    if (tab.key !== "home") {
      void loadTabData(tab.key);
    }
  };

  const handleLoadGradeReports = async () => {
    const authorization = requireAuthorization();
    const sectionId = parsePositiveInteger(gradeSectionIdInput, "Section ID");
    if (!authorization || !sectionId) {
      return;
    }

    await runAction(async () => {
      const data = await getSectionGradeReports(sectionId, authorization);
      setGradeRows(data);
      setTabMessage(`Da tai ${data.length} ban ghi diem cho section ${sectionId}.`);
    });
  };

  const handleLoadAttendances = async () => {
    const authorization = requireAuthorization();
    const studentId = parsePositiveInteger(
      attendanceStudentIdInput,
      "Student ID",
    );
    if (!authorization || !studentId) {
      return;
    }

    await runAction(async () => {
      const data = await getStudentAttendances(studentId, authorization);
      setAttendanceRows(data);
      setTabMessage(`Da tai ${data.length} ban ghi diem danh cho student ${studentId}.`);
    });
  };

  const renderDynamicTable = (
    title: string,
    rows: DynamicRow[],
    columns: string[],
  ) => {
    return (
      <section className={contentCardClass}>
        <div className={sectionTitleClass}>
          <h2>{title}</h2>
          <span className="text-sm font-medium text-[#396786]">{rows.length} records</span>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#cfdfec] text-[#305970]">
                {columns.map((column) => (
                  <th key={column} className="px-2 py-2">
                    {toColumnLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`dynamic-row-${index}`}
                  className="border-b border-[#e0ebf4] text-[#3f6178]"
                >
                  {columns.map((column) => (
                    <td key={`${index}-${column}`} className="max-w-[260px] px-2 py-2">
                      <span className="line-clamp-2">{toDisplayValue(row[column])}</span>
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="px-2 py-4 text-center text-[#577086]">
                    Chua co du lieu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const catalogTabTitles: Partial<Record<AdminTabKey, string>> = {
    faculties: "Danh sach khoa",
    majors: "Danh sach nganh",
    specializations: "Danh sach chuyen nganh",
    cohorts: "Danh sach nien khoa",
    courses: "Danh sach mon hoc",
    classrooms: "Danh sach phong hoc",
    "administrative-classes": "Danh sach lop chu nhiem",
  };

  const catalogTabKey = Object.prototype.hasOwnProperty.call(
    catalogTabTitles,
    activeTab.key,
  )
    ? (activeTab.key as keyof typeof catalogTabTitles)
    : null;

  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-[#e9edf2]">
        <header className="flex h-[52px] items-center justify-between bg-[#0a6ca0] px-3 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/45 text-sm font-semibold">
              AD
            </div>
            <nav className="flex items-center gap-6 text-lg font-semibold">
              {adminTopHeaderTabs.map((item) => (
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
              {(session?.username || "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{session?.username || "-"}</p>
              <p className="text-xs opacity-90">Role: {session?.role || "-"}</p>
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

        <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 lg:grid-cols-[275px_minmax(0,1fr)]">
          <aside className="border-r border-[#b9cfe0] bg-[#f2f5f8]">
            <div className="border-b border-[#c7d8e5] px-4 py-3 text-[17px] font-semibold text-[#1c587f]">
              Admin Menu
            </div>
            <nav className="px-2 py-2">
              {adminFeatureTabs.map((item) => {
                const active = item.key === activeTabKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleTabChange(item)}
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
                <Link className="font-semibold text-[#0a5f92] hover:underline" href="/dashboard">
                  Mo dashboard student
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
                    <h2>Tong quan nhanh</h2>
                  </div>
                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3 xl:grid-cols-4">
                    {adminFeatureTabs
                      .filter((item) => item.key !== "home")
                      .map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleTabChange(item)}
                          className="rounded-[8px] border border-[#c0d8ea] bg-[#f4fbff] p-3 text-left transition hover:border-[#7eb3d9] hover:bg-[#eaf5ff]"
                        >
                          <p className="text-base font-semibold text-[#1d5b82]">{item.label}</p>
                          <p className="mt-2 text-xs text-[#6c8597]">Click de tai du lieu</p>
                        </button>
                      ))}
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Danh sach chuc nang admin</h2>
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
                        {adminFeatureTabs
                          .filter((item) => item.key !== "home")
                          .map((item) => (
                            <tr key={item.key} className="border-b border-[#e0ebf4] text-[#3f6178]">
                              <td className="px-2 py-2 font-semibold text-[#1f567b]">{item.label}</td>
                              <td className="px-2 py-2">{item.description}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab.key === "accounts" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Danh sach tai khoan</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTabError("");
                        setIsCreateStudentModalOpen(true);
                      }}
                      className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90]"
                    >
                      Tao tai khoan STUDENT
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void loadTabData("accounts");
                      }}
                      disabled={isWorking}
                      className="rounded-[4px] border border-[#9ec3dd] bg-white px-3 py-1.5 text-sm font-semibold text-[#165a83] transition hover:bg-[#edf6fd] disabled:opacity-60"
                    >
                      Lam moi
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto px-4 py-4">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">ID</th>
                        <th className="px-2 py-2">Username</th>
                        <th className="px-2 py-2">Role</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Created at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.rows.map((item) => (
                        <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                          <td className="px-2 py-2">{item.id}</td>
                          <td className="px-2 py-2">{item.username || "-"}</td>
                          <td className="px-2 py-2">{item.roleName || "-"}</td>
                          <td className="px-2 py-2">{item.status || "-"}</td>
                          <td className="px-2 py-2">{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))}
                      {accounts.rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-2 py-4 text-center text-[#577086]">
                            Chua co du lieu tai khoan.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {isCreateStudentModalOpen ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#08273f]/55 px-3 py-6 backdrop-blur-[1px]"
                    onClick={() => {
                      if (!isWorking) {
                        setIsCreateStudentModalOpen(false);
                      }
                    }}
                  >
                    <div
                      className="w-full max-w-[620px] rounded-[14px] border border-[#8db7d5] bg-white shadow-[0_18px_60px_rgba(7,35,62,0.36)]"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-[#d2e4f1] px-5 py-3">
                        <h3 className="text-[20px] font-semibold text-[#154f75]">
                          Tao Tai Khoan Sinh Vien
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isWorking) {
                              setIsCreateStudentModalOpen(false);
                            }
                          }}
                          className="rounded-full border border-[#bdd5e7] px-2 py-0.5 text-xl leading-none text-[#346180] transition hover:bg-[#edf6fd]"
                          disabled={isWorking}
                          aria-label="Dong popup"
                        >
                          ×
                        </button>
                      </div>

                      <form
                        className="grid gap-3 px-5 py-4 md:grid-cols-2"
                        onSubmit={handleCreateStudentAccount}
                      >
                        <label className="space-y-1 md:col-span-2">
                          <span className="text-sm font-semibold text-[#2c5877]">Username</span>
                          <input
                            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                            placeholder="Nhap username sinh vien"
                            value={studentAccountForm.username}
                            onChange={(event) =>
                              setStudentAccountForm((prev) => ({
                                ...prev,
                                username: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-sm font-semibold text-[#2c5877]">Password</span>
                          <input
                            type="password"
                            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                            placeholder="Toi thieu 6 ky tu"
                            value={studentAccountForm.password}
                            onChange={(event) =>
                              setStudentAccountForm((prev) => ({
                                ...prev,
                                password: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-sm font-semibold text-[#2c5877]">
                            Xac nhan password
                          </span>
                          <input
                            type="password"
                            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                            placeholder="Nhap lai password"
                            value={studentAccountForm.confirmPassword}
                            onChange={(event) =>
                              setStudentAccountForm((prev) => ({
                                ...prev,
                                confirmPassword: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="space-y-1 md:col-span-2">
                          <span className="text-sm font-semibold text-[#2c5877]">
                            Avatar URL (khong bat buoc)
                          </span>
                          <input
                            className="h-10 w-full rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] placeholder:text-[#5f6b76] outline-none focus:border-[#6aa8cf]"
                            placeholder="https://..."
                            value={studentAccountForm.avatarUrl}
                            onChange={(event) =>
                              setStudentAccountForm((prev) => ({
                                ...prev,
                                avatarUrl: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <div className="mt-1 flex justify-end gap-2 md:col-span-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isWorking) {
                                setIsCreateStudentModalOpen(false);
                              }
                            }}
                            className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-4 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                            disabled={isWorking}
                          >
                            Huy
                          </button>
                          <button
                            type="submit"
                            disabled={isWorking}
                            className="h-10 rounded-[6px] bg-[#0d6ea6] px-4 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                          >
                            {isWorking ? "Dang tao..." : "Tao tai khoan"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab.key === "roles" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Danh sach role</h2>
                    <button
                      type="button"
                      onClick={() => {
                        void loadTabData("roles");
                      }}
                      disabled={isWorking}
                      className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Lam moi
                    </button>
                  </div>
                  <div className="overflow-x-auto px-4 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#cfdfec] text-[#305970]">
                          <th className="px-2 py-2">ID</th>
                          <th className="px-2 py-2">Role name</th>
                          <th className="px-2 py-2">Function codes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map((role) => (
                          <tr key={role.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                            <td className="px-2 py-2">{role.id}</td>
                            <td className="px-2 py-2">{role.roleName || "-"}</td>
                            <td className="px-2 py-2">{toDisplayValue(role.functionCodes)}</td>
                          </tr>
                        ))}
                        {roles.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-2 py-4 text-center text-[#577086]">
                              Chua co role.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Tap permission he thong</h2>
                    <span className="text-sm font-medium text-[#396786]">{permissions.length} permissions</span>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 py-4">
                    {permissions.length > 0 ? (
                      permissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full border border-[#9ec3dd] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f5d86]"
                        >
                          {permission}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-[#577086]">Chua tai permission.</p>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {catalogTabKey
              ? renderDynamicTable(
                  catalogTabTitles[catalogTabKey] || activeTab.label,
                  catalogRows,
                  catalogColumns,
                )
              : null}

            {activeTab.key === "grade-management" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Quan ly diem theo lop hoc phan</h2>
                  </div>
                  <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px]">
                    <input
                      className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Section ID"
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
                      Tai diem theo lop
                    </button>
                  </div>
                </section>
                {renderDynamicTable(
                  "Bang diem theo lop hoc phan",
                  gradeRows,
                  gradeColumns,
                )}
              </div>
            ) : null}

            {activeTab.key === "attendance-management" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Quan ly diem danh theo sinh vien</h2>
                  </div>
                  <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px]">
                    <input
                      className="h-10 rounded-[4px] border border-[#c8d3dd] px-3 text-sm outline-none focus:border-[#6aa8cf]"
                      placeholder="Student ID"
                      value={attendanceStudentIdInput}
                      onChange={(event) => setAttendanceStudentIdInput(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadAttendances();
                      }}
                      disabled={isWorking}
                      className="h-10 rounded-[4px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Tai diem danh
                    </button>
                  </div>
                </section>
                {renderDynamicTable(
                  "Bang diem danh theo sinh vien",
                  attendanceRows,
                  attendanceColumns,
                )}
              </div>
            ) : null}

            {activeTab.key === "students"
              ? renderDynamicTable("Danh sach sinh vien", students.rows, studentColumns)
              : null}

            {activeTab.key === "lecturers"
              ? renderDynamicTable("Danh sach giang vien", lecturers.rows, lecturerColumns)
              : null}

            {activeTab.key === "guardians"
              ? renderDynamicTable("Danh sach phu huynh", guardians.rows, guardianColumns)
              : null}

            {activeTab.key === "course-sections" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Lop hoc phan</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void loadTabData("course-sections");
                    }}
                    disabled={isWorking}
                    className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Lam moi
                  </button>
                </div>
                <div className="overflow-x-auto px-4 py-4">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#cfdfec] text-[#305970]">
                        <th className="px-2 py-2">ID</th>
                        <th className="px-2 py-2">Section code</th>
                        <th className="px-2 py-2">Display name</th>
                        <th className="px-2 py-2">Course</th>
                        <th className="px-2 py-2">Lecturer</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseSections.map((item) => (
                        <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
                          <td className="px-2 py-2">{item.id}</td>
                          <td className="px-2 py-2">{item.sectionCode || "-"}</td>
                          <td className="px-2 py-2">{item.displayName || "-"}</td>
                          <td className="px-2 py-2">{item.courseName || "-"}</td>
                          <td className="px-2 py-2">{item.lecturerName || "-"}</td>
                          <td className="px-2 py-2">{item.status || "-"}</td>
                        </tr>
                      ))}
                      {courseSections.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-2 py-4 text-center text-[#577086]">
                            Chua co du lieu lop hoc phan.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeTab.key === "admissions" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Ky tuyen sinh (periods)</h2>
                    <button
                      type="button"
                      onClick={() => {
                        void loadTabData("admissions");
                      }}
                      disabled={isWorking}
                      className="rounded-[4px] bg-[#0d6ea6] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                    >
                      Lam moi tat ca
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
                          <th className="px-2 py-2">Tong ho so</th>
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
                              Chua co du lieu period.
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
                              Chua co du lieu blocks.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Diem chuan (benchmarks)</h2>
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
                              Chua co du lieu benchmark.
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
                          <th className="px-2 py-2">ID</th>
                          <th className="px-2 py-2">Ho ten</th>
                          <th className="px-2 py-2">Nganh</th>
                          <th className="px-2 py-2">Block</th>
                          <th className="px-2 py-2">Period</th>
                          <th className="px-2 py-2">Tong diem</th>
                          <th className="px-2 py-2">Trang thai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissionApplications.rows.map((item) => (
                          <tr key={item.id} className="border-b border-[#e0ebf4] text-[#3f6178]">
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
                            <td colSpan={7} className="px-2 py-4 text-center text-[#577086]">
                              Chua co du lieu application.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
