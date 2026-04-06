"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AccountManagementPanel } from "@/components/admin/account-management-panel";
import { AdmissionsPanel } from "@/components/admin/admissions-panel";
import { AttendanceManagementPanel } from "@/components/admin/attendance-management-panel";
import { CohortManagementPanel } from "@/components/admin/cohort-management-panel";
import { CourseSectionScheduleSummary } from "@/components/admin/course-section-schedule-summary";
import { DynamicCrudPanel } from "@/components/admin/dynamic-crud-panel";
import { GradeComponentPanel } from "@/components/admin/grade-component-panel";
import { GradeManagementPanel } from "@/components/admin/grade-management-panel";
import { RecurringSchedulePanel } from "@/components/admin/recurring-schedule-panel";
import { RolePermissionPanel } from "@/components/admin/role-permission-panel";
import { useAuth } from "@/context/auth-context";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { adminFeatureTabs, adminTopHeaderTabs } from "@/lib/admin/tabs";
import type {
  AdminFeatureTab,
  AdminTabKey,
  DynamicRow,
} from "@/lib/admin/types";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Thao tác thất bại. Vui lòng thử lại.";
};

const contentCardClass =
  "rounded-[8px] border border-[#8ab3d1] bg-white shadow-[0_1px_2px_rgba(7,51,84,0.16)]";

const sectionTitleClass =
  "flex items-center justify-between border-b border-[#c5dced] px-4 py-2 text-[18px] font-semibold text-[#1a4f75]";

type DynamicCrudTabConfig = {
  title: string;
  basePath: string;
  listQuery?: Record<string, string | number | undefined>;
  hiddenColumns?: string[];
  fieldLookups?: Record<
    string,
    {
      path: string;
      query?: Record<string, string | number | undefined>;
      filterBy?: Record<string, string | number | boolean>;
      valueKey?: string;
      labelKeys?: string[];
      dependsOn?: string;
      pathTemplate?: string;
      disableUntilDependsOn?: boolean;
    }
  >;
  priorityColumns: string[];
  createTemplate: Record<string, unknown>;
  updateTemplate: Record<string, unknown>;
  statusPatch?: {
    fieldName: string;
    pathSuffix: string;
    options: string[];
  };
  fieldConfigs?: Record<
    string,
    {
      hidden?: boolean | ((context: {
        formMode: "create" | "edit";
        formPayload: Record<string, unknown>;
        currentRow: DynamicRow | null;
      }) => boolean);
      disabled?: boolean | ((context: {
        formMode: "create" | "edit";
        formPayload: Record<string, unknown>;
        currentRow: DynamicRow | null;
      }) => boolean);
      helperText?: string | ((context: {
        formMode: "create" | "edit";
        formPayload: Record<string, unknown>;
        currentRow: DynamicRow | null;
      }) => string);
      options?:
        | Array<{ value: string; label?: string }>
        | ((context: {
            formMode: "create" | "edit";
            formPayload: Record<string, unknown>;
            currentRow: DynamicRow | null;
          }) => Array<{ value: string; label?: string }>);
    }
  >;
  beforeDelete?: (row: DynamicRow) => string | null;
  transformCreatePayload?: (payload: Record<string, unknown>) => Record<string, unknown>;
  transformUpdatePayload?: (
    payload: Record<string, unknown>,
    currentRow: DynamicRow | null,
  ) => Record<string, unknown>;
};

const semesterStatusOptions = [
  { value: "PLANNING" },
  { value: "REGISTRATION_OPEN" },
  { value: "ONGOING"},
  { value: "FINISHED"},
] as const;

const dynamicCrudTabConfigs: Partial<Record<AdminTabKey, DynamicCrudTabConfig>> = {
  semesters: {
    title: "Danh sách học kỳ",
    basePath: "/api/v1/semesters",
    priorityColumns: [
      "id",
      "displayName",
      "semesterNumber",
      "academicYear",
      "startDate",
      "endDate",
      "totalWeeks",
      "status",
    ],
    createTemplate: {
      semesterNumber: 1,
      academicYear: "2025-2026",
      startDate: "2025-09-01",
      totalWeeks: 16,
    },
    updateTemplate: {
      semesterNumber: 1,
      academicYear: "2025-2026",
      startDate: "2025-09-01",
      totalWeeks: 16,
      status: "PLANNING",
    },
    fieldConfigs: {
      status: {
        options: semesterStatusOptions.map((item) => ({
          value: item.value,
          label: item.value,
        })),
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status === "FINISHED",
        helperText: ({ currentRow }) => {
          const status =
            typeof currentRow?.status === "string" ? currentRow.status : "PLANNING";
          if (status === "PLANNING") {
            return "Học kỳ đang ở trạng thái lập kế hoạch nên có thể sửa thông tin và đổi trạng thái.";
          }
          if (status === "REGISTRATION_OPEN") {
            return "Học kỳ đang mở đăng ký, chỉ nên chuyển tiếp sang Đang diễn ra hoặc Đã kết thúc.";
          }
          if (status === "ONGOING") {
            return "Học kỳ đang diễn ra, chỉ có thể chuyển sang Đã kết thúc.";
          }
          return "Học kỳ đã kết thúc nên không thể thay đổi trạng thái nữa.";
        },
      },
      semesterNumber: {
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING",
        helperText: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING"
            ? "Chỉ được sửa số học kỳ khi học kỳ đang ở trạng thái PLANNING."
            : "",
      },
      academicYear: {
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING",
        helperText: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING"
            ? "Chỉ được sửa năm học khi học kỳ đang ở trạng thái PLANNING."
            : "",
      },
      startDate: {
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING",
        helperText: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING"
            ? "Ngày bắt đầu chỉ được đổi khi học kỳ đang ở trạng thái PLANNING."
            : "",
      },
      totalWeeks: {
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING",
        helperText: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "PLANNING"
            ? "Tổng số tuần chỉ được sửa khi học kỳ đang ở trạng thái PLANNING."
            : "",
      },
    },
    beforeDelete: (row) =>
      row.status === "PLANNING"
        ? null
        : "Chỉ được xóa học kỳ khi học kỳ đang ở trạng thái PLANNING.",
    transformCreatePayload: (payload) => {
      const nextPayload = { ...payload };
      delete nextPayload.status;
      delete nextPayload.endDate;
      return nextPayload;
    },
    transformUpdatePayload: (payload) => {
      const nextPayload = { ...payload };
      delete nextPayload.endDate;
      return nextPayload;
    },
  },
  "registration-periods": {
    title: "Đợt đăng ký học phần",
    basePath: "/api/v1/registration-periods",
    hiddenColumns: ["semesterId"],
    fieldLookups: {
      semesterId: {
        path: "/api/v1/semesters",
        query: {
          status: "REGISTRATION_OPEN",
          page: 0,
          size: 100,
        },
        filterBy: {
          status: "REGISTRATION_OPEN",
        },
        labelKeys: ["displayName", "semesterNumber", "academicYear", "id"],
      },
    },
    priorityColumns: [
      "id",
      "name",
      "semesterId",
      "semesterNumber",
      "academicYear",
      "startTime",
      "endTime",
      "status",
    ],
    createTemplate: {
      semesterId: 1,
      name: "Đợt đăng ký chính",
      startTime: "2026-04-01T08:00:00",
      endTime: "2026-04-10T23:59:59",
      status: "UPCOMING",
    },
    updateTemplate: {
      semesterId: 1,
      name: "Đợt đăng ký chính",
      startTime: "2026-04-01T08:00:00",
      endTime: "2026-04-10T23:59:59",
      status: "UPCOMING",
    },
    fieldConfigs: {
      semesterId: {
        disabled: ({ formMode }) => formMode === "edit",
        helperText: ({ formMode }) =>
          formMode === "edit"
            ? "Học kỳ chỉ được chọn khi tạo mới đợt đăng ký."
            : "",
      },
      name: {
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "UPCOMING",
      },
      startTime: {
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "UPCOMING",
      },
      endTime: {
        disabled: ({ formMode, currentRow }) =>
          formMode === "edit" && currentRow?.status !== "UPCOMING",
      },
      status: {
        hidden: ({ formMode }) => formMode === "create",
        options: ({ currentRow }) => {
          const status =
            typeof currentRow?.status === "string" ? currentRow.status : "UPCOMING";

          const transitions: Record<string, string[]> = {
            UPCOMING: ["UPCOMING", "OPEN", "CLOSED"],
            OPEN: ["OPEN", "CLOSED"],
            CLOSED: ["CLOSED"],
          };

          const allowed = transitions[status] || [status];
          return allowed.map((value) => ({ value, label: value }));
        },
        helperText: ({ currentRow }) => {
          const status =
            typeof currentRow?.status === "string" ? currentRow.status : "UPCOMING";
          if (status === "UPCOMING") {
            return "";
          }
          return "";
        },
      },
    },
  },
  faculties: {
    title: "Danh sách khoa",
    basePath: "/api/v1/faculties",
    priorityColumns: ["id", "facultyCode", "facultyName", "status"],
    createTemplate: {
      facultyCode: "",
      facultyName: "",
    },
    updateTemplate: {
      facultyCode: "",
      facultyName: "",
    },
  },
  majors: {
    title: "Danh sách ngành",
    basePath: "/api/v1/majors",
    fieldLookups: {
      facultyId: {
        path: "/api/v1/faculties",
        labelKeys: ["facultyName", "facultyCode", "id"],
      },
    },
    priorityColumns: ["id", "majorCode", "majorName", "facultyId", "status"],
    createTemplate: {
      facultyId: 1,
      majorCode: "",
      majorName: "",
    },
    updateTemplate: {
      facultyId: 1,
      majorCode: "",
      majorName: "",
    },
  },
  specializations: {
    title: "Danh sách chuyen ngành",
    basePath: "/api/v1/specializations",
    fieldLookups: {
      majorId: {
        path: "/api/v1/majors",
        labelKeys: ["majorName", "majorCode", "id"],
      },
    },
    priorityColumns: ["id", "specializationName", "majorId", "status"],
    createTemplate: {
      majorId: 1,
      specializationName: "",
    },
    updateTemplate: {
      majorId: 1,
      specializationName: "",
    },
  },
  cohorts: {
    title: "Danh sách niên khóa",
    basePath: "/api/v1/cohorts",
    priorityColumns: ["id", "cohortName", "startYear", "endYear", "status"],
    createTemplate: {
      cohortName: "",
      startYear: 2026,
      endYear: 2030,
      status: "ACTIVE",
    },
    updateTemplate: {
      cohortName: "",
      startYear: 2026,
      endYear: 2030,
      status: "ACTIVE",
    },
  },
  courses: {
    title: "Danh sách môn học",
    basePath: "/api/v1/courses",
    fieldLookups: {
      facultyId: {
        path: "/api/v1/faculties",
        labelKeys: ["facultyName", "facultyCode", "id"],
      },
    },
    priorityColumns: [
      "id",
      "courseCode",
      "courseName",
      "credits",
      "facultyId",
      "status",
    ],
    createTemplate: {
      courseCode: "",
      courseName: "",
      credits: 3,
      facultyId: 1,
      status: "ACTIVE",
    },
    updateTemplate: {
      courseCode: "",
      courseName: "",
      credits: 3,
      facultyId: 1,
      status: "ACTIVE",
    },
  },
  "grade-components": {
    title: "Cấu hình điểm",
    basePath: "/api/v1/grade-components",
    priorityColumns: ["id", "componentName", "weightPercentage", "courseId"],
    createTemplate: {
      componentName: "",
      weightPercentage: 10,
      courseId: 1,
    },
    updateTemplate: {
      componentName: "",
      weightPercentage: 10,
      courseId: 1,
    },
  },
  classrooms: {
    title: "Danh sách phong hoc",
    basePath: "/api/v1/classrooms",
    priorityColumns: ["id", "roomName", "capacity", "roomType"],
    createTemplate: {
      roomName: "",
      capacity: 40,
      roomType: "THEORY",
    },
    updateTemplate: {
      roomName: "",
      capacity: 40,
      roomType: "THEORY",
    },
  },
  "administrative-classes": {
    title: "Danh sách lớp chủ nhiệm",
    basePath: "/api/v1/administrative-classes",
    fieldLookups: {
      headLecturerId: {
        path: "/api/v1/lecturers",
        query: { page: 0, size: 100 },
        labelKeys: ["fullName", "email", "id"],
      },
      cohortId: {
        path: "/api/v1/cohorts",
        labelKeys: ["cohortName", "id"],
      },
      majorId: {
        path: "/api/v1/majors",
        labelKeys: ["majorName", "majorCode", "id"],
      },
    },
    priorityColumns: [
      "id",
      "className",
      "cohortId",
      "majorId",
      "headLecturerId",
      "maxCapacity",
    ],
    createTemplate: {
      className: "",
      headLecturerId: 1,
      cohortId: 1,
      majorId: 1,
      maxCapacity: 60,
    },
    updateTemplate: {
      className: "",
      headLecturerId: 1,
      cohortId: 1,
      majorId: 1,
      maxCapacity: 60,
    },
  },
  students: {
    title: "Quản lý sinh viên",
    basePath: "/api/v1/students",
    listQuery: {
      page: 0,
      size: 20,
    },
    fieldLookups: {
      classId: {
        path: "/api/v1/administrative-classes",
        labelKeys: ["className", "id"],
      },
      majorId: {
        path: "/api/v1/majors",
        labelKeys: ["majorName", "majorCode", "id"],
      },
      specializationId: {
        path: "/api/v1/specializations",
        dependsOn: "majorId",
        pathTemplate: "/api/v1/specializations/major/{value}",
        disableUntilDependsOn: true,
        labelKeys: ["specializationName", "id"],
      },
      guardianId: {
        path: "/api/v1/guardians",
        query: { page: 0, size: 100 },
        labelKeys: ["fullName", "phone", "id"],
      },
    },
    priorityColumns: [
      "id",
      "studentCode",
      "fullName",
      "email",
      "phone",
      "status",
      "classId",
      "majorId",
    ],
    createTemplate: {
      classId: 1,
      majorId: 1,
      specializationId: 1,
      guardianId: 1,
      studentCode: "",
      fullName: "",
      email: "",
      nationalId: "",
      dateOfBirth: "2004-01-01",
      gender: true,
      phone: "",
      address: "",
      ethnicity: "",
      religion: "",
      placeOfBirth: "",
      nationality: "VN",
    },
    updateTemplate: {
      classId: 1,
      majorId: 1,
      specializationId: 1,
      guardianId: 1,
      fullName: "",
      email: "",
      nationalId: "",
      dateOfBirth: "2004-01-01",
      gender: true,
      phone: "",
      address: "",
      ethnicity: "",
      religion: "",
      placeOfBirth: "",
      nationality: "VN",
    },
    statusPatch: {
      fieldName: "status",
      pathSuffix: "/status",
      options: ["ACTIVE", "SUSPENDED", "GRADUATED", "DROPPED_OUT"],
    },
  },
  lecturers: {
    title: "Quản lý giảng viên",
    basePath: "/api/v1/lecturers",
    listQuery: {
      page: 0,
      size: 20,
    },
    priorityColumns: ["id", "fullName", "email", "academicDegree", "phone"],
    createTemplate: {
      fullName: "",
      email: "",
      academicDegree: "",
      phone: "",
    },
    updateTemplate: {
      fullName: "",
      email: "",
      academicDegree: "",
      phone: "",
    },
  },
  guardians: {
    title: "Quản lý phụ huynh",
    basePath: "/api/v1/guardians",
    listQuery: {
      page: 0,
      size: 20,
    },
    priorityColumns: ["id", "fullName", "phone", "relationship"],
    createTemplate: {
      fullName: "",
      phone: "",
      relationship: "",
    },
    updateTemplate: {
      fullName: "",
      phone: "",
      relationship: "",
    },
  },
  "course-sections": {
    title: "Quản lý lớp học phần",
    basePath: "/api/v1/course-sections",
    hiddenColumns: [
      "courseName",
      "courseCode",
      "lecturerName",
      "createdAt",
      "updatedAt",
      "courseId",
      "lecturerId",
      "semesterId",
      "sectionName",
      "notes",
      "course",
      "lecturer",
      "semester",
      "semesterName",
      "lecturerFullName",
      "createdBy",
      "updatedBy",
    ],
    fieldLookups: {
      courseId: {
        path: "/api/v1/courses",
        labelKeys: ["courseName", "courseCode", "id"],
      },
      lecturerId: {
        path: "/api/v1/lecturers",
        query: { page: 0, size: 100 },
        labelKeys: ["fullName", "email", "id"],
      },
      semesterId: {
        path: "/api/v1/semesters",
        query: {
          page: 0,
          size: 1000,
        },
        filterBy: {
          status: "PLANNING",
        },
        labelKeys: ["displayName", "semesterNumber", "academicYear", "id"],
      },
    },
    priorityColumns: [
      "displayName",
      "sectionCode",
      "academicYear",
      "semesterNumber",
      "maxCapacity",
      "status",
    ],
    fieldConfigs: {
      sectionCode: {
        hidden: true,
      },
      displayName: {
        hidden: true,
      },
      semesterId: {
        helperText: "Chỉ hiển thị học kỳ có trạng thái PLANNING.",
      },
      status: {
        hidden: ({ formMode }) => formMode === "create",
        options: ["DRAFT", "OPEN", "ONGOING", "FINISHED", "CANCELLED"].map(
          (value) => ({
            value,
            label: value,
          }),
        ),
      },
    },
    createTemplate: {
      sectionCode: "",
      displayName: "",
      courseId: 1,
      lecturerId: 1,
      semesterId: 1,
      maxCapacity: 60,
      status: "DRAFT",
    },
    updateTemplate: {
      sectionCode: "",
      displayName: "",
      courseId: 1,
      lecturerId: 1,
      semesterId: 1,
      maxCapacity: 60,
      status: "DRAFT",
    },
  },
};

export default function AdminDashboardPage() {
  const { session, logout } = useAuth();

  const [activeTabKey, setActiveTabKey] = useState<AdminTabKey>("home");
  const [tabError, setTabError] = useState("");
  const [, setTabMessage] = useState("");
  useToastFeedback({
    errorMessage: tabError,
    errorTitle: "Thao tác quản trị thất bại",
  });
  const [isWorking, setIsWorking] = useState(false);
  const [majorFacultyFilterValue, setMajorFacultyFilterValue] = useState("");
  const [majorListPath, setMajorListPath] = useState("/api/v1/majors");
  const [specializationMajorFilterValue, setSpecializationMajorFilterValue] =
    useState("");
  const [specializationListPath, setSpecializationListPath] = useState(
    "/api/v1/specializations",
  );
  const [courseFacultyFilterValue, setCourseFacultyFilterValue] = useState("");
  const [courseListPath, setCourseListPath] = useState("/api/v1/courses");
  const [recurringScheduleSectionPrefill, setRecurringScheduleSectionPrefill] =
    useState<number | null>(null);

  const activeTab = useMemo(
    () =>
      adminFeatureTabs.find((item) => item.key === activeTabKey) ||
      adminFeatureTabs[0],
    [activeTabKey],
  );

  const requireAuthorization = (): string | null => {
    if (!session?.authorization) {
      setTabError("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
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
      setTabError(`${fieldLabel} không hop le.`);
      return null;
    }

    return parsed;
  };

  const handleApplyMajorFacultyFilter = () => {
    const facultyId = parsePositiveInteger(majorFacultyFilterValue, "Mã khoa");
    if (!facultyId) {
      return;
    }

    setMajorListPath(`/api/v1/majors/faculty/${facultyId}`);
    setTabMessage(`Đang lọc ngành theo khoa #${facultyId}.`);
  };

  const handleResetMajorFacultyFilter = () => {
    setMajorFacultyFilterValue("");
    setMajorListPath("/api/v1/majors");
    setTabMessage("Đã xóa bộ lọc ngành theo khoa.");
  };

  const handleApplySpecializationMajorFilter = () => {
    const majorId = parsePositiveInteger(
      specializationMajorFilterValue,
      "Mã ngành",
    );
    if (!majorId) {
      return;
    }

    setSpecializationListPath(`/api/v1/specializations/major/${majorId}`);
    setTabMessage(`Đang lọc chuyên ngành theo ngành #${majorId}.`);
  };

  const handleResetSpecializationMajorFilter = () => {
    setSpecializationMajorFilterValue("");
    setSpecializationListPath("/api/v1/specializations");
    setTabMessage("Đã xóa bộ lọc chuyên ngành theo ngành.");
  };

  const handleApplyCourseFacultyFilter = () => {
    const facultyId = parsePositiveInteger(courseFacultyFilterValue, "Mã khoa");
    if (!facultyId) {
      return;
    }

    setCourseListPath(`/api/v1/courses/faculty/${facultyId}`);
    setTabMessage(`Đang lọc môn học theo khoa #${facultyId}.`);
  };

  const handleResetCourseFacultyFilter = () => {
    setCourseFacultyFilterValue("");
    setCourseListPath("/api/v1/courses");
    setTabMessage("Đã xóa bộ lọc môn học theo khoa.");
  };

  const loadTabData = async (tabKey: AdminTabKey) => {
    const authorization = requireAuthorization();
    if (!authorization) {
      return;
    }

    await runAction(async () => {
      switch (tabKey) {
        case "accounts": {
          setTabMessage("Sử dụng module Quản lý tải khoan để thao tac CRUD.");
          break;
        }
        case "roles": {
          setTabMessage(
            "Sử dụng module Vai trò & phan quyen để thao tac toan bo CRUD vai trò.",
          );
          break;
        }
        case "faculties": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu khoa.");
          break;
        }
        case "majors": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu ngành, có thể lọc theo khoa.");
          break;
        }
        case "specializations": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu chuyen ngành, có thể lọc theo ngành.");
          break;
        }
        case "cohorts": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu niên khóa.");
          break;
        }
        case "courses": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu môn học, có thể lọc theo khoa.");
          break;
        }
        case "grade-components": {
          setTabMessage("Sử dụng module Cấu hình điểm để quan ly thành phần điểm theo môn học.");
          break;
        }
        case "classrooms": {
          setTabMessage("Sử dụng module CRUD để quan ly dữ liệu phong hoc.");
          break;
        }
        case "administrative-classes": {
          setTabMessage("Sử dụng module CRUD để quan ly lớp chủ nhiệm.");
          break;
        }
        case "students": {
          setTabMessage("Sử dụng module CRUD để quan ly sinh viên.");
          break;
        }
        case "lecturers": {
          setTabMessage("Sử dụng module CRUD để quan ly giảng viên.");
          break;
        }
        case "guardians": {
          setTabMessage("Sử dụng module CRUD để quan ly phụ huynh.");
          break;
        }
        case "course-sections": {
          setTabMessage("Sử dụng module CRUD để quan ly lop hoc phan.");
          break;
        }
        case "recurring-schedules": {
          setTabMessage("Nhập section ID để tải va quan ly lịch học lap lai.");
          break;
        }
        case "admissions": {
          setTabMessage("Sử dụng module Admissions để thao tác tuyển sinh.");
          break;
        }
        case "grade-management":
        case "attendance-management":
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

  const activeDynamicCrudConfig =
    activeTab.key === "cohorts" ||
    activeTab.key === "recurring-schedules"
      ? undefined
      : dynamicCrudTabConfigs[activeTab.key];

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
              <p className="text-xs opacity-90">Vai trò: {session?.role || "-"}</p>
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
              <p className="font-semibold text-[#2d5672]">Điều hướng nhanh</p>
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
              </div>
            </section>

            {activeTab.key === "home" ? (
              <div className="space-y-4">
                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Tổng quan nhanh</h2>
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
                          <p className="mt-2 text-xs text-[#6c8597]">Click để tải dữ liệu</p>
                        </button>
                      ))}
                  </div>
                </section>

                <section className={contentCardClass}>
                  <div className={sectionTitleClass}>
                    <h2>Danh sách chuc nang admin</h2>
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
              <AccountManagementPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "roles" ? (
              <RolePermissionPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "cohorts" ? (
              <CohortManagementPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "grade-components" ? (
              <GradeComponentPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "recurring-schedules" ? (
              <RecurringSchedulePanel
                authorization={session?.authorization}
                initialSectionId={recurringScheduleSectionPrefill || undefined}
              />
            ) : null}

            {activeTab.key === "majors" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Lọc ngành theo khoa</h2>
                </div>
                <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px_140px]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                    placeholder="Nhập faculty ID"
                    value={majorFacultyFilterValue}
                    onChange={(event) => setMajorFacultyFilterValue(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleApplyMajorFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={handleResetMajorFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    Bỏ lọc
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab.key === "specializations" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Lọc chuyên ngành theo ngành</h2>
                </div>
                <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px_140px]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                    placeholder="Nhập major ID"
                    value={specializationMajorFilterValue}
                    onChange={(event) => setSpecializationMajorFilterValue(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleApplySpecializationMajorFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSpecializationMajorFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    Bỏ lọc
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab.key === "courses" ? (
              <section className={contentCardClass}>
                <div className={sectionTitleClass}>
                  <h2>Lọc môn học theo khoa</h2>
                </div>
                <div className="grid gap-2 px-4 py-4 sm:grid-cols-[220px_160px_140px]">
                  <input
                    className="h-10 rounded-[6px] border border-[#c8d3dd] px-3 text-sm text-[#111827] outline-none focus:border-[#6aa8cf]"
                    placeholder="Nhập faculty ID"
                    value={courseFacultyFilterValue}
                    onChange={(event) => setCourseFacultyFilterValue(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCourseFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] bg-[#0d6ea6] px-3 text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:opacity-60"
                  >
                    Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCourseFacultyFilter}
                    disabled={isWorking}
                    className="h-10 rounded-[6px] border border-[#9ec3dd] bg-white px-3 text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd] disabled:opacity-60"
                  >
                    Bỏ lọc
                  </button>
                </div>
              </section>
            ) : null}

            {activeDynamicCrudConfig ? (
              <DynamicCrudPanel
                authorization={session?.authorization}
                title={activeDynamicCrudConfig.title}
                basePath={activeDynamicCrudConfig.basePath}
                listPath={
                  activeTab.key === "majors"
                    ? majorListPath
                    : activeTab.key === "specializations"
                      ? specializationListPath
                      : activeTab.key === "courses"
                        ? courseListPath
                    : undefined
                }
                listQuery={activeDynamicCrudConfig.listQuery}
                hiddenColumns={activeDynamicCrudConfig.hiddenColumns}
                fieldLookups={activeDynamicCrudConfig.fieldLookups}
                fieldConfigs={activeDynamicCrudConfig.fieldConfigs}
                priorityColumns={activeDynamicCrudConfig.priorityColumns}
                createTemplate={activeDynamicCrudConfig.createTemplate}
                updateTemplate={activeDynamicCrudConfig.updateTemplate}
                statusPatch={
                  activeTab.key === "course-sections"
                    ? undefined
                    : activeDynamicCrudConfig.statusPatch
                }
                beforeDelete={activeDynamicCrudConfig.beforeDelete}
                transformCreatePayload={activeDynamicCrudConfig.transformCreatePayload}
                transformUpdatePayload={activeDynamicCrudConfig.transformUpdatePayload}
                enableDetailView={activeTab.key === "course-sections"}
                detailFieldOrder={
                  activeTab.key === "course-sections"
                    ? [
                        "courseName",
                        "courseCode",
                        "sectionCode",
                        "displayName",
                        "lecturerName",
                        "academicYear",
                        "semesterNumber",
                        "maxCapacity",
                        "status",
                      ]
                    : undefined
                }
                renderDetailExtra={
                  activeTab.key === "course-sections"
                    ? (row) => {
                        const sectionId = Number(row.id || 0);
                        if (!Number.isInteger(sectionId) || sectionId <= 0) {
                          return null;
                        }

                        return (
                        <CourseSectionScheduleSummary
                          authorization={session?.authorization}
                          sectionId={sectionId}
                          onOpenFullManagement={(nextSectionId) => {
                            setRecurringScheduleSectionPrefill(nextSectionId);
                            setActiveTabKey("recurring-schedules");
                          }}
                        />
                        );
                      }
                    : undefined
                }
              />
            ) : null}

            {activeTab.key === "grade-management" ? (
              <GradeManagementPanel authorization={session?.authorization} />
            ) : null}

            {activeTab.key === "attendance-management" ? (
              <AttendanceManagementPanel authorization={session?.authorization} />
            ) : null}


            {activeTab.key === "admissions" ? (
              <AdmissionsPanel authorization={session?.authorization} />
            ) : null}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
