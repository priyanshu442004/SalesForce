"use client";

import React, { useState } from "react";
import { useMigration } from "@/context/MigrationContext";
import { useRouter } from "next/navigation";
import { 
  Wrench, Table2, ShieldCheck, CheckCircle2, Info, Database, User, X, Eye
} from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const {
    currentUser,
    currentProject,
    currentClient,
    projectList,
    clientList,
    isLoadingClients,
    isLoadingProjects,
    createClient,
    createProject,
    selectClient,
    selectProject,
  } = useMigration();

  // Search queries
  const [clientSearch, setClientSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  // Details sidebar state
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<any | null>(null);

  // Sync selectedProjectForDetails details when projectList updates
  React.useEffect(() => {
    if (selectedProjectForDetails) {
      const updatedProj = projectList.find(p => p.id === selectedProjectForDetails.id);
      if (updatedProj) {
        setSelectedProjectForDetails(updatedProj);
      }
    }
  }, [projectList, selectedProjectForDetails?.id]);

  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Form fields
  const [newClientName, setNewClientName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client search filtering
  const filteredClients = clientList.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Projects filtering based on selected client
  const projectsForSelectedClient = projectList.filter((p) => p.clientId === currentClient?.id);
  const filteredProjects = projectsForSelectedClient.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const client = await createClient(newClientName);
      if (client) {
        setNewClientName("");
        setIsClientModalOpen(false);
        await selectClient(client.id);
      }
    } catch (err) {
      console.error("Error creating client:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !currentClient || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const project = await createProject(newProjectName, currentClient.id);
      if (project) {
        setNewProjectName("");
        setIsProjectModalOpen(false);
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
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto select-none bg-[#f8fafc] dark:bg-slate-900 gap-6 md:gap-8">

      {/* Left Column: Clients List */}
      <div className="w-full md:w-80 flex flex-col flex-shrink-0 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
              Clients
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select or create a client
            </p>
          </div>
          <button
            onClick={() => setIsClientModalOpen(true)}
            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-400 transition-colors select-none cursor-pointer"
            title="New Client"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Search Clients */}
        <div className="relative">
          <input
            type="text"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-850"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Clients List */}
        <div className="flex-1 overflow-y-auto max-h-[300px] md:max-h-[calc(100vh-320px)] space-y-1 pr-1">
          {isLoadingClients ? (
            <div className="py-8 flex justify-center items-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredClients.length > 0 ? (
            filteredClients.map((client) => {
              const isSelected = currentClient?.id === client.id;
              return (
                <button
                  key={client.id}
                  onClick={() => selectClient(client.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all select-none cursor-pointer border ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-300 border-transparent"
                  }`}
                >
                  <span className="truncate max-w-[200px]">{client.name}</span>
                  {isSelected && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No clients found.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Projects for Selected Client */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        {currentClient ? (
          <div className="flex-1 flex flex-col space-y-6 min-h-0">
            {/* Projects Header */}
            <div className="flex-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                  Projects
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Managing migration projects for Client: <span className="text-blue-600 dark:text-blue-400 font-semibold">{currentClient.name}</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-60">
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-850"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                </div>

                <button
                  onClick={() => setIsProjectModalOpen(true)}
                  className="w-full sm:w-auto px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors select-none cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>New Project</span>
                </button>
              </div>
            </div>

            {/* Main content split between table and details sidebar */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
              {/* Projects Table */}
              <div className="flex-1 overflow-x-auto min-h-[300px]">
                {isLoadingProjects ? (
                  <div className="h-full flex justify-center items-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        <th className="pb-3 pl-3">Project Name</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 w-48">Progress</th>
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
                              onClick={() => setSelectedProjectForDetails(project)}
                              className={`hover:bg-slate-50/40 dark:hover:bg-slate-700/20 transition-colors cursor-pointer ${
                                isCurrent ? "bg-blue-50/20 dark:bg-blue-900/10" : ""
                              } ${
                                selectedProjectForDetails?.id === project.id ? "ring-2 ring-blue-500/20 dark:ring-blue-500/10 bg-slate-50/80 dark:bg-slate-800/80" : ""
                              }`}
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
                                  <div className="w-24 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                                    <div
                                      className={`h-full rounded-full ${
                                        project.status === "Completed" ? "bg-emerald-600" :
                                        project.status === "In Progress" ? "bg-amber-500" :
                                        "bg-rose-500"
                                      }`}
                                      style={{ width: `${project.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-8 tabular-nums">
                                    {project.progress}%
                                  </span>
                                </div>
                              </td>

                              <td className="py-4 uppercase text-xs font-semibold text-slate-500 tracking-wide">
                                {project.stage || "Upload"}
                              </td>

                              <td className="py-4 text-xs text-slate-700 dark:text-slate-300 font-semibold tabular-nums">
                                {project.recordsCount.toLocaleString()}
                              </td>

                              <td className="py-4 text-slate-400 text-xs">{formattedDate}</td>

                              <td className="py-4 text-right pr-4">
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setSelectedProjectForDetails(project)}
                                    className={`p-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${
                                      selectedProjectForDetails?.id === project.id
                                        ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                                        : "bg-white dark:bg-slate-800 border-slate-205 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                                    }`}
                                    title="View Activities"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleSelectProject(project.id)}
                                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-blue-600 text-slate-700 dark:text-slate-300 hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                                  >
                                    {isCurrent ? "Continue" : "Open Workspace"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-medium text-xs">
                            No projects found for this client. Create a project above to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Sidebar Details Panel */}
              {selectedProjectForDetails && (
                <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4 overflow-y-auto max-h-[400px] lg:max-h-[calc(100vh-280px)]">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div className="min-w-0">
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Project Activities</h4>
                      <h3 className="text-xs font-semibold text-slate-850 dark:text-slate-250 truncate mt-0.5">{selectedProjectForDetails.name}</h3>
                    </div>
                    <button 
                      onClick={() => setSelectedProjectForDetails(null)} 
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Activities List */}
                  <div className="space-y-3 pr-1">
                    {selectedProjectForDetails.activities && selectedProjectForDetails.activities.length > 0 ? (
                      selectedProjectForDetails.activities.map((activity: any) => {
                        const dateStr = new Date(activity.timestamp).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        });

                        // Icon and colors based on category
                        let CategoryIcon = Info;
                        let catBg = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
                        if (activity.category === "Transformation") {
                          CategoryIcon = Wrench;
                          catBg = "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400";
                        } else if (activity.category === "Mapping") {
                          CategoryIcon = Table2;
                          catBg = "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400";
                        } else if (activity.category === "Validation") {
                          CategoryIcon = ShieldCheck;
                          catBg = "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
                        } else if (activity.category === "Upload") {
                          CategoryIcon = CheckCircle2;
                          catBg = "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
                        } else if (activity.category === "System") {
                          CategoryIcon = Database;
                          catBg = "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400";
                        }

                        // Dot color for status
                        let statusColor = "bg-emerald-500";
                        if (activity.status === "Warning") statusColor = "bg-amber-500";
                        if (activity.status === "Error") statusColor = "bg-rose-500";

                        return (
                          <div key={activity.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-lg p-3 space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${catBg}`}>
                                <CategoryIcon size={10} />
                                {activity.category}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{dateStr}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                              {activity.description}
                            </p>
                            <div className="flex items-center gap-1 text-[9px] text-slate-450">
                              <User size={10} />
                              <span>Actor: {activity.actor}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                        No activity recorded for this project yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-700 flex-none">
              <span className="text-xs text-slate-400 font-semibold">
                Showing {filteredProjects.length} of {projectsForSelectedClient.length} projects
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Select a Client</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Please select a client from the list on the left (or create a new one) to view and manage migration projects.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Client Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Create New Client</h3>
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Client Name
                </label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  className="w-full px-3.5 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white dark:bg-slate-700 dark:placeholder-slate-400 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Create New Project</h3>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Enterprise Migration Phase 1"
                  className="w-full px-3.5 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white dark:bg-slate-700 dark:placeholder-slate-400 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
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
