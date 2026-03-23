# Student API Scope (Current Phase)

Only endpoints suitable for student flow are mapped in the current home/dashboard.
Admin and lecturer endpoints are intentionally excluded for now.

## Selected Endpoints

| Feature | Endpoint(s) |
| --- | --- |
| Profile | `GET /api/v1/profile/me`, `PUT /api/v1/profile/me` |
| Change password | `PUT /api/v1/profile/password` |
| Course registration | `GET /api/v1/course-sections`, `POST /api/v1/course-registrations` |
| Grades | `GET /api/v1/students/{studentId}/grade-reports` |
| Attendance | `GET /api/v1/students/{studentId}/attendances` |

## Deferred Endpoints

- Admin-focused endpoints (`/api/v1/accounts`, `/api/v1/students`, `/api/v1/roles`, etc.).
- Lecturer-focused schedule endpoint (`GET /api/v1/schedules/lecturers/me`).
