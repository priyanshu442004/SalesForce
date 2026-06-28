"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Info,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { useMigration } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

interface ImportJob {
  job_id: string;
  project_name: string;
  sf_object: string;
  sf_account: string;
  import_mode: string;
  s3_key: string;
  batch_size: number;
  status: JobStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  total_records: number;
  successful: number;
  failed: number;
  skipped: number;
  report_s3_key: string | null;
  success_report_s3_key: string | null;
  failed_report_s3_key: string | null;
  validation_report_s3_key: string | null;
  error_message: string | null;
  current_batch: number;
  total_batches: number;
  progress_percent: number;
  sf_bulk_job_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportJobDetail extends ImportJob {
  field_mappings: Record<string, string>;
  failed_records: Array<Record<string, string>>;
  batch_details: Array<{
    poll: number;
    state: string;
    processed: number;
    failed: number;
    elapsed_s: number;
    timestamp: string;
    sf_error?: string;
  }>;
}

interface JobStats {
  total: number;
  completed: number;
  running: number;
  failed: number;
  queued: number;
  cancelled: number;
  records_imported: number;
  avg_duration: number;
}

type DetailTab = "summary" | "config" | "stats" | "batches" | "failed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function fmtDuration(sec: number | null): string {
  if (sec == null || sec === 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.endsWith("Z") ? "" : "Z")).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortId(id: string): string {
  return id.split("-")[0].toUpperCase();
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<JobStatus, { label: string; dot: string; chip: string }> = {
  queued:                  { label: "Queued",                dot: "bg-slate-400",              chip: "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-600" },
  running:                 { label: "Running",               dot: "bg-blue-500 animate-pulse", chip: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-800/40" },
  completed:               { label: "Completed",             dot: "bg-emerald-500",            chip: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800/40" },
  completed_with_warnings: { label: "Completed with Warnings", dot: "bg-amber-500",           chip: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800/40" },
  failed:                  { label: "Failed",                dot: "bg-rose-500",              chip: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 ring-rose-200 dark:ring-rose-800/40" },
  cancelled:               { label: "Cancelled",             dot: "bg-slate-400",              chip: "bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-600" },
};

function StatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 whitespace-nowrap",
      cfg.chip,
    )}>
      <span className={cx("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  label, value, sub, color = "slate",
}: {
  label: string; value: string | number; sub?: string; color?: "slate" | "emerald" | "blue" | "rose" | "amber";
}) {
  const valueColor = {
    slate:   "text-slate-900 dark:text-slate-100",
    emerald: "text-emerald-700 dark:text-emerald-400",
    blue:    "text-blue-700 dark:text-blue-400",
    rose:    "text-rose-700 dark:text-rose-400",
    amber:   "text-amber-700 dark:text-amber-400",
  }[color];
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{label}</span>
      <span className={cx("text-2xl font-bold tabular-nums leading-none", valueColor)}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {sub && <span className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live progress for running jobs (shown in table row)
// ---------------------------------------------------------------------------

function JobProgress({ job }: { job: ImportJob }) {
  const pct       = Math.min(100, Math.max(0, job.progress_percent ?? 0));
  const processed = job.total_records
    ? Math.round((pct / 100) * job.total_records)
    : 0;

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-36 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">{Math.round(pct)}%</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
        {job.total_records > 0
          ? <span>{processed.toLocaleString()} / {job.total_records.toLocaleString()} records</span>
          : <span className="italic">Processing…</span>}
        {job.current_batch > 0 && (
          <span className="text-slate-300 dark:text-slate-600">·</span>
        )}
        {job.current_batch > 0 && <span>Poll #{job.current_batch}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Detail Drawer
// ---------------------------------------------------------------------------

function JobDetailDrawer({
  job,
  onClose,
  onRetry,
  onCancel,
  sfAccessToken,
  sfInstanceUrl,
}: {
  job: ImportJobDetail;
  onClose: () => void;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  sfAccessToken: string | null;
  sfInstanceUrl: string | null;
}) {
  const [tab, setTab] = useState<DetailTab>("summary");
  const [failedPage, setFailedPage] = useState(0);
  const FAILED_PAGE = 25;

  const failedCols = useMemo(() => {
    if (!job.failed_records.length) return [];
    const cols = Object.keys(job.failed_records[0]).filter(k => k !== "_sf_error");
    return cols.slice(0, 6); // cap columns shown in table
  }, [job.failed_records]);

  const failedSlice = job.failed_records.slice(failedPage * FAILED_PAGE, (failedPage + 1) * FAILED_PAGE);
  const failedPages = Math.max(1, Math.ceil(job.failed_records.length / FAILED_PAGE));

  const downloadFile = (s3Key: string, filename: string) => {
    const a = document.createElement("a");
    a.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(s3Key)}`;
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const canRetry = job.status === "failed" || job.status === "completed_with_warnings";
  const canCancel = job.status === "queued" || job.status === "running";
  const isRunning = job.status === "running" || job.status === "queued";

  const TABS: { id: DetailTab; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "config",  label: "Configuration" },
    { id: "stats",   label: "Statistics" },
    { id: "batches", label: "Batch Details" },
    { id: "failed",  label: `Failed Records${job.failed > 0 ? ` (${job.failed})` : ""}` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-200 dark:border-slate-700 px-6 py-5 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {job.project_name || "Unnamed Project"}
              </h3>
              <StatusBadge status={job.status} />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {job.job_id}
            </p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{job.sf_object}</span>
              <span>·</span>
              <span>{job.import_mode}</span>
              {job.sf_account && <><span>·</span><span>{job.sf_account}</span></>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canCancel && (
              <button
                onClick={() => onCancel(job.job_id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <XCircle size={12} />Cancel
              </button>
            )}
            {canRetry && sfAccessToken && (
              <button
                onClick={() => onRetry(job.job_id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-semibold text-white transition-colors"
              >
                <RotateCcw size={12} />Retry Failed ({job.failed.toLocaleString()})
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <XCircle size={16} />
            </button>
          </div>
        </div>

        {/* Running progress */}
        {isRunning && (
          <div className="border-b border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-900/10 px-6 py-3">
            <JobProgress job={job} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors",
                tab === t.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Summary ── */}
          {tab === "summary" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Status",      value: STATUS_CONFIG[job.status]?.label ?? job.status },
                  { label: "SF Object",   value: job.sf_object || "—" },
                  { label: "Project",     value: job.project_name || "—" },
                  { label: "SF Account",  value: job.sf_account || "—" },
                  { label: "Started",     value: fmtDate(job.started_at) },
                  { label: "Completed",   value: fmtDate(job.completed_at) },
                  { label: "Duration",    value: fmtDuration(job.duration_seconds) },
                  { label: "SF Bulk Job", value: job.sf_bulk_job_id ? job.sf_bulk_job_id.split("-")[0] : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-slate-100 dark:border-slate-700 px-4 py-3">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{label}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-800 dark:text-slate-200 break-all">{value}</span>
                  </div>
                ))}
              </div>

              {job.error_message && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
                  <XCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">Error</p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 font-mono">{job.error_message}</p>
                  </div>
                </div>
              )}

              {/* Report download buttons */}
              <div className="flex flex-wrap gap-2">
                {job.success_report_s3_key && (
                  <button
                    onClick={() => downloadFile(job.success_report_s3_key!, `${job.sf_object}_Import_Success.csv`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                  >
                    <Download size={13} />Success CSV
                  </button>
                )}
                {job.failed_report_s3_key && (
                  <button
                    onClick={() => downloadFile(job.failed_report_s3_key!, `${job.sf_object}_Import_Failed.csv`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                  >
                    <Download size={13} />Failed CSV
                  </button>
                )}
                {job.validation_report_s3_key && (
                  <button
                    onClick={() => downloadFile(job.validation_report_s3_key!, "Validation_Report.xlsx")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ShieldCheck size={13} />Validation Report
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Configuration ── */}
          {tab === "config" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Import Mode",    value: job.import_mode },
                  { label: "Batch Size",     value: String(job.batch_size) },
                  { label: "Total Batches",  value: String(job.total_batches) },
                  { label: "SF Object",      value: job.sf_object },
                  { label: "SF Account",     value: job.sf_account || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-slate-100 dark:border-slate-700 px-4 py-3">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-800 dark:text-slate-200">{value}</span>
                  </div>
                ))}
              </div>

              {Object.keys(job.field_mappings).length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Field Mappings ({Object.keys(job.field_mappings).length})
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_4px_1fr] max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
                    {Object.entries(job.field_mappings).slice(0, 50).map(([src, sf]) => (
                      <React.Fragment key={src}>
                        <span className="px-4 py-2 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">{src}</span>
                        <span className="bg-slate-100 dark:bg-slate-700" />
                        <span className="px-4 py-2 text-[11px] font-mono text-blue-700 dark:text-blue-400 truncate">{sf ?? "—"}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Statistics ── */}
          {tab === "stats" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Records",  value: job.total_records,  color: "slate"   as const },
                  { label: "Successful",     value: job.successful,     color: "emerald" as const },
                  { label: "Failed",         value: job.failed,         color: job.failed > 0 ? "rose" as const : "slate" as const },
                  { label: "Skipped",        value: job.skipped,        color: "amber"   as const },
                  { label: "Duration",       value: fmtDuration(job.duration_seconds), color: "slate" as const },
                  { label: "Success Rate",   value: job.total_records > 0
                      ? `${Math.round((job.successful / job.total_records) * 100)}%`
                      : "—",                                            color: "emerald" as const },
                ].map(({ label, value, color }) => {
                  const textColor = {
                    slate:   "text-slate-900 dark:text-slate-100",
                    emerald: "text-emerald-700 dark:text-emerald-400",
                    rose:    "text-rose-700 dark:text-rose-400",
                    amber:   "text-amber-700 dark:text-amber-400",
                  }[color];
                  return (
                    <div key={label} className="flex flex-col gap-1 rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-4">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
                      <span className={cx("text-xl font-bold tabular-nums", textColor)}>
                        {typeof value === "number" ? value.toLocaleString() : value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Success rate bar */}
              {job.total_records > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Import Success Rate</span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {Math.round((job.successful / job.total_records) * 100)}%
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(job.successful / job.total_records) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{job.successful.toLocaleString()} succeeded</span>
                    <span>{job.failed.toLocaleString()} failed</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Batch Details ── */}
          {tab === "batches" && (
            <>
              {job.batch_details.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                  <Info size={20} />
                  <span className="text-sm">No batch polling data yet.</span>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-[3rem_5rem_6rem_5rem_5rem_5rem] gap-0 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span>Poll</span>
                    <span>State</span>
                    <span>Processed</span>
                    <span>Failed</span>
                    <span>Elapsed</span>
                    <span>Time</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
                    {[...job.batch_details].reverse().map((bd, i) => (
                      <div key={i} className="divide-y divide-slate-50 dark:divide-slate-700/30">
                        <div className="grid grid-cols-[3rem_5rem_6rem_5rem_5rem_5rem] gap-0 items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400">#{bd.poll}</span>
                          <span className={cx(
                            "text-[10px] font-semibold",
                            bd.state === "JobComplete" ? "text-emerald-600"
                            : bd.state === "InProgress" ? "text-blue-600"
                            : bd.state === "Failed" || bd.state === "Aborted" ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-500"
                          )}>
                            {bd.state === "JobComplete" ? "Complete" : bd.state === "InProgress" ? "Running" : bd.state}
                          </span>
                          <span className="text-[11px] tabular-nums text-slate-700 dark:text-slate-300">{bd.processed.toLocaleString()}</span>
                          <span className={cx("text-[11px] tabular-nums", bd.failed > 0 ? "text-rose-600" : "text-slate-400")}>{bd.failed}</span>
                          <span className="text-[11px] tabular-nums text-slate-500">{bd.elapsed_s}s</span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {bd.timestamp ? new Date(bd.timestamp + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                          </span>
                        </div>
                        {bd.sf_error && (
                          <div className="px-4 pb-2.5 pt-1">
                            <p className="text-[11px] font-mono text-rose-600 dark:text-rose-400 break-words">{bd.sf_error}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Failed Records ── */}
          {tab === "failed" && (
            <>
              {job.failed_records.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span className="text-sm">No failed records.</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {job.failed_records.length.toLocaleString()} failed record{job.failed_records.length !== 1 ? "s" : ""}
                      {failedCols.length > 0 && ` · showing ${failedCols.length} of ${Object.keys(job.failed_records[0]).length - 1} columns`}
                    </p>
                    <div className="flex items-center gap-2">
                      {job.failed_report_s3_key && (
                        <button
                          onClick={() => downloadFile(job.failed_report_s3_key!, `${job.sf_object}_Import_Failed.csv`)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                        >
                          <Download size={11} />Download Failed CSV
                        </button>
                      )}
                      {canRetry && sfAccessToken && (
                        <button
                          onClick={() => onRetry(job.job_id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
                        >
                          <RotateCcw size={11} />Retry {job.failed_records.length} Records
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    {/* Column headers */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                          <tr>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 w-10">#</th>
                            {failedCols.map(col => (
                              <th key={col} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 max-w-[120px]">
                                <span className="truncate block">{col}</span>
                              </th>
                            ))}
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-rose-500">SF Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                          {failedSlice.map((row, i) => (
                            <tr key={i} className="hover:bg-rose-50/30 dark:hover:bg-rose-900/10">
                              <td className="px-3 py-2 text-slate-400 font-mono tabular-nums">{failedPage * FAILED_PAGE + i + 1}</td>
                              {failedCols.map(col => (
                                <td key={col} className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[120px]">
                                  <span className="truncate block font-mono text-[10px]">{String(row[col] ?? "")}</span>
                                </td>
                              ))}
                              <td className="px-3 py-2 text-rose-600 dark:text-rose-400 text-[11px] max-w-[200px]">
                                <span className="truncate block">{row["_sf_error"] ?? "—"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {failedPages > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Page {failedPage + 1} of {failedPages}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setFailedPage(p => Math.max(0, p - 1))} disabled={failedPage === 0}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors">
                          <ChevronLeft size={13} />
                        </button>
                        <button onClick={() => setFailedPage(p => Math.min(failedPages - 1, p + 1))} disabled={failedPage === failedPages - 1}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors">
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function ImportJobsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { sfAccessToken, sfInstanceUrl } = useMigration();

  // ── Data state ─────────────────────────────────────────────────────────────
  const [jobs,    setJobs]    = useState<ImportJob[]>([]);
  const [stats,   setStats]   = useState<JobStats | null>(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Detail drawer ──────────────────────────────────────────────────────────
  const [detailJob,     setDetailJob]     = useState<ImportJobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerOpen,    setDrawerOpen]    = useState(false);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,     setSearch]     = useState("");
  const [statusF,    setStatusF]    = useState("");
  const [projectF,   setProjectF]   = useState("");
  const [objectF,    setObjectF]    = useState("");
  const [accountF,   setAccountF]   = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [page,       setPage]       = useState(0);

  // ── Action state ───────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionError,   setActionError]   = useState<string | null>(null);

  // ── Fetch jobs list ────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (search)   params.set("search",     search);
    if (statusF)  params.set("status",     statusF);
    if (projectF) params.set("project",    projectF);
    if (objectF)  params.set("sf_object",  objectF);
    if (accountF) params.set("sf_account", accountF);
    if (dateFrom) params.set("date_from",  dateFrom);
    if (dateTo)   params.set("date_to",    dateTo);

    try {
      const [jobsRes, statsRes] = await Promise.all([
        fetch(`${NEXT_PUBLIC_API_URL}/import-jobs?${params}`),
        fetch(`${NEXT_PUBLIC_API_URL}/import-jobs/stats`),
      ]);
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs ?? []);
        setTotal(data.total ?? 0);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch { /* network error — silently ignore for background polls */ }
    finally { setLoading(false); }
  }, [page, search, statusF, projectF, objectF, accountF, dateFrom, dateTo]);

  // ── Fetch job detail ───────────────────────────────────────────────────────
  const fetchDetail = useCallback(async (jobId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/import-jobs/${jobId}`);
      if (res.ok) {
        setDetailJob(await res.json());
        setDrawerOpen(true);
      }
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  }, []);

  // ── Initial load + filter changes ─────────────────────────────────────────
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ── Auto-open job from query param ────────────────────────────────────────
  const jobParam = searchParams.get("job");
  const handledParam = useRef<string | null>(null);
  useEffect(() => {
    if (jobParam && jobParam !== handledParam.current) {
      handledParam.current = jobParam;
      fetchDetail(jobParam);
    }
  }, [jobParam, fetchDetail]);

  // ── Auto-download reports when the param job reaches a terminal state ─────
  const autoDownloadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!detailJob || !jobParam) return;
    if (detailJob.job_id !== jobParam) return;
    const terminal = ["completed", "completed_with_warnings", "failed"];
    if (!terminal.includes(detailJob.status)) return;
    if (autoDownloadedFor.current === jobParam) return;
    autoDownloadedFor.current = jobParam;

    const sf_object = detailJob.sf_object ?? "Import";
    if (detailJob.success_report_s3_key) {
      const a = document.createElement("a");
      a.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(detailJob.success_report_s3_key)}`;
      a.setAttribute("download", `${sf_object}_Import_Success.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    if (detailJob.failed_report_s3_key) {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(detailJob.failed_report_s3_key!)}`;
        a.setAttribute("download", `${sf_object}_Import_Failed.csv`);
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, 500);
    }
  }, [detailJob, jobParam]);

  // ── Live polling when jobs are running ────────────────────────────────────
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === "running" || j.status === "queued");
    if (!hasActive) return;

    const id = setInterval(async () => {
      await fetchJobs(true);
      // Also refresh detail if open and active
      if (detailJob && (detailJob.status === "running" || detailJob.status === "queued")) {
        try {
          const res = await fetch(`${NEXT_PUBLIC_API_URL}/import-jobs/${detailJob.job_id}`);
          if (res.ok) setDetailJob(await res.json());
        } catch { /* ignore */ }
      }
    }, 3000);

    return () => clearInterval(id);
  }, [jobs, detailJob, fetchJobs]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCancel = async (jobId: string) => {
    setActionLoading(p => ({ ...p, [jobId]: true }));
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/import-jobs/${jobId}/cancel`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? "Cancel failed");
      await fetchJobs(true);
      if (detailJob?.job_id === jobId) await fetchDetail(jobId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setActionLoading(p => ({ ...p, [jobId]: false }));
    }
  };

  const handleRetry = async (jobId: string) => {
    if (!sfAccessToken || !sfInstanceUrl) {
      setActionError("Connect to Salesforce to retry failed records.");
      return;
    }
    setActionLoading(p => ({ ...p, [jobId]: true }));
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/import-jobs/${jobId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: sfAccessToken, instance_url: sfInstanceUrl }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? "Retry failed");
      const { job_id: newId } = await res.json();
      setDrawerOpen(false);
      await fetchJobs(true);
      await fetchDetail(newId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setActionLoading(p => ({ ...p, [jobId]: false }));
    }
  };

  const downloadFile = (s3Key: string, filename: string) => {
    const a = document.createElement("a");
    a.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(s3Key)}`;
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-5 sm:px-7 lg:px-9 lg:py-6">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-slate-100 sm:text-2xl">
              Import Jobs
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Monitor every Salesforce import — live progress, results, and retry.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => fetchJobs()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => router.push("/import-configuration")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <Zap size={13} />New Import
            </button>
          </div>
        </header>

        {/* ── Action error ──────────────────────────────────────────────────── */}
        {actionError && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 px-4 py-3">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <span className="text-xs text-rose-800 dark:text-rose-200 flex-1">{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-600"><XCircle size={14} /></button>
          </div>
        )}

        {/* ── Metric cards ──────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Total Jobs"        value={stats.total}            color="slate" />
            <MetricCard label="Completed"         value={stats.completed}        color="emerald" />
            <MetricCard label="Running"           value={stats.running}          color="blue" sub={stats.queued > 0 ? `${stats.queued} queued` : undefined} />
            <MetricCard label="Failed"            value={stats.failed}           color={stats.failed > 0 ? "rose" : "slate"} />
            <MetricCard label="Records Imported"  value={stats.records_imported} color="slate" />
            <MetricCard label="Avg Import Time"   value={fmtDuration(stats.avg_duration)} color="slate" />
          </div>
        )}

        {/* ── Filters & Search ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search job ID, project, object…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 pl-8 pr-3 text-xs outline-none placeholder-slate-400 text-slate-800 dark:text-slate-200 focus:border-blue-400 transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusF}
              onChange={e => { setStatusF(e.target.value); setPage(0); }}
              className="appearance-none rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 pl-3 pr-7 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="completed_with_warnings">With Warnings</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Project filter */}
          <input
            type="text"
            value={projectF}
            onChange={e => { setProjectF(e.target.value); setPage(0); }}
            placeholder="Project…"
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-700 dark:text-slate-300 outline-none placeholder-slate-400 w-28 focus:border-blue-400 transition-colors"
          />

          {/* Object filter */}
          <input
            type="text"
            value={objectF}
            onChange={e => { setObjectF(e.target.value); setPage(0); }}
            placeholder="SF Object…"
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-700 dark:text-slate-300 outline-none placeholder-slate-400 w-28 focus:border-blue-400 transition-colors"
          />

          {/* Date range */}
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-700 dark:text-slate-300 outline-none w-36"
          />
          <span className="text-slate-400 text-xs">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-700 dark:text-slate-300 outline-none w-36"
          />

          {/* Clear */}
          {(search || statusF || projectF || objectF || accountF || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearch(""); setStatusF(""); setProjectF(""); setObjectF("");
                setAccountF(""); setDateFrom(""); setDateTo(""); setPage(0);
              }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Jobs table ────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">

          {/* Table header */}
          <div className="grid grid-cols-[7rem_1fr_1fr_9rem_7rem_6rem_6rem_5rem_5rem_7rem] gap-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            <span>Job ID</span>
            <span>Project</span>
            <span>Object</span>
            <span>Status</span>
            <span>Started</span>
            <span>Duration</span>
            <span>Records</span>
            <span>Success</span>
            <span>Failed</span>
            <span>Actions</span>
          </div>

          {/* Loading */}
          {loading && jobs.length === 0 && (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <LoaderCircle size={20} className="animate-spin" />
              <span className="text-sm">Loading import jobs…</span>
            </div>
          )}

          {/* Empty */}
          {!loading && jobs.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400">
                <FileText size={24} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No import jobs found</p>
                <p className="text-xs text-slate-400 mt-1">Start a new import from the Import Configuration page.</p>
              </div>
              <button
                onClick={() => router.push("/import-configuration")}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Zap size={12} />Start an Import
              </button>
            </div>
          )}

          {/* Rows */}
          <div className="divide-y divide-slate-50 dark:divide-slate-700/40">
            {jobs.map(job => {
              const isActive = job.status === "running" || job.status === "queued";
              const canCancel = isActive;
              const canRetry  = job.status === "failed" || job.status === "completed_with_warnings";
              const busy      = !!actionLoading[job.job_id];

              return (
                <div
                  key={job.job_id}
                  className={cx(
                    "group",
                    isActive && "bg-blue-50/30 dark:bg-blue-900/10",
                  )}
                >
                  {/* Main row */}
                  <div
                    className="grid grid-cols-[7rem_1fr_1fr_9rem_7rem_6rem_6rem_5rem_5rem_7rem] gap-2 items-center px-4 py-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-700/20 transition-colors"
                    onClick={() => fetchDetail(job.job_id)}
                  >
                    {/* Job ID */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline truncate">
                        {shortId(job.job_id)}
                      </span>
                    </div>

                    {/* Project */}
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={job.project_name}>
                      {job.project_name || <em className="text-slate-400 not-italic">unnamed</em>}
                    </span>

                    {/* Object */}
                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{job.sf_object}</span>

                    {/* Status */}
                    <StatusBadge status={job.status} />

                    {/* Started */}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {fmtRelative(job.started_at ?? job.created_at)}
                    </span>

                    {/* Duration */}
                    <span className="text-[11px] text-slate-500 tabular-nums">{fmtDuration(job.duration_seconds)}</span>

                    {/* Records */}
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums font-medium">
                      {job.total_records > 0 ? job.total_records.toLocaleString() : "—"}
                    </span>

                    {/* Success */}
                    <span className={cx(
                      "text-[11px] tabular-nums font-semibold",
                      job.successful > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"
                    )}>
                      {job.successful > 0 ? job.successful.toLocaleString() : "—"}
                    </span>

                    {/* Failed */}
                    <span className={cx(
                      "text-[11px] tabular-nums font-semibold",
                      job.failed > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-300 dark:text-slate-600"
                    )}>
                      {job.failed > 0 ? job.failed.toLocaleString() : "—"}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {job.success_report_s3_key && (
                        <button
                          title="Download Success CSV"
                          onClick={() => downloadFile(job.success_report_s3_key!, `${job.sf_object}_Import_Success.csv`)}
                          className="p-1.5 rounded-md text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      {job.failed_report_s3_key && (
                        <button
                          title="Download Failed CSV"
                          onClick={() => downloadFile(job.failed_report_s3_key!, `${job.sf_object}_Import_Failed.csv`)}
                          className="p-1.5 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      {canRetry && sfAccessToken && (
                        <button
                          title="Retry Failed"
                          disabled={busy}
                          onClick={() => handleRetry(job.job_id)}
                          className="p-1.5 rounded-md text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40 transition-colors"
                        >
                          {busy ? <LoaderCircle size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          title="Cancel Job"
                          disabled={busy}
                          onClick={() => handleCancel(job.job_id)}
                          className="p-1.5 rounded-md text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40 transition-colors"
                        >
                          {busy ? <LoaderCircle size={13} className="animate-spin" /> : <XCircle size={13} />}
                        </button>
                      )}
                      <button
                        title="View Details"
                        onClick={() => fetchDetail(job.job_id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Progress sub-row for running/queued */}
                  {isActive && (
                    <div className="px-4 pb-3 pt-0">
                      <JobProgress job={job} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination footer */}
          {total > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-5 py-3">
              <span className="text-[11px] text-slate-400">
                {total.toLocaleString()} job{total !== 1 ? "s" : ""} · Page {page + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Detail drawer loading indicator ──────────────────────────────────── */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20">
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center gap-3 shadow-xl">
            <LoaderCircle size={18} className="animate-spin text-blue-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Loading job details…</span>
          </div>
        </div>
      )}

      {/* ── Job detail drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && detailJob && (
        <JobDetailDrawer
          job={detailJob}
          onClose={() => setDrawerOpen(false)}
          onRetry={handleRetry}
          onCancel={handleCancel}
          sfAccessToken={sfAccessToken}
          sfInstanceUrl={sfInstanceUrl}
        />
      )}
    </div>
  );
}
