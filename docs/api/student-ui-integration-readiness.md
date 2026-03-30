# Student UI Integration Readiness (EduMS API-4)

## 1) Phạm vi rà soát

- Snapshot backend: `/Users/doanvankhoan/Desktop/frontend-datn/docs/api/edums-openapi.json`
- Code đối chiếu:
  - `/Users/doanvankhoan/Desktop/frontend-datn/src/lib/student/service.ts`
  - `/Users/doanvankhoan/Desktop/frontend-datn/src/lib/student/tabs.ts`
  - `/Users/doanvankhoan/Desktop/frontend-datn/src/app/dashboard/page.tsx`

## 2) Kết quả tổng hợp

- Tổng số operation backend trong OpenAPI: `129`
- API đã tích hợp trên student dashboard: `33`
- API mở rộng có thể tận dụng thêm cho student dashboard: `0` trong nhóm ưu tiên hiện tại

## 3) API đã dùng trong student dashboard

1. `GET /api/v1/profile/me`
2. `PUT /api/v1/profile/me`
3. `PUT /api/v1/profile/password`
4. `GET /api/v1/students/{id}`
5. `GET /api/v1/faculties/{id}`
6. `GET /api/v1/majors`
7. `GET /api/v1/majors/{id}`
8. `GET /api/v1/majors/faculty/{facultyId}`
9. `GET /api/v1/specializations`
10. `GET /api/v1/specializations/major/{majorId}`
11. `GET /api/v1/administrative-classes`
12. `GET /api/v1/administrative-classes/{id}`
13. `GET /api/v1/cohorts`
14. `GET /api/v1/cohorts/{id}`
15. `GET /api/v1/faculties`
16. `GET /api/v1/courses`
17. `GET /api/v1/courses/faculty/{facultyId}`
18. `GET /api/v1/courses/{id}`
19. `GET /api/v1/course-sections`
20. `GET /api/v1/course-sections/{id}`
21. `GET /api/v1/course-sections/course/{courseId}`
22. `GET /api/v1/course-sections/semester/{semesterId}`
23. `GET /api/v1/recurring-schedules/section/{sectionId}`
24. `GET /api/v1/recurring-schedules/{id}`
25. `GET /api/v1/recurring-schedules/{id}/sessions`
26. `GET /api/v1/classrooms`
27. `GET /api/v1/classrooms/{id}`
28. `POST /api/v1/course-registrations`
29. `GET /api/v1/students/{studentId}/grade-reports`
30. `GET /api/v1/grade-reports/{id}`
31. `GET /api/v1/courses/{courseId}/grade-components`
32. `GET /api/v1/students/{studentId}/attendances`
33. `GET /api/v1/lecturers/{id}`

## 4) API mở rộng có thể tận dụng thêm cho student dashboard

### Nhóm ưu tiên cao (nên tích hợp tiếp trước)

- Hiện chưa còn API ưu tiên cao chưa tích hợp cho student dashboard trong phạm vi OpenAPI hiện tại.

## 5) API không khuyến nghị dùng cho student dashboard (lệch role/nguy cơ dữ liệu)

1. `GET /api/v1/course-sections/{sectionId}/grade-reports`
  - Summary backend ghi rõ: lecturer lấy bảng điểm theo lớp.
2. `GET /api/v1/class-sessions/{sessionId}/attendances`
  - Có thể trả danh sách điểm danh toàn lớp, không phù hợp scope student.
3. `GET /api/v1/students` và các CRUD `students/*`
  - Thuộc nghiệp vụ quản trị sinh viên.
4. `GET /api/v1/accounts*`, `GET /api/v1/roles*`, `GET /api/v1/admin/*`
  - Thuộc nghiệp vụ quản trị hệ thống.
5. `GET /api/v1/schedules/lecturers/me`
  - Dành riêng cho giảng viên.
6. `GET /api/v1/guardians*`
  - Dành cho phụ huynh / quản trị phụ huynh.
7. `GET /api/v1/grade-components` và `GET /api/v1/grade-components/{id}`
  - Nghiệp vụ quản lý cấu hình điểm toàn hệ thống; student đã có endpoint phù hợp hơn là `GET /api/v1/courses/{courseId}/grade-components`.
8. `GET /api/v1/public/admissions/*`
  - Thuộc portal tuyển sinh công khai, không phải luồng dashboard sinh viên đã nhập học.

## 6) Ghi chú quyền truy cập

- OpenAPI hiện có `bearerAuth` global nhưng không mô tả chi tiết role per-endpoint.
- Danh sách “có thể tận dụng thêm” cần smoke test bằng token `STUDENT` trước khi đưa vào production.
- Kết luận hiện tại: student dashboard đã phủ đủ API cốt lõi; phần còn lại là tối ưu nâng trải nghiệm.
