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
      { method: "GET", path: "/api/v1/students/{id}" },
      { method: "GET", path: "/api/v1/faculties/{id}" },
      { method: "GET", path: "/api/v1/majors" },
      { method: "GET", path: "/api/v1/majors/{id}" },
      { method: "GET", path: "/api/v1/majors/faculty/{facultyId}" },
      { method: "GET", path: "/api/v1/specializations" },
      { method: "GET", path: "/api/v1/specializations/major/{majorId}" },
      { method: "GET", path: "/api/v1/administrative-classes" },
      { method: "GET", path: "/api/v1/administrative-classes/{id}" },
      { method: "GET", path: "/api/v1/cohorts" },
      { method: "GET", path: "/api/v1/cohorts/{id}" },
      { method: "PUT", path: "/api/v1/profile/me" },
    ],
  },
  {
    key: "course-registration",
    label: "Đăng ký môn học",
    description:
      "Tra cứu lớp học phần, lọc theo khoa/môn học/học kỳ, xem lịch học và gửi nguyện vọng đăng ký.",
    endpoints: [
      { method: "GET", path: "/api/v1/faculties" },
      { method: "GET", path: "/api/v1/courses" },
      { method: "GET", path: "/api/v1/courses/faculty/{facultyId}" },
      { method: "GET", path: "/api/v1/courses/{id}" },
      { method: "GET", path: "/api/v1/course-sections" },
      { method: "GET", path: "/api/v1/course-sections/{id}" },
      { method: "GET", path: "/api/v1/course-sections/course/{courseId}" },
      { method: "GET", path: "/api/v1/course-sections/semester/{semesterId}" },
      { method: "GET", path: "/api/v1/recurring-schedules/section/{sectionId}" },
      { method: "GET", path: "/api/v1/recurring-schedules/{id}/sessions" },
      { method: "POST", path: "/api/v1/course-registrations" },
    ],
  },
  {
    key: "schedule",
    label: "Xem thời khóa biểu",
    description:
      "Xem danh sách lớp học phần đang mở (hệ thống hiện chưa có endpoint thời khóa biểu sinh viên riêng).",
    endpoints: [
      { method: "GET", path: "/api/v1/course-sections" },
      { method: "GET", path: "/api/v1/recurring-schedules/{id}" },
      { method: "GET", path: "/api/v1/classrooms" },
      { method: "GET", path: "/api/v1/classrooms/{id}" },
      { method: "GET", path: "/api/v1/lecturers/{id}" },
    ],
  },
  {
    key: "grades",
    label: "Xem điểm",
    description:
      "Tra cứu bảng điểm, xem chi tiết điểm thành phần theo cấu hình trọng số của môn học.",
    endpoints: [
      { method: "GET", path: "/api/v1/students/{studentId}/grade-reports" },
      { method: "GET", path: "/api/v1/grade-reports/{id}" },
      { method: "GET", path: "/api/v1/course-sections/{id}" },
      { method: "GET", path: "/api/v1/courses/{courseId}/grade-components" },
    ],
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
