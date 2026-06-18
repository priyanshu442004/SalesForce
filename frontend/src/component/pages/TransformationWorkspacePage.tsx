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
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SchemaResult = {
  schema_valid: boolean;
  source_field_count: number;
  mapping_field_count: number;
  matched_field_count: number;
  missing_fields: string[];
  additional_fields: string[];
  error?: string;
};

type DataValidationIssue = {
  row: number;
  field: string;
  issue_type: string;
  value: string;
  expected: string;
};

type DataValidationResult = {
  success: boolean;
  total_records: number;
  total_issues: number;
  issues: DataValidationIssue[];
  error?: string;
  reportS3Key?: string;
};

type CleaningChange = {
  row: number;
  column: string;
  original_value: string;
  cleaned_value: string;
  rule: string;
};

type CleaningResult = {
  success: boolean;
  cleanedS3Key: string | null;
  summary: {
    total_rows_processed: number;
    rows_removed: number;
    values_trimmed: number;
    extra_spaces_fixed: number;
    email_corrections: number;
    null_conversions: number;
  };
  changes: CleaningChange[];
  total_changes: number;
  error?: string;
};

type LookupStat = {
  column: string;
  matched: number;
  missed: number;
  total: number;
};

type SheetOutput = {
  sheetName: string;
  fileName: string;
  transformedS3Key: string;
  totalRows: number;
  transformedColumns: string[];
  lookupStats: LookupStat[];
};

type TransformResult = {
  outputs: SheetOutput[];
  zipS3Key: string | null;
  zipFileName: string | null;
  generatedAt: string;
  totalRecords: number;
};

type PipelineStage = "schema" | "cleaning" | "validation" | "transformation";
type StageStatus = "idle" | "running" | "passed" | "failed";
type StepKey = PipelineStage | "export";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseErrorDetail(detail: any, fallback: string): string {
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e?.msg ?? JSON.stringify(e)).join("; ");
  }
  return typeof detail === "string" ? detail : fallback;
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
      "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400",
    danger:
      "border border-rose-200 dark:border-rose-800/50 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400",
    dark:
      "bg-slate-950 dark:bg-slate-700 text-white shadow-sm shadow-slate-950/10 hover:bg-slate-800 dark:hover:bg-slate-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100 tabular-nums">{value}</div>
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
          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</h5>
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
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-5 py-5 shadow-sm lg:px-6">
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
            "mt-2 text-center text-[10px] font-bold whitespace-nowrap leading-tight",
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
        className="relative flex w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-none items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 ring-1 ring-teal-100 dark:ring-teal-800/30">
              <Table2 size={18} />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">Output Preview</h3>
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
                  "shrink-0 rounded-t-lg border border-b-0 px-3.5 py-2 text-[11px] font-bold transition-colors focus:outline-none",
                  activeTab === out.sheetName
                    ? "border-slate-200 dark:border-slate-600 bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100"
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
              <LoaderCircle size={28} className="animate-spin text-teal-600 dark:text-teal-400" />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Loading preview data…</p>
            </div>
          )}

          {!isLoading && !error && activeData && (
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm">
                <tr>
                  <th className="w-10 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    #
                  </th>
                  {activeData.columns.map(col => (
                    <th
                      key={col}
                      className="whitespace-nowrap border-b border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 last:border-r-0"
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
                        ? "bg-white dark:bg-[#1E293B]"
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

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [stageStatus, setStageStatus] = useState<Record<PipelineStage, StageStatus>>({
    schema: "idle",
    cleaning: "idle",
    validation: "idle",
    transformation: "idle",
  });

  const [schemaResult, setSchemaResult] = useState<SchemaResult | null>(null);
  const [cleaningResult, setCleaningResult] = useState<CleaningResult | null>(null);
  const [dataValidationResult, setDataValidationResult] = useState<DataValidationResult | null>(null);
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<StepKey | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoadingSheet, setPreviewLoadingSheet] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSheetData, setPreviewSheetData] = useState<Record<string, PreviewSheet>>({});
  const [previewActiveTab, setPreviewActiveTab] = useState<string>("");

  const {
    currentUser,
    currentProject,
    isContinueEnabled,
    updateProjectStage,
    logActivity,
  } = useMigration();

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
    pipelineStartedRef.current = true;
    sessionStorage.removeItem("autoRunPipeline");
    setAutoRunPending(false);
    runPipeline(); // eslint-disable-line @typescript-eslint/no-use-before-define
  }, [currentProject, isContinueEnabled, autoRunPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore pipeline state from sessionStorage when navigating back to this page.
  // Fires on mount (or project switch) when no auto-run is pending.
  useEffect(() => {
    if (!currentProject?.id) return;
    if (pipelineStartedRef.current) return; // auto-run already started — let it win
    if (autoRunPending) return;             // auto-run is about to start — let it win
    const saved = sessionStorage.getItem(`pipeline_state_${currentProject.id}`);
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.stageStatus)             setStageStatus(s.stageStatus);
      if (s.schemaResult !== undefined)         setSchemaResult(s.schemaResult);
      if (s.cleaningResult !== undefined)       setCleaningResult(s.cleaningResult);
      if (s.dataValidationResult !== undefined) setDataValidationResult(s.dataValidationResult);
      if (s.transformResult !== undefined)      setTransformResult(s.transformResult);
    } catch (_e) {
      console.warn("[TransformationWorkspace] Could not restore cached pipeline state:", _e);
    }
  }, [currentProject?.id, autoRunPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance selected step to the latest active/completed step
  useEffect(() => {
    const steps: StepKey[] = ["schema", "cleaning", "validation", "transformation", "export"];
    const latest = [...steps].reverse().find(s => {
      if (s === "export") return stageStatus.transformation === "passed";
      return stageStatus[s as PipelineStage] !== "idle";
    });
    if (latest) setSelectedStep(latest);
  }, [stageStatus]);

  const getActiveKeys = () => {
    const activeFiles = currentProject?.files || [];
    const sourceKey = activeFiles.find((f: any) => f.slot === "source" && f.isActive)?.s3Key;
    const masterKey = activeFiles.find((f: any) => f.slot === "master" && f.isActive)?.s3Key;
    const logicKey = activeFiles.find((f: any) => f.slot === "logic" && f.isActive)?.s3Key;
    // TEMP logging — remove after stale-file bug is confirmed fixed
    console.log("[getActiveKeys] source_key:", sourceKey, "| master_key:", masterKey, "| logic_key:", logicKey);
    console.log("[getActiveKeys] all active project files:", activeFiles.filter((f: any) => f.isActive).map((f: any) => `${f.slot}:${f.s3Key}`));
    return { sourceKey, masterKey, logicKey };
  };

  // Persist the current pipeline result set to sessionStorage so it survives navigation.
  const savePipelineState = (
    status: Record<PipelineStage, StageStatus>,
    schema: SchemaResult | null,
    cleaning: CleaningResult | null,
    validation: DataValidationResult | null,
    transform: TransformResult | null,
  ) => {
    if (!currentProject?.id) return;
    try {
      sessionStorage.setItem(`pipeline_state_${currentProject.id}`, JSON.stringify({
        stageStatus: status,
        schemaResult: schema,
        cleaningResult: cleaning,
        dataValidationResult: validation,
        transformResult: transform,
      }));
    } catch (_e) { /* sessionStorage quota exceeded — non-critical */ }
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
  // Pipeline orchestrator
  // ---------------------------------------------------------------------------

  const runPipeline = async () => {
    // Clear any previously cached state so a fresh run never restores stale results.
    if (currentProject?.id) sessionStorage.removeItem(`pipeline_state_${currentProject.id}`);

    setPipelineRunning(true);
    setStageStatus({ schema: "idle", cleaning: "idle", validation: "idle", transformation: "idle" });
    setSchemaResult(null);
    setCleaningResult(null);
    setDataValidationResult(null);
    setTransformResult(null);
    setTransformError(null);

    const { sourceKey, masterKey, logicKey } = getActiveKeys();

    // Shadow captures — hold result objects so we can persist state at each exit point.
    let _schema: SchemaResult | null = null;
    let _cleaning: CleaningResult | null = null;
    let _validation: DataValidationResult | null = null;

    if (!sourceKey || !logicKey) {
      setSchemaResult({
        schema_valid: false,
        source_field_count: 0,
        mapping_field_count: 0,
        matched_field_count: 0,
        missing_fields: [],
        additional_fields: [],
        error: "Missing active source or mapping logic files in the project.",
      });
      setStageStatus(s => ({ ...s, schema: "failed" }));
      setPipelineRunning(false);
      return;
    }

    // ── Stage 1: Schema Validation ────────────────────────────────────────────
    setStageStatus(s => ({ ...s, schema: "running" }));
    let schemaPassed = false;
    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/validate-schema?source_key=${encodeURIComponent(sourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseErrorDetail(err.detail, "Schema validation failed"));
      }
      const data = await resp.json();
      _schema = data;
      setSchemaResult(_schema);
      schemaPassed = data.schema_valid === true && data.missing_fields?.length === 0 && data.additional_fields?.length === 0;
      await updateProjectStage("SCHEMA_VALIDATED", 35);
      await logActivity("System", currentUser?.name || "System", "Completed Schema Validation", "Success");
    } catch (error) {
      _schema = {
        schema_valid: false,
        source_field_count: 0,
        mapping_field_count: 0,
        matched_field_count: 0,
        missing_fields: [],
        additional_fields: [],
        error: String(error),
      };
      setSchemaResult(_schema);
      setStageStatus(s => ({ ...s, schema: "failed" }));
      savePipelineState({ schema: "failed", cleaning: "idle", validation: "idle", transformation: "idle" }, _schema, null, null, null);
      await logActivity("System", currentUser?.name || "System", `Schema validation failed: ${String(error)}`, "Failed");
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, schema: schemaPassed ? "passed" : "failed" }));
    if (!schemaPassed) {
      savePipelineState({ schema: "failed", cleaning: "idle", validation: "idle", transformation: "idle" }, _schema, null, null, null);
      setPipelineRunning(false);
      return;
    }

    // ── Stage 2: Data Cleaning ────────────────────────────────────────────────
    setStageStatus(s => ({ ...s, cleaning: "running" }));
    let cleanedKey: string | null = null;
    let cleaningPassed = false;
    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/clean-data?source_key=${encodeURIComponent(sourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": currentProject?.id ?? "" },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseErrorDetail(err.detail, "Data cleaning failed"));
      }
      const data = await resp.json();
      _cleaning = data;
      setCleaningResult(_cleaning);
      cleanedKey = data.cleanedS3Key || null;
      cleaningPassed = data.success === true;
      console.log("[pipeline] cleaned source key:", cleanedKey);
      await updateProjectStage("DATA_CLEANED", 45);
      await logActivity(
        "System",
        currentUser?.name || "System",
        `Data cleaning complete. ${data.total_changes} change${data.total_changes === 1 ? "" : "s"} applied.`,
        "Success"
      );
    } catch (error) {
      _cleaning = {
        success: false,
        cleanedS3Key: null,
        summary: { total_rows_processed: 0, rows_removed: 0, values_trimmed: 0, extra_spaces_fixed: 0, email_corrections: 0, null_conversions: 0 },
        changes: [],
        total_changes: 0,
        error: String(error),
      };
      setCleaningResult(_cleaning);
      setStageStatus(s => ({ ...s, cleaning: "failed" }));
      savePipelineState({ schema: "passed", cleaning: "failed", validation: "idle", transformation: "idle" }, _schema, _cleaning, null, null);
      await logActivity("System", currentUser?.name || "System", `Data cleaning failed: ${String(error)}`, "Failed");
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, cleaning: cleaningPassed ? "passed" : "failed" }));
    if (!cleaningPassed) {
      savePipelineState({ schema: "passed", cleaning: "failed", validation: "idle", transformation: "idle" }, _schema, _cleaning, null, null);
      setPipelineRunning(false);
      return;
    }

    // ── Stage 3: Data Validation ──────────────────────────────────────────────
    setStageStatus(s => ({ ...s, validation: "running" }));
    const effectiveSourceKey = cleanedKey || sourceKey;
    let validationPassed = false;
    let validationTotalRecords = 0;
    try {
      let url = `${NEXT_PUBLIC_API_URL}/api/validate-data?source_key=${encodeURIComponent(effectiveSourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      if (masterKey) url += `&master_key=${encodeURIComponent(masterKey)}`;
      console.log("[pipeline] validate-data effective source key:", effectiveSourceKey);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": currentProject?.id || "" },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseErrorDetail(err.detail, "Data validation failed"));
      }
      const data = await resp.json();
      _validation = data;
      setDataValidationResult(_validation);
      validationTotalRecords = data.total_records ?? 0;
      if (data.reportS3Key && currentProject?.id) {
        await fetch(`/api/projects/${currentProject.id}/outputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "data_validation_report.xlsx",
            fileType: "validation_report",
            s3Key: data.reportS3Key,
            recordsCount: data.total_issues,
          }),
        });
      }
      validationPassed = data.success === true && data.total_issues === 0;
      await updateProjectStage("DATA_VALIDATED", 55);
      await logActivity("System", currentUser?.name || "System", `Data validation complete. Issues: ${data.total_issues ?? 0}`, "Success");
    } catch (error) {
      _validation = { success: false, total_records: 0, total_issues: 0, issues: [], error: String(error) };
      setDataValidationResult(_validation);
      setStageStatus(s => ({ ...s, validation: "failed" }));
      savePipelineState({ schema: "passed", cleaning: "passed", validation: "failed", transformation: "idle" }, _schema, _cleaning, _validation, null);
      await logActivity("System", currentUser?.name || "System", `Data validation failed: ${String(error)}`, "Failed");
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, validation: validationPassed ? "passed" : "failed" }));
    if (!validationPassed) {
      savePipelineState({ schema: "passed", cleaning: "passed", validation: "failed", transformation: "idle" }, _schema, _cleaning, _validation, null);
      setPipelineRunning(false);
      return;
    }

    // ── Stage 4: Transformation (auto) ────────────────────────────────────────
    setStageStatus(s => ({ ...s, transformation: "running" }));
    try {
      const effectiveSource = cleanedKey || sourceKey;
      if (!effectiveSource || !masterKey || !logicKey) {
        throw new Error("Missing required migration files for transformation.");
      }
      const url = `${NEXT_PUBLIC_API_URL}/api/transform-data?source_key=${encodeURIComponent(effectiveSource)}&master_key=${encodeURIComponent(masterKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      console.log("[pipeline] transform-data effective source key:", effectiveSource);
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": currentProject?.id || "" },
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(parseErrorDetail(errorBody?.detail, "Data transformation failed"));
      }
      const data = await response.json();
      const sheetOutputs: SheetOutput[] = (data.outputs ?? []).map((o: any) => ({
        sheetName: o.sheetName,
        fileName: o.fileName,
        transformedS3Key: o.transformedS3Key,
        totalRows: o.total_rows ?? 0,
        transformedColumns: o.transformed_columns ?? [],
        lookupStats: o.lookup_stats ?? [],
      }));

      // Record each output file in the project's output list
      if (currentProject?.id) {
        for (const out of sheetOutputs) {
          await fetch(`/api/projects/${currentProject.id}/outputs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: out.fileName,
              fileType: "transformed_data",
              s3Key: out.transformedS3Key,
              recordsCount: validationTotalRecords,
            }),
          });
        }
      }

      // Auto-download: ZIP if multiple sheets, otherwise the single file
      if (data.zipS3Key) {
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(data.zipS3Key)}`;
        link.setAttribute("download", data.zipFileName || "transformed_data.zip");
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (sheetOutputs[0]?.transformedS3Key) {
        const out = sheetOutputs[0];
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(out.transformedS3Key)}`;
        link.setAttribute("download", out.fileName || "transformed_data.xlsx");
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      const finalTransformResult: TransformResult = {
        outputs: sheetOutputs,
        zipS3Key: data.zipS3Key ?? null,
        zipFileName: data.zipFileName ?? null,
        generatedAt: data.generatedAt || new Date().toISOString(),
        totalRecords: validationTotalRecords,
      };
      setTransformResult(finalTransformResult);
      // Persist complete successful pipeline state so it survives navigation.
      savePipelineState(
        { schema: "passed", cleaning: "passed", validation: "passed", transformation: "passed" },
        _schema, _cleaning, _validation, finalTransformResult,
      );
      await updateProjectStage("TRANSFORMED", 100);
      await logActivity("System", currentUser?.name || "System", "Completed Data Transformation", "Success", data);
      setStageStatus(s => ({ ...s, transformation: "passed" }));
    } catch (error) {
      setTransformError(error instanceof Error ? error.message : "Data transformation failed");
      setStageStatus(s => ({ ...s, transformation: "failed" }));
      savePipelineState({ schema: "passed", cleaning: "passed", validation: "passed", transformation: "failed" }, _schema, _cleaning, _validation, null);
      await logActivity("System", currentUser?.name || "System", `Data transformation failed: ${error instanceof Error ? error.message : String(error)}`, "Failed", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setPipelineRunning(false);
    }
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
    transformation: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-violet-100 dark:ring-violet-800/30",
    export: "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 ring-teal-100 dark:ring-teal-800/30",
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
    transformation: "bg-violet-600",
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
      status === "running" ? <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-800/30">Running</span>
      : status === "passed" ? <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">Passed</span>
      : status === "failed" ? <span className="rounded-full bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 ring-1 ring-rose-100 dark:ring-rose-800/30">Failed</span>
      : <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending</span>
    );

    // ── running skeleton ──────────────────────────────────────────────────────
    if (status === "running" && step !== "export") {
      const progressColor = RUNNING_PROGRESS_COLOR[step as PipelineStage];
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3.5 border-b border-slate-200 dark:border-slate-700 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{label}</h3>
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
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-sm">
          <div className="flex items-start gap-3.5 border-b border-slate-200 dark:border-slate-700 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{label}</h3>
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
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{label}</h3>
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
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{label}</h3>
                  {cleaningResult.success
                    ? cleaningResult.total_changes === 0
                      ? <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">No Changes</span>
                      : <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 ring-1 ring-amber-100 dark:ring-amber-800/30">Completed</span>
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
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B]">
                <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Cleaning Log — {cleaningResult.changes.length} modification{cleaningResult.changes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Column</th>
                        <th className="px-4 py-3">Original Value</th>
                        <th className="px-4 py-3">Cleaned Value</th>
                        <th className="px-4 py-3">Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300">
                      {cleaningResult.changes.map((c, i) => (
                        <tr key={`${c.row}-${c.column}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-slate-100">{c.row}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{c.column}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-rose-700 dark:text-rose-400">{c.original_value}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{c.cleaned_value}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 ring-1 ring-amber-100 dark:ring-amber-800/30">{c.rule}</span>
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
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{label}</h3>
                  {passed
                    ? <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">Passed</span>
                    : <span className="rounded-full bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 ring-1 ring-rose-100 dark:ring-rose-800/30">Issues Found</span>}
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
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B]">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Field</th>
                        <th className="px-4 py-3">Issue Type</th>
                        <th className="px-4 py-3">Actual Value</th>
                        <th className="px-4 py-3">Expected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300">
                      {dataValidationResult.issues.map((issue, i) => (
                        <tr key={`${issue.row}-${issue.field}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-slate-100">{issue.row}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">{issue.field}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-rose-700 dark:text-rose-400">{issue.issue_type}</td>
                          <td className="max-w-[260px] truncate px-4 py-3">{issue.value}</td>
                          <td className="max-w-[360px] truncate px-4 py-3">{issue.expected}</td>
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

    // ── Transformation ────────────────────────────────────────────────────────
    if (step === "transformation") {
      const failed = stageStatus.transformation === "failed";
      const allStats = transformResult?.outputs.flatMap(o => o.lookupStats) ?? [];
      const totalRows    = transformResult?.outputs.reduce((s, o) => s + o.totalRows, 0) ?? 0;
      const totalMatched = allStats.reduce((s, l) => s + l.matched, 0);
      const totalMissed  = allStats.reduce((s, l) => s + l.missed,  0);
      const sheetCount   = transformResult?.outputs.length ?? 0;

      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3.5 border-b border-slate-200 dark:border-slate-700 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{label}</h3>
              {statusBadge}
              {sheetCount > 1 && (
                <span className="rounded-full bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 ring-1 ring-violet-100 dark:ring-violet-800/30">
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
                  <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Transformation failed</p>
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
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B]">
                  <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Per-sheet Output Statistics
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Mapping Sheet</th>
                          <th className="px-4 py-3">Output File</th>
                          <th className="px-4 py-3 text-right">Rows</th>
                          <th className="px-4 py-3 text-right">Cols Transformed</th>
                          <th className="px-4 py-3 text-right">Lookups Matched</th>
                          <th className="px-4 py-3 text-right">Lookups Missed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300">
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
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B]">
                    <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Per-column Lookup Statistics
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          <tr>
                            {sheetCount > 1 && <th className="px-4 py-3">Sheet</th>}
                            <th className="px-4 py-3">Column</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-right">Matched</th>
                            <th className="px-4 py-3 text-right">Missed</th>
                            <th className="px-4 py-3 text-right">Match Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300">
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
                                      "rounded-md px-2 py-0.5 text-[10px] font-bold ring-1",
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
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{label}</h3>
                {statusBadge}
                {sheetCount > 1 && (
                  <span className="rounded-full bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 ring-1 ring-teal-100 dark:ring-teal-800/30">
                    {sheetCount} files
                  </span>
                )}
              </div>
            </div>
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
          </div>
          <div className="p-5 lg:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricTile label="Records Exported"    value={transformResult?.totalRecords ?? "—"} helper="Source rows processed"       icon={Table2}        tone="emerald" />
              <MetricTile label="Columns Transformed" value={totalCols}                            helper="Fields with applied rules"   icon={Database}      tone="blue" />
              <MetricTile label="Generated"           value={transformResult ? new Date(transformResult.generatedAt).toLocaleDateString() : "—"} helper={generatedLabel} icon={FileSpreadsheet} />
            </div>

            {/* Per-sheet output files table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B]">
              <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Output Files
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Mapping Sheet</th>
                      <th className="px-4 py-3">Output Filename</th>
                      <th className="px-4 py-3 text-right">Records</th>
                      <th className="px-4 py-3 text-right">Cols Transformed</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300">
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
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
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
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-[#0F172A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">

        {/* Page header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Link
              href="/upload"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 transition-colors hover:text-blue-700 dark:hover:text-blue-400"
            >
              <ArrowLeft size={13} />
              Back to file upload
            </Link>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">
              <Sparkles size={14} />
              Transformation workspace
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-100 sm:text-[28px]">
              {pipelineRunning ? "Processing migration…" : transformationSucceeded ? "Migration complete" : "Transformation workspace"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {transformationSucceeded
                ? "All stages passed. Click any step in the progress bar to review its metrics."
                : pipelineHasRun
                ? "Pipeline stopped. Click any completed step to review results, then re-run after fixing issues."
                : autoRunPending
                ? "Starting pipeline automatically — schema validation, cleaning, data validation, and transformation will run in sequence."
                : "Upload your files and run the pipeline, or use the button below to start now."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {pipelineRunning && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-4 py-2.5 text-xs font-bold text-blue-700 dark:text-blue-300">
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
        </header>

        {/* Files-not-ready warning */}
        {!isContinueEnabled && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/20 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Files not ready</p>
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <LoaderCircle size={28} className="animate-spin" />
            </span>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">Starting pipeline…</h3>
            <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500 dark:text-slate-400">
              Loading project data, then running schema validation, cleaning, data validation, and transformation.
            </p>
          </div>
        )}

        {/* Idle — files are ready but no run is pending (e.g. opened from sidebar) */}
        {!pipelineHasRun && !pipelineRunning && isContinueEnabled && !autoRunPending && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <Wand2 size={28} />
            </span>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">Ready to run</h3>
            <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500 dark:text-slate-400">
              All files are uploaded. Click below to run the full pipeline — schema validation, cleaning, data validation, and transformation.
            </p>
            <button
              type="button"
              onClick={runPipeline}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
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
    </div>
  );
}
