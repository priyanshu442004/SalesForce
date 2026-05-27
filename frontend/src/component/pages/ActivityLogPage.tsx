"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface AuditLog {
  timestamp: string;
  category: "Transformation" | "Mapping" | "Validation" | "Upload" | "System";
  actor: string;
  description: string;
  status: "Success" | "Warning" | "Error";
}

// Highly reliable inline dynamic counting component
function AnimatedCount({ target, duration = 850, suffix = "" }: { target: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let timerId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) {
        timerId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    timerId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(timerId);
  }, [target, duration]);

  return <>{count}{suffix}</>;
}

export default function ActivityLogPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const logs: AuditLog[] = [
    { timestamp: "2026-05-27 19:15:32", category: "Transformation", actor: "System AI", description: "Executed picklist standard mappings for Account Type", status: "Success" },
    { timestamp: "2026-05-27 19:12:44", category: "Mapping", actor: "admin@salesforce.migrate", description: "Approved schema mappings for Opportunity.StageName", status: "Success" },
    { timestamp: "2026-05-27 19:08:11", category: "Validation", actor: "System AI", description: "Detected 25 missing required fields in Account.Name", status: "Warning" },
    { timestamp: "2026-05-27 18:55:02", category: "Upload", actor: "admin@salesforce.migrate", description: "Uploaded Customer_Records_v3.csv (12.4 KB)", status: "Success" },
    { timestamp: "2026-05-27 18:40:19", category: "System", actor: "System", description: "Initialized workspace context database configurations", status: "Success" },
    { timestamp: "2026-05-27 18:32:05", category: "Validation", actor: "System AI", description: "Flagged 136 records with invalid date patterns in Start_Date__c", status: "Warning" },
    { timestamp: "2026-05-27 18:15:44", category: "Transformation", actor: "admin@salesforce.migrate", description: "Created new Date conversion transformation rule", status: "Success" }
  ];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.actor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || log.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden select-none bg-white">
      
      {/* CSS Animations Injection */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.97) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-scale-up {
          animation: scaleUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-row {
          animation: fadeInRow 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Back link */}
      <div className="flex-none opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <Link
          href="/"
          className="text-[#002BFF] text-[14px] font-black hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
        >
          <span>&lt;</span>
          <span>Back to Workspace</span>
        </Link>
      </div>

      {/* Title and Description */}
      <div className="flex-none flex flex-col space-y-1 border-b border-slate-100/60 pb-3.5 opacity-0 animate-scale-up" style={{ animationDelay: "100ms" }}>
        <h3 className="text-[20px] font-black text-[#000839]">
          System Activity Log
        </h3>
        <span className="text-[14.5px] font-bold text-slate-400">
          Review real-time operations, job histories, API calls, and validation details.
        </span>
      </div>

      {/* Header Metric Cards for Premium Visual Polish */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        
        {/* Metric 1: Total Operations */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-blue-50 border border-blue-500/20 text-[#002BFF] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
              <path d="M22 7c0 2.761-4.477 5-10 5S2 9.761 2 7" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Total Operations</span>
            <span className="block text-[25px] font-black text-[#000839]">
              <AnimatedCount target={128} />
            </span>
          </div>
        </div>

        {/* Metric 2: Warnings Triggered */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-amber-50 border border-amber-500/20 text-[#d97706] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Warnings Triggered</span>
            <span className="block text-[25px] font-black text-[#d97706]">
              <AnimatedCount target={2} />
            </span>
          </div>
        </div>

        {/* Metric 3: Success Rate */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-[#e6f4ea] border border-[#e6f4ea]/45 text-[#137333] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Success Rate</span>
            <span className="block text-[25px] font-black text-[#137333]">
              <AnimatedCount target={100} suffix="%" />
            </span>
          </div>
        </div>

        {/* Metric 4: API Connections */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-purple-50 border border-purple-500/20 text-[#7c3aed] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">API Handshakes</span>
            <span className="block text-[25px] font-black text-[#7c3aed]">
              <AnimatedCount target={42} />
            </span>
          </div>
        </div>

      </div>

      {/* Interactive Controls Panel */}
      <div className="flex-none flex flex-col md:flex-row gap-4 items-center justify-between opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        
        {/* Search */}
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by actor or description..."
            className="w-full pl-11 pr-5 py-3.5 rounded-2xl border border-slate-200 text-[#000839] text-[14.5px] font-black placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/10 bg-white"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Filter Categories */}
        <div className="flex items-center gap-2.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {["All", "Transformation", "Mapping", "Validation", "Upload", "System"].map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-3 rounded-xl text-[13.5px] font-black border transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#002BFF] border-transparent text-white shadow-md shadow-blue-500/10"
                    : "bg-white border-slate-200/60 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Logs Table Grid with Larger Fonts & Row Animations */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.008)] min-h-[350px] overflow-hidden flex flex-col opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100/85 text-[14.5px] font-black text-slate-400 uppercase tracking-tight">
                <th className="pb-4 pl-3">Timestamp</th>
                <th className="pb-4">Category</th>
                <th className="pb-4">Actor</th>
                <th className="pb-4">Action Description</th>
                <th className="pb-4 text-right pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[15.5px] font-bold text-[#000839]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-slate-50/20 transition-all opacity-0 animate-row"
                    style={{ animationDelay: `${300 + idx * 45}ms` }}
                  >
                    <td className="py-4.5 pl-3 font-mono text-[14px] text-slate-400">{log.timestamp}</td>
                    <td className="py-4.5">
                      <span className={`px-3 py-1.5 rounded-xl text-[12.5px] font-black ${
                        log.category === "Transformation" ? "bg-purple-50 text-purple-600 border border-purple-100/40" :
                        log.category === "Mapping" ? "bg-blue-50 text-blue-600 border border-blue-100/40" :
                        log.category === "Validation" ? "bg-amber-50 text-amber-600 border border-amber-100/40" :
                        log.category === "Upload" ? "bg-emerald-50 text-emerald-600 border border-emerald-100/40" :
                        "bg-slate-100 text-slate-600 border border-slate-200/40"
                      }`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="py-4.5 text-[#000839]/85 font-black">{log.actor}</td>
                    <td className="py-4.5 text-[#000839]/70 font-medium max-w-[350px] truncate">{log.description}</td>
                    <td className="py-4.5 text-right pr-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-black ${
                        log.status === "Success" ? "bg-[#e6f4ea] text-[#137333]" :
                        log.status === "Warning" ? "bg-amber-50 text-amber-600" :
                        "bg-[#fff5f5] text-[#e11d48]"
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          log.status === "Success" ? "bg-[#137333]" :
                          log.status === "Warning" ? "bg-amber-600" :
                          "bg-[#e11d48]"
                        }`} />
                        <span>{log.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-black">
                    No system log history found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
