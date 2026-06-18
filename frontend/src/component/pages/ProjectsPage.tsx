"use client";

import React, { useState, useEffect } from "react";
import { useMigration, User, Project } from "@/context/MigrationContext";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const {
    currentUser,
    setCurrentUser,
    currentProject,
    setCurrentProject,
    userList,
    projectList,
    isLoadingUsers,
    isLoadingProjects,
    createProject,
    selectProject
  } = useMigration();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredProjects = projectList.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const project = await createProject(newProjectName);
      if (project) {
        setNewProjectName("");
        setIsCreateModalOpen(false);
        // Automatically open the workspace for the new project
        await selectProject(project.id);
        router.push("/upload");
      }
    } catch (err) {
      console.error("Error creating project:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    await selectProject(projectId);
    // Redirect user to the workspace files upload or dashboard
    router.push("/upload");
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-7 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white dark:bg-[#0F172A]">
      
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
          <div className="flex items-center gap-3.5">
            <h2 className="text-[26px] font-black text-[#002BFF] tracking-tight">
              Active Projects
            </h2>
          </div>
          <p className="text-[14.5px] font-extrabold text-slate-500 dark:text-slate-400">
            Manage migration projects for tester: <span className="text-slate-700 dark:text-slate-300 font-black">{currentUser?.name || ""}</span>
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
              className="w-full pl-11 pr-10 h-13 rounded-2xl border border-slate-200 dark:border-slate-600 text-[#000839] dark:text-white text-[14.5px] font-black placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/10 bg-white dark:bg-[#1E293B]"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* New Migration button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto px-6 h-13 rounded-2xl bg-[#002BFF] hover:bg-blue-700 text-white text-[15px] font-black flex items-center justify-center gap-2 transition-all select-none cursor-pointer shadow-lg shadow-blue-500/10 active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Migration</span>
          </button>

        </div>
      </div>

      {/* Projects Table Card */}
      <div className="flex-1 bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-700 rounded-3xl p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.01)] min-h-[350px] overflow-hidden flex flex-col opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        {isLoadingProjects ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1 min-h-0">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100/95 dark:border-slate-700 text-[14px] font-black text-slate-400 uppercase tracking-tight">
                  <th className="pb-4.5 pl-3">Project Name</th>
                  <th className="pb-4.5">Status</th>
                  <th className="pb-4.5 w-60">Progress</th>
                  <th className="pb-4.5">Active Stage</th>
                  <th className="pb-4.5">Records</th>
                  <th className="pb-4.5">Created On</th>
                  <th className="pb-4.5 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-[15px] font-extrabold text-[#000839] dark:text-slate-200">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((project, idx) => {
                    const isCurrent = currentProject?.id === project.id;
                    const formattedDate = new Date(project.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    });

                    return (
                      <tr 
                        key={project.id} 
                        className={`hover:bg-slate-50/20 dark:hover:bg-slate-700/30 transition-all opacity-0 animate-row ${isCurrent ? "bg-blue-50/30 dark:bg-blue-900/20 hover:bg-blue-50/40 dark:hover:bg-blue-900/30" : ""}`}
                        style={{ animationDelay: `${200 + idx * 50}ms` }}
                      >
                        {/* Project Name */}
                        <td className="py-5.5 pl-3 font-black text-[#000839] dark:text-white text-[16px]">
                          <div className="flex items-center gap-2">
                            <span>{project.name}</span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white text-[10.5px] font-black uppercase rounded-full">
                                Active Workspace
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* Status */}
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
                            <div className="w-32 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 animate-progress ${
                                  project.status === "Completed" ? "bg-[#137333]" :
                                  project.status === "In Progress" ? "bg-[#d97706]" :
                                  "bg-[#e11d48]"
                                }`}
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                            <span className="text-[14.5px] font-black text-[#000839] dark:text-slate-300 w-12">
                              <AnimatedCount target={project.progress} />%
                            </span>
                          </div>
                        </td>

                        {/* Active Stage */}
                        <td className="py-5.5 uppercase text-[13px] font-black text-slate-500">
                          {project.stage || "Upload"}
                        </td>

                        {/* Records with dynamic animated count */}
                        <td className="py-5.5 text-[15.5px] text-[#000839]/90 dark:text-slate-300 font-black">
                          <AnimatedCount target={project.recordsCount} format={true} />
                        </td>

                        {/* Created On */}
                        <td className="py-5.5 text-slate-400 font-bold">{formattedDate}</td>

                        {/* Action Buttons */}
                        <td className="py-5.5 text-right pr-5">
                          <button
                            onClick={() => handleSelectProject(project.id)}
                            className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-[#002BFF] text-[#002BFF] dark:text-blue-400 hover:text-white text-[13px] font-black tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer"
                          >
                            {isCurrent ? "Continue" : "Open Workspace"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
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
        )}

        {/* Footer section */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-slate-100/90 dark:border-slate-700 mt-4 gap-4 flex-none">
          <span className="text-[14.5px] font-black text-slate-400">
            Showing {filteredProjects.length} of {projectList.length} projects
          </span>
        </div>
      </div>

      {/* New Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-scale-up">
          <div className="w-full max-w-md bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-100 dark:border-slate-700 shadow-2xl p-7 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#000839] dark:text-white">Create New Migration</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-tight">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Enterprise Migration Phase 1"
                  className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-slate-600 text-[#000839] dark:text-white dark:bg-slate-700 dark:placeholder-slate-400 text-[14.5px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 h-11 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-[14px] font-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 h-11 rounded-xl bg-[#002BFF] hover:bg-blue-700 text-white text-[14px] font-black shadow-md shadow-blue-500/10 active:scale-98 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
