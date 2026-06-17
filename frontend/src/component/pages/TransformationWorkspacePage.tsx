"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Check,
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
  X,
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
  reportS3Key?: string | null;
  error?: string;
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

type PreviewColumn = {
  key: string;
  name: string;
  type: string;
  meta?: string;
};

type PreviewData = {
  summary: {
    total_rows: number;
    total_columns: number;
    cleaned_columns_count: number;
    lookups_successful: number;
    dates_formatted: number;
  };
  columns: PreviewColumn[];
  rows: Array<Record<string, unknown>>;
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = ["Schema Validation", "Data Cleaning", "Data Validation", "Transformation"] as const;
type Tab = (typeof TABS)[number];

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

function DiscrepancyPanel({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: string[];
}) {
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

function PreviewModal({
  previewData,
  onClose,
}: {
  previewData: PreviewData;
  onClose: () => void;
}) {
  const previewMetrics: Array<[string, React.ReactNode, LucideIcon, "slate" | "blue" | "emerald" | "amber" | "rose"]> = [
    ["Output rows", previewData.summary.total_rows, Table2, "slate" as const],
    ["Active columns", previewData.summary.total_columns, Database, "blue" as const],
    ["Columns removed", previewData.summary.cleaned_columns_count, XCircle, "rose" as const],
    ["Master lookups", previewData.summary.lookups_successful, CheckCircle2, "emerald" as const],
    ["Dates formatted", previewData.summary.dates_formatted, RefreshCw, "amber" as const],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex h-full max-h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
        <div className="flex shrink-0 flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">
                <CheckCircle2 size={12} />
                Live preview
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">Salesforce Client Data Preview</h3>
            <p className="mt-1 text-xs text-slate-500">Processed output generated from the uploaded migration files.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 md:grid-cols-5">
          {previewMetrics.map(([label, value, Icon, tone]) => (
            <div key={label as string} className="bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-950 tabular-nums">{value}</p>
                </div>
                <span
                  className={cx(
                    "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
                    tone === "blue" && "bg-blue-50 text-blue-700 ring-blue-100",
                    tone === "emerald" && "bg-emerald-50 text-emerald-700 ring-emerald-100",
                    tone === "amber" && "bg-amber-50 text-amber-700 ring-amber-100",
                    tone === "rose" && "bg-rose-50 text-rose-700 ring-rose-100",
                    tone === "slate" && "bg-slate-100 text-slate-600 ring-slate-200"
                  )}
                >
                  <Icon size={17} />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5">
          <div className="flex min-h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="w-14 border-r border-slate-200 px-3 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">#</th>
                    {previewData.columns.map((col) => (
                      <th key={col.key} className="min-w-[160px] border-r border-slate-200 px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900">{col.name}</span>
                          <span className="w-fit rounded bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                            {col.type.replace("_", " ")}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {previewData.rows.map((row, rowIndex) => {
                    const isSourceRow = rowIndex === 0;
                    return (
                      <tr key={rowIndex} className={cx("transition-colors hover:bg-blue-50/30", isSourceRow ? "bg-slate-100 font-bold" : "odd:bg-white even:bg-slate-50/40")}>
                        <td className="border-r border-slate-100 px-3 py-3 text-center text-[11px] font-bold text-slate-400">
                          {isSourceRow ? "Source" : rowIndex}
                        </td>
                        {previewData.columns.map((col) => {
                          const value = row[col.key];
                          const isEmpty = value === null || value === undefined || value === "";
                          return (
                            <td key={col.key} className="max-w-[260px] truncate border-r border-slate-100 px-3 py-3">
                              {isEmpty ? <span className="italic text-slate-300">-</span> : String(value)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {previewData.summary.total_rows > 50 && (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-500">
                Showing the first 50 rows. Export the workbook to review the full dataset.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

function TabBar({
  tabs,
  active,
  schemaResult,
  cleaningResult,
  dataValidationResult,
  onChange,
}: {
  tabs: readonly Tab[];
  active: Tab;
  schemaResult: SchemaResult | null;
  cleaningResult: CleaningResult | null;
  dataValidationResult: DataValidationResult | null;
  onChange: (tab: Tab) => void;
}) {
  const statusDot = (tab: Tab) => {
    if (tab === "Schema Validation") {
      if (!schemaResult) return null;
      return schemaResult.schema_valid && schemaResult.missing_fields.length === 0 && schemaResult.additional_fields.length === 0
        ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        : <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />;
    }
    if (tab === "Data Cleaning") {
      if (!cleaningResult) return null;
      return cleaningResult.success
        ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        : <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />;
    }
    if (tab === "Data Validation") {
      if (!dataValidationResult) return null;
      return dataValidationResult.success && dataValidationResult.total_issues === 0
        ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        : <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />;
    }
    return null;
  };

  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={cx(
              "inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all",
              isActive
                ? "border-transparent bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            {tab}
            {statusDot(tab)}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function TransformationWorkspacePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("Schema Validation");
  const [isShowingPreview, setIsShowingPreview] = useState(false);

  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaResult, setSchemaResult] = useState<SchemaResult | null>(null);

  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [cleaningResult, setCleaningResult] = useState<CleaningResult | null>(null);
  const [cleanedSourceKey, setCleanedSourceKey] = useState<string | null>(null);

  const [dataValidationLoading, setDataValidationLoading] = useState(false);
  const [dataValidationResult, setDataValidationResult] = useState<DataValidationResult | null>(null);

  const [transformLoading, setTransformLoading] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);

  const {
    currentUser,
    currentProject,
    isContinueEnabled,
    previewData,
    generatePreview,
    isPreviewLoading,
    previewError,
    updateProjectStage,
    logActivity,
  } = useMigration();

  const getActiveKeys = () => {
    const files = currentProject?.files || [];
    const sourceKey = files.find((f: any) => f.slot === "source" && f.isActive)?.s3Key;
    const masterKey = files.find((f: any) => f.slot === "master" && f.isActive)?.s3Key;
    const logicKey = files.find((f: any) => f.slot === "logic" && f.isActive)?.s3Key;
    return { sourceKey, masterKey, logicKey };
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const { sourceKey: _sk, logicKey: _lk } = getActiveKeys();
  const canTriggerValidation = isContinueEnabled && !!_sk && !!_lk;

  const canContinueAfterSchema =
    schemaResult?.schema_valid === true &&
    schemaResult.missing_fields.length === 0 &&
    schemaResult.additional_fields.length === 0;

  const canTriggerCleaning = canContinueAfterSchema;
  const canContinueAfterCleaning = cleaningResult !== null && cleaningResult.success === true;

  const canContinueAfterDataValidation =
    dataValidationResult?.success === true && dataValidationResult.total_issues === 0;

  const hasDataValidationIssues =
    dataValidationResult?.success === true && dataValidationResult.total_issues > 0;

  // ---------------------------------------------------------------------------
  // Error detail parser
  // ---------------------------------------------------------------------------

  function parseError(detail: any, fallback: string): string {
    if (Array.isArray(detail)) {
      return detail.map((e: any) => e.msg ?? JSON.stringify(e)).join("; ");
    }
    return typeof detail === "string" ? detail : fallback;
  }

  // ---------------------------------------------------------------------------
  // API calls
  // ---------------------------------------------------------------------------

  const validateSchema = async () => {
    setSchemaResult(null);
    setCleaningResult(null);
    setCleanedSourceKey(null);
    setDataValidationResult(null);
    setTransformError(null);
    setSchemaLoading(true);
    let passed = false;

    const { sourceKey, logicKey } = getActiveKeys();
    if (!sourceKey || !logicKey) {
      setSchemaLoading(false);
      return;
    }

    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/validate-schema?source_key=${encodeURIComponent(sourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseError(err.detail, "Schema validation failed"));
      }
      const data = await resp.json();
      setSchemaResult(data);
      if (data.schema_valid === true && data.missing_fields?.length === 0 && data.additional_fields?.length === 0) {
        passed = true;
      }
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
      await logActivity("System", currentUser?.name || "System", `Schema validation failed: ${String(error)}`, "Failed");
    } finally {
      setSchemaLoading(false);
    }

    if (passed) {
      setActiveTab("Data Cleaning");
    }
  };

  const runDataCleaning = async () => {
    setCleaningResult(null);
    setCleanedSourceKey(null);
    setDataValidationResult(null);
    setTransformError(null);
    setCleaningLoading(true);

    const { sourceKey, logicKey } = getActiveKeys();
    if (!sourceKey || !logicKey) {
      setCleaningLoading(false);
      return;
    }

    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/clean-data?source_key=${encodeURIComponent(sourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": currentProject?.id ?? "" },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseError(err.detail, "Data cleaning failed"));
      }
      const data = await resp.json();
      setCleaningResult(data);
      setCleanedSourceKey(data.cleanedS3Key || null);
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
        summary: {
          total_rows_processed: 0,
          rows_removed: 0,
          values_trimmed: 0,
          extra_spaces_fixed: 0,
          email_corrections: 0,
          null_conversions: 0,
        },
        changes: [],
        total_changes: 0,
        error: String(error),
      });
      await logActivity("System", currentUser?.name || "System", `Data cleaning failed: ${String(error)}`, "Failed");
    } finally {
      setCleaningLoading(false);
    }
  };

  const validateData = async (force = false) => {
    if (force !== true && !canContinueAfterCleaning) return;

    setDataValidationResult(null);
    setTransformError(null);
    setDataValidationLoading(true);

    const { sourceKey, logicKey } = getActiveKeys();
    const effectiveSourceKey = cleanedSourceKey || sourceKey;
    if (!effectiveSourceKey || !logicKey) {
      setDataValidationLoading(false);
      return;
    }

    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/validate-data?source_key=${encodeURIComponent(effectiveSourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": currentProject?.id ?? "" },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseError(err.detail, "Data validation failed"));
      }
      const data = await resp.json();
      setDataValidationResult(data);
      await updateProjectStage("DATA_VALIDATED", 65);
      await logActivity("System", currentUser?.name || "System", `Data validation complete. Issues: ${data.total_issues ?? 0}`, "Success");
    } catch (error) {
      setDataValidationResult({
        success: false,
        total_records: 0,
        total_issues: 0,
        issues: [],
        error: String(error),
      });
      await logActivity("System", currentUser?.name || "System", `Data validation failed: ${String(error)}`, "Failed");
    } finally {
      setDataValidationLoading(false);
    }
  };

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

  const transformData = async () => {
    if (!canContinueAfterDataValidation) return;
    setTransformLoading(true);
    setTransformError(null);

    const { sourceKey, masterKey, logicKey } = getActiveKeys();
    const effectiveSourceKey = cleanedSourceKey || sourceKey;
    if (!effectiveSourceKey || !masterKey || !logicKey) {
      setTransformLoading(false);
      return;
    }

    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/transform-data?source_key=${encodeURIComponent(effectiveSourceKey)}&master_key=${encodeURIComponent(masterKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": currentProject?.id ?? "" },
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(parseError(errorBody?.detail, "Data transformation failed"));
      }
      const data = await response.json();
      if (data.transformedS3Key) {
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(data.transformedS3Key)}`;
        link.setAttribute("download", data.fileName || "transformed_data.xlsx");
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      await updateProjectStage("TRANSFORMED", 100);
      await logActivity("System", currentUser?.name || "System", "Completed Data Transformation", "Success");
    } catch (error) {
      setTransformError(error instanceof Error ? error.message : "Data transformation failed");
      await logActivity("System", currentUser?.name || "System", `Data transformation failed: ${error instanceof Error ? error.message : String(error)}`, "Failed");
    } finally {
      setTransformLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!isContinueEnabled) return;
    try {
      await generatePreview();
      setIsShowingPreview(true);
    } catch {
      // previewError from context surfaces the message
    }
  };

  // ---------------------------------------------------------------------------
  // Tab content renderers
  // ---------------------------------------------------------------------------

  const renderSchemaValidation = () => (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <ShieldCheck size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold text-slate-900">Schema validation</h3>
              {!schemaResult && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
              )}
              {schemaResult?.schema_valid === true && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">Passed</span>
              )}
              {schemaResult?.schema_valid === false && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-100">Needs review</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Compare source columns against mapping logic before progressing.</p>
          </div>
        </div>
        <Button type="button" onClick={validateSchema} disabled={!canTriggerValidation || schemaLoading}>
          {schemaLoading ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {schemaLoading ? "Validating schema" : "Validate Schema"}
        </Button>
      </div>

      {schemaLoading ? (
        <div className="px-5 py-8 lg:px-6">
          <div className="mx-auto max-w-md text-center">
            <LoaderCircle size={28} className="mx-auto animate-spin text-blue-600" />
            <h4 className="mt-3 text-sm font-bold text-slate-800">Reviewing field compatibility</h4>
            <p className="mt-1 text-xs text-slate-500">Checking source fields, mapping rules, and discrepancies.</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
            </div>
          </div>
        </div>
      ) : schemaResult ? (
        <div className="p-5 lg:p-6">
          <div
            className={cx(
              "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              schemaResult.schema_valid ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm", schemaResult.schema_valid ? "text-emerald-700" : "text-rose-700")}>
                {schemaResult.schema_valid ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </span>
              <div>
                <h4 className={cx("text-sm font-bold", schemaResult.schema_valid ? "text-emerald-900" : "text-rose-900")}>
                  {schemaResult.schema_valid ? "Schema validation passed" : "Schema discrepancies detected"}
                </h4>
                <p className={cx("mt-1 text-xs", schemaResult.schema_valid ? "text-emerald-700" : "text-rose-700")}>
                  {schemaResult.schema_valid
                    ? "All required fields align. The files are ready for the next step."
                    : schemaResult.error || "Review field differences or download the discrepancy report."}
                </p>
              </div>
            </div>
            {!schemaResult.schema_valid && (
              <Button type="button" variant="danger" onClick={downloadDiscrepancyReport}>
                <Download size={14} />
                Download report
              </Button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Source fields" value={schemaResult.source_field_count} helper="Columns detected in source" icon={Table2} />
            <MetricTile label="Mapping fields" value={schemaResult.mapping_field_count} helper="Fields required by logic" icon={Database} tone="blue" />
            <MetricTile label="Matched fields" value={schemaResult.matched_field_count} helper="Ready for processing" icon={CheckCircle2} tone="emerald" />
            <MetricTile
              label="Discrepancies"
              value={schemaResult.missing_fields.length + schemaResult.additional_fields.length}
              helper="Missing or additional fields"
              icon={AlertTriangle}
              tone={schemaResult.schema_valid ? "slate" : "rose"}
            />
          </div>

          {!schemaResult.schema_valid && (schemaResult.missing_fields.length > 0 || schemaResult.additional_fields.length > 0) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DiscrepancyPanel title="Missing from source data" fields={schemaResult.missing_fields} description="Required by mapping logic but absent from source data." />
              <DiscrepancyPanel title="Missing from mapping logic" fields={schemaResult.additional_fields} description="Present in source data but not referenced by mapping logic." />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-5 py-9 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ShieldCheck size={22} />
          </span>
          <h4 className="mt-3 text-sm font-bold text-slate-800">
            {isContinueEnabled ? "Files ready for validation" : "Return to upload to prepare files"}
          </h4>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            {isContinueEnabled
              ? "Run schema validation to confirm field compatibility and surface any discrepancies."
              : "All three files must be uploaded before schema validation can run."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {canContinueAfterSchema ? (
            <CheckCircle2 size={15} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={15} className="text-slate-400" />
          )}
          <span>
            {canContinueAfterSchema
              ? "Schema valid. Proceed to data cleaning."
              : "Run schema validation and resolve discrepancies before continuing."}
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setActiveTab("Data Cleaning")}
          disabled={!canContinueAfterSchema}
        >
          Next: Data Cleaning
          <ArrowRight size={14} />
        </Button>
      </div>
    </section>
  );

  const renderDataCleaning = () => (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <Wrench size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold text-slate-900">Data Cleaning</h3>
              {!cleaningResult && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {canTriggerCleaning ? "Ready" : "Pending"}
                </span>
              )}
              {cleaningResult?.success && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">
                  {cleaningResult.total_changes === 0 ? "No Changes" : "Completed"}
                </span>
              )}
              {cleaningResult && !cleaningResult.success && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-100">Failed</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Auto-correct and standardize source data before validation.</p>
          </div>
        </div>
        <Button type="button" onClick={runDataCleaning} disabled={!canTriggerCleaning || cleaningLoading}>
          {cleaningLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Wrench size={15} />}
          {cleaningLoading ? "Cleaning data…" : cleaningResult ? "Re-run Cleaning" : "Run Data Cleaning"}
        </Button>
      </div>

      {/* Body */}
      {cleaningLoading ? (
        <div className="px-5 py-8 lg:px-6">
          <div className="mx-auto max-w-md text-center">
            <LoaderCircle size={28} className="mx-auto animate-spin text-amber-600" />
            <h4 className="mt-3 text-sm font-bold text-slate-800">Applying cleaning rules</h4>
            <p className="mt-1 text-xs text-slate-500">Trimming spaces, fixing emails, removing blank rows, and normalising values.</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-3/4 animate-pulse rounded-full bg-amber-500" />
            </div>
          </div>
        </div>
      ) : cleaningResult ? (
        <div className="p-5 lg:p-6">
          {/* Banner */}
          <div
            className={cx(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              cleaningResult.success
                ? cleaningResult.total_changes > 0
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-emerald-200 bg-emerald-50/70"
                : "border-rose-200 bg-rose-50/70"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm",
                  cleaningResult.success
                    ? cleaningResult.total_changes > 0 ? "text-amber-600" : "text-emerald-700"
                    : "text-rose-700"
                )}
              >
                {cleaningResult.success ? (
                  cleaningResult.total_changes > 0 ? <Wrench size={20} /> : <CheckCircle2 size={20} />
                ) : (
                  <XCircle size={20} />
                )}
              </span>
              <div>
                <h4
                  className={cx(
                    "text-sm font-bold",
                    cleaningResult.success
                      ? cleaningResult.total_changes > 0 ? "text-amber-900" : "text-emerald-900"
                      : "text-rose-900"
                  )}
                >
                  {cleaningResult.success
                    ? cleaningResult.total_changes > 0
                      ? "Data Cleaning Completed Successfully"
                      : "No Cleaning Required"
                    : "Data Cleaning Failed"}
                </h4>
                <p
                  className={cx(
                    "mt-1 text-xs",
                    cleaningResult.success
                      ? cleaningResult.total_changes > 0 ? "text-amber-700" : "text-emerald-700"
                      : "text-rose-700"
                  )}
                >
                  {cleaningResult.success
                    ? cleaningResult.total_changes > 0
                      ? `${cleaningResult.total_changes} change${cleaningResult.total_changes === 1 ? "" : "s"} applied to the source dataset. The cleaned file will be used for all subsequent steps.`
                      : "The source data is already clean. No modifications were necessary."
                    : cleaningResult.error || "An error occurred during cleaning."}
                </p>
              </div>
            </div>
            {cleaningResult.success && cleaningResult.total_changes > 0 && (
              <Button type="button" variant="secondary" onClick={downloadCleaningReport}>
                <Download size={14} />
                Download Report
              </Button>
            )}
          </div>

          {/* Summary metrics */}
          {cleaningResult.success && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <MetricTile
                label="Rows processed"
                value={cleaningResult.summary.total_rows_processed}
                helper="Total rows in source"
                icon={Table2}
              />
              <MetricTile
                label="Rows removed"
                value={cleaningResult.summary.rows_removed}
                helper="Blank rows deleted"
                icon={Trash2}
                tone={cleaningResult.summary.rows_removed > 0 ? "rose" : "slate"}
              />
              <MetricTile
                label="Values trimmed"
                value={cleaningResult.summary.values_trimmed}
                helper="Leading/trailing spaces"
                icon={Scissors}
                tone={cleaningResult.summary.values_trimmed > 0 ? "amber" : "slate"}
              />
              <MetricTile
                label="Spaces fixed"
                value={cleaningResult.summary.extra_spaces_fixed}
                helper="Extra internal spaces"
                icon={RefreshCw}
                tone={cleaningResult.summary.extra_spaces_fixed > 0 ? "amber" : "slate"}
              />
              <MetricTile
                label="Email fixes"
                value={cleaningResult.summary.email_corrections}
                helper="Email auto-corrections"
                icon={AtSign}
                tone={cleaningResult.summary.email_corrections > 0 ? "blue" : "slate"}
              />
              <MetricTile
                label="Null conversions"
                value={cleaningResult.summary.null_conversions}
                helper="Empty → NULL"
                icon={XCircle}
                tone={cleaningResult.summary.null_conversions > 0 ? "amber" : "slate"}
              />
            </div>
          )}

          {/* Changes table */}
          {cleaningResult.success && cleaningResult.changes.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                  Changes applied — {cleaningResult.changes.length} modification{cleaningResult.changes.length === 1 ? "" : "s"}
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
                      <th className="px-4 py-3">Rule Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {cleaningResult.changes.map((change, index) => (
                      <tr key={`${change.row}-${change.column}-${index}`} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900">{change.row}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{change.column}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-rose-700">{change.original_value}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-emerald-700">{change.cleaned_value}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">
                            {change.rule}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-5 py-9 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Wrench size={22} />
          </span>
          <h4 className="mt-3 text-sm font-bold text-slate-800">
            {canTriggerCleaning ? "Ready to clean source data" : "Complete schema validation first"}
          </h4>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            {canTriggerCleaning
              ? "Run data cleaning to trim spaces, fix emails, remove blank rows, and normalise empty values."
              : "Schema validation must pass before data cleaning can run."}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {canContinueAfterCleaning ? (
            <CheckCircle2 size={15} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={15} className="text-slate-400" />
          )}
          <span>
            {canContinueAfterCleaning
              ? cleanedSourceKey
                ? "Cleaned data stored. Data Validation will use the cleaned file."
                : "Cleaning complete. Data Validation will use the cleaned file."
              : "Run data cleaning before proceeding to data validation."}
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setActiveTab("Data Validation")}
          disabled={!canContinueAfterCleaning}
        >
          Next: Data Validation
          <ArrowRight size={14} />
        </Button>
      </div>
    </section>
  );

  const renderDataValidation = () => (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <FileCheck2 size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold text-slate-900">Data validation</h3>
              {!dataValidationResult && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {canContinueAfterCleaning ? "Ready" : "Pending"}
                </span>
              )}
              {canContinueAfterDataValidation && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">Passed</span>
              )}
              {dataValidationResult && !canContinueAfterDataValidation && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-100">Needs review</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Validate {cleanedSourceKey ? "cleaned " : ""}source values against mapping logic data types and allowed values.
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => validateData()} disabled={!canContinueAfterCleaning || dataValidationLoading}>
          {dataValidationLoading ? <LoaderCircle size={15} className="animate-spin" /> : <FileCheck2 size={15} />}
          {dataValidationLoading ? "Validating data" : "Validate Data"}
        </Button>
      </div>

      {dataValidationLoading ? (
        <div className="px-5 py-8 lg:px-6">
          <div className="mx-auto max-w-md text-center">
            <LoaderCircle size={28} className="mx-auto animate-spin text-emerald-600" />
            <h4 className="mt-3 text-sm font-bold text-slate-800">Checking data quality</h4>
            <p className="mt-1 text-xs text-slate-500">Reviewing dates, numbers, emails, phones, checkboxes, and picklists.</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
            </div>
          </div>
        </div>
      ) : dataValidationResult ? (
        <div className="p-5 lg:p-6">
          <div
            className={cx(
              "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              canContinueAfterDataValidation ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm", canContinueAfterDataValidation ? "text-emerald-700" : "text-rose-700")}>
                {canContinueAfterDataValidation ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </span>
              <div>
                <h4 className={cx("text-sm font-bold", canContinueAfterDataValidation ? "text-emerald-900" : "text-rose-900")}>
                  {canContinueAfterDataValidation ? "Data Validation Passed" : "Data Quality Issues Found"}
                </h4>
                <p className={cx("mt-1 text-xs", canContinueAfterDataValidation ? "text-emerald-700" : "text-rose-700")}>
                  {canContinueAfterDataValidation
                    ? "No data quality issues were found. The files are ready for transformation."
                    : dataValidationResult.error || `${dataValidationResult.total_issues} issue${dataValidationResult.total_issues === 1 ? "" : "s"} found. Review the table or download the validation report.`}
                </p>
              </div>
            </div>
            {hasDataValidationIssues && (
              <Button type="button" variant="danger" onClick={downloadValidationReport}>
                <Download size={14} />
                Download Validation Report
              </Button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricTile label="Total records" value={dataValidationResult.total_records} helper="Rows checked in source data" icon={Table2} />
            <MetricTile
              label="Total issues"
              value={dataValidationResult.total_issues}
              helper="Data quality issues found"
              icon={AlertTriangle}
              tone={dataValidationResult.total_issues === 0 ? "emerald" : "rose"}
            />
          </div>

          {hasDataValidationIssues && (
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
                    {dataValidationResult.issues.map((issue, index) => (
                      <tr key={`${issue.row}-${issue.field}-${index}`} className="hover:bg-slate-50">
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
      ) : (
        <div className="flex flex-col items-center justify-center px-5 py-9 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileCheck2 size={22} />
          </span>
          <h4 className="mt-3 text-sm font-bold text-slate-800">
            {canContinueAfterCleaning ? "Ready for data validation" : "Complete data cleaning first"}
          </h4>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            {canContinueAfterCleaning
              ? "Click Validate Data to check source values against the mapping logic rules."
              : "Data validation becomes available only after data cleaning has completed."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {canContinueAfterDataValidation ? (
            <CheckCircle2 size={15} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={15} className="text-slate-400" />
          )}
          <span>
            {canContinueAfterDataValidation
              ? "Data validation complete. Ready to transform."
              : "Resolve data quality issues before proceeding to transformation."}
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setActiveTab("Transformation")}
          disabled={!canContinueAfterDataValidation}
        >
          Next: Transformation
          <ArrowRight size={14} />
        </Button>
      </div>
    </section>
  );

  const renderTransformation = () => (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3.5 border-b border-slate-200 px-5 py-5 lg:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
          <Wand2 size={20} />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold text-slate-900">Transformation</h3>
            {canContinueAfterDataValidation ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">Ready</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending validation</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Preview the processed output and export the Salesforce-ready workbook.
            {cleanedSourceKey && " Transformation will use the cleaned source data."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 lg:p-6">
        {!canContinueAfterDataValidation && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-900">Validation required</p>
              <p className="mt-1 text-[11px] leading-5 text-amber-700">
                Complete schema validation, data cleaning, and data validation with zero issues before transforming.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
                <Eye size={17} />
              </span>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-slate-800">Preview transformed data</h4>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">Apply mapping logic and view the first 50 rows of the output inline.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full justify-center"
              onClick={handlePreview}
              disabled={!isContinueEnabled}
            >
              <Eye size={14} />
              Preview transformed data
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-violet-700 shadow-sm ring-1 ring-slate-200">
                <FileSpreadsheet size={17} />
              </span>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-slate-800">Transform and export</h4>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">Run full transformation and download the Salesforce-ready Excel workbook.</p>
              </div>
            </div>
            <Button
              type="button"
              className="mt-4 w-full justify-center"
              onClick={transformData}
              disabled={!canContinueAfterDataValidation || transformLoading}
            >
              {transformLoading ? <LoaderCircle size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {transformLoading ? "Transforming data…" : "Transform Data"}
            </Button>
          </div>
        </div>

        {transformError && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <XCircle size={17} className="shrink-0" />
            <span>{transformError}</span>
          </div>
        )}

        {previewError && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <XCircle size={17} className="shrink-0" />
            <span>{previewError}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {canContinueAfterDataValidation ? (
            <CheckCircle2 size={15} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={15} className="text-slate-400" />
          )}
          <span>
            {canContinueAfterDataValidation
              ? "Ready. Transform your data or continue to AI Mapping."
              : "Complete validation steps before continuing."}
          </span>
        </div>
        <Button
          type="button"
          variant="dark"
          onClick={() => router.push("/mapping")}
          disabled={!canContinueAfterDataValidation}
        >
          Continue to AI Mapping
          <ArrowRight size={15} />
        </Button>
      </div>
    </section>
  );

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
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[28px]">Validate, clean, and transform</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Run schema and data validation, apply cleaning rules, then export your Salesforce-ready workbook.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            {canContinueAfterDataValidation ? (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 size={17} />
                </span>
                <span className="text-xs font-bold text-slate-700">Ready to transform</span>
              </>
            ) : canContinueAfterCleaning ? (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Wrench size={17} />
                </span>
                <span className="text-xs font-bold text-slate-700">Data cleaned</span>
              </>
            ) : canContinueAfterSchema ? (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Wrench size={17} />
                </span>
                <span className="text-xs font-bold text-slate-700">Schema valid — run cleaning</span>
              </>
            ) : (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <ShieldCheck size={17} />
                </span>
                <span className="text-xs font-bold text-slate-700">Start with schema validation</span>
              </>
            )}
          </div>
        </header>

        {/* Tab bar */}
        <TabBar
          tabs={TABS}
          active={activeTab}
          schemaResult={schemaResult}
          cleaningResult={cleaningResult}
          dataValidationResult={dataValidationResult}
          onChange={setActiveTab}
        />

        {/* Tab content */}
        {activeTab === "Schema Validation" && renderSchemaValidation()}
        {activeTab === "Data Cleaning" && renderDataCleaning()}
        {activeTab === "Data Validation" && renderDataValidation()}
        {activeTab === "Transformation" && renderTransformation()}
      </div>

      {/* Preview loading overlay */}
      {isPreviewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white p-7 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <LoaderCircle size={27} className="animate-spin" />
            </span>
            <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">Preparing transformed preview</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">Applying mapping logic, Salesforce lookups, and output formatting.</p>
            <div className="mt-5 space-y-2 text-left text-xs">
              {["Files uploaded", "Schema context loaded", "Applying Salesforce mappings"].map((item, index) => (
                <div key={item} className={cx("flex items-center gap-2.5 rounded-lg px-3 py-2", index < 2 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
                  {index < 2 ? <Check size={14} strokeWidth={3} /> : <LoaderCircle size={14} className="animate-spin" />}
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {isShowingPreview && previewData && (
        <PreviewModal previewData={previewData as PreviewData} onClose={() => setIsShowingPreview(false)} />
      )}
    </div>
  );
}
