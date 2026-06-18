"use client";

import React, { useEffect, useState } from "react";
import { useMigration } from "@/context/MigrationContext";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoadingUsers } = useMigration();
  const [isInitialized, setIsInitialized] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register">("login");

  // Allow a short delay for local storage loading to initialize before rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  if (isLoadingUsers || !isInitialized) {
    return (
      <div className="flex-1 min-h-screen flex justify-center items-center bg-slate-900">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    if (authView === "register") {
      return <RegisterPage onNavigateToLogin={() => setAuthView("login")} />;
    }
    return <LoginPage onNavigateToRegister={() => setAuthView("register")} />;
  }

  return <>{children}</>;
}
