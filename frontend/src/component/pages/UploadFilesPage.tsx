"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  FileCheck2,
  FileSpreadsheet,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useMigration } from "@/context/MigrationContext";
import type { UploadedFile } from "@/context/MigrationContext";

type FileSlot = "source" | "master" | "logic";

const FILE_SLOTS: Array<{
  slot: FileSlot;
  step: string;
  title: string;
  description: string;
  helper: string;
  tone: "emerald" | "blue" | "violet";
}> = [
  {
    slot: "source",
    step: "01",
    title: "Source Data",
    description: "Raw records exported from the source system.",
    helper: "Required source workbook",
    tone: "emerald",
  },
  {
    slot: "master",
    step: "02",
    title: "Salesforce Master Metadata",
    description: "Reference sheets for Salesforce targets and IDs.",
    helper: "Required metadata workbook",
    tone: "blue",
  },
  {
    slot: "logic",
    step: "03",
    title: "Mapping Logic",
    description: "Field mapping, data types, defaults, and rules.",
    helper: "Required mapping workbook",
    tone: "violet",
  },
];

const toneStyles = {
  emerald: {
    accent: "bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    progress: "bg-emerald-600",
  },
  blue: {
    accent: "bg-blue-500",
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    badge: "bg-blue-50 text-blue-700 ring-blue-100",
    progress: "bg-blue-600",
  },
  violet: {
    accent: "bg-violet-500",
    icon: "bg-violet-50 text-violet-700 ring-violet-100",
    badge: "bg-violet-50 text-violet-700 ring-violet-100",
    progress: "bg-violet-600",
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "dark";
}) {
  const variants = {
    primary:
      "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
    secondary:
      "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400",
    danger:
      "border border-rose-200 bg-white text-rose-700 shadow-sm hover:bg-rose-50 disabled:bg-slate-100 disabled:text-slate-400",
    dark:
      "bg-slate-950 text-white shadow-sm shadow-slate-950/10 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  };

  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

function UploadCard({
  config,
  file,
  onUpload,
  onClear,
}: {
  config: (typeof FILE_SLOTS)[number];
  file: UploadedFile | null;
  onUpload: () => void;
  onClear: () => void;
}) {
  const styles = toneStyles[config.tone];
  const isComplete = file?.completed && !file.loading;
  const isLoading = file?.loading;

  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_28px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
        isComplete ? "border-emerald-200" : "border-slate-200"
      )}
    >
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
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Step {config.step}</span>
                  {isComplete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                      <Check size={11} strokeWidth={3} />
                      Uploaded
                    </span>
                  )}
                </div>
                <h3 className="text-[15px] font-bold tracking-tight text-slate-950">{config.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{config.description}</p>
              </div>
            </div>

            {isComplete && (
              <button
                type="button"
                onClick={onClear}
                aria-label={`Remove ${config.title}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-slate-700">{file.name}</span>
                  <span className="font-bold tabular-nums text-slate-600">{file.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                  <div className={cx("h-full rounded-full transition-all duration-150", styles.progress)} style={{ width: `${file.progress}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-500">Saving securely to the S3 workspace.</p>
              </div>
            ) : isComplete ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                    <FileCheck2 size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-800">{file.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{file.size} · Ready for processing</span>
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={onUpload}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3.5 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <span>
                  <span className="block text-xs font-bold text-slate-700">Choose file</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{config.helper}</span>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                  <Upload size={15} />
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-500">
          <span className={cx("rounded-full px-2 py-1 ring-1", isComplete ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : styles.badge)}>
            {isComplete ? "Complete" : isLoading ? "Uploading" : "Pending"}
          </span>
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1 text-slate-500 transition-colors hover:text-blue-700">
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

  const {
    currentProject,
    setCurrentProject,
    projectList,
    createProject,
    selectProject,
    uploadedFiles,
    handleFileUpload,
    clearFile,
    isContinueEnabled,
  } = useMigration();

  React.useEffect(() => {
    if (projectList.length > 0 && !selectedProjId) {
      setSelectedProjId(projectList[0].id);
    }
  }, [projectList, selectedProjId]);

  const inputRefs = {
    source: sourceInputRef,
    master: masterInputRef,
    logic: logicInputRef,
  };

  const handleCreateProjectInline = async () => {
    if (!newProjName.trim() || isSubmittingProj) return;
    setIsSubmittingProj(true);
    try {
      const project = await createProject(newProjName);
      if (project) {
        setNewProjName("");
        await selectProject(project.id);
      }
    } catch (err) {
      console.error("Error creating project inline:", err);
    } finally {
      setIsSubmittingProj(false);
    }
  };

  const handleSelectProjectInline = async () => {
    if (!selectedProjId || isSubmittingProj) return;
    setIsSubmittingProj(true);
    try {
      await selectProject(selectedProjId);
    } catch (err) {
      console.error("Error selecting project inline:", err);
    } finally {
      setIsSubmittingProj(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50 min-h-[calc(100vh-60px)]">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="bg-slate-900 px-6 py-5 text-white">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-blue-400">
              <Sparkles size={14} className="animate-pulse" />
              Setup Workspace
            </div>
            <h3 className="mt-1.5 text-lg font-bold">Select or Create a Project</h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              You must choose an active project workspace to begin uploading and validating migration files.
            </p>
          </div>

          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setProjTab("select")}
              className={cx(
                "flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 focus:outline-none",
                projTab === "select"
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              Continue Existing Project
            </button>
            <button
              onClick={() => setProjTab("create")}
              className={cx(
                "flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 focus:outline-none",
                projTab === "create"
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              Create New Project
            </button>
          </div>

          <div className="p-6 bg-white">
            {projTab === "select" ? (
              <div className="space-y-4">
                {projectList.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium">No projects found. Please create a new project to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Select Project Workspace</label>
                    <select
                      value={selectedProjId}
                      onChange={(e) => setSelectedProjId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {projectList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.stage.replace("_", " ")})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  onClick={handleSelectProjectInline}
                  disabled={!selectedProjId || isSubmittingProj}
                  className="w-full py-3 text-xs"
                >
                  {isSubmittingProj ? "Opening Workspace..." : "Open Workspace"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Q3 Salesforce Migration"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <Button
                  onClick={handleCreateProjectInline}
                  disabled={!newProjName.trim() || isSubmittingProj}
                  className="w-full py-3 text-xs"
                >
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
    <div className="flex-1 overflow-y-auto bg-slate-50/80">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">
        {FILE_SLOTS.map((config) => (
          <input
            key={config.slot}
            ref={inputRefs[config.slot]}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={(event) => handleFileUpload(event.target.files, config.slot)}
          />
        ))}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
              <Sparkles size={14} />
              Migration setup
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Active Project:</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-normal ring-1 ring-blue-100">
                {currentProject.name}
              </span>
              <button
                onClick={() => setCurrentProject(null)}
                className="text-slate-400 transition-colors hover:text-rose-600 text-[10px] font-bold underline"
              >
                Switch Project
              </button>
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[28px]">Prepare your migration files</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Upload the three required workbooks to S3. Once all files are ready, proceed to the Transformation Workspace to validate, clean, and transform your data.
            </p>
          </div>

          <div className="flex min-w-[260px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", uploadedCount === 3 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
              {uploadedCount === 3 ? <CheckCircle2 size={18} /> : <CloudUpload size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Upload progress</span>
                <span className="font-bold tabular-nums text-slate-500">{uploadedCount} of 3</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${(uploadedCount / 3) * 100}%` }} />
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FILE_SLOTS.map((config) => (
            <UploadCard
              key={config.slot}
              config={config}
              file={uploadedFiles[config.slot]}
              onUpload={() => inputRefs[config.slot].current?.click()}
              onClear={() => clearFile(config.slot)}
            />
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {isContinueEnabled ? "All files uploaded — ready to continue" : `${uploadedCount} of 3 files uploaded`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isContinueEnabled
                  ? "Head to the Transformation Workspace to validate, clean, and transform your data."
                  : "Upload all three required workbooks before proceeding."}
              </p>
            </div>
            <Button
              type="button"
              variant="dark"
              onClick={() => router.push("/transformation-workspace")}
              disabled={!isContinueEnabled}
            >
              Continue to Transformation Workspace
              <ArrowRight size={15} />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
