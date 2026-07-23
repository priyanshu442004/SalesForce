"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Info,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { useMigration } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationSummary {
  total_records: number;
  total_columns: number;
  target_object: string;
  mapped_fields: number;
  import_mode: string;
}

interface ValidationCounts {
  valid: number;
  invalid: number;
  with_warnings: number;
  duplicates: number;
  required_missing: number;
  invalid_picklist: number;
  invalid_email: number;
  invalid_phone: number;
  invalid_date: number;
  invalid_numeric: number;
}

interface ValidationIssue {
  row: number;
  source_field: string;
  sf_field: string;
  sf_label: string;
  value: string;
  error_type: string;
  severity: "critical" | "warning";
  message: string;
  suggestion: string;
}

interface DuplicateGroup {
  type: string;
  sf_field: string;
  sf_label: string;
  value: string;
  rows: number[];
  total: number;
}

interface ValidationResult {
  summary: ValidationSummary;
  counts: ValidationCounts;
  errors: ValidationIssue[];
  total_errors: number;
  duplicates: DuplicateGroup[];
  total_duplicates: number;
  can_import: boolean;
  has_warnings: boolean;
  report_s3_key: string | null;
}

type IssueTab = "all" | "critical" | "warnings" | "required_missing" | "invalid_picklist" | "invalid_email" | "invalid_phone" | "invalid_date" | "invalid_numeric";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const ERROR_TYPE_META: Record<string, { label: string; color: "rose" | "amber" | "orange" }> = {
  required_missing:  { label: "Required",  color: "rose"   },
  invalid_picklist:  { label: "Picklist",  color: "rose"   },
  invalid_numeric:   { label: "Numeric",   color: "rose"   },
  invalid_date:      { label: "Date",      color: "amber"  },
  invalid_datetime:  { label: "Date/Time", color: "amber"  },
  invalid_email:     { label: "Email",     color: "orange" },
  invalid_phone:     { label: "Phone",     color: "orange" },
};

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PreImportValidationPage() {
  const router = useRouter();
  const {
    effectiveTargetSf,
    transformResult, importConfig, currentProject,
  } = useMigration();

  const sfAccessToken = effectiveTargetSf.accessToken;
  const sfInstanceUrl = effectiveTargetSf.instanceUrl;
  const sfUserEmail   = effectiveTargetSf.userEmail;

  // ── Validation state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── Issues table state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<IssueTab>("all");
  const [issuePage, setIssuePage] = useState(0);

  // ── Upload state ──────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Derived context values ────────────────────────────────────────────────
  const targetObject  = importConfig?.targetObject ?? null;
  const action        = importConfig?.action ?? "Insert";
  const batchSize     = importConfig?.batchSize ?? 200;
  const fieldMappings = importConfig?.fieldMappings ?? {};
  const matchingField = importConfig?.matchingField ?? null;
  const s3Key         = transformResult?.zipS3Key ?? transformResult?.outputs?.[0]?.transformedS3Key ?? null;

  // ── Filtered issues ───────────────────────────────────────────────────────
  const filteredIssues = useMemo(() => {
    if (!result) return [];
    const all = result.errors;
    switch (activeTab) {
      case "critical":  return all.filter(e => e.severity === "critical");
      case "warnings":  return all.filter(e => e.severity === "warning");
      default:          return activeTab === "all" ? all : all.filter(e => e.error_type === activeTab || e.error_type === activeTab + "_datetime");
    }
  }, [result, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / PAGE_SIZE));
  const pageIssues = filteredIssues.slice(issuePage * PAGE_SIZE, (issuePage + 1) * PAGE_SIZE);

  // Reset page when tab changes
  useEffect(() => { setIssuePage(0); }, [activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    if (!result) return {} as Record<string, number>;
    const all = result.errors;
    const typeCounts: Record<string, number> = {};
    all.forEach(e => { typeCounts[e.error_type] = (typeCounts[e.error_type] ?? 0) + 1; });
    return {
      all:              all.length,
      critical:         all.filter(e => e.severity === "critical").length,
      warnings:         all.filter(e => e.severity === "warning").length,
      required_missing: typeCounts["required_missing"] ?? 0,
      invalid_picklist: typeCounts["invalid_picklist"] ?? 0,
      invalid_email:    typeCounts["invalid_email"] ?? 0,
      invalid_phone:    typeCounts["invalid_phone"] ?? 0,
      invalid_date:     (typeCounts["invalid_date"] ?? 0) + (typeCounts["invalid_datetime"] ?? 0),
      invalid_numeric:  typeCounts["invalid_numeric"] ?? 0,
    };
  }, [result]);

  // ── Run validation ────────────────────────────────────────────────────────
  const runValidation = useCallback(async () => {
    if (!sfAccessToken || !sfInstanceUrl || !targetObject || !s3Key) return;
    setLoading(true);
    setValidationError(null);
    setResult(null);
    setActiveTab("all");
    setIssuePage(0);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/validate-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: sfAccessToken,
          instance_url: sfInstanceUrl,
          object_name: targetObject,
          s3_key: s3Key,
          field_mappings: fieldMappings,
          import_mode: action,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail?.message ?? body?.detail ?? `Validation failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Validation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [sfAccessToken, sfInstanceUrl, targetObject, s3Key, fieldMappings, action]);

  // Auto-run on mount
  useEffect(() => { runValidation(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proceed to Import — starts a tracked import job ──────────────────────
  const handleProceedToImport = async () => {
    if (!sfAccessToken || !sfInstanceUrl || !targetObject || !s3Key) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/import-jobs/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: sfAccessToken,
          instance_url: sfInstanceUrl,
          sf_object: targetObject,
          s3_key: s3Key,
          import_mode: action,
          matching_field: matchingField,
          batch_size: batchSize,
          project_name: currentProject?.name ?? "",
          sf_account: sfUserEmail ?? "",
          field_mappings: fieldMappings,
          validation_report_s3_key: result?.report_s3_key ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail?.message ?? body?.detail ?? `Failed to start import (${res.status})`);
      }
      const { job_id } = await res.json();
      router.push(`/import-jobs?job=${job_id}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to start import.");
      setUploading(false);
    }
  };

  const downloadValidationReport = () => {
    if (!result?.report_s3_key) return;
    const link = document.createElement("a");
    link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(result.report_s3_key)}`;
    link.setAttribute("download", "Pre_Import_Validation.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // ── Guard: missing context ────────────────────────────────────────────────
  if (!importConfig?.targetObject || !s3Key) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center bg-slate-50/80 dark:bg-slate-900">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
          <ShieldCheck size={26} />
        </span>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No import configuration found</h3>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Configure your field mappings first, then return here to validate your data.
        </p>
        <button
          onClick={() => router.push("/import-configuration")}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={14} />Go to Import Configuration
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-5 sm:px-7 lg:px-9 lg:py-6">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/import-configuration")}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 transition-colors hover:text-blue-700 dark:hover:text-blue-400"
          >
            <ArrowLeft size={13} />Back to Import Configuration
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-slate-100 sm:text-2xl">
                Pre-Import Validation
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Full data scan for{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {targetObject}
                </span>
                {sfUserEmail && ` · Connected as ${sfUserEmail}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {result?.report_s3_key && (
                <button
                  type="button"
                  onClick={downloadValidationReport}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Download size={13} />Download Report
                </button>
              )}
              <button
                type="button"
                onClick={runValidation}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleProceedToImport}
                disabled={!result?.can_import || uploading || loading}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors",
                  result?.can_import && !uploading && !loading
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                )}
              >
                {uploading
                  ? <><LoaderCircle size={13} className="animate-spin" />Starting…</>
                  : <><Zap size={13} />Proceed to Import</>}
              </button>
            </div>
          </div>
        </header>

        {/* ── Upload error ──────────────────────────────────────────────────── */}
        {uploadError && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
            <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="flex flex-1 items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">Import failed</p>
                <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-300">{uploadError}</p>
              </div>
              <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
                <XCircle size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Loading state ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-8 py-16 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-800/30">
              <LoaderCircle size={28} className="animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Scanning dataset…
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Checking required fields, data types, picklist values, and duplicates
              </p>
            </div>
            {/* Fake progress bar */}
            <div className="w-64 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* ── Validation error ──────────────────────────────────────────────── */}
        {validationError && !loading && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-5">
            <XCircle size={18} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Validation failed</p>
              <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{validationError}</p>
              <button onClick={runValidation} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors">
                <RefreshCw size={12} />Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {result && !loading && (
          <>
            {/* Decision banner */}
            {result.can_import && !result.has_warnings ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Ready for Import</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    All {result.summary.total_records.toLocaleString()} records passed validation. No issues detected.
                  </p>
                </div>
              </div>
            ) : result.can_import && result.has_warnings ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Import with Warnings</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      No critical errors found. {result.counts.with_warnings} record{result.counts.with_warnings !== 1 ? "s" : ""} have warnings that
                      won&apos;t block import but may indicate data quality issues.
                    </p>
                  </div>
                  <button
                    onClick={handleProceedToImport}
                    disabled={uploading}
                    className="mt-2 sm:mt-0 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    <Zap size={12} />Import Anyway
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 px-5 py-4">
                <XCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Cannot Import — Critical Errors Found</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                    {result.counts.invalid.toLocaleString()} record{result.counts.invalid !== 1 ? "s" : ""} have critical issues that must be
                    resolved before importing. Fix the data or update the field mappings, then re-validate.
                  </p>
                </div>
              </div>
            )}

            {/* Summary + Counts grid */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Dataset Summary */}
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dataset Summary</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {[
                    { label: "Total Records",    value: result.summary.total_records.toLocaleString() },
                    { label: "Total Columns",    value: result.summary.total_columns.toString() },
                    { label: "Target Object",    value: result.summary.target_object },
                    { label: "Mapped Fields",    value: result.summary.mapped_fields.toString() },
                    { label: "Import Mode",      value: result.summary.import_mode },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Record Analysis */}
              <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Record Analysis</h3>
                </div>

                {/* Top 3 big numbers */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700">
                  {[
                    { label: "Valid Records",  value: result.counts.valid,         color: "text-emerald-700 dark:text-emerald-400" },
                    { label: "Invalid Records",value: result.counts.invalid,       color: result.counts.invalid > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-400" },
                    { label: "With Warnings",  value: result.counts.with_warnings, color: result.counts.with_warnings > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-5 gap-1">
                      <span className={cx("text-2xl font-bold tabular-nums", color)}>{value.toLocaleString()}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Breakdown grid */}
                <div className="grid grid-cols-2 gap-0 divide-y divide-x divide-slate-100 dark:divide-slate-700 sm:grid-cols-3 lg:grid-cols-3">
                  {[
                    { label: "Required Missing", value: result.counts.required_missing, color: "rose" },
                    { label: "Invalid Picklist",  value: result.counts.invalid_picklist, color: "rose" },
                    { label: "Invalid Numeric",   value: result.counts.invalid_numeric,  color: "rose" },
                    { label: "Invalid Email",     value: result.counts.invalid_email,    color: "orange" },
                    { label: "Invalid Phone",     value: result.counts.invalid_phone,    color: "amber" },
                    { label: "Invalid Date",      value: result.counts.invalid_date,     color: "amber" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-4 gap-0.5">
                      <span className={cx(
                        "text-lg font-bold tabular-nums",
                        value > 0 && color === "rose"   && "text-rose-700 dark:text-rose-400",
                        value > 0 && color === "orange" && "text-orange-700 dark:text-orange-400",
                        value > 0 && color === "amber"  && "text-amber-700 dark:text-amber-400",
                        value === 0 && "text-slate-300 dark:text-slate-600",
                      )}>
                        {value.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 text-center leading-tight px-2">{label}</span>
                    </div>
                  ))}
                </div>

                {result.counts.duplicates > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-5 py-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Duplicate Groups</span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                      {result.counts.duplicates}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Issues table ────────────────────────────────────────────── */}
            {result.total_errors > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Validation Issues</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {result.total_errors.toLocaleString()} total issue{result.total_errors !== 1 ? "s" : ""}
                      {result.total_errors > 1000 && " · Showing first 1,000"}
                    </p>
                  </div>
                  {result.report_s3_key && (
                    <button onClick={downloadValidationReport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <Download size={12} />Full Report
                    </button>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-2.5">
                  {(["all", "critical", "warnings", "required_missing", "invalid_picklist", "invalid_email", "invalid_phone", "invalid_date", "invalid_numeric"] as IssueTab[]).map(tab => {
                    const count = tabCounts[tab] ?? 0;
                    if (tab !== "all" && tab !== "critical" && tab !== "warnings" && count === 0) return null;
                    const isActive = activeTab === tab;
                    const tabLabel = tab === "all" ? "All" : tab === "critical" ? "Critical" : tab === "warnings" ? "Warnings"
                      : (ERROR_TYPE_META[tab]?.label ?? tab.replace(/_/g, " "));
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cx(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors",
                          isActive ? "bg-blue-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                      >
                        {tabLabel}
                        <span className={cx(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[3rem_1fr_1fr_1.5fr_2fr_1.5fr_5rem] gap-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <span>Row</span>
                  <span>Source Field</span>
                  <span>SF Field</span>
                  <span>Current Value</span>
                  <span>Issue</span>
                  <span>Suggested Fix</span>
                  <span>Severity</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {pageIssues.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                      <Info size={16} />No issues in this category
                    </div>
                  ) : pageIssues.map((issue, i) => (
                    <div
                      key={i}
                      className={cx(
                        "grid grid-cols-[3rem_1fr_1fr_1.5fr_2fr_1.5fr_5rem] gap-2 items-start px-4 py-3",
                        issue.severity === "critical" ? "hover:bg-rose-50/30 dark:hover:bg-rose-900/10" : "hover:bg-amber-50/30 dark:hover:bg-amber-900/10"
                      )}
                    >
                      <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 pt-0.5">{issue.row}</span>
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate pt-0.5" title={issue.source_field}>{issue.source_field}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate pt-0.5" title={issue.sf_label}>{issue.sf_label}</span>
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate pt-0.5" title={issue.value}>
                        {issue.value || <em className="text-slate-300 dark:text-slate-600 not-italic">(empty)</em>}
                      </span>
                      <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{issue.message}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{issue.suggestion}</span>
                      <span>
                        <span className={cx(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          issue.severity === "critical"
                            ? "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800/30"
                            : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/30"
                        )}>
                          {issue.severity === "critical" ? "Critical" : "Warning"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-5 py-3">
                    <span className="text-[11px] text-slate-400">
                      Page {issuePage + 1} of {totalPages} · {filteredIssues.length} issues
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIssuePage(p => Math.max(0, p - 1))}
                        disabled={issuePage === 0}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setIssuePage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={issuePage === totalPages - 1}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Duplicates section ───────────────────────────────────────── */}
            {result.duplicates.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800/40 bg-white dark:bg-slate-800 shadow-sm">
                <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Copy size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Duplicate Records Detected</h3>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        {result.total_duplicates} duplicate group{result.total_duplicates !== 1 ? "s" : ""}
                        {result.total_duplicates > 100 && " · Showing first 100"} ·
                        Importing duplicates will create multiple records for the same entity.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.report_s3_key && (
                      <button
                        onClick={downloadValidationReport}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                      >
                        <Download size={11} />Download Duplicate Report
                      </button>
                    )}
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1.5fr_1fr_1.5fr_2fr_5rem] gap-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <span>Type</span>
                  <span>Field</span>
                  <span>Duplicate Value</span>
                  <span>Affected Rows</span>
                  <span className="text-right">Count</span>
                </div>

                <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-72 overflow-y-auto">
                  {result.duplicates.map((d, i) => (
                    <div key={i} className="grid grid-cols-[1.5fr_1fr_1.5fr_2fr_5rem] gap-3 items-start px-5 py-3 hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/30 w-fit">
                        {d.type}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">{d.sf_label}</span>
                      <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate" title={d.value}>{d.value}</span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Rows {d.rows.slice(0, 8).join(", ")}{d.total > 8 ? ` +${d.total - 8} more` : ""}
                      </span>
                      <span className="text-right text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums">{d.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── No issues state ──────────────────────────────────────────── */}
            {result.total_errors === 0 && result.duplicates.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-8 py-12 text-center">
                <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">All records passed validation</p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    No required field violations, invalid types, picklist errors, or duplicates detected.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Bottom action bar ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
          <button
            type="button"
            onClick={() => router.push("/import-configuration")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={13} />Back to Mapping
          </button>

          <div className="flex items-center gap-2">
            {result?.report_s3_key && (
              <button
                type="button"
                onClick={downloadValidationReport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Download size={13} />Download Report
              </button>
            )}
            <button
              type="button"
              onClick={runValidation}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh Validation
            </button>
            <button
              type="button"
              onClick={handleProceedToImport}
              disabled={!result?.can_import || uploading || loading}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors",
                result?.can_import && !uploading && !loading
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              )}
            >
              {uploading
                ? <><LoaderCircle size={13} className="animate-spin" />Importing…</>
                : <><Zap size={13} />Proceed to Import</>}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
