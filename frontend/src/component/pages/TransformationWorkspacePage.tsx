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

type TransformResult = {
  transformedS3Key: string;
  fileName: string;
  totalRows: number;
  transformedColumns: string[];
  lookupStats: LookupStat[];
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
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{value}</div>
          <p className="mt-1 text-xs font-medium text-slate-500">{helper}</p>
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <h5 className="text-xs font-bold text-slate-800">{title}</h5>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {fields.map((field) => (
          <span key={field} className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm lg:px-6">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isSelected = selectedStep === step.key;
          const isClickable = step.status !== "idle";

          const iconCx = cx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
            isSelected ? "ring-2 ring-offset-1" : "ring-2",
            step.status === "idle"    && "bg-slate-100 text-slate-400 ring-slate-200",
            step.status === "running" && "bg-blue-50 text-blue-700 ring-blue-300",
            step.status === "passed"  && "bg-emerald-50 text-emerald-700 ring-emerald-300",
            step.status === "failed"  && "bg-rose-50 text-rose-700 ring-rose-300",
            isSelected && step.status === "idle"    && "ring-slate-400",
            isSelected && step.status === "running" && "ring-blue-500",
            isSelected && step.status === "passed"  && "ring-emerald-500",
            isSelected && step.status === "failed"  && "ring-rose-500",
          );

          const labelCx = cx(
            "mt-2 text-center text-[10px] font-bold whitespace-nowrap leading-tight",
            step.status === "idle"    && "text-slate-400",
            step.status === "running" && "text-blue-700",
            step.status === "passed"  && "text-emerald-700",
            step.status === "failed"  && "text-rose-700",
          );

          const subLabelCx = cx(
            "text-[9px] font-semibold uppercase tracking-wider",
            step.status === "idle"    && "text-slate-300",
            step.status === "running" && "text-blue-500",
            step.status === "passed"  && "text-emerald-500",
            step.status === "failed"  && "text-rose-500",
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
                  nextReached ? "bg-emerald-400" : "bg-slate-200"
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

  const {
    currentUser,
    currentProject,
    isContinueEnabled,
    updateProjectStage,
    logActivity,
  } = useMigration();

  // Auto-run on navigate from Upload Files page
  const pipelineStartedRef = useRef(false);
  useEffect(() => {
    if (pipelineStartedRef.current) return;
    if (sessionStorage.getItem("autoRunPipeline") !== "true") return;
    if (!currentProject || !isContinueEnabled) return;
    pipelineStartedRef.current = true;
    sessionStorage.removeItem("autoRunPipeline");
    runPipeline(); // eslint-disable-line @typescript-eslint/no-use-before-define
  }, [currentProject, isContinueEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

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
    return { sourceKey, masterKey, logicKey };
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
    if (!transformResult?.transformedS3Key) return;
    const link = document.createElement("a");
    link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(transformResult.transformedS3Key)}`;
    link.setAttribute("download", transformResult.fileName || "transformed_data.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // ---------------------------------------------------------------------------
  // Pipeline orchestrator
  // ---------------------------------------------------------------------------

  const runPipeline = async () => {
    setPipelineRunning(true);
    setStageStatus({ schema: "idle", cleaning: "idle", validation: "idle", transformation: "idle" });
    setSchemaResult(null);
    setCleaningResult(null);
    setDataValidationResult(null);
    setTransformResult(null);
    setTransformError(null);

    const { sourceKey, masterKey, logicKey } = getActiveKeys();

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
      setSchemaResult(data);
      schemaPassed = data.schema_valid === true && data.missing_fields?.length === 0 && data.additional_fields?.length === 0;
      await updateProjectStage("SCHEMA_VALIDATED", 35);
      await logActivity("System", currentUser?.name || "System", "Completed Schema Validation", "Success");
    } catch (error) {
      setSchemaResult({
        schema_valid: false,
        source_field_count: 0,
        mapping_field_count: 0,
        matched_field_count: 0,
        missing_fields: [],
        additional_fields: [],
        error: String(error),
      });
      setStageStatus(s => ({ ...s, schema: "failed" }));
      await logActivity("System", currentUser?.name || "System", `Schema validation failed: ${String(error)}`, "Failed");
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, schema: schemaPassed ? "passed" : "failed" }));
    if (!schemaPassed) {
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
      setCleaningResult(data);
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
      setCleaningResult({
        success: false,
        cleanedS3Key: null,
        summary: { total_rows_processed: 0, rows_removed: 0, values_trimmed: 0, extra_spaces_fixed: 0, email_corrections: 0, null_conversions: 0 },
        changes: [],
        total_changes: 0,
        error: String(error),
      });
      setStageStatus(s => ({ ...s, cleaning: "failed" }));
      await logActivity("System", currentUser?.name || "System", `Data cleaning failed: ${String(error)}`, "Failed");
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, cleaning: cleaningPassed ? "passed" : "failed" }));
    if (!cleaningPassed) {
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
      setDataValidationResult(data);
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
      setDataValidationResult({ success: false, total_records: 0, total_issues: 0, issues: [], error: String(error) });
      setStageStatus(s => ({ ...s, validation: "failed" }));
      await logActivity("System", currentUser?.name || "System", `Data validation failed: ${String(error)}`, "Failed");
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, validation: validationPassed ? "passed" : "failed" }));
    if (!validationPassed) {
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
      if (data.transformedS3Key && currentProject?.id) {
        await fetch(`/api/projects/${currentProject.id}/outputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: data.fileName || "transformed_data.xlsx",
            fileType: "transformed_data",
            s3Key: data.transformedS3Key,
            recordsCount: validationTotalRecords,
          }),
        });
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(data.transformedS3Key)}`;
        link.setAttribute("download", data.fileName || "transformed_data.xlsx");
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTransformResult({
        transformedS3Key: data.transformedS3Key || "",
        fileName: data.fileName || "transformed_data.xlsx",
        totalRows: data.total_rows || validationTotalRecords,
        transformedColumns: data.transformed_columns || [],
        lookupStats: data.lookup_stats || [],
        generatedAt: data.generatedAt || new Date().toISOString(),
        totalRecords: validationTotalRecords,
      });
      await updateProjectStage("TRANSFORMED", 100);
      await logActivity("System", currentUser?.name || "System", "Completed Data Transformation", "Success");
      setStageStatus(s => ({ ...s, transformation: "passed" }));
    } catch (error) {
      setTransformError(error instanceof Error ? error.message : "Data transformation failed");
      setStageStatus(s => ({ ...s, transformation: "failed" }));
      await logActivity(
        "System",
        currentUser?.name || "System",
        `Data transformation failed: ${error instanceof Error ? error.message : String(error)}`,
        "Failed"
      );
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
    schema: "bg-blue-50 text-blue-700 ring-blue-100",
    cleaning: "bg-amber-50 text-amber-700 ring-amber-100",
    validation: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    transformation: "bg-violet-50 text-violet-700 ring-violet-100",
    export: "bg-teal-50 text-teal-700 ring-teal-100",
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
      status === "running" ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-100">Running</span>
      : status === "passed" ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">Passed</span>
      : status === "failed" ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-100">Failed</span>
      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
    );

    // ── running skeleton ──────────────────────────────────────────────────────
    if (status === "running" && step !== "export") {
      const progressColor = RUNNING_PROGRESS_COLOR[step as PipelineStage];
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3.5 border-b border-slate-200 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-bold text-slate-900">{label}</h3>
              {statusBadge}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <LoaderCircle size={32} className={cx("animate-spin", progressColor.replace("bg-", "text-"))} />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">{RUNNING_MESSAGE[step as PipelineStage]}</p>
            <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-slate-100">
              <div className={cx("h-full w-2/3 animate-pulse rounded-full", progressColor)} />
            </div>
          </div>
        </section>
      );
    }

    // ── idle / pending ────────────────────────────────────────────────────────
    if (status === "idle") {
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3.5 border-b border-slate-200 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-bold text-slate-900">{label}</h3>
              {statusBadge}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon size={22} /></span>
            <p className="mt-3 text-xs leading-5 text-slate-400">This step has not run yet.</p>
          </div>
        </section>
      );
    }

    // ── Schema Validation ─────────────────────────────────────────────────────
    if (step === "schema" && schemaResult) {
      const passed = schemaResult.schema_valid && schemaResult.missing_fields.length === 0 && schemaResult.additional_fields.length === 0;
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <h3 className="text-[15px] font-bold text-slate-900">{label}</h3>
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
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                <p className="text-xs text-rose-800">{schemaResult.error}</p>
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
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-slate-900">{label}</h3>
                  {cleaningResult.success
                    ? cleaningResult.total_changes === 0
                      ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">No Changes</span>
                      : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-100">Completed</span>
                    : statusBadge}
                </div>
                <p className="mt-1 text-xs text-slate-500">{cleaningResult.total_changes} modification{cleaningResult.total_changes === 1 ? "" : "s"} applied.</p>
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
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                <p className="text-xs text-rose-800">{cleaningResult.error}</p>
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
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Cleaning Log — {cleaningResult.changes.length} modification{cleaningResult.changes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Column</th>
                        <th className="px-4 py-3">Original Value</th>
                        <th className="px-4 py-3">Cleaned Value</th>
                        <th className="px-4 py-3">Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {cleaningResult.changes.map((c, i) => (
                        <tr key={`${c.row}-${c.column}-${i}`} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900">{c.row}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{c.column}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-rose-700">{c.original_value}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-emerald-700">{c.cleaned_value}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">{c.rule}</span>
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
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-slate-900">{label}</h3>
                  {passed
                    ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">Passed</span>
                    : <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-100">Issues Found</span>}
                </div>
                {!passed && dataValidationResult.total_issues > 0 && (
                  <p className="mt-1 text-xs text-slate-500">{dataValidationResult.total_issues} issue{dataValidationResult.total_issues === 1 ? "" : "s"} found. Fix source data and re-run.</p>
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
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                <p className="text-xs text-rose-800">{dataValidationResult.error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile label="Rows Checked"  value={dataValidationResult.total_records} helper="Source rows validated"  icon={Table2} />
              <MetricTile label="Issues Found"  value={dataValidationResult.total_issues}  helper="Data quality issues"    icon={AlertTriangle} tone={dataValidationResult.total_issues === 0 ? "emerald" : "rose"} />
            </div>
            {validationHasIssues && dataValidationResult.issues.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Field</th>
                        <th className="px-4 py-3">Issue Type</th>
                        <th className="px-4 py-3">Actual Value</th>
                        <th className="px-4 py-3">Expected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {dataValidationResult.issues.map((issue, i) => (
                        <tr key={`${issue.row}-${issue.field}-${i}`} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900">{issue.row}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">{issue.field}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-rose-700">{issue.issue_type}</td>
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
      const totalMatched = transformResult?.lookupStats.reduce((s, l) => s + l.matched, 0) ?? 0;
      const totalMissed  = transformResult?.lookupStats.reduce((s, l) => s + l.missed,  0) ?? 0;
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3.5 border-b border-slate-200 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-bold text-slate-900">{label}</h3>
              {statusBadge}
            </div>
          </div>
          <div className="p-5 lg:p-6">
            {failed && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                <div>
                  <p className="text-xs font-bold text-rose-900">Transformation failed</p>
                  {transformError && <p className="mt-1 text-xs text-rose-700">{transformError}</p>}
                </div>
              </div>
            )}
            {!failed && transformResult && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricTile label="Rows Transformed"  value={transformResult.totalRows}  helper="Output rows generated"    icon={Table2}       tone="blue" />
                  <MetricTile label="Lookups Matched"   value={totalMatched}               helper="Lookup values resolved"   icon={CheckCircle2} tone="emerald" />
                  <MetricTile label="Lookups Missed"    value={totalMissed}                helper="Lookup values not found"  icon={AlertTriangle} tone={totalMissed > 0 ? "rose" : "slate"} />
                </div>
                {transformResult.lookupStats.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                        Per-column Lookup Statistics
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Column</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-right">Matched</th>
                            <th className="px-4 py-3 text-right">Missed</th>
                            <th className="px-4 py-3 text-right">Match Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {transformResult.lookupStats.map((stat) => {
                            const rate = stat.total > 0 ? Math.round((stat.matched / stat.total) * 100) : 100;
                            return (
                              <tr key={stat.column} className="hover:bg-slate-50">
                                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{stat.column}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{stat.total}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700">{stat.matched}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-700">{stat.missed}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                  <span className={cx(
                                    "rounded-md px-2 py-0.5 text-[10px] font-bold ring-1",
                                    rate === 100 ? "bg-emerald-50 text-emerald-700 ring-emerald-100" :
                                    rate >= 80  ? "bg-amber-50 text-amber-700 ring-amber-100" :
                                                  "bg-rose-50 text-rose-700 ring-rose-100"
                                  )}>{rate}%</span>
                                </td>
                              </tr>
                            );
                          })}
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
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3.5 border-b border-slate-200 px-5 py-5 lg:px-6">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", iconBg)}><Icon size={20} /></span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h3 className="text-[15px] font-bold text-slate-900">{label}</h3>
              {statusBadge}
            </div>
          </div>
          <div className="p-5 lg:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricTile label="Records Exported"    value={transformResult?.totalRecords ?? "—"}        helper="Rows in output file"        icon={Table2}        tone="emerald" />
              <MetricTile label="Columns Transformed" value={transformResult?.transformedColumns.length ?? "—"} helper="Fields with applied rules" icon={Database}      tone="blue" />
              <MetricTile label="Generated"           value={transformResult ? new Date(transformResult.generatedAt).toLocaleDateString() : "—"} helper={generatedLabel} icon={FileSpreadsheet} />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Output File</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{transformResult?.fileName || "transformed_data.xlsx"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Download started automatically when transformation completed.</p>
                </div>
                <Button type="button" variant="secondary" onClick={downloadTransformedFile} className="shrink-0">
                  <Download size={14} />
                  Re-download
                </Button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => router.push("/upload")}>
                <ArrowLeft size={14} />
                Upload new files
              </Button>
              <Button type="button" variant="dark" onClick={() => router.push("/mapping")}>
                Continue to AI Mapping
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
    <div className="flex-1 overflow-y-auto bg-slate-50/80">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">

        {/* Page header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Link
              href="/upload"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-blue-700"
            >
              <ArrowLeft size={13} />
              Back to file upload
            </Link>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
              <Sparkles size={14} />
              Transformation workspace
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[28px]">
              {pipelineRunning ? "Processing migration…" : transformationSucceeded ? "Migration complete" : "Transformation workspace"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {transformationSucceeded
                ? "All stages passed. Click any step in the progress bar to review its metrics."
                : pipelineHasRun
                ? "Pipeline stopped. Click any completed step to review results, then re-run after fixing issues."
                : "Starting pipeline automatically — schema validation, cleaning, data validation, and transformation will run in sequence."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {pipelineRunning && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700">
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
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-900">Files not ready</p>
              <p className="mt-1 text-[11px] leading-5 text-amber-700">
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

        {/* Idle — briefly shown while context loads before auto-run fires */}
        {!pipelineHasRun && !pipelineRunning && isContinueEnabled && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <LoaderCircle size={28} className="animate-spin" />
            </span>
            <h3 className="mt-4 text-base font-bold text-slate-900">Starting pipeline…</h3>
            <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
              Loading project data, then running schema validation, cleaning, data validation, and transformation.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
