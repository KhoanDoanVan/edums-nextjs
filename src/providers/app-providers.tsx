"use client";

import { AuthProvider } from "@/context/auth-context";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  return <AuthProvider>{children}</AuthProvider>;
};
