"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Wand2,
  Wrench,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { useMigration } from "@/context/MigrationContext";
import type { PipelineStage, StageStatus, StepKey, SheetOutput } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
      "bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
    secondary:
      "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400",
    danger:
      "border border-rose-200 dark:border-rose-800/50 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400",
    dark:
      "bg-slate-950 dark:bg-slate-700 text-white shadow-sm hover:bg-slate-800 dark:hover:bg-slate-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  };
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

function MetricTile({
  label,
  value,
  helper,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  icon: LucideIcon;
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-600",
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-800/30",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-100 dark:ring-amber-800/30",
    rose: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-100 dark:ring-rose-800/30",
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 tabular-nums">{value}</div>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{helper}</p>
        </div>
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", tones[tone])}>
          <Icon size={19} />
        </span>
      </div>
    </div>
  );
}

function DiscrepancyPanel({ title, description, fields }: { title: string; description: string; fields: string[] }) {
  if (!fields.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">{title}</h5>
          <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {fields.map((field) => (
          <span key={field} className="rounded-md bg-white dark:bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600">
            {field}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline stepper (compact, clickable)
// ---------------------------------------------------------------------------

type DisplayStep = { key: StepKey; label: string; Icon: LucideIcon; status: StageStatus };

function PipelineStepper({
  stageStatus,
  selectedStep,
  onSelect,
}: {
  stageStatus: Record<PipelineStage, StageStatus>;
  selectedStep: StepKey | null;
  onSelect: (step: StepKey) => void;
}) {
  const exportStatus: StageStatus = stageStatus.transformation === "passed" ? "passed" : "idle";

  const steps: DisplayStep[] = [
    { key: "schema",         label: "Schema Validation", Icon: ShieldCheck,    status: stageStatus.schema },
    { key: "cleaning",       label: "Data Cleaning",     Icon: Wrench,         status: stageStatus.cleaning },
    { key: "validation",     label: "Data Validation",   Icon: FileCheck2,     status: stageStatus.validation },
    { key: "transformation", label: "Transformation",    Icon: Wand2,          status: stageStatus.transformation },
    { key: "export",         label: "Export",            Icon: FileSpreadsheet, status: exportStatus },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-5 shadow-sm lg:px-6">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isSelected = selectedStep === step.key;
          const isClickable = step.status !== "idle";

          const iconCx = cx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
            isSelected ? "ring-2 ring-offset-1 dark:ring-offset-[#1E293B]" : "ring-2",
            step.status === "idle"    && "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-slate-600",
            step.status === "running" && "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-300 dark:ring-blue-600",
            step.status === "passed"  && "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-300 dark:ring-emerald-600",
            step.status === "failed"  && "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-300 dark:ring-rose-600",
            isSelected && step.status === "idle"    && "ring-slate-400",
            isSelected && step.status === "running" && "ring-blue-500",
            isSelected && step.status === "passed"  && "ring-emerald-500",
            isSelected && step.status === "failed"  && "ring-rose-500",
          );

          const labelCx = cx(
            "mt-2 text-center text-[10px] font-semibold whitespace-nowrap leading-tight",
            step.status === "idle"    && "text-slate-400 dark:text-slate-500",
            step.status === "running" && "text-blue-700 dark:text-blue-400",
            step.status === "passed"  && "text-emerald-700 dark:text-emerald-400",
            step.status === "failed"  && "text-rose-700 dark:text-rose-400",
          );

          const subLabelCx = cx(
            "text-[9px] font-semibold uppercase tracking-wider",
            step.status === "idle"    && "text-slate-300 dark:text-slate-600",
            step.status === "running" && "text-blue-500 dark:text-blue-500",
            step.status === "passed"  && "text-emerald-500 dark:text-emerald-500",
            step.status === "failed"  && "text-rose-500 dark:text-rose-500",
          );

          const statusLabel = { idle: "Pending", running: "Running…", passed: "Done", failed: "Failed" }[step.status];
          const nextReached = steps[index + 1]?.status !== "idle";

          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onSelect(step.key)}
                className={cx(
                  "flex flex-col items-center transition-opacity",
                  isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default",
                )}
              >
                <span className={iconCx}>
                  {step.status === "running" && <LoaderCircle size={15} className="animate-spin" />}
                  {step.status === "passed"  && <CheckCircle2 size={15} />}
                  {step.status === "failed"  && <XCircle size={15} />}
                  {step.status === "idle"    && <step.Icon size={15} />}
                </span>
                <p className={labelCx}>{step.label}</p>
                <p className={subLabelCx}>{statusLabel}</p>
                {isSelected && (
                  <span className={cx(
                    "mt-1 h-0.5 w-6 rounded-full",
                    step.status === "idle"    && "bg-slate-400",
                    step.status === "running" && "bg-blue-500",
                    step.status === "passed"  && "bg-emerald-500",
                    step.status === "failed"  && "bg-rose-500",
                  )} />
                )}
              </button>
              {!isLast && (
                <div className={cx(
                  "mx-2 mt-4 h-0.5 flex-1 transition-colors",
                  nextReached ? "bg-emerald-400 dark:bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview modal
// ---------------------------------------------------------------------------

type PreviewSheet = {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
};

function PreviewModal({
  open,
  onClose,
  outputs,
  activeTab,
  onTabChange,
  sheetData,
  loadingSheet,
  error,
}: {
  open: boolean;
  onClose: () => void;
  outputs: SheetOutput[];
  activeTab: string;
  onTabChange: (sheetName: string, s3Key: string) => void;
  sheetData: Record<string, PreviewSheet>;
  loadingSheet: string | null;
  error: string | null;
}) {
  if (!open) return null;

  const activeData = sheetData[activeTab];
  const isLoading = loadingSheet === activeTab;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-none items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700/30">
              <Table2 size={18} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Output Preview</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeData ? `${activeData.rowCount} row${activeData.rowCount === 1 ? "" : "s"} · ${activeData.columns.length} column${activeData.columns.length === 1 ? "" : "s"}` : "Loading…"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Sheet tabs — only for multi-output transforms */}
        {outputs.length > 1 && (
          <div className="flex flex-none gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 px-4 pt-2.5">
            {outputs.map(out => (
              <button
                key={out.sheetName}
                type="button"
                onClick={() => onTabChange(out.sheetName, out.transformedS3Key)}
                className={cx(
                  "shrink-0 rounded-t-lg border border-b-0 px-3.5 py-2 text-[11px] font-semibold transition-colors focus:outline-none",
                  activeTab === out.sheetName
                    ? "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {out.sheetName}
              </button>
            ))}
          </div>
        )}

        {/* Table area */}
        <div className="min-h-0 flex-1 overflow-auto">
          {error && (
            <div className="m-5 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
              <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="text-xs text-rose-800 dark:text-rose-300">{error}</p>
            </div>
          )}

          {isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <LoaderCircle size={28} className="animate-spin text-slate-600 dark:text-slate-400" />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Loading preview data…</p>
            </div>
          )}

          {!isLoading && !error && activeData && (
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm">
                <tr>
                  <th className="w-10 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    #
                  </th>
                  {activeData.columns.map(col => (
                    <th
                      key={col}
                      className="whitespace-nowrap border-b border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 last:border-r-0"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeData.rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={cx(
                      "transition-colors",
                      rowIdx % 2 === 0
                        ? "bg-white dark:bg-slate-800"
                        : "bg-slate-50/60 dark:bg-slate-800/30"
                    )}
                  >
                    <td className="border-r border-slate-100 dark:border-slate-700 px-3 py-2.5 text-right font-mono text-[10px] text-slate-300 dark:text-slate-600">
                      {rowIdx + 1}
                    </td>
                    {row.map((cell, colIdx) => (
                      <td
                        key={colIdx}
                        className="max-w-[240px] truncate border-r border-slate-100 dark:border-slate-700 px-3 py-2.5 text-slate-700 dark:text-slate-300 last:border-r-0"
                      >
                        {cell === null || cell === undefined ? (
                          <span className="italic text-slate-300 dark:text-slate-600">—</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!isLoading && activeData && (
          <div className="flex flex-none items-center justify-between border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-3">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Showing first {activeData.rowCount} row{activeData.rowCount === 1 ? "" : "s"}
            </p>
            <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
              Preview capped at 100 rows
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function TransformationWorkspacePage() {
  const router = useRouter();

  const [selectedStep, setSelectedStep] = useState<StepKey | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoadingSheet, setPreviewLoadingSheet] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSheetData, setPreviewSheetData] = useState<Record<string, PreviewSheet>>({});
  const [previewActiveTab, setPreviewActiveTab] = useState<string>("");

  // Staged Files Preview States (Source Data, Salesforce Master, Mapping Logic)
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [filePreviewSlot, setFilePreviewSlot] = useState<"source" | "master" | "logic">("source");
  const [filePreviewSheet, setFilePreviewSheet] = useState<string>("");
  const [fileSheetNames, setFileSheetNames] = useState<string[]>([]);
  const [filePreviewData, setFilePreviewData] = useState<Record<string, PreviewSheet>>({});
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [filePreviewError, setFilePreviewError] = useState<string | null>(null);

  const {
    currentUser,
    currentProject,
    uploadedFiles,
    isContinueEnabled,
    pipelineRunning,
    stageStatus,
    schemaResult,
    cleaningResult,
    dataValidationResult,
    transformResult,
    transformError,
    runPipeline,
    proceedWithSkips,
    restorePipelineState,
    sfAccessToken,
    sfInstanceUrl,
    sfRefreshToken,
    sfSelectedObject,
    setSfSelectedObject,
    sfUserInfo,
    clearSalesforceSession,
  } = useMigration();

  console.log("[TransformationWorkspace]", {
    sfAccessToken,
    sfInstanceUrl,
    sfRefreshToken,
  });

  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>({});

  // Salesforce object picker state
  const [sfObjects, setSfObjects] = useState<{ label: string; api_name: string }[]>([]);
  const [sfObjectsLoading, setSfObjectsLoading] = useState(false);
  const [sfObjectPickerOpen, setSfObjectPickerOpen] = useState(false);
  const [sfObjectPickerError, setSfObjectPickerError] = useState<string | null>(null);

  const [sfObjectSearch, setSfObjectSearch] = useState("");

  // Salesforce upload state
  const [sfUploading, setSfUploading] = useState(false);
  const [sfUploadResult, setSfUploadResult] = useState<{ total: number; success: number; failed: number; errors: { row: number; message: string }[] } | null>(null);
  const [sfUploadError, setSfUploadError] = useState<string | null>(null);
  const [sfResultOpen, setSfResultOpen] = useState(false);

  useEffect(() => {
    if (dataValidationResult?.issues) {
      const initial: Record<string, boolean> = {};
      dataValidationResult.issues.forEach(issue => { initial[issue.field] = false; });
      setCheckedRows(initial);
    }
  }, [dataValidationResult]);

  // True while the auto-run triggered by "Continue to Transformation Workspace" is pending.
  // Used to show "Starting pipeline…" only when an actual auto-run is imminent, not when the
  // user navigates here from the sidebar with files already uploaded.
  const [autoRunPending, setAutoRunPending] = useState(false);

  // Read the sessionStorage flag synchronously on first mount so the spinner shows immediately.
  useEffect(() => {
    if (sessionStorage.getItem("autoRunPipeline") === "true") setAutoRunPending(true);
  }, []);

  // Auto-run on navigate from Upload Files page
  const pipelineStartedRef = useRef(false);
  useEffect(() => {
    if (pipelineStartedRef.current) return;
    if (!autoRunPending) return;
    if (!currentProject || !isContinueEnabled) return;
    if (pipelineRunning) return; // pipeline already running in context — don't double-start
    pipelineStartedRef.current = true;
    sessionStorage.removeItem("autoRunPipeline");
    setAutoRunPending(false);
    runPipeline();
  }, [currentProject, isContinueEnabled, autoRunPending, pipelineRunning, runPipeline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore pipeline state from sessionStorage when navigating back to this page.
  // Skipped when a pipeline is already live in context (context state is authoritative).
  useEffect(() => {
    if (!currentProject?.id) return;
    if (pipelineRunning) return;              // live context state — don't overwrite it
    if (stageStatus.schema !== "idle") return; // context already has results
    if (pipelineStartedRef.current) return;   // auto-run already started — let it win
    if (autoRunPending) return;               // auto-run is about to start — let it win
    const saved = sessionStorage.getItem(`pipeline_state_${currentProject.id}`);
    if (!saved) return;
    try {
      restorePipelineState(JSON.parse(saved));
    } catch (_e) {
      console.warn("[TransformationWorkspace] Could not restore cached pipeline state:", _e);
    }
  }, [currentProject?.id, pipelineRunning, stageStatus.schema, autoRunPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance selected step to the latest active/completed step
  useEffect(() => {
    const steps: StepKey[] = ["schema", "cleaning", "validation", "transformation", "export"];
    const latest = [...steps].reverse().find(s => {
      if (s === "export") return stageStatus.transformation === "passed";
      return stageStatus[s as PipelineStage] !== "idle";
    });
    if (latest) setSelectedStep(latest);
  }, [stageStatus]);

  // Clear file preview cache on project change
  useEffect(() => {
    setFilePreviewData({});
    setFilePreviewOpen(false);
    setFilePreviewError(null);
  }, [currentProject?.id]);

  const loadFilePreview = async (slot: "source" | "master" | "logic", sheetName?: string) => {
    const s3Key = currentProject?.files?.find(f => f.slot === slot && f.isActive)?.s3Key;
    if (!s3Key) {
      setFilePreviewError("File path not found in project context.");
      return;
    }

    setFilePreviewLoading(true);
    setFilePreviewError(null);

    try {
      let url = `${NEXT_PUBLIC_API_URL}/api/preview-output?s3_key=${encodeURIComponent(s3Key)}&limit=100`;
      if (sheetName) {
        url += `&sheet_name=${encodeURIComponent(sheetName)}`;
      }

      const resp = await fetch(url);
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || "Failed to load workbook preview.");
      }

      const data = await resp.json();
      
      // Update sheet names and active sheet
      setFileSheetNames(data.sheet_names || []);
      const selected = data.selected_sheet || "";
      setFilePreviewSheet(selected);

      // Cache the loaded sheet data
      const finalCacheKey = `${slot}_${selected}`;
      setFilePreviewData(prev => ({
        ...prev,
        [finalCacheKey]: {
          columns: data.columns || [],
          rows: data.rows || [],
          rowCount: data.row_count || 0,
        }
      }));
    } catch (err: any) {
      setFilePreviewError(err.message || "Failed to load preview data.");
    } finally {
      setFilePreviewLoading(false);
    }
  };

  const handleOpenFilePreview = async (slot: "source" | "master" | "logic") => {
    setFilePreviewOpen(true);
    setFilePreviewSlot(slot);
    setFilePreviewSheet("");
    setFileSheetNames([]);
    await loadFilePreview(slot);
  };

  const handleFileSlotChange = async (slot: "source" | "master" | "logic") => {
    setFilePreviewSlot(slot);
    setFilePreviewSheet("");
    setFileSheetNames([]);
    await loadFilePreview(slot);
  };

  const handleFileSheetChange = async (sheetName: string) => {
    setFilePreviewSheet(sheetName);
    const cacheKey = `${filePreviewSlot}_${sheetName}`;
    if (filePreviewData[cacheKey]) {
      // Use cached data
      return;
    }
    await loadFilePreview(filePreviewSlot, sheetName);
  };



  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const pipelineHasRun = stageStatus.schema !== "idle";
  const validationHasIssues = dataValidationResult?.success === true && dataValidationResult.total_issues > 0;
  const transformationSucceeded = stageStatus.transformation === "passed";

  // ---------------------------------------------------------------------------
  // Download helpers
  // ---------------------------------------------------------------------------

  const downloadDiscrepancyReport = () => {
    if (!schemaResult) return;
    const rows = [
      ["Type", "Field Name"],
      ...schemaResult.missing_fields.map((f) => ["Missing from Source Data", f]),
      ...schemaResult.additional_fields.map((f) => ["Missing from Mapping Logic", f]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schema_Discrepancies");
    XLSX.writeFile(wb, "schema_discrepancy_report.xlsx");
  };

  const downloadCleaningReport = () => {
    if (!cleaningResult?.changes.length) return;
    const rows = [
      ["Row", "Column", "Original Value", "Cleaned Value", "Cleaning Rule"],
      ...cleaningResult.changes.map((c) => [c.row, c.column, c.original_value, c.cleaned_value, c.rule]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cleaning_Report");
    XLSX.writeFile(wb, "data_cleaning_report.xlsx");
  };

  const downloadValidationReport = () => {
    const reportKey = dataValidationResult?.reportS3Key;
    if (!reportKey) return;
    const link = document.createElement("a");
    link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(reportKey)}`;
    link.setAttribute("download", "data_validation_report.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadTransformedFile = () => {
    if (!transformResult) return;
    if (transformResult.zipS3Key) {
      const link = document.createElement("a");
      link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(transformResult.zipS3Key)}`;
      link.setAttribute("download", transformResult.zipFileName || "transformed_data.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else if (transformResult.outputs[0]?.transformedS3Key) {
      const out = transformResult.outputs[0];
      const link = document.createElement("a");
      link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(out.transformedS3Key)}`;
      link.setAttribute("download", out.fileName || "transformed_data.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const handleSwitchSalesforceAccount = async () => {
    clearSalesforceSession();
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/login`);
      if (!res.ok) throw new Error("Failed to get Salesforce login URL");
      const { auth_url } = await res.json();
      window.location.href = auth_url;
    } catch (err) {
      console.error("[Switch Salesforce Account] OAuth initiation failed:", err);
    }
  };

  const handlePushToSalesforce = async () => {
    if (!sfAccessToken || !sfInstanceUrl) {
      // Not authenticated — start OAuth flow
      try {
        const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/login`);
        if (!res.ok) throw new Error("Failed to get Salesforce login URL");
        const { auth_url } = await res.json();
        window.location.href = auth_url;
      } catch (err) {
        console.error("[Push to Salesforce] OAuth initiation failed:", err);
      }
      return;
    }

    // Already authenticated — fetch available objects and open picker
    setSfObjectsLoading(true);
    setSfObjectPickerError(null);
    setSfObjectSearch("");
    setSfObjectPickerOpen(true);
    try {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/salesforce/objects?access_token=${encodeURIComponent(sfAccessToken)}&instance_url=${encodeURIComponent(sfInstanceUrl)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail?.message ?? body?.detail ?? "Failed to fetch Salesforce objects");
      }
      const objects = await res.json();
      setSfObjects(objects);
    } catch (err) {
      setSfObjectPickerError(err instanceof Error ? err.message : "Failed to load Salesforce objects");
    } finally {
      setSfObjectsLoading(false);
    }
  };

  const handleSfUpload = async (objectName: string) => {
    if (!sfAccessToken || !sfInstanceUrl || !transformResult) return;

    const s3Key = transformResult.zipS3Key ?? transformResult.outputs[0]?.transformedS3Key;
    if (!s3Key) return;

    setSfObjectPickerOpen(false);
    setSfUploading(true);
    setSfUploadError(null);
    setSfUploadResult(null);

    try {
      await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/validate-mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: sfAccessToken,
          instance_url: sfInstanceUrl,
          object_name: objectName,
          s3_key: s3Key,
        }),
      });
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/upload-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: sfAccessToken,
          instance_url: sfInstanceUrl,
          object_name: objectName,
          s3_key: s3Key,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail?.message ?? body?.detail ?? `Upload failed (${res.status})`);
      }

      const result = await res.json();
      setSfUploadResult(result);
      setSfResultOpen(true);
    } catch (err) {
      setSfUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setSfUploading(false);
    }
  };

  const downloadSheetFile = (out: SheetOutput) => {
    const link = document.createElement("a");
    link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(out.transformedS3Key)}`;
    link.setAttribute("download", out.fileName || `${out.sheetName}_transformed.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // ---------------------------------------------------------------------------
  // Preview helpers
  // ---------------------------------------------------------------------------

  const loadPreviewSheet = async (sheetName: string, s3Key: string) => {
    if (previewSheetData[sheetName]) return; // already cached
    setPreviewLoadingSheet(sheetName);
    setPreviewError(null);
    try {
      const resp = await fetch(
        `${NEXT_PUBLIC_API_URL}/api/preview-output?s3_key=${encodeURIComponent(s3Key)}&limit=100`
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || "Failed to load preview");
      }
      const data = await resp.json();
      setPreviewSheetData(prev => ({
        ...prev,
        [sheetName]: { columns: data.columns, rows: data.rows, rowCount: data.row_count },
      }));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setPreviewLoadingSheet(null);
    }
  };

  const openPreview = async () => {
    if (!transformResult || transformResult.outputs.length === 0) return;
    const first = transformResult.outputs[0];
    setPreviewSheetData({});
    setPreviewError(null);
    setPreviewActiveTab(first.sheetName);
    setPreviewOpen(true);
    await loadPreviewSheet(first.sheetName, first.transformedS3Key);
  };

  const handlePreviewTabChange = async (sheetName: string, s3Key: string) => {
    setPreviewActiveTab(sheetName);
    await loadPreviewSheet(sheetName, s3Key);
  };

  // ---------------------------------------------------------------------------
  // Detail panel content
  // ---------------------------------------------------------------------------

  const STEP_ICON: Record<StepKey, LucideIcon> = {
    schema: ShieldCheck,
    cleaning: Wrench,
    validation: FileCheck2,
    transformation: Wand2,
    export: FileSpreadsheet,
  };

  const STEP_LABEL: Record<StepKey, string> = {
    schema: "Schema Validation",
    cleaning: "Data Cleaning",
    validation: "Data Validation",
    transformation: "Transformation",
    export: "Export",
  };

  const STEP_ICON_BG: Record<StepKey, string> = {
    schema: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-800/30",
    cleaning: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-100 dark:ring-amber-800/30",
    validation: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30",
    transformation: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-700/30",
    export: "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-700/30",
  };

  const RUNNING_MESSAGE: Record<PipelineStage, string> = {
    schema: "Comparing source columns against mapping logic fields…",
    cleaning: "Trimming spaces, fixing emails, removing blank rows…",
    validation: "Checking dates, emails, phones, picklists, and required fields…",
    transformation: "Applying Salesforce mappings and generating the output workbook…",
  };

  const RUNNING_PROGRESS_COLOR: Record<PipelineStage, string> = {
    schema: "bg-blue-600",
    cleaning: "bg-amber-500",
    validation: "bg-emerald-600",
    transformation: "bg-blue-600",
  };

  const getStepStatus = (step: StepKey): StageStatus => {
    if (step === "export") return stageStatus.transformation === "passed" ? "passed" : "idle";
    return stageStatus[step];
  };

  const renderDetailPanel = (step: StepKey): React.ReactNode => {
    const Icon = STEP_ICON[step];
    const label = STEP_LABEL[step];
    const iconBg = STEP_ICON_BG[step];
    const status = getStepStatus(step);

    // ── status badge ──────────────────────────────────────────────────────────
    const statusBadge = (
      status === "running" ? <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-800/30">Running</span>
      : status === "passed" ? <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">Passed</span>
      : status === "failed" ? <span className="rounded-full bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 ring-1 ring-rose-100 dark:ring-rose-800/30">Failed</span>
      : <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending</span>
    );

    // ── running skeleton ──────────────────────────────────────────────────────
    if (status === "running" && step !== "export") {
      const progressColor = RUNNING_PROGRESS_COLOR[step as PipelineStage];
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3.5 border-b border-slate-200 dark:border-slate-700 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
              {statusBadge}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <LoaderCircle size={32} className={cx("animate-spin", progressColor.replace("bg-", "text-"))} />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">{RUNNING_MESSAGE[step as PipelineStage]}</p>
            <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className={cx("h-full w-2/3 animate-pulse rounded-full", progressColor)} />
            </div>
          </div>
        </section>
      );
    }

    // ── idle / pending ────────────────────────────────────────────────────────
    if (status === "idle") {
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <div className="flex items-start gap-3.5 border-b border-slate-200 dark:border-slate-700 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
              {statusBadge}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"><Icon size={22} /></span>
            <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500">This step has not run yet.</p>
          </div>
        </section>
      );
    }

    // ── Schema Validation ─────────────────────────────────────────────────────
    if (step === "schema" && schemaResult) {
      const passed = schemaResult.schema_valid && schemaResult.missing_fields.length === 0 && schemaResult.additional_fields.length === 0;
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
                {statusBadge}
              </div>
            </div>
            {!passed && (
              <Button type="button" variant="danger" onClick={downloadDiscrepancyReport}>
                <Download size={14} />Download Report
              </Button>
            )}
          </div>
          <div className="p-5 lg:p-6">
            {schemaResult.error && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <p className="text-xs text-rose-800 dark:text-rose-300">{schemaResult.error}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <MetricTile label="Source Fields"  value={schemaResult.source_field_count}  helper="Columns in source"       icon={Table2}       />
              <MetricTile label="Mapping Fields" value={schemaResult.mapping_field_count} helper="Required by logic"        icon={Database}     tone="blue" />
              <MetricTile label="Matched Fields" value={schemaResult.matched_field_count} helper="Ready for processing"     icon={CheckCircle2} tone="emerald" />
              <MetricTile label="Missing Fields" value={schemaResult.missing_fields.length} helper="In logic, not in source" icon={AlertTriangle} tone={schemaResult.missing_fields.length > 0 ? "rose" : "slate"} />
              <MetricTile label="Extra Fields"   value={schemaResult.additional_fields.length} helper="In source, not in logic" icon={AlertTriangle} tone={schemaResult.additional_fields.length > 0 ? "amber" : "slate"} />
            </div>
            {(schemaResult.missing_fields.length > 0 || schemaResult.additional_fields.length > 0) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <DiscrepancyPanel title="Missing from source data" fields={schemaResult.missing_fields} description="Required by mapping logic but absent from source." />
                <DiscrepancyPanel title="Missing from mapping logic" fields={schemaResult.additional_fields} description="Present in source but not referenced by logic." />
              </div>
            )}
          </div>
        </section>
      );
    }

    // ── Data Cleaning ─────────────────────────────────────────────────────────
    if (step === "cleaning" && cleaningResult) {
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
                  {cleaningResult.success
                    ? cleaningResult.total_changes === 0
                      ? <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">No Changes</span>
                      : <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 ring-1 ring-amber-100 dark:ring-amber-800/30">Completed</span>
                    : statusBadge}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{cleaningResult.total_changes} modification{cleaningResult.total_changes === 1 ? "" : "s"} applied.</p>
              </div>
            </div>
            {cleaningResult.success && cleaningResult.total_changes > 0 && (
              <Button type="button" variant="secondary" onClick={downloadCleaningReport}>
                <Download size={14} />Download Log
              </Button>
            )}
          </div>
          <div className="p-5 lg:p-6">
            {cleaningResult.error && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <p className="text-xs text-rose-800 dark:text-rose-300">{cleaningResult.error}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <MetricTile label="Rows Processed"   value={cleaningResult.summary.total_rows_processed} helper="Total rows"                icon={Table2}   />
              <MetricTile label="Rows Removed"     value={cleaningResult.summary.rows_removed}         helper="Blank rows deleted"         icon={Trash2}   tone={cleaningResult.summary.rows_removed > 0 ? "rose" : "slate"} />
              <MetricTile label="Values Trimmed"   value={cleaningResult.summary.values_trimmed}       helper="Leading/trailing spaces"    icon={Scissors} tone={cleaningResult.summary.values_trimmed > 0 ? "amber" : "slate"} />
              <MetricTile label="Spaces Fixed"     value={cleaningResult.summary.extra_spaces_fixed}   helper="Extra internal spaces"      icon={RefreshCw} tone={cleaningResult.summary.extra_spaces_fixed > 0 ? "amber" : "slate"} />
              <MetricTile label="Email Fixes"      value={cleaningResult.summary.email_corrections}    helper="Email auto-corrections"     icon={AtSign}   tone={cleaningResult.summary.email_corrections > 0 ? "blue" : "slate"} />
              <MetricTile label="Null Conversions" value={cleaningResult.summary.null_conversions}     helper="Empty → NULL"               icon={XCircle}  tone={cleaningResult.summary.null_conversions > 0 ? "amber" : "slate"} />
            </div>
            {cleaningResult.changes.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Cleaning Log — {cleaningResult.changes.length} modification{cleaningResult.changes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Column</th>
                        <th className="px-4 py-3">Original Value</th>
                        <th className="px-4 py-3">Cleaned Value</th>
                        <th className="px-4 py-3">Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {cleaningResult.changes.map((c, i) => (
                        <tr key={`${c.row}-${c.column}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{c.row}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{c.column}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-rose-700 dark:text-rose-400">{c.original_value}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{c.cleaned_value}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-100 dark:ring-amber-800/30">{c.rule}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      );
    }

    // ── Data Validation ───────────────────────────────────────────────────────
    if (step === "validation" && dataValidationResult) {
      const passed = dataValidationResult.success === true && dataValidationResult.total_issues === 0;
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
                  {passed
                    ? <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">Passed</span>
                    : <span className="rounded-full bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 ring-1 ring-rose-100 dark:ring-rose-800/30">Issues Found</span>}
                </div>
                {!passed && dataValidationResult.total_issues > 0 && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dataValidationResult.total_issues} issue{dataValidationResult.total_issues === 1 ? "" : "s"} found. Fix source data and re-run.</p>
                )}
              </div>
            </div>
            {validationHasIssues && (
              <Button type="button" variant="danger" onClick={downloadValidationReport}>
                <Download size={14} />Download Report
              </Button>
            )}
          </div>
          <div className="p-5 lg:p-6">
            {dataValidationResult.error && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <p className="text-xs text-rose-800 dark:text-rose-300">{dataValidationResult.error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile label="Rows Checked"  value={dataValidationResult.total_records} helper="Source rows validated"  icon={Table2} />
              <MetricTile label="Issues Found"  value={dataValidationResult.total_issues}  helper="Data quality issues"    icon={AlertTriangle} tone={dataValidationResult.total_issues === 0 ? "emerald" : "rose"} />
            </div>
            {validationHasIssues && dataValidationResult.issues.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Skip?</th>
                        <th className="px-4 py-3">Field</th>
                        <th className="px-4 py-3">Issue Types</th>
                        <th className="px-4 py-3 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {dataValidationResult.issues.map((issue, i) => (
                        <tr key={`${issue.field}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checkedRows[issue.field] ?? false}
                              onChange={e => setCheckedRows(prev => ({ ...prev, [issue.field]: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{issue.field}</td>
                          <td className="px-4 py-3 text-rose-700 dark:text-rose-400">{issue.issue_types}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">{issue.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {validationHasIssues && dataValidationResult.issues.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    pipelineRunning ||
                    !dataValidationResult.issues.every(issue => checkedRows[issue.field] === true)
                  }
                  onClick={() => {
                    const skippedFields = dataValidationResult.issues
                      .filter(issue => checkedRows[issue.field])
                      .map(issue => issue.field);
                    proceedWithSkips(skippedFields);
                  }}
                >
                  Proceed
                </Button>
              </div>
            )}
          </div>
        </section>
      );
    }

    // ── Transformation ────────────────────────────────────────────────────────
    if (step === "transformation") {
      const failed = stageStatus.transformation === "failed";
      const allStats = transformResult?.outputs.flatMap(o => o.lookupStats) ?? [];
      const totalRows    = transformResult?.outputs.reduce((s, o) => s + o.totalRows, 0) ?? 0;
      const totalMatched = allStats.reduce((s, l) => s + l.matched, 0);
      const totalMissed  = allStats.reduce((s, l) => s + l.missed,  0);
      const sheetCount   = transformResult?.outputs.length ?? 0;

      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3.5 border-b border-slate-200 dark:border-slate-700 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
              {statusBadge}
              {sheetCount > 1 && (
                <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-700/30">
                  {sheetCount} sheets
                </span>
              )}
            </div>
          </div>
          <div className="p-5 lg:p-6">
            {failed && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">Transformation failed</p>
                  {transformError && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{transformError}</p>}
                </div>
              </div>
            )}
            {!failed && transformResult && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricTile label="Rows Transformed"  value={totalRows}     helper={sheetCount > 1 ? `Across ${sheetCount} output files` : "Output rows generated"} icon={Table2}        tone="blue" />
                  <MetricTile label="Lookups Matched"   value={totalMatched}  helper="Lookup values resolved"  icon={CheckCircle2}  tone="emerald" />
                  <MetricTile label="Lookups Missed"    value={totalMissed}   helper="Lookup values not found" icon={AlertTriangle} tone={totalMissed > 0 ? "rose" : "slate"} />
                </div>

                {/* Per-sheet breakdown */}
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Per-sheet Output Statistics
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Mapping Sheet</th>
                          <th className="px-4 py-3">Output File</th>
                          <th className="px-4 py-3 text-right">Rows</th>
                          <th className="px-4 py-3 text-right">Cols Transformed</th>
                          <th className="px-4 py-3 text-right">Lookups Matched</th>
                          <th className="px-4 py-3 text-right">Lookups Missed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {transformResult.outputs.map(out => {
                          const sm = out.lookupStats.reduce((a, l) => a + l.matched, 0);
                          const sx = out.lookupStats.reduce((a, l) => a + l.missed,  0);
                          return (
                            <tr key={out.sheetName} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{out.sheetName}</td>
                              <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">{out.fileName}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{out.totalRows}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{out.transformedColumns.length}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{sm}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-700 dark:text-rose-400">{sx}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Per-column lookup stats (only when any sheet has lookup columns) */}
                {allStats.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Per-column Lookup Statistics
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          <tr>
                            {sheetCount > 1 && <th className="px-4 py-3">Sheet</th>}
                            <th className="px-4 py-3">Column</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-right">Matched</th>
                            <th className="px-4 py-3 text-right">Missed</th>
                            <th className="px-4 py-3 text-right">Match Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {transformResult.outputs.flatMap(out =>
                            out.lookupStats.map(stat => {
                              const rate = stat.total > 0 ? Math.round((stat.matched / stat.total) * 100) : 100;
                              return (
                                <tr key={`${out.sheetName}-${stat.column}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  {sheetCount > 1 && (
                                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400">{out.sheetName}</td>
                                  )}
                                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{stat.column}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{stat.total}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{stat.matched}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-700 dark:text-rose-400">{stat.missed}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right">
                                    <span className={cx(
                                      "rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1",
                                      rate === 100 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30" :
                                      rate >= 80   ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-100 dark:ring-amber-800/30" :
                                                     "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-100 dark:ring-rose-800/30"
                                    )}>{rate}%</span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      );
    }

    // ── Export ────────────────────────────────────────────────────────────────
    if (step === "export") {
      const generatedLabel = transformResult?.generatedAt
        ? new Date(transformResult.generatedAt).toLocaleString()
        : "—";
      const totalCols = transformResult?.outputs.reduce((s, o) => s + o.transformedColumns.length, 0) ?? 0;
      const sheetCount = transformResult?.outputs.length ?? 0;
      const hasZip = !!transformResult?.zipS3Key;

      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
                {statusBadge}
                {sheetCount > 1 && (
                  <span className="rounded-full bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700/30">
                    {sheetCount} files
                  </span>
                )}
              </div>
            </div>
            {sfAccessToken ? (
              <div className="flex flex-col items-end gap-2">
                {/* File actions */}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" onClick={openPreview} className="shrink-0">
                    <Eye size={14} />
                    Preview Output
                  </Button>
                  <Button type="button" variant={hasZip ? "dark" : "secondary"} onClick={downloadTransformedFile} className="shrink-0">
                    <Download size={14} />
                    {hasZip ? "Download ZIP" : "Re-download"}
                  </Button>
                </div>
                {/* Salesforce connection card */}
                <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                  {/* Identity */}
                  <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                      <Cloud size={13} />
                    </span>
                    <div className="leading-[1.3]">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Connected</p>
                      <p className="max-w-[180px] truncate text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
                        {sfUserInfo?.email ?? sfUserInfo?.username ?? "Salesforce"}
                      </p>
                    </div>
                  </div>
                  <div className="w-px bg-slate-200 dark:bg-slate-700" />
                  {/* Switch Account */}
                  <button
                    type="button"
                    onClick={handleSwitchSalesforceAccount}
                    className="whitespace-nowrap bg-white dark:bg-slate-800 px-3.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Switch Account
                  </button>
                  <div className="w-px bg-slate-200 dark:bg-slate-700" />
                  {/* Push */}
                  <button
                    type="button"
                    onClick={handlePushToSalesforce}
                    disabled={sfUploading}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap bg-blue-600 px-4 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {sfUploading ? (
                      <>
                        <svg className="animate-spin w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        Uploading…
                      </>
                    ) : (
                      "Push to Salesforce Object"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={openPreview} className="shrink-0">
                  <Eye size={14} />
                  Preview Output
                </Button>
                <Button type="button" variant={hasZip ? "dark" : "secondary"} onClick={downloadTransformedFile} className="shrink-0">
                  <Download size={14} />
                  {hasZip ? "Download ZIP" : "Re-download"}
                </Button>
                <Button type="button" variant="primary" onClick={handlePushToSalesforce} disabled={sfUploading} className="shrink-0">
                  {sfUploading ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Uploading…
                    </>
                  ) : (
                    "Push to Salesforce Object"
                  )}
                </Button>
              </div>
            )}
          </div>
          <div className="p-5 lg:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricTile label="Records Exported"    value={transformResult?.totalRecords ?? "—"} helper="Source rows processed"       icon={Table2}        tone="emerald" />
              <MetricTile label="Columns Transformed" value={totalCols}                            helper="Fields with applied rules"   icon={Database}      tone="blue" />
              <MetricTile label="Generated"           value={transformResult ? new Date(transformResult.generatedAt).toLocaleDateString() : "—"} helper={generatedLabel} icon={FileSpreadsheet} />
            </div>

            {/* Per-sheet output files table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Output Files
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Mapping Sheet</th>
                      <th className="px-4 py-3">Output Filename</th>
                      <th className="px-4 py-3 text-right">Records</th>
                      <th className="px-4 py-3 text-right">Cols Transformed</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {(transformResult?.outputs ?? []).map(out => (
                      <tr key={out.sheetName} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{out.sheetName}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">{out.fileName}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{out.totalRows}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{out.transformedColumns.length}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => downloadSheetFile(out)}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            <Download size={11} />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-2.5 text-[11px] text-slate-400">
              {hasZip
                ? "All output files were packaged into a ZIP and downloaded automatically."
                : "The output file was downloaded automatically on completion."}
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => router.push("/upload")}>
                <ArrowLeft size={14} />
                Upload new files
              </Button>
              <Button type="button" variant="dark" onClick={() => router.push("/projects")}>
                View Projects
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </section>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-5 sm:px-7 lg:px-9 lg:py-6">

        {/* Page header */}
        <header className="flex flex-col gap-2">
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 transition-colors hover:text-blue-700 dark:hover:text-blue-400"
          >
            <ArrowLeft size={13} />
            Back to file upload
          </Link>

          {/* Single row: Title + Re-run Pipeline (left) | Staged Files (right) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-slate-100 sm:text-2xl">
                {pipelineRunning ? "Processing migration…" : transformationSucceeded ? "Migration complete" : "Transformation workspace"}
              </h2>
              {pipelineRunning && (
                <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-4 py-2.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <LoaderCircle size={14} className="animate-spin" />
                  Processing…
                </span>
              )}
              {pipelineHasRun && !pipelineRunning && (
                <Button type="button" variant="secondary" onClick={runPipeline}>
                  <RefreshCw size={14} />
                  Re-run Pipeline
                </Button>
              )}
            </div>

            {currentProject && uploadedFiles && (
              <div className="shrink-0">
                <div className="flex items-center gap-2.5 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 p-2 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="hidden xl:block px-2 border-r border-slate-250 dark:border-slate-700">
                    <span className="block text-[8px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Staged Files</span>
                    <span className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400">Click to preview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(["source", "master", "logic"] as const).map((slot) => {
                      const fileInfo = uploadedFiles[slot];
                      const toneColors = {
                        source: {
                          bg: "bg-emerald-50 dark:bg-emerald-950/30",
                          text: "text-emerald-700 dark:text-emerald-400",
                          border: "border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/10",
                        },
                        master: {
                          bg: "bg-blue-50 dark:bg-blue-950/30",
                          text: "text-blue-700 dark:text-blue-400",
                          border: "border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/10",
                        },
                        logic: {
                          bg: "bg-blue-50 dark:bg-blue-900/30",
                          text: "text-blue-700 dark:text-blue-400",
                          border: "border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/10",
                        },
                      }[slot];

                      const title = {
                        source: "Source",
                        master: "Master",
                        logic: "Logic",
                      }[slot];

                      if (!fileInfo) return null;

                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleOpenFilePreview(slot)}
                          className={cx(
                            "group flex items-center gap-2 rounded-xl border bg-white dark:bg-slate-800/80 px-2.5 py-1.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer",
                            toneColors.border
                          )}
                        >
                          <span className={cx("flex h-6 w-6 items-center justify-center rounded-lg transition-transform group-hover:scale-110", toneColors.bg, toneColors.text)}>
                            <FileSpreadsheet size={13} />
                          </span>
                          <div className="max-w-[100px] truncate leading-tight">
                            <span className="block text-[8px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</span>
                            <span className="block truncate text-[10px] font-semibold text-slate-700 dark:text-slate-300" title={fileInfo.name}>
                              {fileInfo.name}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Files-not-ready warning */}
        {!isContinueEnabled && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/20 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Files not ready</p>
              <p className="mt-1 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                Upload all three files (source data, master, and mapping logic) before running the pipeline.
              </p>
            </div>
          </div>
        )}

        {/* Compact progress indicator — clickable steps */}
        {(pipelineHasRun || pipelineRunning) && (
          <PipelineStepper
            stageStatus={stageStatus}
            selectedStep={selectedStep}
            onSelect={setSelectedStep}
          />
        )}

        {/* Detail panel for the selected step */}
        {selectedStep && renderDetailPanel(selectedStep)}

        {/* Auto-run is imminent — waiting for project context to finish loading */}
        {!pipelineHasRun && !pipelineRunning && isContinueEnabled && autoRunPending && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <LoaderCircle size={28} className="animate-spin" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">Starting pipeline…</h3>
            <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500 dark:text-slate-400">
              Loading project data, then running schema validation, cleaning, data validation, and transformation.
            </p>
          </div>
        )}

        {/* Idle — files are ready but no run is pending (e.g. opened from sidebar) */}
        {!pipelineHasRun && !pipelineRunning && isContinueEnabled && !autoRunPending && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <Wand2 size={28} />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">Ready to run</h3>
            <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500 dark:text-slate-400">
              All files are uploaded. Click below to run the full pipeline — schema validation, cleaning, data validation, and transformation.
            </p>
            <button
              type="button"
              onClick={runPipeline}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Sparkles size={14} />
              Run Pipeline
            </button>
          </div>
        )}

      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        outputs={transformResult?.outputs ?? []}
        activeTab={previewActiveTab}
        onTabChange={handlePreviewTabChange}
        sheetData={previewSheetData}
        loadingSheet={previewLoadingSheet}
        error={previewError}
      />

      {/* Staged Files Preview Modal */}
      {filePreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setFilePreviewOpen(false)}
        >
          <div
            className="relative flex w-full max-w-[95vw] lg:max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300"
            style={{ maxHeight: "88vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-none items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-800/30">
                  <FileSpreadsheet size={20} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Workbook Inspector</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Preview raw sheets and metadata properties.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilePreviewOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Level 1: File Switcher Tab Bar */}
            <div className="flex flex-none border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-6 py-3 gap-2 overflow-x-auto">
              {(["source", "master", "logic"] as const).map((slot) => {
                const fileInfo = uploadedFiles?.[slot];
                const isSelected = filePreviewSlot === slot;
                
                if (!fileInfo) return null;
                
                const label = {
                  source: "Source Data",
                  master: "Master Metadata",
                  logic: "Mapping Logic",
                }[slot];

                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleFileSlotChange(slot)}
                    className={cx(
                      "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all border shrink-0",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    )}
                  >
                    <FileSpreadsheet size={14} />
                    <span>{label}</span>
                    <span className={cx(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-normal",
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    )}>
                      {fileInfo.size}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Level 2: Sheet Selector Tabs (only shown if multi-sheet) */}
            {fileSheetNames.length > 1 && (
              <div className="flex flex-none gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 px-6 pt-2.5">
                {fileSheetNames.map((sheet) => (
                  <button
                    key={sheet}
                    type="button"
                    onClick={() => handleFileSheetChange(sheet)}
                    className={cx(
                      "shrink-0 rounded-t-lg border border-b-0 px-4 py-2 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none",
                      filePreviewSheet === sheet
                        ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    )}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
            )}

            {/* Main Grid View */}
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-900/10">
              {filePreviewError && (
                <div className="m-6 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
                  <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-xs text-rose-800 dark:text-rose-300">{filePreviewError}</p>
                </div>
              )}

              {filePreviewLoading && (
                <div className="flex flex-col items-center justify-center py-28 text-center">
                  <LoaderCircle size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
                  <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Downloading and parsing workbook sheet...</p>
                </div>
              )}

              {!filePreviewLoading && !filePreviewError && (() => {
                const currentData = filePreviewData[`${filePreviewSlot}_${filePreviewSheet}`];
                if (!currentData) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500">No sheet selected or available.</p>
                    </div>
                  );
                }

                if (currentData.columns.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500">No data found in this sheet.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-auto max-h-full">
                    <table className="min-w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="w-12 border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800">
                            #
                          </th>
                          {currentData.columns.map((col) => (
                            <th
                              key={col}
                              className="whitespace-nowrap border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 last:border-r-0 bg-slate-100 dark:bg-slate-800"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                        {currentData.rows.map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            className={cx(
                              "transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                              rowIdx % 2 === 0
                                ? "bg-white dark:bg-slate-800"
                                : "bg-slate-50/30 dark:bg-slate-800/10"
                            )}
                          >
                            <td className="border-r border-slate-150 dark:border-slate-700 px-3 py-2 text-right font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/20">
                              {rowIdx + 1}
                            </td>
                            {row.map((cell, colIdx) => (
                              <td
                                key={colIdx}
                                className="max-w-[280px] truncate border-r border-slate-100 dark:border-slate-800 px-4 py-2 text-slate-700 dark:text-slate-300 last:border-r-0 font-medium"
                              >
                                {cell === null || cell === undefined ? (
                                  <span className="italic text-slate-300 dark:text-slate-600">—</span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            {!filePreviewLoading && !filePreviewError && (() => {
              const currentData = filePreviewData[`${filePreviewSlot}_${filePreviewSheet}`];
              if (!currentData || currentData.columns.length === 0) return null;
              return (
                <div className="flex flex-none items-center justify-between border-t border-slate-150 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 px-6 py-3 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  <span>
                    Showing first {currentData.rowCount} row{currentData.rowCount === 1 ? "" : "s"}
                  </span>
                  <span className="italic">
                    Preview limited to first 100 rows for speed and performance
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Salesforce upload error banner */}
      {sfUploadError && !sfResultOpen && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-start gap-3 rounded-xl border border-rose-200 bg-white dark:bg-slate-900 dark:border-rose-800 px-5 py-4 shadow-xl max-w-md w-full">
          <svg className="mt-0.5 shrink-0 text-rose-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-rose-600 dark:text-rose-400">Upload failed</p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{sfUploadError}</p>
          </div>
          <button onClick={() => setSfUploadError(null)} className="shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Salesforce upload result modal */}
      {sfResultOpen && sfUploadResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            {/* Header */}
            <div className={`flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-slate-700 ${sfUploadResult.failed === 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
              {sfUploadResult.failed === 0 ? (
                <svg className="text-emerald-600 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg className="text-amber-600 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                  {sfUploadResult.failed === 0 ? "Upload complete" : "Upload finished with errors"}
                </h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {sfSelectedObject && `Target object: ${sfSelectedObject}`}
                </p>
              </div>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700 border-b border-slate-200 dark:border-slate-700">
              {[
                { label: "Total", value: sfUploadResult.total, color: "text-slate-900 dark:text-white" },
                { label: "Uploaded", value: sfUploadResult.success, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Failed", value: sfUploadResult.failed, color: sfUploadResult.failed > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center py-5 gap-1">
                  <span className={`text-2xl font-semibold ${color}`}>{value.toLocaleString()}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                </div>
              ))}
            </div>

            {/* Error table */}
            {sfUploadResult.errors.length > 0 && (
              <div className="max-h-[220px] overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold uppercase tracking-widest text-[10px] text-slate-500 dark:text-slate-400 w-20">Row</th>
                      <th className="px-5 py-2.5 font-semibold uppercase tracking-widest text-[10px] text-slate-500 dark:text-slate-400">Salesforce Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {sfUploadResult.errors.map((e, i) => (
                      <tr key={i} className="bg-white dark:bg-slate-900">
                        <td className="px-5 py-2.5 font-mono text-rose-600 dark:text-rose-400 font-semibold">{e.row}</td>
                        <td className="px-5 py-2.5 text-slate-600 dark:text-slate-300">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSfResultOpen(false)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salesforce Object Picker Modal */}
      {sfObjectPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setSfObjectPickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white tracking-tight">Select Salesforce Object</h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Choose the target object to push records into</p>
              </div>
              <button
                onClick={() => setSfObjectPickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Search */}
            {!sfObjectsLoading && !sfObjectPickerError && (
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search objects…"
                    value={sfObjectSearch}
                    onChange={e => setSfObjectSearch(e.target.value)}
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-400 dark:focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Body */}
            <div className="px-2 py-2 max-h-[320px] overflow-y-auto">
              {sfObjectsLoading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span className="text-[13px] font-medium">Loading objects…</span>
                </div>
              ) : sfObjectPickerError ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] font-semibold text-rose-600">Failed to load objects</p>
                  <p className="text-[12px] text-slate-500 mt-1">{sfObjectPickerError}</p>
                </div>
              ) : (() => {
                const q = sfObjectSearch.toLowerCase();
                const filtered = sfObjects.filter(
                  obj => obj.label.toLowerCase().includes(q) || obj.api_name.toLowerCase().includes(q)
                );
                if (filtered.length === 0) {
                  return (
                    <p className="py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
                      No matching objects found
                    </p>
                  );
                }
                return (
                  <ul className="space-y-0.5">
                    {filtered.map(obj => (
                      <li key={obj.api_name}>
                        <button
                          onClick={() => {
                            setSfSelectedObject(obj.api_name);
                            handleSfUpload(obj.api_name);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                        >
                          <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200">{obj.label}</span>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400">{obj.api_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <button
                onClick={() => setSfObjectPickerOpen(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
