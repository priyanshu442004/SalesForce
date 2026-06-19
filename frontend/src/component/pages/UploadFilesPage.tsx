"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, CheckCircle2, ChevronRight, CloudUpload,
  FileCheck2, FileSpreadsheet, Sparkles, Trash2, Upload,
} from "lucide-react";
import { useMigration } from "@/context/MigrationContext";
import type { UploadedFile } from "@/context/MigrationContext";

type FileSlot = "source" | "master" | "logic";

const FILE_SLOTS: Array<{
  slot: FileSlot; step: string; title: string; description: string; helper: string;
  tone: "emerald" | "blue" | "violet";
}> = [
  { slot: "source", step: "01", title: "Source Data", description: "Raw records exported from the source system.", helper: "Required source workbook", tone: "emerald" },
  { slot: "master", step: "02", title: "Salesforce Master Metadata", description: "Reference sheets for Salesforce targets and IDs.", helper: "Required metadata workbook", tone: "blue" },
  { slot: "logic", step: "03", title: "Mapping Logic", description: "Field mapping, data types, defaults, and rules.", helper: "Required mapping workbook", tone: "violet" },
];

const toneStyles = {
  emerald: {
    accent: "bg-emerald-500",
    icon: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30",
    badge: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30",
    progress: "bg-emerald-600",
  },
  blue: {
    accent: "bg-blue-500",
    icon: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-800/30",
    badge: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-800/30",
    progress: "bg-blue-600",
  },
  violet: {
    accent: "bg-violet-500",
    icon: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-violet-100 dark:ring-violet-800/30",
    badge: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-violet-100 dark:ring-violet-800/30",
    progress: "bg-violet-600",
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children, variant = "primary", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "dark" }) {
  const variants = {
    primary: "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
    secondary: "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50",
    danger: "border border-rose-200 dark:border-rose-700/40 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50",
    dark: "bg-slate-950 dark:bg-slate-700 text-white shadow-sm shadow-slate-950/10 hover:bg-slate-800 dark:hover:bg-slate-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  };
  return (
    <button {...props} className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100", variants[variant], className)}>
      {children}
    </button>
  );
}

function UploadCard({ config, file, onUpload, onClear }: {
  config: (typeof FILE_SLOTS)[number]; file: UploadedFile | null; onUpload: () => void; onClear: () => void;
}) {
  const styles = toneStyles[config.tone];
  const isComplete = file?.completed && !file.loading;
  const isLoading = file?.loading;

  return (
    <article className={cx(
      "group relative overflow-hidden rounded-xl border bg-white dark:bg-[#1E293B] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_28px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
      isComplete ? "border-emerald-200 dark:border-emerald-700/50" : "border-slate-200 dark:border-slate-700"
    )}>
      <div className={cx("absolute inset-x-0 top-0 h-1", isComplete ? "bg-emerald-500" : styles.accent)} />

      <div className="flex min-h-[210px] flex-col justify-between gap-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1", styles.icon)}>
                <FileSpreadsheet size={21} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Step {config.step}</span>
                  {isComplete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                      <Check size={11} strokeWidth={3} />Uploaded
                    </span>
                  )}
                </div>
                <h3 className="text-[15px] font-bold tracking-tight text-slate-950 dark:text-slate-100">{config.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{config.description}</p>
              </div>
            </div>
            {isComplete && (
              <button type="button" onClick={onClear} aria-label={`Remove ${config.title}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400">
                <Trash2 size={15} />
              </button>
            )}
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{file.name}</span>
                  <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300">{file.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600">
                  <div className={cx("h-full rounded-full transition-all duration-150", styles.progress)} style={{ width: `${file.progress}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Saving securely to the S3 workspace.</p>
              </div>
            ) : isComplete ? (
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm">
                    <FileCheck2 size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{file.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{file.size} · Ready for processing</span>
                  </span>
                </div>
              </div>
            ) : (
              <button type="button" onClick={onUpload}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-3.5 py-3 text-left transition-all hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <span>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Choose file</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{config.helper}</span>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600">
                  <Upload size={15} />
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className={cx("rounded-full px-2 py-1 ring-1", isComplete ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30" : styles.badge)}>
            {isComplete ? "Complete" : isLoading ? "Uploading" : "Pending"}
          </span>
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-700 dark:hover:text-blue-400">
            {isComplete ? "Replace" : "Browse"}
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function UploadFilesPage() {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);
  const logicInputRef = useRef<HTMLInputElement>(null);

  const [newProjName, setNewProjName] = useState("");
  const [selectedProjId, setSelectedProjId] = useState("");
  const [isSubmittingProj, setIsSubmittingProj] = useState(false);
  const [projTab, setProjTab] = useState<"select" | "create">("select");

  const { currentProject, setCurrentProject, projectList, createProject, selectProject, uploadedFiles, handleFileUpload, clearFile, isContinueEnabled, resetPipelineState } = useMigration();

  React.useEffect(() => {
    if (projectList.length === 0) setProjTab("create");
    else if (projectList.length > 0 && !selectedProjId) { setSelectedProjId(projectList[0].id); setProjTab("select"); }
  }, [projectList, selectedProjId]);

  const inputRefs = { source: sourceInputRef, master: masterInputRef, logic: logicInputRef };

  const handleCreateProjectInline = async () => {
    if (!newProjName.trim() || isSubmittingProj) return;
    setIsSubmittingProj(true);
    try {
      const project = await createProject(newProjName);
      if (project) { setNewProjName(""); await selectProject(project.id); }
    } catch (err) { console.error("Error creating project inline:", err); }
    finally { setIsSubmittingProj(false); }
  };

  const handleSelectProjectInline = async () => {
    if (!selectedProjId || isSubmittingProj) return;
    setIsSubmittingProj(true);
    try { await selectProject(selectedProjId); }
    catch (err) { console.error("Error selecting project inline:", err); }
    finally { setIsSubmittingProj(false); }
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50 dark:bg-[#0F172A] min-h-[calc(100vh-60px)]">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="bg-slate-900 px-6 py-5 text-white">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-blue-400">
              <Sparkles size={14} className="animate-pulse" />Setup Workspace
            </div>
            <h3 className="mt-1.5 text-lg font-bold">Select or Create a Project</h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              You must choose an active project workspace to begin uploading and validating migration files.
            </p>
          </div>

          {projectList.length > 0 && (
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <button onClick={() => setProjTab("select")} className={cx("flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 focus:outline-none",
                projTab === "select" ? "border-blue-600 text-blue-600 bg-white dark:bg-[#1E293B]" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white")}>
                Continue Existing Project
              </button>
              <button onClick={() => setProjTab("create")} className={cx("flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 focus:outline-none",
                projTab === "create" ? "border-blue-600 text-blue-600 bg-white dark:bg-[#1E293B]" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white")}>
                Create New Project
              </button>
            </div>
          )}

          <div className="p-6 bg-white dark:bg-[#1E293B]">
            {projTab === "select" ? (
              <div className="space-y-4">
                {projectList.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium">No projects found. Please create a new project to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Select Project Workspace</label>
                    <select value={selectedProjId} onChange={(e) => setSelectedProjId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      {projectList.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stage.replace("_", " ")})</option>)}
                    </select>
                  </div>
                )}
                <Button onClick={handleSelectProjectInline} disabled={!selectedProjId || isSubmittingProj} className="w-full py-3 text-xs">
                  {isSubmittingProj ? "Opening Workspace..." : "Open Workspace"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Project Name</label>
                  <input type="text" placeholder="e.g. Acme Q3 Salesforce Migration" value={newProjName} onChange={(e) => setNewProjName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <Button onClick={handleCreateProjectInline} disabled={!newProjName.trim() || isSubmittingProj} className="w-full py-3 text-xs">
                  {isSubmittingProj ? "Creating Project..." : "Create & Launch Workspace"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const uploadedCount = FILE_SLOTS.filter(({ slot }) => uploadedFiles[slot]?.completed).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-[#0F172A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">
        {FILE_SLOTS.map((config) => (
          <input key={config.slot} ref={inputRefs[config.slot]} type="file" accept=".xlsx, .xls, .csv" className="hidden"
            onChange={(event) => handleFileUpload(event.target.files, config.slot)} />
        ))}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">
              <Sparkles size={14} />
              Migration setup
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400">Active Project:</span>
              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-normal ring-1 ring-blue-100 dark:ring-blue-800/30">
                {currentProject.name}
              </span>
              <button onClick={() => setCurrentProject(null)} className="text-slate-400 transition-colors hover:text-rose-600 dark:hover:text-rose-400 text-[10px] font-bold underline">
                Switch Project
              </button>
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-100 sm:text-[28px]">Prepare your migration files</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Upload the three required workbooks to S3. Once all files are ready, proceed to the Transformation Workspace to validate, clean, and transform your data.
            </p>
          </div>

          <div className="flex min-w-[260px] items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-4 py-3 shadow-sm">
            <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", uploadedCount === 3 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400")}>
              {uploadedCount === 3 ? <CheckCircle2 size={18} /> : <CloudUpload size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">Upload progress</span>
                <span className="font-bold tabular-nums text-slate-500 dark:text-slate-400">{uploadedCount} of 3</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${(uploadedCount / 3) * 100}%` }} />
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FILE_SLOTS.map((config) => (
            <UploadCard key={config.slot} config={config} file={uploadedFiles[config.slot]}
              onUpload={() => inputRefs[config.slot].current?.click()} onClear={() => clearFile(config.slot)} />
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isContinueEnabled ? "All files uploaded — ready to continue" : `${uploadedCount} of 3 files uploaded`}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isContinueEnabled
                  ? "Head to the Transformation Workspace to validate, clean, and transform your data."
                  : "Upload all three required workbooks before proceeding."}
              </p>
            </div>
            <Button type="button" variant="dark"
              onClick={() => { resetPipelineState(); sessionStorage.setItem("autoRunPipeline", "true"); router.push("/transformation-workspace"); }}
              disabled={!isContinueEnabled}>
              Continue to Transformation Workspace
              <ArrowRight size={15} />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
