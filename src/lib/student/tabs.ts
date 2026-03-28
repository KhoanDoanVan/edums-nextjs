import type { StudentFeatureTab } from "@/lib/student/types";

export const studentFeatureTabs: StudentFeatureTab[] = [
  {
    key: "home",
    label: "Trang chủ",
    description:
      "Tổng quan cổng thông tin sinh viên và các hướng dẫn sử dụng chức năng.",
    endpoints: [],
  },
  {
    key: "profile",
    label: "Thông tin cá nhân",
    description: "Xem/cập nhật thông tin cá nhân sinh viên.",
    endpoints: [
      { method: "GET", path: "/api/v1/profile/me" },
      { method: "PUT", path: "/api/v1/profile/me" },
    ],
  },
  {
    key: "course-registration",
    label: "Đăng ký môn học",
    description:
      "Tra cứu lớp học phần và gửi nguyện vọng đăng ký học phần theo kỳ.",
    endpoints: [
      { method: "GET", path: "/api/v1/course-sections" },
      { method: "POST", path: "/api/v1/course-registrations" },
    ],
  },
  {
    key: "schedule",
    label: "Xem thời khóa biểu",
    description:
      "Xem danh sách lớp học phần đang mở (backend chưa có endpoint thời khóa biểu sinh viên riêng).",
    endpoints: [{ method: "GET", path: "/api/v1/course-sections" }],
  },
  {
    key: "grades",
    label: "Xem điểm",
    description: "Tra cứu bảng điểm của sinh viên.",
    endpoints: [{ method: "GET", path: "/api/v1/students/{studentId}/grade-reports" }],
  },
  {
    key: "attendance",
    label: "Thông tin điểm danh",
    description: "Theo dõi thông tin điểm danh của sinh viên.",
    endpoints: [{ method: "GET", path: "/api/v1/students/{studentId}/attendances" }],
  },
  {
    key: "password",
    label: "Đổi mật khẩu",
    description: "Đổi mật khẩu tài khoản đang đăng nhập.",
    endpoints: [{ method: "PUT", path: "/api/v1/profile/password" }],
  },
];

export const studentTopHeaderTabs = [
  "Thông báo",
  "Quy định - quy chế",
  "Thông tin cập nhật",
] as const;
