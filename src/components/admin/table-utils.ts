import type { DynamicRow } from "@/lib/admin/types";

const fieldLabelMap: Record<string, string> = {
  id: "Mã",
  name: "Tên",
  code: "Mã",
  status: "Trạng thái",
  displayName: "Tên hiển thị",
  semesterId: "Mã Học kỳ",
  semesterNumber: "Học kỳ",
  academicYear: "Năm học",
  startDate: "Ngày bắt đầu",
  endDate: "Ngày kết thúc",
  totalWeeks: "Tổng số tuần",
  startTime: "Thời gian bắt đầu",
  endTime: "Thời gian kết thúc",
  facultyId: "Khoa",
  facultyCode: "Mã khoa",
  facultyName: "Tên khoa",
  majorId: "Ngành",
  majorCode: "Mã ngành",
  majorName: "Tên ngành",
  specializationId: "Chuyên ngành",
  specializationName: "Tên chuyên ngành",
  cohortId: "Niên khóa",
  cohortName: "Tên niên khóa",
  startYear: "Năm bắt đầu",
  endYear: "Năm kết thúc",
  courseId: "Môn học",
  courseCode: "Mã môn học",
  courseName: "Tên môn học",
  credits: "Số tín chỉ",
  classId: "Lớp hành chính",
  className: "Tên lớp",
  sectionCode: "Mã lớp học phần",
  lecturerId: "Giảng viên",
  headLecturerId: "Giảng viên chủ nhiệm",
  guardianId: "Phụ huynh",
  studentCode: "Mã sinh viên",
  fullName: "Họ và tên",
  email: "Email",
  phone: "Số điện thoại",
  nationalId: "CCCD/CMND",
  dateOfBirth: "Ngày sinh",
  gender: "Giới tính",
  address: "Địa chỉ",
  ethnicity: "Dân tộc",
  religion: "Tôn giáo",
  placeOfBirth: "Nơi sinh",
  nationality: "Quốc tịch",
  relationship: "Mối quan hệ",
  academicDegree: "Học vị",
  roomName: "Tên phòng",
  roomType: "Loại phòng",
  capacity: "Sức chứa",
  maxCapacity: "Sĩ số tối đa",
  componentName: "Tên thành phần điểm",
  weightPercentage: "Tỷ trọng (%)",
  dayOfWeek: "Thứ",
  startPeriod: "Tiết bắt đầu",
  endPeriod: "Tiết kết thúc",
  classroomId: "Phòng học",
};

const valueLabelMap: Record<string, string> = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
  PLANNING: "Lập kế hoạch",
  REGISTRATION_OPEN: "Mở đăng ký",
  UPCOMING: "Sắp diễn ra",
  OPEN: "Đang mở",
  ONGOING: "Đang diễn ra",
  FINISHED: "Đã kết thúc",
  CLOSED: "Đã đóng",
  PAUSED: "Tạm dừng",
  CANCELLED: "Đã hủy",
  DRAFT: "Nháp",
  SUSPENDED: "Tạm ngưng",
  GRADUATED: "Đã tốt nghiệp",
  DROPPED_OUT: "Thôi học",
  THEORY: "Lý thuyết",
  PRACTICE: "Thực hành",
  LAB: "Phòng thí nghiệm",
};

export const toColumnLabel = (field: string): string => {
  if (fieldLabelMap[field]) {
    return fieldLabelMap[field];
  }

  const spaced = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  return spaced ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : field;
};

export const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Có" : "Không";
  }

  if (Array.isArray(value)) {
    return `${value.length} mục`;
  }

  if (typeof value === "object") {
    return "Có dữ liệu";
  }

  if (typeof value === "string" && valueLabelMap[value]) {
    return valueLabelMap[value];
  }

  return String(value);
};

export const buildColumns = (
  rows: DynamicRow[],
  priorityColumns: string[],
  sampleSize = 50,
): string[] => {
  const scalarKeys = new Set<string>();
  const complexKeys = new Set<string>();

  for (const row of rows.slice(0, sampleSize)) {
    for (const [key, value] of Object.entries(row)) {
      if (Array.isArray(value) || (value !== null && typeof value === "object")) {
        complexKeys.add(key);
        continue;
      }
      scalarKeys.add(key);
    }
  }

  const visibleKeys = [...scalarKeys].filter((key) => !complexKeys.has(key));
  const priority = priorityColumns.filter((key) => visibleKeys.includes(key));
  const others = visibleKeys
    .filter((key) => !priorityColumns.includes(key))
    .sort();

  return [...priority, ...others];
};
