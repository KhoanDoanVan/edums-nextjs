import type { LecturerFeatureTab } from "@/lib/lecturer/types";

export const lecturerFeatureTabs: LecturerFeatureTab[] = [
  {
    key: "schedule",
    label: "Lịch giảng dạy",
    description: "Tra cứu thời khóa biểu cá nhân của giảng viên theo học kỳ.",
    endpoints: [
      { method: "GET", path: "/api/v1/semesters" },
      { method: "GET", path: "/api/v1/schedules/lecturers/me?semesterId={semesterId}" },
    ],
  },
  {
    key: "grades",
    label: "Nhập điểm lớp",
    description: "Nhập điểm theo luồng học kỳ, lớp học phần và grade-entry roster của section.",
    endpoints: [
      { method: "GET", path: "/api/v1/lecturers/me/course-sections" },
      { method: "GET", path: "/api/v1/course-sections/{sectionId}/grade-entry-roster" },
      { method: "POST", path: "/api/v1/grade-reports" },
      { method: "PUT", path: "/api/v1/grade-reports/{id}" },
    ],
  },
  {
    key: "attendance",
    label: "Điểm danh buổi học",
    description:
      "Điểm danh theo luồng học kỳ, lớp học phần, buổi học và đồng bộ roster trước khi chấm.",
    endpoints: [
      { method: "GET", path: "/api/v1/lecturers/me/course-sections" },
      { method: "GET", path: "/api/v1/schedules/lecturers/me?semesterId={semesterId}" },
      { method: "POST", path: "/api/v1/class-sessions/{sessionId}/attendances/sync" },
      { method: "POST", path: "/api/v1/class-sessions/{sessionId}/attendances/batch" },
    ],
  },
];
