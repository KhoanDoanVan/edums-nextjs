"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AuthInput } from "@/components/auth/auth-input";
import {
  EyeIcon,
  EyeOffIcon,
  IdBadgeIcon,
  ImageIcon,
  LockIcon,
  LoginIcon,
  UserIcon,
} from "@/components/auth/auth-icons";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { useAuth } from "@/context/auth-context";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { getRoles } from "@/lib/auth/service";
import { toErrorMessage as toSharedErrorMessage } from "@/components/admin/format-utils";
import type { RoleResponse } from "@/lib/auth/types";

const toErrorMessage = (error: unknown): string => {
  return toSharedErrorMessage(error);
};

export default function RegisterPage() {
  const { session, registerAccount } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleId, setRoleId] = useState("1");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [availableRoles, setAvailableRoles] = useState<RoleResponse[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useToastFeedback({
    errorMessage,
    successMessage,
    errorTitle: "Tạo tài khoản thất bại",
    successTitle: "Tạo tài khoản thành công",
  });

  const hasRoleOptions = useMemo(() => availableRoles.length > 0, [availableRoles]);

  useEffect(() => {
    let ignore = false;

    const loadRoles = async () => {
      if (!session?.authorization) {
        if (!ignore) {
          setAvailableRoles([]);
          setIsLoadingRoles(false);
        }
        return;
      }

      setIsLoadingRoles(true);
      try {
        const roles = await getRoles(session.authorization);
        if (!ignore) {
          setAvailableRoles(roles);
          if (roles.length > 0) {
            setRoleId(String(roles[0].id));
          }
        }
      } catch {
        if (!ignore) {
          setAvailableRoles([]);
        }
      } finally {
        if (!ignore) {
          setIsLoadingRoles(false);
        }
      }
    };

    void loadRoles();

    return () => {
      ignore = true;
    };
  }, [session?.authorization]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const parsedRoleId = Number(roleId);

    if (!session?.authorization) {
      setErrorMessage("Chức năng tạo tài khoản chỉ dành cho quản trị viên đã đăng nhập.");
      return;
    }

    if (!username.trim() || !password) {
      setErrorMessage("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      setErrorMessage("Vai trò đã chọn không hợp lệ.");
      return;
    }

    try {
      setIsSubmitting(true);
      const createdAccount = await registerAccount({
        username: username.trim(),
        password,
        roleId: parsedRoleId,
        avatarUrl: avatarUrl.trim() || undefined,
      });

      setSuccessMessage(
        `Tạo tài khoản thành công. Mã tài khoản: ${createdAccount.id}, vai trò: ${createdAccount.roleName}.`,
      );
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <AuthPageShell>
        <form className="space-y-2.5" onSubmit={handleSubmit}>
          <AuthInput
            leftIcon={<UserIcon />}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="Tên đăng nhập"
          />

          <AuthInput
            leftIcon={<LockIcon />}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Mật khẩu"
            rightNode={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="rounded p-0.5 text-[#607286] transition hover:bg-[#eef3f8]"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />

          <AuthInput
            leftIcon={<LockIcon />}
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Xác nhận mật khẩu"
            rightNode={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="rounded p-0.5 text-[#607286] transition hover:bg-[#eef3f8]"
                aria-label={
                  showConfirmPassword
                    ? "Ẩn xác nhận mật khẩu"
                    : "Hiện xác nhận mật khẩu"
                }
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />

          {hasRoleOptions ? (
            <div className="flex h-10 overflow-hidden rounded-[4px] border border-[#c8cfd7] bg-white">
              <span className="flex w-9 items-center justify-center border-r border-[#c8cfd7] bg-[#edf2f6] text-[#5f6f80]">
                <IdBadgeIcon />
              </span>
              <select
                className="flex-1 border-0 bg-white px-3 text-sm text-[#1d2a39] outline-none"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
              >
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.roleName} (ID: {role.id})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <AuthInput
              leftIcon={<IdBadgeIcon />}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              placeholder="Mã vai trò"
              inputMode="numeric"
            />
          )}

          <AuthInput
            leftIcon={<ImageIcon />}
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="Đường dẫn ảnh đại diện (không bắt buộc)"
          />

          {isLoadingRoles ? (
            <p className="text-[12px] font-medium text-[#698198]">
              Đang tải danh sách vai trò...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-[4px] border border-[#e6b5b5] bg-[#fff3f3] px-3 py-2 text-xs text-[#b33a3a]">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-[4px] border border-[#9fd8b0] bg-[#ecf9f0] px-3 py-2 text-xs text-[#227b3e]">
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-[#0d6ea6] text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LoginIcon className="h-4 w-4" />
            <span>{isSubmitting ? "Đang xử lý..." : "Tạo tài khoản"}</span>
          </button>
        </form>
      </AuthPageShell>
    </AuthGuard>
  );
}
