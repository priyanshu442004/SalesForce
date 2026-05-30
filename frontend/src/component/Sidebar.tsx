"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMigration } from "@/context/MigrationContext";
import Icon from "./Icon";

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed } = useMigration();

  const navItems = [
    { name: "Dashboard", path: "/", icon: "dashboard" },
    { name: "Upload Files", path: "/upload", icon: "upload" },
    { name: "AI Mapping", path: "/mapping", icon: "database" },
    { name: "Transformations", path: "/transformations", icon: "shuffle" },
    { name: "Validation", path: "/validation", icon: "shield" },
    { name: "Export", path: "/export", icon: "download" },
    { name: "Projects", path: "/projects", icon: "folder" },
    { name: "Activity Log", path: "/activity-log", icon: "activity" },
    { name: "Settings", path: "/settings", icon: "settings" },
    { name: "Help & Support", path: "/help", icon: "help" }
  ];

  return (
    <aside 
      className={`shrink-0 bg-[#0d162d] flex flex-col justify-between text-slate-300 p-5 border-r border-[#1e293b]/40 h-screen sticky top-0 z-40 hidden lg:flex transition-all duration-350 ease-in-out ${
        sidebarCollapsed ? "w-[78px]" : "w-[260px]"
      }`}
    >
      <div className="space-y-7">
        
        {/* Header Brand Area */}
        <div className="flex items-center justify-between py-4.5 border-b border-[#1e293b]/40 overflow-hidden">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-[36px] h-[36px] rounded-[11px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0 transition-transform duration-350 hover:scale-105">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v8" />
                <path d="M9 11h6" />
              </svg>
            </div>
            <span 
              className={`font-extrabold text-white text-[15px] tracking-wider uppercase whitespace-nowrap transition-all duration-300 ease-in-out ${
                sidebarCollapsed ? "opacity-0 w-0 max-w-0 ml-0 overflow-hidden pointer-events-none" : "opacity-100 ml-1.5"
              }`}
            >
              AI Migrate
            </span>
          </div>
          
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded-lg bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors duration-250 shrink-0 select-none ml-1 cursor-pointer focus:outline-none"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className={`transform transition-transform duration-350 ${sidebarCollapsed ? "rotate-180" : ""}`}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu Links */}
        <nav className="space-y-1.5 max-h-[calc(100vh-190px)] overflow-y-auto pr-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {navItems.map((item, idx) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={idx}
                href={item.path}
                className={`w-full flex items-center py-3 rounded-xl text-[13px] font-extrabold tracking-wide transition-all duration-250 group relative focus:outline-none select-none cursor-pointer ${
                  sidebarCollapsed ? "justify-center px-0" : "px-4"
                } ${
                  isActive
                    ? "bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white shadow-lg shadow-blue-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Icon 
                  name={item.icon} 
                  size={16.5}
                  className={`transition-transform duration-250 shrink-0 ${sidebarCollapsed ? "" : "group-hover:scale-108"} ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`} 
                />
                <span 
                  className={`whitespace-nowrap transition-all duration-300 ease-in-out ${
                    sidebarCollapsed ? "opacity-0 w-0 max-w-0 ml-0 overflow-hidden pointer-events-none" : "opacity-100 ml-3.5"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile Card Footer */}
      <div className="pt-4 border-t border-[#1e293b]/40 flex items-center justify-between overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-[38px] h-[38px] rounded-full bg-amber-400 border-2 border-amber-300 flex items-center justify-center overflow-hidden shadow-inner shrink-0 relative">
            <svg viewBox="0 0 36 36" fill="none" className="w-9.5 h-9.5 absolute bottom-0">
              <path d="M18 36c10 0 18-8 18-18S28 0 18 0 0 8 0 18s8 18 18 18z" fill="#fed7aa" />
              <path d="M30 18c0-3.5-3.5-7-7-8s-7-2-10 1c-3.5 3-4.5 7.5-4 11" fill="#ea580c" />
              <circle cx="13" cy="17" r="1.5" fill="#1e293b" />
              <circle cx="21" cy="17" r="1.5" fill="#1e293b" />
              <path d="M15 22.5c1.5.8 3.5.8 5 0" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div 
            className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
              sidebarCollapsed ? "opacity-0 w-0 max-w-0 overflow-hidden pointer-events-none" : "opacity-100 ml-1"
            }`}
          >
            <span className="text-[12.5px] font-extrabold text-white leading-tight truncate">Admin User</span>
            <span className="text-[10px] text-slate-500 truncate">admin@domain.com</span>
          </div>
        </div>
        <span 
          className={`text-[10.5px] font-extrabold text-slate-500 pr-1 select-none transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? "opacity-0 w-0 max-w-0 overflow-hidden pointer-events-none" : "opacity-100"
          }`}
        >
          1.1.0
        </span>
      </div>
    </aside>
  );
}
