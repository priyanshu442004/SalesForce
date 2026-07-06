"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMigration } from "@/context/MigrationContext";
import Icon from "./Icon";

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed, currentUser, setCurrentUser, currentProject } = useMigration();

  if (!currentUser) return null;

  const navItems = [
    { name: "Dashboard", path: "/", icon: "dashboard" },
    { name: "Upload Files", path: "/upload", icon: "upload" },
    { name: "Transformations", path: "/transformation-workspace", icon: "layers" },
    { name: "Unique Identifier", path: "/unique-identifier", icon: "hash" },
    { name: "Projects", path: "/projects", icon: "folder" },
    { name: "Import Jobs", path: "/import-jobs", icon: "briefcase" },
    { name: "Activity Log", path: "/activity-log", icon: "activity" },
    { name: "History", path: "/history", icon: "clock" },
  ];

  return (
    <aside
      className={`shrink-0 bg-slate-900 flex flex-col justify-between text-slate-300 border-r border-slate-800 h-screen sticky top-0 z-40 hidden lg:flex transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "w-[52px] px-2 py-4" : "w-[200px] p-3"
      }`}
    >
      <div className="space-y-3">

        {/* Brand */}
        <div className={`flex items-center border-b border-slate-800 pb-3 overflow-hidden ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 11h6" />
                <path d="M12 8v6" />
              </svg>
            </div>
            <span className={`font-semibold text-white text-[13px] tracking-wide whitespace-nowrap transition-all duration-250 ${
              sidebarCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            }`}>
              DataMigrate
            </span>
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute top-4 right-[-11px] w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer focus:outline-none shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Active project badge */}
        {currentProject && !sidebarCollapsed && (
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-2 overflow-hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="text-[10px] font-medium text-slate-400 truncate">
              <span className="text-slate-500">Project: </span>
              <span className="text-slate-200 font-semibold">{currentProject.name}</span>
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-0.5">
          {navItems.map((item, idx) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={idx}
                href={item.path}
                title={sidebarCollapsed ? item.name : undefined}
                className={`w-full flex items-center py-1.5 rounded-md text-[12px] font-medium transition-colors duration-150 group focus:outline-none select-none ${
                  sidebarCollapsed ? "justify-center px-0" : "px-2.5 gap-2.5"
                } ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
              >
                <span className="relative flex items-center justify-center shrink-0">
                  {isActive && (
                    <span className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-[3px] h-3.5 bg-blue-500 rounded-r-full" />
                  )}
                  <Icon
                    name={item.icon}
                    size={14}
                    className={isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}
                  />
                </span>
                {!sidebarCollapsed && (
                  <span className="whitespace-nowrap">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User footer */}
      <div className="pt-3 border-t border-slate-800 flex items-center overflow-hidden" style={{ gap: sidebarCollapsed ? 0 : "0.5rem" }}>
        <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-slate-200 leading-none">
            {(currentUser?.name || "U").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        </div>

        <div className={`flex flex-col min-w-0 flex-1 transition-all duration-250 ${
          sidebarCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
        }`}>
          <span className="text-[11px] font-semibold text-slate-200 leading-tight truncate">
            {currentUser?.name || ""}
          </span>
          <span className="text-[10px] text-slate-500 truncate mt-0.5">
            {currentUser?.email || ""}
          </span>
        </div>

        {!sidebarCollapsed && (
          <button
            onClick={() => setCurrentUser(null)}
            title="Sign out"
            className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
