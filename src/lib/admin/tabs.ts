import type { AdminFeatureTab } from "@/lib/admin/types";

export const adminFeatureTabs: AdminFeatureTab[] = [
  {
    key: "home",
    label: "Trang chu",
    description: "Tong quan he thong quan tri va thong bao quan trong.",
    endpoints: [],
  },
  {
    key: "accounts",
    label: "Quan ly tai khoan",
    description: "Danh sach tai khoan, role va trang thai.",
    endpoints: [{ method: "GET", path: "/api/v1/accounts" }],
  },
  {
    key: "roles",
    label: "Vai tro & quyen",
    description: "Quan ly role va tap permission he thong.",
    endpoints: [
      { method: "GET", path: "/api/v1/roles" },
      { method: "GET", path: "/api/v1/roles/permissions" },
    ],
  },
  {
    key: "faculties",
    label: "Quan ly khoa",
    description: "Quan ly danh sach khoa trong he thong.",
    endpoints: [{ method: "GET", path: "/api/v1/faculties" }],
  },
  {
    key: "majors",
    label: "Quan ly nganh",
    description: "Quan ly danh sach nganh dao tao.",
    endpoints: [{ method: "GET", path: "/api/v1/majors" }],
  },
  {
    key: "specializations",
    label: "Quan ly chuyen nganh",
    description: "Quan ly danh sach chuyen nganh theo tung nganh.",
    endpoints: [{ method: "GET", path: "/api/v1/specializations" }],
  },
  {
    key: "cohorts",
    label: "Quan ly nien khoa",
    description: "Quan ly danh sach nien khoa dao tao.",
    endpoints: [{ method: "GET", path: "/api/v1/cohorts" }],
  },
  {
    key: "courses",
    label: "Quan ly mon hoc",
    description: "Quan ly danh sach mon hoc trong chuong trinh dao tao.",
    endpoints: [{ method: "GET", path: "/api/v1/courses" }],
  },
  {
    key: "classrooms",
    label: "Quan ly phong hoc",
    description: "Quan ly danh sach phong hoc.",
    endpoints: [{ method: "GET", path: "/api/v1/classrooms" }],
  },
  {
    key: "administrative-classes",
    label: "Quan ly lop chu nhiem",
    description: "Quan ly lop hanh chinh/lop chu nhiem.",
    endpoints: [{ method: "GET", path: "/api/v1/administrative-classes" }],
  },
  {
    key: "students",
    label: "Quan ly sinh vien",
    description: "Theo doi danh sach sinh vien trong he thong.",
    endpoints: [{ method: "GET", path: "/api/v1/students" }],
  },
  {
    key: "lecturers",
    label: "Quan ly giang vien",
    description: "Theo doi danh sach giang vien.",
    endpoints: [{ method: "GET", path: "/api/v1/lecturers" }],
  },
  {
    key: "guardians",
    label: "Quan ly phu huynh",
    description: "Theo doi danh sach phu huynh.",
    endpoints: [{ method: "GET", path: "/api/v1/guardians" }],
  },
  {
    key: "course-sections",
    label: "Lop hoc phan",
    description: "Quan ly lop hoc phan va phan cong giang vien theo lop.",
    endpoints: [
      { method: "GET", path: "/api/v1/course-sections" },
      { method: "PUT", path: "/api/v1/course-sections/{id}" },
      { method: "PATCH", path: "/api/v1/course-sections/{id}/status" },
    ],
  },
  {
    key: "grade-management",
    label: "Quan ly diem",
    description: "Xem bang diem theo tung lop hoc phan (nhap section ID).",
    endpoints: [{ method: "GET", path: "/api/v1/course-sections/{sectionId}/grade-reports" }],
  },
  {
    key: "attendance-management",
    label: "Quan ly diem danh",
    description: "Xem diem danh theo sinh vien (nhap student ID).",
    endpoints: [{ method: "GET", path: "/api/v1/students/{studentId}/attendances" }],
  },
  {
    key: "admissions",
    label: "Tuyen sinh",
    description: "Dieu hanh ky tuyen sinh, benchmark va ho so du tuyen.",
    endpoints: [
      { method: "GET", path: "/api/v1/admin/admissions/config/periods" },
      { method: "GET", path: "/api/v1/admin/admissions/config/blocks" },
      { method: "GET", path: "/api/v1/admin/admissions/config/benchmarks" },
      { method: "GET", path: "/api/v1/admin/admissions/applications" },
    ],
  },
];

export const adminTopHeaderTabs = [
  "Quan tri he thong",
  "Bao cao",
  "Cau hinh",
] as const;
