import type { StudentFeatureTab } from "@/lib/student/types";

export const studentFeatureTabs: StudentFeatureTab[] = [
  {
    key: "home",
    label: "Trang chu",
    description:
      "Tong quan cong thong tin sinh vien va cac huong dan su dung chuc nang.",
    endpoints: [],
  },
  {
    key: "profile",
    label: "Thong tin ca nhan",
    description: "Xem/cap nhat thong tin ca nhan sinh vien.",
    endpoints: [
      { method: "GET", path: "/api/v1/profile/me" },
      { method: "PUT", path: "/api/v1/profile/me" },
    ],
  },
  {
    key: "course-registration",
    label: "Dang ky mon hoc",
    description:
      "Tra cuu lop hoc phan va gui nguyen vong dang ky hoc phan theo ky.",
    endpoints: [
      { method: "GET", path: "/api/v1/course-sections" },
      { method: "POST", path: "/api/v1/course-registrations" },
    ],
  },
  {
    key: "schedule",
    label: "Xem thoi khoa bieu",
    description:
      "Xem danh sach lop hoc phan dang mo (backend chua co endpoint tkb sinh vien rieng).",
    endpoints: [{ method: "GET", path: "/api/v1/course-sections" }],
  },
  {
    key: "grades",
    label: "Xem diem",
    description: "Tra cuu bang diem cua sinh vien.",
    endpoints: [{ method: "GET", path: "/api/v1/students/{studentId}/grade-reports" }],
  },
  {
    key: "attendance",
    label: "Thong tin diem danh",
    description: "Theo doi thong tin diem danh cua sinh vien.",
    endpoints: [{ method: "GET", path: "/api/v1/students/{studentId}/attendances" }],
  },
  {
    key: "password",
    label: "Doi mat khau",
    description: "Doi mat khau tai khoan dang nhap.",
    endpoints: [{ method: "PUT", path: "/api/v1/profile/password" }],
  },
];

export const studentTopHeaderTabs = [
  "Thong bao",
  "Quy dinh - quy che",
  "Thong tin cap nhat",
] as const;
