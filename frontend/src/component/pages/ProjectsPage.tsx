"use client";

import React, { useState } from "react";
import { useMigration } from "@/context/MigrationContext";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const router = useRouter();
  const {
    currentUser,
    currentProject,
    projectList,
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
    router.push("/upload");
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-[#f8fafc] dark:bg-slate-900">

      {/* Header */}
      <div className="flex-none flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Active Projects
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage migration projects for <span className="text-slate-700 dark:text-slate-300 font-medium">{currentUser?.name || ""}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto px-4 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors select-none cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Projects Table Card */}
      <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl p-6 shadow-sm min-h-[350px] overflow-hidden flex flex-col">
        {isLoadingProjects ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1 min-h-0">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  <th className="pb-3 pl-3">Project Name</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 w-60">Progress</th>
                  <th className="pb-3">Active Stage</th>
                  <th className="pb-3">Records</th>
                  <th className="pb-3">Created On</th>
                  <th className="pb-3 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((project) => {
                    const isCurrent = currentProject?.id === project.id;
                    const formattedDate = new Date(project.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    });

                    return (
                      <tr
                        key={project.id}
                        className={`hover:bg-slate-50/40 dark:hover:bg-slate-700/20 transition-colors ${isCurrent ? "bg-blue-50/20 dark:bg-blue-900/10" : ""}`}
                      >
                        <td className="py-4 pl-3 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{project.name}</span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium uppercase rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4">
                          <span className={`text-sm font-medium ${
                            project.status === "Completed" ? "text-emerald-700 dark:text-emerald-400" :
                            project.status === "In Progress" ? "text-amber-600 dark:text-amber-400" :
                            "text-rose-600 dark:text-rose-400"
                          }`}>
                            {project.status}
                          </span>
                        </td>

                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-28 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                              <div
                                className={`h-full rounded-full ${
                                  project.status === "Completed" ? "bg-emerald-600" :
                                  project.status === "In Progress" ? "bg-amber-500" :
                                  "bg-rose-500"
                                }`}
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-10 tabular-nums">
                              {project.progress}%
                            </span>
                          </div>
                        </td>

                        <td className="py-4 uppercase text-xs font-medium text-slate-500 tracking-wide">
                          {project.stage || "Upload"}
                        </td>

                        <td className="py-4 text-sm text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                          {project.recordsCount.toLocaleString()}
                        </td>

                        <td className="py-4 text-slate-400 text-sm">{formattedDate}</td>

                        <td className="py-4 text-right pr-4">
                          <button
                            onClick={() => handleSelectProject(project.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-blue-600 text-slate-700 dark:text-slate-300 hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                          >
                            {isCurrent ? "Continue" : "Open Workspace"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium text-sm">
                      No migration projects found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-700 mt-4 flex-none">
          <span className="text-sm text-slate-400 font-medium">
            Showing {filteredProjects.length} of {projectList.length} projects
          </span>
        </div>
      </div>

      {/* New Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create New Migration</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Enterprise Migration Phase 1"
                  className="w-full px-4 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white dark:bg-slate-700 dark:placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
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
