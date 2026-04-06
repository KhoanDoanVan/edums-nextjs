# EduMS Backend - API Flow Toan Trinh Cho Frontend

## 1. Request Pipeline Chung
1. Frontend goi endpoint `/api/v1/...`.
2. `SecurityFilterChain` ap rule quyen tu `SecurityConfig`.
3. Neu la API protected, `JwtAuthenticationFilter` doc header `Authorization: Bearer <token>`, goi `JwtService.extractUsername`, load user qua `ApplicationConfig.userDetailsService -> AccountRepository.findByUsernameAndDeletedFalse`, validate token, gan `SecurityContext`.
4. Controller nhan request (`@Valid`, `@PathVariable`, `@RequestParam`, `@ModelAttribute`).
5. Controller goi Service method tuong ung.
6. Service xu ly business: validate, check ton tai, check duplicate, check status transition, check ranh buoc.
7. Service goi Repository (JPA) de query/save (soft-delete la set `deleted=true`).
8. Mapper (MapStruct) map Entity -> Response DTO.
9. Controller tra `ResponseData`/`PageResponse` ve frontend.

## 2. End-to-End Business Flows (Frontend hay dung)

### 2.1 Login -> Lay profile
1. `POST /api/v1/auth/login`
2. `GET /api/v1/profile/me`
3. `PUT /api/v1/profile/me` (neu sua profile)
4. `PUT /api/v1/profile/password` (neu doi mat khau)

### 2.2 Flow tuyen sinh cong khai -> duyet -> tao sinh vien
1. `GET /api/v1/public/admissions/active-periods`
2. `GET /api/v1/public/admissions/periods/{periodId}/majors`
3. `GET /api/v1/public/admissions/periods/{periodId}/majors/{majorId}/blocks`
4. `POST /api/v1/public/admissions/apply`
5. `GET /api/v1/public/admissions/lookup`
6. `GET /api/v1/admin/admissions/applications`
7. `PATCH /api/v1/admin/admissions/applications/{id}/review` hoac `POST /api/v1/admin/admissions/applications/auto-screen/{periodId}`
8. `POST /api/v1/admin/admissions/applications/onboard`
9. Sau onboarding, account STUDENT/GUARDIAN duoc tao, login bang `POST /api/v1/auth/login`

### 2.3 Flow mo hoc phan -> tao lich hoc -> dang ky hoc -> diem danh -> bang diem
1. `POST /api/v1/courses`
2. `POST /api/v1/course-sections`
3. `POST /api/v1/recurring-schedules`
4. `GET /api/v1/recurring-schedules/{id}/sessions`
5. `POST /api/v1/course-registrations`
6. `POST /api/v1/class-sessions/{sessionId}/attendances/batch`
7. `POST /api/v1/grade-reports`
8. `GET /api/v1/students/{studentId}/grade-reports` va `GET /api/v1/students/{studentId}/attendances`

### 2.4 Flow xem lich giang vien
1. `GET /api/v1/schedules/lecturers/me?startDate=...&endDate=...`

---

## 3. API Flow Catalog (Toan bo endpoint)

## 3.1 Auth

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `POST /api/v1/auth/login` | FE -> `AuthController.login` -> `AuthenticationManager.authenticate` -> `ApplicationConfig.userDetailsService` -> `AccountRepository.findByUsernameAndDeletedFalse` -> verify password (`BCrypt`) -> `JwtService.generateToken` -> tra `AuthResponse(token, accountId, username, role)` | Bat dau session dang nhap, token dung cho tat ca API protected |

## 3.2 Profile

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/profile/me` | FE (Bearer token) -> `ProfileController.getMyProfile` -> `ProfileServiceImpl.getMyProfile(username)` -> `AccountRepository.findByUsernameAndDeletedFalse` -> branch theo role: `StudentRepository.findByAccount_IdAndDeletedFalse` / `LecturerRepository.findByAccountIdAndDeletedFalse` / `GuardianRepository.findByAccountIdAndDeletedFalse` -> map `ProfileResponse` -> FE | Goi sau login |
| `PUT /api/v1/profile/me` | FE -> `ProfileController.updateMyProfile` -> `ProfileServiceImpl.updateMyProfile` -> load account theo username -> branch role -> update field -> save (`StudentRepository`/`LecturerRepository`/`GuardianRepository`) -> map response | Thuong goi sau `GET /profile/me` |
| `PUT /api/v1/profile/password` | FE -> `ProfileController.changePassword` -> `ProfileServiceImpl.changePassword` -> load account -> check oldPassword -> check new/confirm -> encode password -> `AccountRepository.save` | Login -> doi mat khau |

## 3.3 Account Management

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/accounts` | FE -> `AccountController.getAccounts` -> `AccountServiceImpl.getAccounts` -> tao pageable/sort -> `AccountRepository.searchAccounts(keyword, roleId, status, prefix, pageable)` -> `AccountMapper.toResponseList` -> `PageResponse` | Filter list account trong admin panel |
| `GET /api/v1/accounts/{id}` | FE -> `AccountController.getAccountById` -> `AccountServiceImpl.getAccountById` -> `AccountRepository.findById` -> `AccountMapper.toResponse` | Thuong goi khi mo detail/edit |
| `POST /api/v1/accounts` | FE -> `AccountController.createAccount` -> `AccountServiceImpl.createAccount` -> check duplicate username (`AccountRepository.existsByUsername`) -> load role (`RoleRepository.findById`) -> encode password -> `AccountRepository.save` -> mapper response | Thuong goi sau `GET /api/v1/roles` |
| `PUT /api/v1/accounts/{id}` | FE -> `AccountController.updateAccount` -> `AccountServiceImpl.updateAccount` -> find account -> check username duplicate -> load role -> save -> mapper response | Edit account |
| `PATCH /api/v1/accounts/{id}/status` | FE -> `AccountController.updateStatus` -> `AccountServiceImpl.updateAccountStatus` -> `AccountRepository.findById` -> set status -> save | Khoa/mo tai khoan |
| `PATCH /api/v1/accounts/{id}/reset-password` | FE -> `AccountController.resetPassword` -> `AccountServiceImpl.resetPassword` -> check confirmPassword -> find account -> encode newPassword -> save | Admin reset mat khau |

## 3.4 Role & Permission

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/roles/permissions` | FE -> `RoleController.getAllPermissions` -> `RoleServiceImpl.getAllSystemPermissions` (static permission code list) -> FE | Goi truoc man tao/sua role de render checkbox |
| `GET /api/v1/roles` | FE -> `RoleController.getAllRoles` -> `RoleServiceImpl.getAllRoles` -> `RoleRepository.findAll` -> filter `deleted=false` -> mapper list | Dropdown role |
| `GET /api/v1/roles/{id}` | FE -> `RoleController.getRoleById` -> `RoleServiceImpl.getRoleById` -> `RoleRepository.findById` -> mapper | Detail role |
| `POST /api/v1/roles` | FE -> `RoleController.createRole` -> `RoleServiceImpl.createRole` -> `RoleMapper.toEntity` -> `RoleRepository.save` -> tao `RolePermission` list -> `RolePermissionRepository.saveAll` -> mapper response | Thuong chain: permissions -> tao role |
| `PUT /api/v1/roles/{id}` | FE -> `RoleController.updateRole` -> `RoleServiceImpl.updateRole` -> find role -> save roleName -> `RolePermissionRepository.deleteAllByRoleId` -> save lai permission moi -> mapper | Sua role |
| `DELETE /api/v1/roles/{id}` | FE -> `RoleController.deleteRole` -> `RoleServiceImpl.deleteRole` -> find role -> check role dang duoc account dung (`AccountRepository.existsByRoleId`) -> soft delete | Xoa role neu khong con account gan vao |

## 3.5 Faculty

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/faculties` | FE -> `FacultyController.getAll` -> `FacultyServiceImpl.getAll` -> `FacultyRepository.findAllByDeletedFalse` -> mapper | Dropdown faculty |
| `GET /api/v1/faculties/{id}` | FE -> `FacultyController.getById` -> `FacultyServiceImpl.getById` -> `FacultyRepository.findByIdAndDeletedFalse` -> mapper | Detail faculty |
| `POST /api/v1/faculties` | FE -> controller -> `FacultyServiceImpl.create` -> `FacultyValidator.validateDuplicate(name, code)` -> mapper -> `FacultyRepository.save` | Tao faculty |
| `PUT /api/v1/faculties/{id}` | FE -> controller -> `FacultyServiceImpl.update` -> find faculty -> validate duplicate -> mapper update -> save | Sua faculty |
| `DELETE /api/v1/faculties/{id}` | FE -> controller -> `FacultyServiceImpl.delete` -> find faculty -> check major/course con ton tai (`MajorRepository.existsByFacultyIdAndDeletedFalse`, `CourseRepository.existsByFacultyIdAndDeletedFalse`) -> set deleted -> save | Xoa faculty |

## 3.6 Major

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/majors` | FE -> `MajorController.getAll` -> `MajorServiceImpl.getAll` -> `MajorRepository.findAllByDeletedFalse` -> mapper | Dropdown major |
| `GET /api/v1/majors/faculty/{facultyId}` | FE -> controller -> `MajorServiceImpl.getAllByFaculty` -> check faculty ton tai -> query major theo faculty -> mapper | Chain sau khi chon faculty |
| `GET /api/v1/majors/{id}` | FE -> controller -> `MajorServiceImpl.getById` -> `MajorRepository.findByIdAndDeletedFalse` -> mapper | Detail major |
| `POST /api/v1/majors` | FE -> controller -> `MajorServiceImpl.create` -> find faculty -> check duplicate name/code trong faculty -> mapper -> `MajorRepository.save` | Tao major |
| `PUT /api/v1/majors/{id}` | FE -> controller -> `MajorServiceImpl.update` -> find major -> find faculty -> `MajorValidator.validateDuplicate` -> mapper update -> save | Sua major |
| `DELETE /api/v1/majors/{id}` | FE -> controller -> `MajorServiceImpl.delete` -> check rang buoc (`SpecializationRepository`, `AdministrativeClassRepository`, `AdmissionApplicationRepository`, `BenchmarkScoreRepository`) -> soft delete | Xoa major |

## 3.7 Specialization

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/specializations` | FE -> `SpecializationController.getAll` -> `SpecializationServiceImpl.getAll` -> repo list -> mapper | Dropdown specialization |
| `GET /api/v1/specializations/major/{majorId}` | FE -> controller -> service `getAllByMajor` -> check major -> query specialization by major -> mapper | Chain sau khi chon major |
| `GET /api/v1/specializations/{id}` | FE -> controller -> service `getById` -> repo find -> mapper | Detail |
| `POST /api/v1/specializations` | FE -> controller -> service `create` -> find major -> validator duplicate name trong major -> mapper -> save | Tao specialization |
| `PUT /api/v1/specializations/{id}` | FE -> controller -> service `update` -> find specialization -> find major -> validator duplicate -> mapper update -> save | Sua specialization |
| `DELETE /api/v1/specializations/{id}` | FE -> controller -> service `delete` -> check student con gan specialization (`StudentRepository.existsBySpecializationIdAndDeletedFalse`) -> soft delete | Xoa specialization |

## 3.8 Cohort

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/cohorts` | FE -> `CohortController.getAll` -> `CohortServiceImpl.getAll` -> repo list -> mapper | Dropdown cohort |
| `GET /api/v1/cohorts/{id}` | FE -> controller -> service `getById` -> findOrThrow -> mapper | Detail cohort |
| `POST /api/v1/cohorts` | FE -> controller -> service `create` -> `CohortValidator.validateCreate` (duplicate name + year range) -> mapper -> save | Tao cohort |
| `PUT /api/v1/cohorts/{id}` | FE -> controller -> service `update` -> findOrThrow -> validator update -> mapper update -> save | Sua cohort |
| `DELETE /api/v1/cohorts/{id}` | FE -> controller -> service `delete` -> validator check khong co administrative class gan vao -> soft delete | Xoa cohort |

## 3.9 Administrative Class

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/administrative-classes` | FE -> `AdministrativeClassController.getAll` -> service `getAll` -> repo list -> mapper | Dropdown class |
| `GET /api/v1/administrative-classes/{id}` | FE -> controller -> service `getById` -> findOrThrow -> mapper | Detail class |
| `POST /api/v1/administrative-classes` | FE -> controller -> service `create` -> validator create (duplicate className + FK ton tai) -> mapper -> setRelations(lecturer/cohort/major) -> save | Tao lop hanh chinh |
| `PUT /api/v1/administrative-classes/{id}` | FE -> controller -> service `update` -> validator update -> findOrThrow -> mapper update -> setRelations -> save | Sua lop hanh chinh |
| `DELETE /api/v1/administrative-classes/{id}` | FE -> controller -> service `delete` -> validator check khong con student trong lop -> soft delete | Xoa lop hanh chinh |

## 3.10 Classroom

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/classrooms` | FE -> `ClassroomController.getAll` -> `ClassroomServiceImpl.getAll` -> repo list -> mapper | Dropdown phong |
| `GET /api/v1/classrooms/{id}` | FE -> controller -> service `getById` -> repo find -> mapper | Detail phong |
| `POST /api/v1/classrooms` | FE -> controller -> service `create` -> `ClassroomValidator.validateDuplicate(roomName)` -> mapper -> save | Tao phong |
| `PUT /api/v1/classrooms/{id}` | FE -> controller -> service `update` -> find -> validator duplicate -> mapper update -> save | Sua phong |
| `DELETE /api/v1/classrooms/{id}` | FE -> controller -> service `delete` -> check phong khong dang gan recurring schedule (`RecurringScheduleRepository.existsByRoomId`) va class session (`ClassSessionRepository.existsByRoomId`) -> soft delete | Xoa phong |

## 3.11 Course

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/courses` | FE -> `CourseController.getAll` -> `CourseServiceImpl.getAll` -> repo list -> mapper | Dropdown mon hoc |
| `GET /api/v1/courses/faculty/{facultyId}` | FE -> controller -> service `getAllByFaculty` -> check faculty -> query by faculty -> mapper | Chain theo faculty |
| `GET /api/v1/courses/{id}` | FE -> controller -> service `getById` -> repo find -> mapper | Detail course |
| `POST /api/v1/courses` | FE -> controller -> service `create` -> find faculty -> `CourseValidator.validateDuplicate` -> mapper entity -> optional find prerequisite course -> save | Tao course |
| `PUT /api/v1/courses/{id}` | FE -> controller -> service `update` -> find course -> find faculty -> validator duplicate -> mapper update -> update prerequisite -> save | Sua course |
| `DELETE /api/v1/courses/{id}` | FE -> controller -> service `delete` -> check khong la prerequisite cua mon khac (`CourseRepository.existsByPrerequisiteCourseIdAndDeletedFalse`) -> soft delete | Xoa course |

## 3.12 Course Section

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/course-sections` | FE -> `CourseSectionController.getAll` -> `CourseSectionServiceImpl.getAll` -> repo list -> mapper | List hoc phan |
| `GET /api/v1/course-sections/course/{courseId}` | FE -> controller -> service `getAllByCourse` -> check course -> query by course -> mapper | Chain theo course |
| `GET /api/v1/course-sections/semester/{semesterId}` | FE -> controller -> service `getAllBySemester` -> check semester -> query by semester -> mapper | Chain theo hoc ky |
| `GET /api/v1/course-sections/{id}` | FE -> controller -> service `getById` -> repo find -> mapper | Detail hoc phan |
| `POST /api/v1/course-sections` | FE -> controller -> service `create` -> find course/semester/lecturer -> `CourseSectionValidator.validateDuplicate(sectionCode, courseId, semesterId)` -> mapper -> save | Tao hoc phan |
| `PUT /api/v1/course-sections/{id}` | FE -> controller -> service `update` -> find section -> find FK moi -> check status constraints (FINISHED/CANCELLED khong cho update, doi course/semester chi khi DRAFT, doi lecturer chi khi DRAFT/OPEN) -> validator duplicate -> mapper update -> save | Sua hoc phan |
| `PATCH /api/v1/course-sections/{id}/status` | FE -> controller -> service `updateStatus` -> find section -> validate transition (`DRAFT->OPEN/CANCELLED`, `OPEN->ONGOING/CANCELLED`, `ONGOING->FINISHED`) -> save | Dong/mo/chuyen trang thai hoc phan |
| `DELETE /api/v1/course-sections/{id}` | FE -> controller -> service `delete` -> chi cho xoa khi `DRAFT`/`CANCELLED` -> soft delete section -> cascade soft-delete recurring schedules (`RecurringScheduleRepository.findAllBySectionIdAndDeletedFalse`) + class sessions (`ClassSessionRepository.findAllBySectionIdAndDeletedFalse`) | Xoa hoc phan |

## 3.13 Recurring Schedule & Class Session

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/recurring-schedules/section/{sectionId}` | FE -> `RecurringScheduleController.getBySectionId` -> service `getBySectionId` -> check section ton tai -> list schedules -> mapper | Sau khi co section |
| `GET /api/v1/recurring-schedules/{id}` | FE -> controller -> service `getById` -> repo find -> mapper | Detail schedule |
| `GET /api/v1/recurring-schedules/{id}/sessions` | FE -> controller -> service `getClassSessions` -> check schedule ton tai -> query class sessions -> mapper | Xem buoi hoc da sinh |
| `POST /api/v1/recurring-schedules` | FE -> controller -> service `create` -> `RecurringScheduleValidator.validatePeriodLogic` -> find section -> validate section status/lecturer/semester date -> find classroom -> validate capacity -> validate conflict section/classroom/lecturer -> save schedule -> `generateClassSessions` (sinh tung tuan trong date range hoc ky, check duplicate date) -> saveAll sessions | Tao TKB tu dong |
| `PUT /api/v1/recurring-schedules/{id}` | FE -> controller -> service `update` -> find schedule -> validate nhu create -> soft-delete old sessions theo schedule -> update schedule -> regenerate sessions | Sua TKB va sinh lai buoi hoc |
| `DELETE /api/v1/recurring-schedules/{id}` | FE -> controller -> service `delete` -> find schedule -> check khong co attendance (`ClassSessionRepository.existsSessionWithAttendanceByScheduleId`) -> soft-delete sessions cua schedule -> soft-delete schedule | Xoa TKB |

## 3.14 Lecturer Personal Schedule

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/schedules/lecturers/me` | FE (lecturer token) -> `ScheduleController.getMyLecturerSchedule` -> lay username tu `SecurityContext` -> `ScheduleServiceImpl.getMyLecturerSchedule` -> `LecturerRepository.findByAccount_UsernameAndDeletedFalse` -> `ClassSessionRepository.findScheduleByLecturerAndDateRange` -> `ScheduleMapper.toLecturerScheduleResponseList` -> FE | Login lecturer -> goi API nay de ve lich |

## 3.15 Student Management

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/students` | FE -> `StudentController.getAllStudents` -> `StudentServiceImpl.getAllStudents` -> `StudentRepository.searchStudents(keyword,classId,majorId,status,pageable)` -> mapper page | List sinh vien + filter |
| `GET /api/v1/students/{id}` | FE -> controller -> service `getStudentById` -> `StudentRepository.findByIdAndDeletedFalse` -> mapper | Detail sinh vien |
| `POST /api/v1/students` | FE -> controller -> service `createStudent` -> check unique (`studentCode/email/nationalId`) -> mapper -> `bindForeignKeys` (class/major/spec/guardian) -> save -> mapper | Tao sinh vien |
| `PUT /api/v1/students/{id}` | FE -> controller -> service `updateStudent` -> find student -> check unique email/nationalId khi thay doi -> mapper update -> bind FK lai -> save | Sua sinh vien |
| `PATCH /api/v1/students/{id}/status` | FE -> controller -> service `updateStudentStatus` -> find student -> set status -> save | Doi trang thai sinh vien |
| `DELETE /api/v1/students/{id}` | FE -> controller -> service `deleteStudent` -> find -> soft delete | Xoa mem sinh vien |

## 3.16 Lecturer Management

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/lecturers` | FE -> `LecturerController.getAllLecturers` -> `LecturerServiceImpl.getAllLecturers` -> `LecturerRepository.searchLecturers` hoac `findAllByDeletedFalse(pageable)` -> mapper page | List lecturer |
| `GET /api/v1/lecturers/{id}` | FE -> controller -> service `getLecturerById` -> repo find -> mapper | Detail lecturer |
| `POST /api/v1/lecturers` | FE -> controller -> service `createLecturer` -> check email unique (`existsByEmailAndDeletedFalse`) -> mapper -> save | Tao lecturer |
| `PUT /api/v1/lecturers/{id}` | FE -> controller -> service `updateLecturer` -> find -> check email moi unique -> mapper update -> save | Sua lecturer |
| `DELETE /api/v1/lecturers/{id}` | FE -> controller -> service `deleteLecturer` -> find -> soft delete | Xoa mem lecturer |

## 3.17 Guardian Management

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/guardians` | FE -> `GuardianController.getAllGuardians` -> `GuardianServiceImpl.getAllGuardians` -> `GuardianRepository.searchGuardians` hoac `findAllByDeletedFalse(pageable)` -> mapper page | List guardian |
| `GET /api/v1/guardians/{id}` | FE -> controller -> service `getGuardianById` -> repo find -> mapper | Detail guardian |
| `POST /api/v1/guardians` | FE -> controller -> service `createGuardian` -> check phone unique (`existsByPhoneAndDeletedFalse`) -> mapper -> save | Tao guardian |
| `PUT /api/v1/guardians/{id}` | FE -> controller -> service `updateGuardian` -> find -> check phone moi unique -> mapper update -> save | Sua guardian |
| `DELETE /api/v1/guardians/{id}` | FE -> controller -> service `deleteGuardian` -> find -> soft delete | Xoa mem guardian |

## 3.18 Course Registration

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `POST /api/v1/course-registrations` | FE -> `CourseRegistrationController.register` -> `CourseRegistrationServiceImpl.register` -> find student (`StudentRepository.findByIdAndDeletedFalse`) -> find section (`CourseSectionRepository.findByIdAndDeletedFalse`) -> `CourseRegistrationValidator.validateStudentActive` + `validateSectionOpen` + `validateNotDuplicate` + `validateCapacity` -> find open registration period (`RegistrationPeriodRepository.findOpenPeriodBySemesterId`) -> build `CourseRegistration(status=CONFIRMED)` -> `CourseRegistrationRepository.save` -> mapper response | Thuong chain: `GET /api/v1/course-sections/semester/{semesterId}` -> `POST /api/v1/course-registrations` |

## 3.19 Attendance

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/class-sessions/{sessionId}/attendances` | FE -> `AttendanceController.getBySession` -> `AttendanceServiceImpl.getBySession` -> check class session exists -> `AttendanceRepository.findAllBySessionId` -> mapper list | Lecturer mo man diem danh |
| `POST /api/v1/class-sessions/{sessionId}/attendances/batch` | FE -> controller -> service `createBatch` -> find session -> loop items: `AttendanceValidator.validateBatch(sessionId, registrationId)` -> find registration -> save attendance tung item -> mapper list | Luu diem danh hang loat |
| `PUT /api/v1/attendances/{id}` | FE -> controller -> service `update` -> find attendance -> update status/note -> save | Sua 1 dong diem danh |
| `DELETE /api/v1/attendances/{id}` | FE -> controller -> service `delete` -> find attendance -> soft delete | Xoa diem danh |
| `GET /api/v1/students/{studentId}/attendances` | FE -> controller -> service `getByStudent` -> check student exists -> query attendance by student -> mapper | Sinh vien xem attendance |
| `GET /api/v1/guardians/{guardianId}/students/{studentId}/attendances` | FE -> controller -> service `getByGuardianAndStudent` -> check guardian -> check student -> verify `student.guardian.id == guardianId` -> query attendance by student -> mapper | Phu huynh xem attendance con |

## 3.20 Grade Component

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/grade-components` | FE -> `GradeComponentController.getAll` -> `GradeComponentServiceImpl.getAll` -> `GradeComponentRepository.findByDeletedFalse` -> mapper | Cau hinh diem list |
| `GET /api/v1/courses/{courseId}/grade-components` | FE -> controller -> service `getByCourse` -> check course -> query by course -> mapper | Chain theo course |
| `GET /api/v1/grade-components/{id}` | FE -> controller -> service `getById` -> repo find -> mapper | Detail component |
| `POST /api/v1/grade-components` | FE -> controller -> service `create` -> find course -> `GradeComponentValidator.validateCreate` (unique componentName trong course, tong weight <= 100) -> mapper -> save | Tao component |
| `PUT /api/v1/grade-components/{id}` | FE -> controller -> service `update` -> find component -> find course -> validator update (unique + tong weight) -> mapper update -> save | Sua component |
| `DELETE /api/v1/grade-components/{id}` | FE -> controller -> service `delete` -> find component -> validator delete (khong duoc co grade details) -> soft delete | Xoa component |

## 3.21 Grade Report

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `POST /api/v1/grade-reports` | FE -> `GradeReportController.create` -> `GradeReportServiceImpl.create` -> `GradeReportValidator.validateCreate(registrationId)` -> find registration -> save report (`DRAFT` neu request khong truyen status) -> loop details: validate component + duplicate detail -> find component -> save detail -> `recalculateFinalScore` (tinh weighted score, gan letter grade) -> reload report -> mapper response | Lecturer nhap diem |
| `PUT /api/v1/grade-reports/{id}` | FE -> controller -> service `update` -> validator report ton tai -> soft-delete old details -> tao lai detail moi -> cap nhat status neu co -> recalculate final score -> mapper response | Sua bang diem |
| `DELETE /api/v1/grade-reports/{id}` | FE -> controller -> service `delete` -> find report -> soft delete | Xoa mem bang diem |
| `GET /api/v1/course-sections/{sectionId}/grade-reports` | FE -> controller -> service `getBySection` -> `GradeReportRepository.findAllBySectionId` -> mapper list | Lecturer xem bang diem theo hoc phan |
| `GET /api/v1/students/{studentId}/grade-reports` | FE -> controller -> service `getByStudent` -> check student exists -> `GradeReportRepository.findAllByStudentId` -> mapper list | Student xem diem |
| `GET /api/v1/grade-reports/{id}` | FE -> controller -> service `getById` -> repo find -> mapper | Detail report |

## 3.22 Public Admissions

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/public/admissions/active-periods` | FE public -> `PublicAdmissionController.getActivePeriods` -> `PublicAdmissionServiceImpl.getActivePeriods` -> `AdmissionPeriodRepository.findActivePeriods(OPEN)` -> mapper map list | Step 1 form tuyen sinh |
| `GET /api/v1/public/admissions/periods/{periodId}/majors` | FE -> controller -> service `getAvailableMajors` -> `BenchmarkScoreRepository.findAllByAdmissionPeriodIdAndDeletedFalse` -> map -> distinct major -> response | Step 2 sau khi chon period |
| `GET /api/v1/public/admissions/periods/{periodId}/majors/{majorId}/blocks` | FE -> controller -> service `getAvailableBlocks` -> benchmark list theo period -> filter major -> distinct blocks -> response | Step 3 sau khi chon major |
| `POST /api/v1/public/admissions/apply` | FE -> controller -> service `submitApplication` -> find period -> check period OPEN + chua qua `endTime` -> check CCCD chua nop trong dot (`existsByNationalIdAndAdmissionPeriodIdAndDeletedFalse`) -> find major + block -> validate config benchmark ton tai (`findByMajorIdAndAdmissionBlockIdAndAdmissionPeriodIdAndDeletedFalse`) -> mapper.toEntity -> `AdmissionApplicationRepository.save` | Step submit ho so |
| `GET /api/v1/public/admissions/lookup` | FE -> controller -> service `lookupApplication` -> `AdmissionApplicationRepository.findAllByNationalIdAndPhoneAndDeletedFalse` -> mapper list `PublicLookupResponse` | Tra cuu trang thai sau nop |

## 3.23 Admin Admission Config

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/admin/admissions/config/periods` | FE admin -> `AdminAdmissionConfigController.getPeriods` -> `AdminMasterDataServiceImpl.getPeriods` -> pageable -> `AdmissionPeriodRepository.findAll(pageable)` -> mapper -> `PageResponse` | Quan ly dot tuyen sinh |
| `GET /api/v1/admin/admissions/config/periods/{id}` | FE -> controller -> service `getPeriodById` -> repo find -> mapper | Detail period |
| `POST /api/v1/admin/admissions/config/periods` | FE -> controller -> service `createPeriod` -> validate start<=end -> mapper -> save | Tao period |
| `PUT /api/v1/admin/admissions/config/periods/{id}` | FE -> controller -> service `updatePeriod` -> validate time -> find -> mapper update -> save | Sua period |
| `DELETE /api/v1/admin/admissions/config/periods/{id}` | FE -> controller -> service `deletePeriod` -> find -> check chua co application (`AdmissionApplicationRepository.existsByAdmissionPeriodIdAndDeletedFalse`) -> soft delete | Xoa period |
| `GET /api/v1/admin/admissions/config/blocks` | FE -> controller -> service `getAllBlocks` -> `AdmissionBlockRepository.findAllByDeletedFalse` | List khoi |
| `POST /api/v1/admin/admissions/config/blocks` | FE -> controller -> service `createBlock` -> mapper -> save | Tao khoi |
| `PUT /api/v1/admin/admissions/config/blocks/{id}` | FE -> controller -> service `updateBlock` -> find block -> mapper update -> save | Sua khoi |
| `DELETE /api/v1/admin/admissions/config/blocks/{id}` | FE -> controller -> service `deleteBlock` -> find block -> soft delete | Xoa khoi |
| `GET /api/v1/admin/admissions/config/benchmarks` | FE -> controller -> service `getBenchmarks` -> pageable -> `BenchmarkScoreRepository.findAll(pageable)` -> mapper page | List diem chuan |
| `POST /api/v1/admin/admissions/config/benchmarks/bulk` | FE -> controller -> service `saveBulkBenchmarks` -> find period -> loop items: find major + block -> tim benchmark cu theo (major,block,period) -> create/update score -> save | Luu diem chuan hang loat |
| `PUT /api/v1/admin/admissions/config/benchmarks/{id}` | FE -> controller -> service `updateBenchmark` -> find benchmark -> set score -> save -> mapper | Sua 1 diem chuan |
| `DELETE /api/v1/admin/admissions/config/benchmarks/{id}` | FE -> controller -> service `deleteBenchmark` -> find -> soft delete | Xoa diem chuan |
| `GET /api/v1/admin/admissions/config/form-options` | FE -> controller -> service `getSelectionOptions` -> lay majors/blocks/periods -> dong goi `SelectionOptionsResponse` | API preload options cho man benchmark |

## 3.24 Admin Admissions Applications + Onboarding

| Endpoint | Flow backend toan trinh | API frontend lien quan |
|---|---|---|
| `GET /api/v1/admin/admissions/applications` | FE admin -> `AdminApplicationController.getApplications` -> `AdminApplicationServiceImpl.getApplications` -> pageable/sort -> `AdmissionApplicationRepository.searchApplications(periodId, majorId, status, keyword, pageable)` -> mapper -> page response | Dashboard ho so |
| `GET /api/v1/admin/admissions/applications/{id}` | FE -> controller -> service `getApplicationById` -> repo find -> mapper | Detail ho so |
| `PATCH /api/v1/admin/admissions/applications/{id}/review` | FE -> controller -> service `reviewSingleApplication` -> find app -> set status + approvalDate -> save | Duyet tay tung ho so |
| `POST /api/v1/admin/admissions/applications/bulk-review` | FE -> controller -> service `reviewBulkApplications` -> `findAllById` -> update status + approvalDate hang loat -> `saveAll` | Duyet tay hang loat |
| `POST /api/v1/admin/admissions/applications/auto-screen/{periodId}` | FE -> controller -> `AdmissionOnboardingServiceImpl.autoScreenApplications` -> load pending apps theo period -> load benchmark theo period -> map `(majorId_blockId)->score` -> so sanh `totalScore` voi benchmark -> set APPROVED/REJECTED + approvalDate -> `AdmissionApplicationRepository.saveAll` | Duyet tu dong theo diem chuan |
| `POST /api/v1/admin/admissions/applications/onboard` | FE -> controller -> `AdmissionOnboardingServiceImpl.processOnboarding` -> load approved apps theo period -> load role STUDENT/GUARDIAN -> voi moi app: skip neu student nationalId da ton tai -> tao guardian account -> tao guardian profile -> tao student account -> tao student profile link guardian + major -> set app `ENROLLED` -> batch save students + applications | Chot danh sach nhap hoc |

---

## 4. Security Matrix Theo Nhom API (de frontend gan role dung)

| Nhom endpoint | Rule quyen trong `SecurityConfig` |
|---|---|
| `/api/v1/auth/**`, `/api/v1/public/**` | Public, khong can token |
| `/api/v1/profile/**` | Chi can authenticated |
| `GET /api/v1/students/*/grade-reports`, `GET /api/v1/students/*/attendances` | `STUDENT` hoac `ADMIN` hoac `MANAGER` |
| `GET /api/v1/guardians/*/students/*/attendances` | `GUARDIAN` hoac `ADMIN` hoac `MANAGER` |
| `GET /api/v1/schedules/lecturers/me` | Chi `LECTURER` |
| `/api/v1/grade-reports/**`, `/api/v1/attendances/**`, `/api/v1/class-sessions/**` | `LECTURER` hoac `ADMIN` hoac `MANAGER` |
| `GET` master data (`faculties`, `majors`, `specializations`, `cohorts`, `classrooms`, `administrative-classes`, `courses`, `course-sections`, `recurring-schedules`, `grade-components`) | Authenticated |
| `/api/v1/admin/**`, `/api/v1/accounts/**`, `/api/v1/roles/**`, `/api/v1/guardians/**`, `/api/v1/lecturers/**`, `/api/v1/students/**` | `ADMIN` hoac `MANAGER` |
| Catch-all `/api/v1/**` | `ADMIN` hoac `MANAGER` |

