"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { useMigration } from "../context/MigrationContext";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { transformationsView, transformationsTab, currentUser } = useMigration();

  if (!currentUser) return null;

  const getPageTitle = () => {
    const clean = (title:any) => title.replace(/^\d+\.\s*/, "").replace(/\s*-\s*Layer\s*\d+$/i, "");
    switch (pathname) {
      case "/":
        return "Dashboard";
      case "/upload":
        return clean("02. Upload Files - Layer 1");
      case "/mapping":
        return clean("03. AI Mapping Summary - Layer 2");
      case "/transformations":
        if (transformationsTab === "Execution Engine") {
          return "Execution Engine";
        }
        if (transformationsTab === "Human Feedback Loop") {
          return "Human Feedback Loop";
        }
        if (transformationsTab === "Preview Engine") {
          return "Preview Engine";
        }
        if (transformationsTab === "Transformation Library") {
          return "Transformation Library";
        }
        return transformationsView === "create"
          ? "Transformation Center"
          : "Transformation Workspace";
      case "/validation":
        return clean("10. Validation - Layer 4");
      case "/export":
        return "Export Engine";
      case "/projects":
        return "Active Projects Workspace";
      case "/templates":
        return "Configuration Templates";
      case "/activity-log":
        return "System Activity Log";
      case "/data-dictionary":
        return "Data Dictionary Viewer";
      case "/settings":
        return "Global Settings";
      case "/help":
        return "Help & Support Desk";
      default:
        return "AI Migrate Platform";
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: "dashboard" },
    { name: "Upload Files", path: "/upload", icon: "upload" },
    { name: "AI Mapping", path: "/mapping", icon: "database" },
    { name: "Transformations", path: "/transformations", icon: "shuffle" },
    { name: "Validation", path: "/validation", icon: "shield" },
    { name: "Export", path: "/export", icon: "download" },
    { name: "Projects", path: "/projects", icon: "folder" },
    { name: "Templates", path: "/templates", icon: "layers" },
    { name: "Activity Log", path: "/activity-log", icon: "activity" },
    { name: "Data Dictionary", path: "/data-dictionary", icon: "fileCode" },
    { name: "Settings", path: "/settings", icon: "settings" },
    { name: "Help & Support", path: "/help", icon: "help" }
  ];

  return (
    <>
      <header className="px-6 lg:px-8 py-4 lg:py-5 flex items-center justify-between border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm flex-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="lg:hidden p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <h1 className="text-[19px] lg:text-[22px] font-extrabold text-[#000839] tracking-tight">
            {getPageTitle()}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="w-8.5 h-8.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-all duration-200 cursor-pointer">
            <Icon name="moon" size={14.5} />
          </button>
          <button className="w-8.5 h-8.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-all duration-200 cursor-pointer">
            <Icon name="help" size={14.5} />
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#040815]/60 backdrop-blur-sm z-50 lg:hidden animate-fade-in-up" 
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside 
            className="w-[260px] bg-[#0d162d] flex flex-col justify-between text-slate-300 p-5 h-full" 
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#1e293b]/40 pb-4">
                <span className="font-extrabold text-white text-[15px] tracking-wider uppercase">AI Migrate</span>
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="text-slate-400 hover:text-white cursor-pointer select-none"
                >
                  ✕
                </button>
              </div>
              <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-160px)]">
                {navItems.map((item, idx) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={idx}
                      href={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-[13px] font-extrabold tracking-wide ${
                        isActive ? "bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white" : "text-slate-400"
                      }`}
                    >
                      <Icon name={item.icon} size={16} />
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
