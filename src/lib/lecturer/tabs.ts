import type { LecturerFeatureTab } from "@/lib/lecturer/types";

export const lecturerFeatureTabs: LecturerFeatureTab[] = [
  {
    key: "schedule",
    label: "Lịch giảng dạy",
    description: "Tra cứu lịch dạy cá nhân của giảng viên theo khoảng thời gian.",
    endpoints: [{ method: "GET", path: "/api/v1/schedules/lecturers/me" }],
  },
  {
    key: "grades",
    label: "Bảng điểm lớp",
    description: "Xem bảng điểm theo lớp học phần mà giảng viên phụ trách.",
    endpoints: [
      { method: "GET", path: "/api/v1/course-sections" },
      { method: "GET", path: "/api/v1/course-sections/{sectionId}/grade-reports" },
      { method: "GET", path: "/api/v1/grade-reports/{id}" },
    ],
  },
  {
    key: "attendance",
    label: "Điểm danh buổi học",
    description:
      "Chọn buổi dạy từ lịch cá nhân rồi chấm điểm danh theo từng sinh viên.",
    endpoints: [
      { method: "GET", path: "/api/v1/schedules/lecturers/me" },
      { method: "GET", path: "/api/v1/class-sessions/{sessionId}/attendances" },
      { method: "POST", path: "/api/v1/class-sessions/{sessionId}/attendances/batch" },
      { method: "PUT", path: "/api/v1/attendances/{id}" },
    ],
  },
];
