# EduMS Frontend (Base Setup)

Project nền tảng frontend bằng Next.js (App Router + TypeScript) cho hệ thống
EduMS.

## 1) Cài đặt

```bash
npm install
```

## 2) Cấu hình môi trường

```bash
cp .env.example .env.local
```

Mặc định:

- `NEXT_PUBLIC_APP_NAME=EduMS Frontend`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`
- `BACKEND_API_BASE_URL=http://localhost:8080` (dung cho Next API proxy)
- `NEXT_PUBLIC_ENABLE_SEED_BYPASS=true` (hien nut seed login STUDENT de xem UI khi chua co account student that)
- `NEXT_PUBLIC_SEED_AUTH_TOKEN=<jwt>` (token hard-code cho seed bypass)
- `NEXT_PUBLIC_SEED_STUDENT_ID=1` (student ID mac dinh khi vao seed mode)

## 3) Chạy frontend

```bash
npm run dev
```

Mở `http://localhost:3000`.

Routing mac dinh:

- `/`: tu dong dieu huong, `ADMIN` -> `/admin/dashboard`, role khac -> `/dashboard`, chua co session -> `/login`.

## API snapshot đã lưu

- OpenAPI đầy đủ: `docs/api/edums-openapi.json`
- Danh sách endpoint: `docs/api/endpoints.tsv`
- Tổng quan theo tag: `docs/api/README.md`
- Student scope hiện tại: `docs/api/student-scope.md`

## Cấu trúc setup ban đầu

- `src/config/env.ts`: đọc biến môi trường frontend.
- `src/lib/api/client.ts`: hàm gọi API cơ bản (fetch wrapper).
- `src/lib/api/types.ts`: type cho API response.
- `src/lib/api/catalog.ts`: catalog tag endpoint (snapshot).

## Auth setup (login/register/permission)

- `src/lib/auth/service.ts`: gọi API login/register/account/role.
- `src/lib/auth/storage.ts`: lưu session token ở localStorage.
- `src/context/auth-context.tsx`: quản lý auth state, login/logout, role/permission check.
- `src/components/auth/auth-guard.tsx`: chặn route theo trạng thái đăng nhập và phân quyền.

Routes:

- `/login`: đăng nhập bằng `POST /api/v1/auth/login`.
- `/register`: đăng ký bằng `POST /api/v1/accounts`.
- `/dashboard`: route bảo vệ, hiển thị role và permissions hiện tại.

Lưu ý:

- Frontend client goi API qua Next proxy `/api/proxy/*` de tranh loi CORS preflight khi backend chua mo CORS.
- Theo OpenAPI hiện có, endpoint `POST /api/v1/accounts` không ghi rõ public hay protected; nếu backend yêu cầu quyền, cần đăng nhập tài khoản có quyền phù hợp trước.
