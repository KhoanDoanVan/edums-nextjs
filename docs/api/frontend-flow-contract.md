# Frontend Flow Contract (Theo README Backend)

Tai lieu nay chot lai flow de frontend code dung thu tu backend, tranh goi API sai role hoac sai chuoi nghiep vu.

Nguon doi chieu: `/Users/doanvankhoan/Desktop/frontend-datn/README.md`.

## 1) Request Pipeline Bat Buoc

Moi tab frontend khi tich hop API deu tuan thu:

1. Goi endpoint `/api/v1/...` (qua proxy frontend).
2. Gui `Authorization: Bearer <token>` voi API protected.
3. Backend filter JWT + SecurityConfig check role.
4. Controller -> Service validate business -> Repository.
5. Backend tra `ResponseData` hoac `PageResponse`.
6. Frontend luon unwrap `response.data` va xu ly fallback shape an toan.

## 2) Security Matrix Cho Dashboard

1. Public:
  - `/api/v1/auth/**`, `/api/v1/public/**`.
2. Student:
  - `GET /api/v1/students/me/grade-reports`
  - `GET /api/v1/students/{studentId}/attendances`
3. Guardian:
  - `GET /api/v1/guardians/{guardianId}/students/{studentId}/attendances`
4. Lecturer:
  - `GET /api/v1/schedules/lecturers/me`
  - `/api/v1/grade-reports/**`, `/api/v1/attendances/**`, `/api/v1/class-sessions/**`
5. Admin/Manager:
  - `/api/v1/admin/**`, `/api/v1/accounts/**`, `/api/v1/roles/**`
  - CRUD `students/lecturers/guardians` va cac module quan tri khac.

## 3) Flow Chuan Theo Tung Dashboard

### 3.1 Student Dashboard

1. Ho so:
  - `GET /api/v1/profile/me`
  - (can them detail) `GET /api/v1/students/{id}`
  - `PUT /api/v1/profile/me`
  - `PUT /api/v1/profile/password` (tab doi mat khau)
2. Dang ky hoc phan:
  - `GET /api/v1/semesters`
  - `GET /api/v1/course-registrations/available-sections?...`
  - `POST /api/v1/course-registrations`
  - (neu ho tro) `PATCH /cancel`, `POST /switch`
3. Thoi khoa bieu:
  - `GET /api/v1/course-registrations/me`
  - `GET /api/v1/course-sections/{id}`
  - `GET /api/v1/recurring-schedules/section/{sectionId}`
  - `GET /api/v1/recurring-schedules/{id}/sessions`
4. Diem va diem danh:
  - `GET /api/v1/students/me/grade-reports`
  - `GET /api/v1/students/me/grade-reports/{id}`
  - `GET /api/v1/students/{studentId}/attendances`

### 3.2 Lecturer Dashboard

1. Lich giang day:
  - `GET /api/v1/schedules/lecturers/me?startDate=...&endDate=...`
2. Bang diem lop:
  - `GET /api/v1/course-sections`
  - `GET /api/v1/course-sections/{sectionId}/grade-reports`
  - `GET /api/v1/grade-reports/{id}`
3. Diem danh:
  - `GET /api/v1/course-sections`
  - `GET /api/v1/recurring-schedules/section/{sectionId}`
  - `GET /api/v1/recurring-schedules/{id}/sessions`
  - `GET /api/v1/class-sessions/{sessionId}/attendances`
  - `POST /api/v1/class-sessions/{sessionId}/attendances/batch`

### 3.3 Guardian Dashboard

1. Ho so:
  - `GET /api/v1/profile/me`
  - `GET /api/v1/guardians/{guardianId}`
2. Diem danh con:
  - `GET /api/v1/guardians/{guardianId}/students/{studentId}/attendances`
3. Bang diem con:
  - `GET /api/v1/students/{studentId}/grade-reports`
  - `GET /api/v1/grade-reports/{id}`

### 3.4 Admin Dashboard

1. Master data:
  - `faculties`, `majors`, `specializations`, `cohorts`, `courses`, `classrooms`, `administrative-classes`.
2. Van hanh dao tao:
  - `course-sections` -> `recurring-schedules` -> `class-sessions`.
3. Diem danh va diem:
  - `class-sessions/{id}/attendances`
  - `grade-reports` (create/update/list/detail).
4. Tuyen sinh:
  - Config (`periods`, `blocks`, `benchmarks`, `form-options`)
  - Applications (`list`, `review`, `bulk-review`, `auto-screen`, `onboard`).

## 4) Quy Tac UI De Khop Flow Backend

1. Cac form FK bat buoc dung `select/dropdown` + goi API preload options:
  - Chon khoa -> goi `GET /majors/faculty/{facultyId}`.
  - Chon nganh -> goi `GET /specializations/major/{majorId}`.
  - Chon hoc phan -> goi `GET /recurring-schedules/section/{sectionId}`.
  - Chon schedule -> goi `GET /recurring-schedules/{id}/sessions`.
2. Khong hien thi JSON raw tren UI:
  - moi object/map/list phai render thanh bang, card, detail row hoac badge.
3. Role routing phai phu hop:
  - Admin -> `/admin/dashboard`
  - Lecturer -> `/lecturer/dashboard`
  - Guardian/Parent -> `/guardian/dashboard`
  - Student -> `/dashboard`
4. Enum map UI dong bo backend:
  - Account: `ACTIVE|INACTIVE|LOCKED`
  - Section: `DRAFT|OPEN|ONGOING|FINISHED|CANCELLED`
  - Grade report: `DRAFT|PUBLISHED|LOCKED`
  - Attendance: `PRESENT|ABSENT|LATE|EXCUSED`
  - Admission app: `PENDING|APPROVED|ENROLLED|REJECTED`

## 5) Checklist Truoc Khi Merge Moi Tab

1. Da map dung role security cho endpoint trong tab.
2. Da goi dung thu tu flow (khong skip API trung gian).
3. Da unwrap response theo `ResponseData/PageResponse`.
4. Cac ID input da doi thanh select co preload options neu co API lien ket.
5. Khong con block hien thi JSON tho.
6. Da smoke test tai tab:
  - load list,
  - xem detail,
  - submit action chinh,
  - refresh van giu dung state.
