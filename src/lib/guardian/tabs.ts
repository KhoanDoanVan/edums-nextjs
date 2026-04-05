import type { GuardianFeatureTab } from "@/lib/guardian/types";

export const guardianFeatureTabs: GuardianFeatureTab[] = [
  {
    key: "profile",
    label: "Hồ sơ phụ huynh",
    description: "Xem thông tin phụ huynh và danh sách học sinh liên kết.",
    endpoints: [{ method: "GET", path: "/api/v1/guardians/{id}" }],
  },
  {
    key: "attendance",
    label: "Điểm danh của con",
    description: "Theo dõi điểm danh theo từng học sinh.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/guardians/{guardianId}/students/{studentId}/attendances",
      },
    ],
  },
  {
    key: "grades",
    label: "Bảng điểm của con",
    description: "Theo dõi bảng điểm học kỳ của học sinh.",
    endpoints: [
      { method: "GET", path: "/api/v1/students/{studentId}/grade-reports" },
      { method: "GET", path: "/api/v1/grade-reports/{id}" },
    ],
  },
];
