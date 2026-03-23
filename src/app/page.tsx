"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getDefaultHomePath } from "@/lib/auth/routing";

export default function RootPage() {
  const router = useRouter();
  const { status, isAuthenticated, session } = useAuth();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (isAuthenticated) {
      router.replace(getDefaultHomePath(session));
      return;
    }

    router.replace("/login");
  }, [isAuthenticated, router, session, status]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf1f5] px-4">
      <div className="rounded-[8px] border border-[#bfd4e4] bg-white px-5 py-4 text-sm text-[#355970] shadow-[0_1px_2px_rgba(7,51,84,0.16)]">
        Dang chuyen huong...
      </div>
    </main>
  );
}
