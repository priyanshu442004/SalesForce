"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface ProjectItem {
  name: string;
  status: "Completed" | "In Progress" | "Failed";
  progress: number;
  records: number;
  createdOn: string;
  lastUpdated: string;
}

// Highly reliable inline dynamic counting component
function AnimatedCount({ target, duration = 1200, format = false }: { target: number; duration?: number; format?: boolean }) {
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

  if (format) {
    return <>{count.toLocaleString()}</>;
  }
  return <>{count}</>;
}

export default function ProjectsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const projects: ProjectItem[] = [
    { name: "Acme Corp Migration", status: "Completed", progress: 100, records: 12356, createdOn: "20 May 2024", lastUpdated: "25 May 2024" },
    { name: "Globex Data Migration", status: "In Progress", progress: 60, records: 8732, createdOn: "18 May 2024", lastUpdated: "24 May 2024" },
    { name: "Beta Solutions Migration", status: "Completed", progress: 100, records: 6231, createdOn: "18 May 2024", lastUpdated: "24 May 2024" },
    { name: "Omega Inc Migration", status: "Failed", progress: 20, records: 2116, createdOn: "17 May 2024", lastUpdated: "24 May 2024" },
    { name: "Zypher Migration", status: "In Progress", progress: 45, records: 9876, createdOn: "16 May 2024", lastUpdated: "24 May 2024" }
  ];

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-7 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white">
      
      {/* CSS Animations Injection */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.98) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawProgress {
          from { width: 0%; }
        }
        .animate-scale-up {
          animation: scaleUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-row {
          animation: fadeInRow 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-progress {
          animation: drawProgress 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header bar styled exactly as in the mockup */}
      <div className="flex-none flex flex-col md:flex-row md:items-center md:justify-between gap-4 opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <div className="space-y-1.5">
          <h2 className="text-[26px] font-black text-[#002BFF] tracking-tight">
            Active Projects
          </h2>
          <p className="text-[14.5px] font-extrabold text-slate-500">
            Manage and track all your migration projects.
          </p>
        </div>

        {/* Right header actions: Search & New Migration */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full md:w-auto">
          
          {/* Search bar with dropdown chevron */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-11 pr-10 h-13 rounded-2xl border border-slate-200 text-[#000839] text-[14.5px] font-black placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/10 bg-white"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* New Migration button */}
          <button className="w-full sm:w-auto px-6 h-13 rounded-2xl bg-[#002BFF] hover:bg-blue-700 text-white text-[15px] font-black flex items-center justify-center gap-2 transition-all select-none cursor-pointer shadow-lg shadow-blue-500/10 active:scale-[0.98]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Migration</span>
          </button>

        </div>
      </div>

      {/* Projects Table Card */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-3xl p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.01)] min-h-[350px] overflow-hidden flex flex-col opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100/95 text-[14px] font-black text-slate-400 uppercase tracking-tight">
                <th className="pb-4.5 pl-3">Project Name</th>
                <th className="pb-4.5">Status</th>
                <th className="pb-4.5 w-60">Progress</th>
                <th className="pb-4.5">Records</th>
                <th className="pb-4.5">Created On</th>
                <th className="pb-4.5">Last Updated</th>
                <th className="pb-4.5 text-right pr-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[15px] font-extrabold text-[#000839]">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project, idx) => (
                  <tr 
                    key={project.name} 
                    className="hover:bg-slate-50/20 transition-all opacity-0 animate-row"
                    style={{ animationDelay: `${200 + idx * 50}ms` }}
                  >
                    {/* Project Name */}
                    <td className="py-5.5 pl-3 font-black text-[#000839] text-[16px]">{project.name}</td>
                    
                    {/* Status with exact mockup color matching */}
                    <td className="py-5.5">
                      <span className={`text-[15px] font-black ${
                        project.status === "Completed" ? "text-[#137333]" :
                        project.status === "In Progress" ? "text-[#d97706]" :
                        "text-[#e11d48]"
                      }`}>
                        {project.status}
                      </span>
                    </td>

                    {/* Progress Bar & Percentage */}
                    <td className="py-5.5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-32 h-2.5 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                          <div 
                            className={`h-full rounded-full transition-all duration-700 animate-progress ${
                              project.status === "Completed" ? "bg-[#137333]" :
                              project.status === "In Progress" ? "bg-[#d97706]" :
                              "bg-[#e11d48]"
                            }`}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-[14.5px] font-black text-[#000839] w-12">
                          <AnimatedCount target={project.progress} />%
                        </span>
                      </div>
                    </td>

                    {/* Records with dynamic animated count */}
                    <td className="py-5.5 text-[15.5px] text-[#000839]/90 font-black">
                      <AnimatedCount target={project.records} format={true} />
                    </td>

                    {/* Created On */}
                    <td className="py-5.5 text-slate-400 font-bold">{project.createdOn}</td>

                    {/* Last Updated */}
                    <td className="py-5.5 text-slate-400 font-bold">{project.lastUpdated}</td>

                    {/* Action Icons exactly matching view, edit, run action styles */}
                    <td className="py-5.5 text-right pr-5">
                      <div className="flex items-center justify-end gap-4 text-[#002BFF]">
                        {/* Eye / View Icon */}
                        <button className="hover:text-blue-700 transition-colors p-1.5 rounded-lg select-none cursor-pointer">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        
                        {/* Pencil / Edit Icon */}
                        <button className="hover:text-blue-700 transition-colors p-1.5 rounded-lg select-none cursor-pointer">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        {/* Execute / Run / Option Icon */}
                        <button className="hover:text-blue-700 transition-colors p-1.5 rounded-lg select-none cursor-pointer">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="6" y1="3" x2="6" y2="15" />
                            <circle cx="18" cy="6" r="3" />
                            <circle cx="6" cy="18" r="3" />
                            <path d="M18 9a9 9 0 0 1-9 9" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-black">
                    No migration projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer section with status text and beautiful pagination exactly like mockup */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-slate-100/90 mt-4 gap-4 flex-none">
          <span className="text-[14.5px] font-black text-slate-400">
            Showing 1 to 5 of 24 projects
          </span>

          {/* Pagination controls */}
          <div className="flex items-center gap-1.5 text-[14.5px] font-black">
            {/* Left arrow */}
            <button className="w-9 h-9 border border-slate-100 rounded-xl text-slate-400 hover:bg-slate-50 flex items-center justify-center cursor-pointer select-none">
              &lt;
            </button>
            
            {/* Pages */}
            <button className="w-9 h-9 bg-[#002BFF] text-white rounded-xl flex items-center justify-center cursor-pointer select-none">
              1
            </button>
            <button className="w-9 h-9 border border-slate-100 text-[#000839] hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer select-none">
              2
            </button>
            <button className="w-9 h-9 border border-slate-100 text-[#000839] hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer select-none">
              3
            </button>
            <button className="w-9 h-9 border border-slate-100 text-[#000839] hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer select-none">
              4
            </button>
            <button className="w-9 h-9 border border-slate-100 text-[#000839] hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer select-none">
              5
            </button>

            {/* Ellipsis */}
            <span className="px-1.5 text-slate-400">...</span>

            {/* Right arrow */}
            <button className="w-9 h-9 border border-slate-100 text-slate-400 hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer select-none">
              &gt;
            </button>
            
            {/* Double Right arrow */}
            <button className="w-9 h-9 border border-slate-100 text-slate-400 hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer select-none">
              &gt;&gt;
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
