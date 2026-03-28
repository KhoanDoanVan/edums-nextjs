import type { AdminFeatureTab } from "@/lib/admin/types";

export const adminFeatureTabs: AdminFeatureTab[] = [
  {
    key: "home",
    label: "Trang chủ",
    description: "Tổng quan hệ thống quản trị và các thông báo quan trọng.",
    endpoints: [],
  },
  {
    key: "accounts",
    label: "Quản lý tài khoản",
    description: "Danh sách tài khoản, vai trò và trạng thái.",
    endpoints: [{ method: "GET", path: "/api/v1/accounts" }],
  },
  {
    key: "roles",
    label: "Vai trò & quyền",
    description: "Quản lý vai trò và tập quyền hệ thống.",
    endpoints: [
      { method: "GET", path: "/api/v1/roles" },
      { method: "GET", path: "/api/v1/roles/permissions" },
    ],
  },
  {
    key: "faculties",
    label: "Quản lý khoa",
    description: "Quản lý danh sách khoa trong hệ thống.",
    endpoints: [{ method: "GET", path: "/api/v1/faculties" }],
  },
  {
    key: "majors",
    label: "Quản lý ngành",
    description: "Quản lý danh sách ngành đào tạo.",
    endpoints: [{ method: "GET", path: "/api/v1/majors" }],
  },
  {
    key: "specializations",
    label: "Quản lý chuyên ngành",
    description: "Quản lý danh sách chuyên ngành theo từng ngành.",
    endpoints: [{ method: "GET", path: "/api/v1/specializations" }],
  },
  {
    key: "cohorts",
    label: "Quản lý niên khóa",
    description: "Quản lý danh sách niên khóa đào tạo.",
    endpoints: [{ method: "GET", path: "/api/v1/cohorts" }],
  },
  {
    key: "courses",
    label: "Quản lý môn học",
    description: "Quản lý danh sách môn học trong chương trình đào tạo.",
    endpoints: [{ method: "GET", path: "/api/v1/courses" }],
  },
  {
    key: "grade-components",
    label: "Cấu hình điểm",
    description: "Quản lý các thành phần điểm theo môn học.",
    endpoints: [
      { method: "GET", path: "/api/v1/grade-components" },
      { method: "POST", path: "/api/v1/grade-components" },
    ],
  },
  {
    key: "classrooms",
    label: "Quản lý phòng học",
    description: "Quản lý danh sách phòng học.",
    endpoints: [{ method: "GET", path: "/api/v1/classrooms" }],
  },
  {
    key: "administrative-classes",
    label: "Quản lý lớp chủ nhiệm",
    description: "Quản lý lớp hành chính/lớp chủ nhiệm.",
    endpoints: [{ method: "GET", path: "/api/v1/administrative-classes" }],
  },
  {
    key: "students",
    label: "Quản lý sinh viên",
    description: "Theo dõi danh sách sinh viên trong hệ thống.",
    endpoints: [{ method: "GET", path: "/api/v1/students" }],
  },
  {
    key: "lecturers",
    label: "Quản lý giảng viên",
    description: "Theo dõi danh sách giảng viên.",
    endpoints: [{ method: "GET", path: "/api/v1/lecturers" }],
  },
  {
    key: "guardians",
    label: "Quản lý phụ huynh",
    description: "Theo dõi danh sách phụ huynh.",
    endpoints: [{ method: "GET", path: "/api/v1/guardians" }],
  },
  {
    key: "course-sections",
    label: "Lớp học phần",
    description: "Quản lý lớp học phần và phân công giảng viên theo lớp.",
    endpoints: [
      { method: "GET", path: "/api/v1/course-sections" },
      { method: "PUT", path: "/api/v1/course-sections/{id}" },
      { method: "PATCH", path: "/api/v1/course-sections/{id}/status" },
    ],
  },
  {
    key: "recurring-schedules",
    label: "Lịch học lặp lại",
    description: "Quản lý lịch học lặp lại theo từng lớp học phần.",
    endpoints: [
      { method: "POST", path: "/api/v1/recurring-schedules" },
      { method: "GET", path: "/api/v1/recurring-schedules/section/{sectionId}" },
    ],
  },
  {
    key: "grade-management",
    label: "Quản lý điểm",
    description: "Xem bảng điểm theo từng lớp học phần (nhập section ID).",
    endpoints: [{ method: "GET", path: "/api/v1/course-sections/{sectionId}/grade-reports" }],
  },
  {
    key: "attendance-management",
    label: "Quản lý điểm danh",
    description: "Xem điểm danh theo sinh viên (nhập student ID).",
    endpoints: [{ method: "GET", path: "/api/v1/students/{studentId}/attendances" }],
  },
  {
    key: "admissions",
    label: "Tuyển sinh",
    description: "Điều hành kỳ tuyển sinh, điểm chuẩn và hồ sơ dự tuyển.",
    endpoints: [
      { method: "GET", path: "/api/v1/admin/admissions/config/periods" },
      { method: "GET", path: "/api/v1/admin/admissions/config/blocks" },
      { method: "GET", path: "/api/v1/admin/admissions/config/benchmarks" },
      { method: "GET", path: "/api/v1/admin/admissions/applications" },
    ],
  },
];

export const adminTopHeaderTabs = [
  "Quản trị hệ thống",
  "Báo cáo",
  "Cấu hình",
] as const;
