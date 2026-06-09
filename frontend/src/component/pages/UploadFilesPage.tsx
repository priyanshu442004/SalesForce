"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { useMigration } from "@/context/MigrationContext";
import type { UploadedFile } from "@/context/MigrationContext";

type FileSlot = "source" | "master" | "logic";

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
                <p className="mt-2 text-[11px] font-medium text-slate-500">Saving securely to the backend workspace.</p>
              </div>
            ) : isComplete ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                    <FileCheck2 size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-800">{file.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{file.size} - Ready for validation</span>
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
            <Button
              onClick={() => {
                const link = document.createElement("a");
                link.href = "http://localhost:8000/api/download-preview";
                link.setAttribute("download", "preview.xlsx");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
            >
              <Download size={15} />
              Export Excel
            </Button>
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

export default function UploadFilesPage() {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);
  const logicInputRef = useRef<HTMLInputElement>(null);
  const globalInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isShowingPreview, setIsShowingPreview] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaResult, setSchemaResult] = useState<SchemaResult | null>(null);
  const [dataValidationLoading, setDataValidationLoading] = useState(false);
  const [dataValidationResult, setDataValidationResult] = useState<DataValidationResult | null>(null);

  const {
    uploadedFiles,
    handleFileUpload,
    clearFile,
    isContinueEnabled,
    previewData,
    generatePreview,
    isPreviewLoading,
    previewError,
  } = useMigration();

  const inputRefs = {
    source: sourceInputRef,
    master: masterInputRef,
    logic: logicInputRef,
  };

  const resetValidationResults = () => {
    setSchemaResult(null);
    setDataValidationResult(null);
  };

  const uploadFiles = (files: FileList | null, slot?: FileSlot) => {
    resetValidationResults();
    handleFileUpload(files, slot);
  };

  const clearUploadedFile = (slot: FileSlot) => {
    resetValidationResults();
    clearFile(slot);
  };

  const uploadedCount = FILE_SLOTS.filter(({ slot }) => uploadedFiles[slot]?.completed).length;
  const canContinueAfterSchema =
    schemaResult?.schema_valid === true &&
    schemaResult.missing_fields.length === 0 &&
    schemaResult.additional_fields.length === 0;
  const canContinueAfterDataValidation =
    dataValidationResult?.success === true &&
    dataValidationResult.total_issues === 0;
  const hasDataValidationIssues =
    dataValidationResult?.success === true &&
    dataValidationResult.total_issues > 0;

  const downloadDiscrepancyReport = () => {
    if (!schemaResult) return;

    const rows = [
      ["Type", "Field Name"],
      ...schemaResult.missing_fields.map((field) => ["Missing", field]),
      ...schemaResult.additional_fields.map((field) => ["Additional", field]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schema_Discrepancies");
    XLSX.writeFile(workbook, "schema_discrepancy_report.xlsx");
  };

  const validateSchema = async () => {
    setSchemaResult(null);
    setDataValidationResult(null);
    setSchemaLoading(true);
    try {
      const resp = await fetch("http://localhost:8000/api/validate-schema", { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Schema validation failed");
      }
      const data = await resp.json();
      setSchemaResult(data);
    } catch (error) {
      console.error(error);
      setSchemaResult({
        schema_valid: false,
        source_field_count: 0,
        mapping_field_count: 0,
        matched_field_count: 0,
        missing_fields: [],
        additional_fields: [],
        error: String(error),
      });
    } finally {
      setSchemaLoading(false);
    }
  };

  const validateData = async () => {
    if (!canContinueAfterSchema) return;

    setDataValidationResult(null);
    setDataValidationLoading(true);
    try {
      const resp = await fetch("http://localhost:8000/api/validate-data", { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Data validation failed");
      }
      const data = await resp.json();
      setDataValidationResult(data);
    } catch (error) {
      console.error(error);
      setDataValidationResult({
        success: false,
        total_records: 0,
        total_issues: 0,
        issues: [],
        error: String(error),
      });
    } finally {
      setDataValidationLoading(false);
    }
  };

  const downloadValidationReport = () => {
    const link = document.createElement("a");
    link.href = "http://localhost:8000/api/download-data-validation-report";
    link.setAttribute("download", "data_validation_report.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

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
            onChange={(event) => uploadFiles(event.target.files, config.slot)}
          />
        ))}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
              <Sparkles size={14} />
              Migration setup
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[28px]">Prepare your migration files</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Upload the required workbooks, validate source fields against mapping logic, then continue once the schema is clean.
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
              onClear={() => clearUploadedFile(config.slot)}
            />
          ))}
        </section>

        <section
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (event.dataTransfer.files?.length) uploadFiles(event.dataTransfer.files);
          }}
          onClick={() => globalInputRef.current?.click()}
          className={cx(
            "flex cursor-pointer items-center gap-4 rounded-xl border border-dashed px-5 py-4 transition-all duration-200",
            isDragging ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-300 bg-white/80 hover:border-blue-300 hover:bg-blue-50/40"
          )}
        >
          <input ref={globalInputRef} type="file" multiple accept=".xlsx, .xls, .csv" className="hidden" onChange={(event) => uploadFiles(event.target.files)} />
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <CloudUpload size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">Drop all three files here to auto-sort</p>
            <p className="mt-0.5 text-xs text-slate-500">Excel or CSV files. Click to browse from your computer.</p>
          </div>
          <ChevronRight size={18} className="hidden text-slate-400 sm:block" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <ShieldCheck size={20} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-slate-900">Schema validation</h3>
                  {!schemaResult && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending</span>}
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
            <Button type="button" onClick={validateSchema} disabled={!isContinueEnabled || schemaLoading}>
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
                      {schemaResult.schema_valid ? "All required fields align. The files are ready for the next step." : schemaResult.error || "Review field differences or download the discrepancy report."}
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
                <MetricTile label="Discrepancies" value={schemaResult.missing_fields.length + schemaResult.additional_fields.length} helper="Missing or additional fields" icon={AlertTriangle} tone={schemaResult.schema_valid ? "slate" : "rose"} />
              </div>

              {!schemaResult.schema_valid && (schemaResult.missing_fields.length > 0 || schemaResult.additional_fields.length > 0) && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <DiscrepancyPanel title="Missing fields" fields={schemaResult.missing_fields} description="Required by mapping logic but absent from source data." />
                  <DiscrepancyPanel title="Additional fields" fields={schemaResult.additional_fields} description="Present in source data but not referenced by mapping logic." />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-9 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ShieldCheck size={22} />
              </span>
              <h4 className="mt-3 text-sm font-bold text-slate-800">{isContinueEnabled ? "Files ready for validation" : "Complete all uploads to validate"}</h4>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                {isContinueEnabled ? "Run schema validation to confirm field compatibility and surface any discrepancies." : "Schema validation becomes available after all three required files finish uploading."}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {canContinueAfterSchema ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertTriangle size={15} className="text-slate-400" />}
              <span>{canContinueAfterSchema ? "Validation complete. Ready to continue." : "Run schema validation and resolve discrepancies before continuing."}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  if (isContinueEnabled) {
                    try {
                      await generatePreview();
                      setIsShowingPreview(true);
                    } catch (error) {
                      console.error(error);
                    }
                  }
                }}
                disabled={!isContinueEnabled}
              >
                <Eye size={15} />
                Preview transformed data
              </Button>
              <Button type="button" variant="dark" onClick={validateData} disabled={!canContinueAfterSchema || dataValidationLoading}>
                {dataValidationLoading ? "Validating data" : "Continue to Data Validation"}
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <FileCheck2 size={20} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-slate-900">Data validation</h3>
                  {!dataValidationResult && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending</span>}
                  {canContinueAfterDataValidation && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">Passed</span>
                  )}
                  {dataValidationResult && !canContinueAfterDataValidation && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-100">Needs review</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Validate source values against mapping logic data types and allowed values.</p>
              </div>
            </div>
            <Button type="button" onClick={validateData} disabled={!canContinueAfterSchema || dataValidationLoading}>
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
                      {canContinueAfterDataValidation ? "No data quality issues were found. The files are ready for AI mapping." : dataValidationResult.error || `${dataValidationResult.total_issues} issue${dataValidationResult.total_issues === 1 ? "" : "s"} found. Review the table or download the validation report.`}
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
                <MetricTile label="Total issues" value={dataValidationResult.total_issues} helper="Data quality issues found" icon={AlertTriangle} tone={dataValidationResult.total_issues === 0 ? "emerald" : "rose"} />
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
              <h4 className="mt-3 text-sm font-bold text-slate-800">{canContinueAfterSchema ? "Ready for data validation" : "Complete schema validation first"}</h4>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                {canContinueAfterSchema ? "Continue to data validation to check source values against the mapping logic rules." : "Data validation becomes available only after schema validation has zero discrepancies."}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {canContinueAfterDataValidation ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertTriangle size={15} className="text-slate-400" />}
              <span>{canContinueAfterDataValidation ? "Data validation complete. Ready for AI mapping." : "Resolve data validation issues before continuing to the next step."}</span>
            </div>
            <Button type="button" variant="dark" onClick={() => canContinueAfterDataValidation && router.push("/mapping")} disabled={!canContinueAfterDataValidation}>
              Continue to AI Mapping
              <ArrowRight size={15} />
            </Button>
          </div>
        </section>

        {previewError && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <XCircle size={17} className="shrink-0" />
            <span>{previewError}</span>
          </div>
        )}
      </div>

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

      {isShowingPreview && previewData && <PreviewModal previewData={previewData as PreviewData} onClose={() => setIsShowingPreview(false)} />}
    </div>
  );
}
