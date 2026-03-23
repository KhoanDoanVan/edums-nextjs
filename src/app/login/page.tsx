"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
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
import { getPostLoginPath } from "@/lib/auth/routing";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Dang nhap that bai. Vui long thu lai.";
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, isAuthenticated, session, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setErrorMessage("Vui long nhap day du username va password.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login({
        username: username.trim(),
        password,
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell mode="login">
      <form className="space-y-2.5" onSubmit={handleSubmit}>
        <AuthInput
          leftIcon={<UserIcon />}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          placeholder="Username"
        />

        <AuthInput
          leftIcon={<LockIcon />}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Password"
          rightNode={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="rounded p-0.5 text-[#607286] transition hover:bg-[#eef3f8]"
              aria-label={showPassword ? "Hide password" : "Show password"}
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
            Quen mat khau
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
          <span>{isSubmitting ? "Dang xu ly..." : "Dang nhap"}</span>
        </button>

        <button
          type="button"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-[#0d6ea6] text-lg font-semibold text-white transition hover:bg-[#085d90]"
        >
          <BellIcon className="h-4 w-4 text-[#ef2e2e]" />
          <span>Xem thong bao - tin tuc</span>
        </button>
      </form>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell mode="login">
          <div className="rounded-[4px] border border-[#bfd4e4] bg-white px-4 py-3 text-sm text-[#355970]">
            Dang tai trang dang nhap...
          </div>
        </AuthPageShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
