"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthInput } from "@/components/auth/auth-input";
import {
  BellIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  LoginIcon,
  UserIcon,
} from "@/components/auth/auth-icons";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/context/toast-context";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { getPostLoginPath } from "@/lib/auth/routing";
import { toErrorMessage as toSharedErrorMessage } from "@/components/admin/format-utils";

const toErrorMessage = (error: unknown): string => {
  return toSharedErrorMessage(error);
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, isAuthenticated, session, login } = useAuth();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useToastFeedback({ errorMessage, errorTitle: "Đăng nhập thất bại" });

  const explicitNextPath = useMemo(() => {
    const rawPath = searchParams.get("next");
    if (!rawPath || !rawPath.startsWith("/")) {
      return null;
    }

    return rawPath;
  }, [searchParams]);

  const nextPath = getPostLoginPath(session, explicitNextPath);

  useEffect(() => {
    if (status === "authenticated" && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, nextPath, router, status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!username.trim() || !password) {
      setErrorMessage("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login({
        username: username.trim(),
        password,
      });
      toast.success("Đăng nhập thành công. Đang chuyển đến trang phù hợp.", "Thành công");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
          autoComplete="current-password"
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

        <div className="flex justify-end">
          <button
            type="button"
            className="text-[13px] font-semibold text-[#0a5c93] hover:underline"
          >
            Quên mật khẩu
          </button>
        </div>

        {errorMessage ? (
          <p className="rounded-[4px] border border-[#e6b5b5] bg-[#fff3f3] px-3 py-2 text-xs text-[#b33a3a]">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || status === "loading"}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-[#0d6ea6] text-sm font-semibold text-white transition hover:bg-[#085d90] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LoginIcon className="h-4 w-4" />
          <span>{isSubmitting ? "Đang xử lý..." : "Đăng nhập"}</span>
        </button>

        <Link
          href="/apply"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-[#0d6ea6] text-lg font-semibold text-white transition hover:bg-[#085d90]"
        >
          <BellIcon className="h-4 w-4 text-[#ef2e2e]" />
          <span>Nộp hồ sơ tuyển sinh</span>
        </Link>

        <Link
          href="/admissions"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[4px] border border-[#9ec3dd] bg-white text-sm font-semibold text-[#245977] transition hover:bg-[#edf6fd]"
        >
          <span>Tra cứu hồ sơ tuyển sinh</span>
        </Link>
      </form>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <div className="rounded-[4px] border border-[#bfd4e4] bg-white px-4 py-3 text-sm text-[#355970]">
            Đang tải trang đăng nhập...
          </div>
        </AuthPageShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
