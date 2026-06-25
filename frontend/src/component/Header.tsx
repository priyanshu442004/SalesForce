"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { useMigration } from "../context/MigrationContext";
import { useTheme } from "../context/ThemeContext";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, currentProject } = useMigration();
  const { theme, toggleTheme } = useTheme();

  if (!currentUser) return null;

  const getPageTitle = () => {
    switch (pathname) {
      case "/":
        return "Dashboard";
      case "/upload":
        return "Upload Files";
      case "/transformation-workspace":
        return "Transformation Workspace";
      case "/projects":
        return "Active Projects Workspace";
      case "/activity-log":
        return "System Activity Log";
      case "/unique-identifier":
        return "Unique Identifier";
      default:
        return "Data Migrate Platform";
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: "dashboard" },
    { name: "Upload Files", path: "/upload", icon: "upload" },
    { name: "Transformation Workspace", path: "/transformation-workspace", icon: "layers" },
    { name: "Projects", path: "/projects", icon: "folder" },
    { name: "Activity Log", path: "/activity-log", icon: "activity" },
  ];

  return (
    <>
      <header className="px-6 lg:px-8 py-4 lg:py-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-30 shadow-sm flex-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] lg:text-[20px] font-semibold text-slate-900 dark:text-white tracking-tight">
              {getPageTitle()}
            </h1>
            {pathname === "/transformation-workspace" && currentProject && (
              <span className="max-w-[180px] truncate rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700">
                {currentProject.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-8.5 h-8.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 cursor-pointer"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={14.5} />
          </button>
          <button className="w-8.5 h-8.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 cursor-pointer">
            <Icon name="help" size={14.5} />
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER — always dark by design */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="w-[240px] bg-slate-900 flex flex-col justify-between text-slate-300 p-5 h-full border-r border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 11h6" /><path d="M12 8v6" />
                    </svg>
                  </div>
                  <span className="font-semibold text-white text-[14px] tracking-wide">DataMigrate</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <nav className="space-y-0.5 overflow-y-auto max-h-[calc(100vh-160px)]">
                {navItems.map((item, idx) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={idx}
                      href={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon name={item.icon} size={15} className={isActive ? "text-blue-400" : "text-slate-500"} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
