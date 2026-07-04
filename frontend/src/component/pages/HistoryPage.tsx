"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMigration } from "@/context/MigrationContext";
import * as XLSX from "xlsx";
import {
  X,
  Download,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Eye,
  Info,
  FileText,
  Database,
  Clock,
  User,
  Table2,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  RefreshCw,
  XCircle,
  Scissors,
  AtSign,
  FolderOpen,
  List,
  LayoutGrid
} from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  category: "Transformation" | "Mapping" | "Validation" | "Upload" | "System";
  actor: string;
  description: string;
  status: "Success" | "Warning" | "Error";
  details: any;
  fileStates: any;
  projectId: string;
  project?: {
    id: string;
    name: string;
  };
}

function aggregateValidationIssues(
  rawIssues: any[]
): Array<{ field: string; issue_types: string; count: number }> {
  if (!rawIssues || !rawIssues.length) return [];
  if ("issue_types" in rawIssues[0] && "count" in rawIssues[0]) {
    return rawIssues as Array<{ field: string; issue_types: string; count: number }>;
  }
  const agg: Record<string, { field: string; seenTypes: string[]; count: number }> = {};
  for (const issue of rawIssues) {
    const field = String(issue.field ?? "");
    const issueType = String(issue.issue_type ?? "");
    if (!agg[field]) agg[field] = { field, seenTypes: [], count: 0 };
    if (issueType && !agg[field].seenTypes.includes(issueType)) agg[field].seenTypes.push(issueType);
    agg[field].count++;
  }
  return Object.values(agg).map(v => ({
    field: v.field,
    issue_types: v.seenTypes.join(", "),
    count: v.count,
  }));
}

function LogDetailModal({ log, onClose, onSelectProject }: { log: AuditLog; onClose: () => void; onSelectProject: (projectId: string) => void }) {
  const [issueSearch, setIssueSearch] = useState("");
  const [cleaningPage, setCleaningPage] = useState(1);
  const cleaningItemsPerPage = 8;

  const downloadFile = (s3Key: string, fileName: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const link = document.createElement("a");
    link.href = `${apiUrl}/api/download-file?s3_key=${encodeURIComponent(s3Key)}`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const details = log.details;
  const fileStates = Array.isArray(log.fileStates) ? log.fileStates : [];

  const isDataValidation = log.category === "Validation" && details && typeof details === "object" && "issues" in details;
  const issues = isDataValidation && Array.isArray(details.issues) ? details.issues : [];
  const aggregatedIssues = aggregateValidationIssues(issues);
  const filteredIssues = issueSearch
    ? aggregatedIssues.filter(i =>
        i.field.toLowerCase().includes(issueSearch.toLowerCase()) ||
        i.issue_types.toLowerCase().includes(issueSearch.toLowerCase())
      )
    : aggregatedIssues;

  const isSchemaValidation = (log.category === "Validation" || log.category === "System") && details && typeof details === "object" && "schema_valid" in details;
  const schemaResult = isSchemaValidation ? details : null;

  const downloadSchemaDiscrepancy = () => {
    if (!schemaResult) return;
    const rows = [
      ["Type", "Field Name"],
      ...(schemaResult.missing_fields || []).map((f: string) => ["Missing from Source Data", f]),
      ...(schemaResult.additional_fields || []).map((f: string) => ["Missing from Mapping Logic", f]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schema_Discrepancies");
    XLSX.writeFile(wb, "schema_discrepancy_report.xlsx");
  };

  const isDataCleaning = log.category === "Transformation" && details && typeof details === "object" && "summary" in details && "changes" in details;
  const cleaningChanges = isDataCleaning && Array.isArray(details.changes) ? details.changes : [];
  const totalCleaningPages = Math.max(1, Math.ceil(cleaningChanges.length / cleaningItemsPerPage));
  const paginatedCleaningChanges = cleaningChanges.slice((cleaningPage - 1) * cleaningItemsPerPage, cleaningPage * cleaningItemsPerPage);

  const downloadCleaningReport = () => {
    if (!details?.changes?.length) return;
    const rows = [
      ["Row", "Column", "Original Value", "Cleaned Value", "Cleaning Rule"],
      ...details.changes.map((c: any) => [c.row, c.column, c.original_value, c.cleaned_value, c.rule]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cleaning_Report");
    XLSX.writeFile(wb, "data_cleaning_report.xlsx");
  };

  const isSkippedIssue = details && typeof details === "object" && details.skippedIssue === true;

  const isDataTransformation = log.category === "Transformation" && details && typeof details === "object" && "outputs" in details;
  const transformOutputs = isDataTransformation && Array.isArray(details.outputs) ? details.outputs : [];

  const transformTotalRows = transformOutputs.reduce((sum: number, o: any) => sum + (o.totalRows ?? o.total_rows ?? 0), 0);
  const transformTotalMatched = transformOutputs.reduce((sum: number, o: any) => {
    const stats = o.lookupStats ?? o.lookup_stats ?? [];
    return sum + stats.reduce((s: number, l: any) => s + (l.matched ?? 0), 0);
  }, 0);
  const transformTotalMissed = transformOutputs.reduce((sum: number, o: any) => {
    const stats = o.lookupStats ?? o.lookup_stats ?? [];
    return sum + stats.reduce((s: number, l: any) => s + (l.missed ?? 0), 0);
  }, 0);

  const isGenericError = log.status === "Error" || (details && typeof details === "object" && "error" in details);
  const errorMsg = details && typeof details === "object" && "error" in details ? details.error : null;

  const isSalesforceMigration = details && typeof details === "object" && details.sf_type === "salesforce_migration";
  const sfDurationSec = isSalesforceMigration && details.duration_ms ? (details.duration_ms / 1000).toFixed(1) : null;

  const MetricTile = ({ label, value, helper, icon: Icon, tone = "slate" }: any) => {
    const toneStyles = {
      slate: "bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700",
      blue: "bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800/30",
      emerald: "bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30",
      rose: "bg-rose-50/50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800/30",
      amber: "bg-amber-50/50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800/30",
    }[tone as "slate" | "blue" | "emerald" | "rose" | "amber"];

    return (
      <div className={`rounded-xl border p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.005)] ${toneStyles}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="opacity-70" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-85">{label}</span>
        </div>
        <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
        {helper && <p className="mt-0.5 text-[9px] font-semibold opacity-75">{helper}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm sm:p-6 animate-fade-in">
      <div className="flex h-full max-h-[85vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl animate-scale-up-modal">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4.5">
          <div className="space-y-1 min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${
                log.category === "Transformation" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" :
                log.category === "Mapping" ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" :
                log.category === "Validation" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" :
                log.category === "Upload" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" :
                "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
              }`}>
                {log.category}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                log.status === "Success" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" :
                log.status === "Warning" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" :
                "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  log.status === "Success" ? "bg-emerald-600" :
                  log.status === "Warning" ? "bg-amber-500" :
                  "bg-rose-500"
                }`} />
                {log.status}
              </span>
              {log.project && (
                <button
                  onClick={() => onSelectProject(log.project!.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[11px] font-semibold uppercase hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
                  title="Switch to this project workspace"
                >
                  <FolderOpen size={11} />
                  <span>Project: {log.project.name}</span>
                </button>
              )}
            </div>
            <h3 className="text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white truncate">
              {log.description}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-slate-400" />
            <span>Actor:</span>
            <span className="text-slate-800 dark:text-slate-200">{log.actor}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            <span>Timestamp:</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono">{log.timestamp}</span>
          </div>
          {fileStates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              <span>Snapshot Files:</span>
              <span className="rounded bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 font-semibold">{fileStates.length}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 bg-slate-50/45 dark:bg-slate-900/60">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full">
            
            {/* Left Section: Reports */}
            <div className="lg:col-span-2 space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Activity Details</h4>
              </div>

              {/* Data Validation */}
              {isDataValidation && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Validation Execution Metrics</h5>
                    {details.reportS3Key && (
                      <button
                        onClick={() => downloadFile(details.reportS3Key, "data_validation_report.xlsx")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all cursor-pointer shadow-sm"
                      >
                        <Download size={13} />
                        <span>Download Validation Report</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MetricTile label="Total Records Checked" value={details.total_records ?? "N/A"} icon={Table2} />
                    <MetricTile label="Total Issues Detected" value={details.total_issues ?? issues.length} icon={AlertTriangle} tone={issues.length > 0 ? "rose" : "emerald"} />
                  </div>

                  {issues.length > 0 ? (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-50/30 dark:bg-slate-800/30">
                        <Search size={14} className="text-slate-400" />
                        <input
                          type="text"
                          value={issueSearch}
                          onChange={(e) => setIssueSearch(e.target.value)}
                          placeholder="Filter by field or issue type…"
                          className="w-full text-xs font-semibold focus:outline-none bg-transparent dark:text-slate-200 dark:placeholder-slate-500"
                        />
                      </div>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                              <th className="px-3 py-2.5">Field</th>
                              <th className="px-3 py-2.5">Issue Types</th>
                              <th className="px-3 py-2.5 text-right">Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 font-medium">
                            {filteredIssues.map((issue, index) => (
                              <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30">
                                <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap">{issue.field}</td>
                                <td className="px-3 py-2.5 text-rose-700 dark:text-rose-400">{issue.issue_types}</td>
                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">{issue.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl shadow-sm text-slate-400 font-semibold text-xs flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={24} className="text-emerald-600" />
                      <span>Data validation passed cleanly. No issues detected!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Skipped Validation Issue */}
              {isSkippedIssue && (
                <div className="space-y-3">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Skipped Validation Issue
                  </h5>
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-900/10 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-amber-100 dark:border-amber-800/30 bg-white dark:bg-slate-800/40 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.005)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertTriangle size={12} className="text-amber-600 opacity-70" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 opacity-85">Field</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{details.field}</p>
                      </div>
                      <div className="rounded-xl border border-rose-100 dark:border-rose-800/30 bg-white dark:bg-slate-800/40 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.005)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertTriangle size={12} className="text-rose-500 opacity-70" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 opacity-85">Affected Rows</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{details.count}</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-amber-100 dark:border-amber-800/30 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Issue Type</p>
                      <p className="text-xs font-medium text-rose-700 dark:text-rose-400">{details.issue_types || "—"}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-amber-100 dark:border-amber-800/30 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Remark</p>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 italic">{details.remark || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Schema Validation */}
              {isSchemaValidation && schemaResult && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Schema Validation Metrics</h5>
                    {!schemaResult.schema_valid && (
                      <button
                        onClick={downloadSchemaDiscrepancy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Download Discrepancy Report</span>
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <MetricTile label="Source Fields" value={schemaResult.source_field_count ?? 0} icon={Table2} />
                    <MetricTile label="Mapping Fields" value={schemaResult.mapping_field_count ?? 0} icon={Database} tone="blue" />
                    <MetricTile label="Matched Fields" value={schemaResult.matched_field_count ?? 0} icon={CheckCircle2} tone="emerald" />
                    <MetricTile label="Missing Fields" value={schemaResult.missing_fields?.length || 0} icon={AlertTriangle} tone={schemaResult.missing_fields?.length > 0 ? "rose" : "slate"} />
                    <MetricTile label="Extra Fields" value={schemaResult.additional_fields?.length || 0} icon={AlertTriangle} tone={schemaResult.additional_fields?.length > 0 ? "amber" : "slate"} />
                  </div>

                  <div className={`p-4 rounded-xl border flex gap-3 items-start ${
                    schemaResult.schema_valid ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-rose-50/70 border-rose-200 text-rose-800"
                  }`}>
                    <span className={`p-1 bg-white rounded-full shadow-sm ${schemaResult.schema_valid ? "text-emerald-600" : "text-rose-600"}`}>
                      {schemaResult.schema_valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    </span>
                    <div>
                      <h5 className="font-semibold text-xs">{schemaResult.schema_valid ? "Compatible Field Schema Match" : "Field Discrepancies Found"}</h5>
                      <p className="text-[11.5px] mt-0.5 leading-4 font-semibold opacity-90">
                        {schemaResult.schema_valid ? "Source fields match perfectly with the mapping rules." : "Review discrepancies below to align source columns."}
                      </p>
                    </div>
                  </div>

                  {!schemaResult.schema_valid && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                          Missing from source data ({schemaResult.missing_fields?.length || 0})
                        </h5>
                        <div className="mt-3 max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                          {schemaResult.missing_fields?.map((f: string) => (
                            <span key={f} className="px-2 py-1 bg-rose-50 text-rose-700 rounded-md text-[10.5px] font-semibold">
                              {f}
                            </span>
                          )) || <span className="text-xs text-slate-400 italic">None</span>}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          Missing from mapping logic ({schemaResult.additional_fields?.length || 0})
                        </h5>
                        <div className="mt-3 max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                          {schemaResult.additional_fields?.map((f: string) => (
                            <span key={f} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-[10.5px] font-semibold">
                              {f}
                            </span>
                          )) || <span className="text-xs text-slate-400 italic">None</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Data Cleaning */}
              {isDataCleaning && details.summary && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cleaning Execution Metrics</h5>
                    {cleaningChanges.length > 0 && (
                      <button
                        onClick={downloadCleaningReport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-all cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Download Cleaning Log</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <MetricTile label="Rows Processed" value={details.summary.total_rows_processed ?? 0} icon={Table2} />
                    <MetricTile label="Rows Removed" value={details.summary.rows_removed ?? 0} icon={Trash2} tone={details.summary.rows_removed > 0 ? "rose" : "slate"} />
                    <MetricTile label="Values Trimmed" value={details.summary.values_trimmed ?? 0} icon={Scissors} tone={details.summary.values_trimmed > 0 ? "amber" : "slate"} />
                    <MetricTile label="Spaces Fixed" value={details.summary.extra_spaces_fixed ?? 0} icon={RefreshCw} tone={details.summary.extra_spaces_fixed > 0 ? "amber" : "slate"} />
                    <MetricTile label="Email Fixes" value={details.summary.email_corrections ?? 0} icon={AtSign} tone={details.summary.email_corrections > 0 ? "blue" : "slate"} />
                    <MetricTile label="Null Conversions" value={details.summary.null_conversions ?? 0} icon={XCircle} tone={details.summary.null_conversions > 0 ? "amber" : "slate"} />
                  </div>

                  {cleaningChanges.length > 0 ? (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                              <th className="px-3 py-2.5">Row</th>
                              <th className="px-3 py-2.5">Column</th>
                              <th className="px-3 py-2.5">Original</th>
                              <th className="px-3 py-2.5">Cleaned</th>
                              <th className="px-3 py-2.5">Rule</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 font-medium">
                            {paginatedCleaningChanges.map((change: any, index: number) => (
                              <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30">
                                <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white font-mono">{change.row}</td>
                                <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{change.column}</td>
                                <td className="px-3 py-2.5 max-w-[130px] truncate font-mono text-[11px] text-rose-700">{String(change.original_value || "")}</td>
                                <td className="px-3 py-2.5 max-w-[130px] truncate font-mono text-[11px] text-emerald-700">{String(change.cleaned_value || "")}</td>
                                <td className="px-3 py-2.5">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                                    {change.rule}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {totalCleaningPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 text-[11px] font-semibold text-slate-500">
                          <span>Showing {(cleaningPage - 1) * cleaningItemsPerPage + 1} to {Math.min(cleaningPage * cleaningItemsPerPage, cleaningChanges.length)} of {cleaningChanges.length}</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setCleaningPage(p => Math.max(1, p - 1))} disabled={cleaningPage === 1} className="p-1 rounded border disabled:opacity-40"><ChevronLeft size={14} /></button>
                            <span>{cleaningPage} / {totalCleaningPages}</span>
                            <button onClick={() => setCleaningPage(p => Math.min(totalCleaningPages, p + 1))} disabled={cleaningPage === totalCleaningPages} className="p-1 rounded border disabled:opacity-40"><ChevronRight size={14} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl shadow-sm text-slate-400 font-semibold text-xs flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={24} className="text-emerald-600" />
                      <span>Data cleaning complete. No changes were necessary!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Data Transformation */}
              {isDataTransformation && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Transformation Summary</h5>
                    {details.zipS3Key ? (
                      <button
                        onClick={() => downloadFile(details.zipS3Key, details.zipFileName || "transformed_data.zip")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all cursor-pointer shadow-md"
                      >
                        <Download size={13} />
                        <span>Download Transformed Files (ZIP)</span>
                      </button>
                    ) : transformOutputs[0]?.transformedS3Key ? (
                      <button
                        onClick={() => downloadFile(transformOutputs[0].transformedS3Key, transformOutputs[0].fileName || "transformed_data.xlsx")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all cursor-pointer shadow-md"
                      >
                        <Download size={13} />
                        <span>Download Transformed File</span>
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <MetricTile label="Rows Transformed" value={transformTotalRows} helper="Output rows generated" icon={Table2} tone="blue" />
                    <MetricTile label="Lookups Matched" value={transformTotalMatched} helper="Lookup values resolved" icon={CheckCircle2} tone="emerald" />
                    <MetricTile label="Lookups Missed" value={transformTotalMissed} helper="Lookup values not found" icon={AlertTriangle} tone={transformTotalMissed > 0 ? "rose" : "slate"} />
                  </div>

                  <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/20 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b">
                          <tr>
                            <th className="px-4 py-3">Sheet Name</th>
                            <th className="px-4 py-3">Output File</th>
                            <th className="px-4 py-3">Total Rows</th>
                            <th className="px-4 py-3">Lookups (Matched/Missed)</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-slate-700 dark:text-slate-300 font-medium">
                          {transformOutputs.map((out: any, index: number) => {
                            const stats = out.lookupStats ?? out.lookup_stats ?? [];
                            const matched = stats.reduce((s: number, l: any) => s + (l.matched ?? 0), 0);
                            const missed = stats.reduce((s: number, l: any) => s + (l.missed ?? 0), 0);
                            return (
                              <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30">
                                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{out.sheetName}</td>
                                <td className="px-4 py-3 font-mono truncate max-w-[150px]">{out.fileName}</td>
                                <td className="px-4 py-3 font-semibold">{out.totalRows ?? out.total_rows ?? 0}</td>
                                <td className="px-4 py-3">
                                  <span className="text-emerald-600 font-semibold">{matched}</span> / <span className={missed > 0 ? "text-rose-600 font-semibold" : "text-slate-400"}>{missed}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => downloadFile(out.transformedS3Key, out.fileName)} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"><Download size={13} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Salesforce Migration */}
              {isSalesforceMigration && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Salesforce Migration Details</h5>
                    {details.report_s3_key && (
                      <button
                        onClick={() => downloadFile(details.report_s3_key, "Migration_Report.xlsx")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all cursor-pointer shadow-md"
                      >
                        <Download size={13} />
                        Download Report
                      </button>
                    )}
                  </div>

                  {/* Info row: object + account + duration */}
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Cloud size={13} className="text-slate-400" />
                      <span>Object:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{details.sf_object ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      <span>Account:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{details.sf_user_email ?? "—"}</span>
                    </div>
                    {sfDurationSec && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        <span>Duration:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{sfDurationSec}s</span>
                      </div>
                    )}
                  </div>

                  {/* Metric tiles */}
                  <div className="grid grid-cols-3 gap-3">
                    <MetricTile label="Total Attempted" value={details.total ?? 0} helper="Records sent to Salesforce" icon={Table2} tone="blue" />
                    <MetricTile label="Successful" value={details.success ?? 0} helper="Records inserted" icon={CheckCircle2} tone="emerald" />
                    <MetricTile label="Failed" value={details.failed ?? 0} helper="Records rejected" icon={XCircle} tone={details.failed > 0 ? "rose" : "slate"} />
                  </div>

                  {/* Error from thrown exception */}
                  {details.error && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 text-rose-800 dark:text-rose-300 rounded-xl flex gap-3 items-start">
                      <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="text-xs font-semibold">Error</p>
                        <p className="text-xs mt-0.5 font-medium opacity-90">{details.error}</p>
                      </div>
                    </div>
                  )}

                  {/* Per-row errors from partial failures */}
                  {Array.isArray(details.errors) && details.errors.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                      <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Row Errors ({details.errors.length})
                        </span>
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                        {details.errors.map((e: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-xs">
                            <span className="font-mono font-semibold text-slate-500 shrink-0 pt-0.5">Row {e.row}</span>
                            <span className="text-rose-700 dark:text-rose-400 font-medium">{e.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generic Error message */}
              {isGenericError && errorMsg && !isDataValidation && !isSchemaValidation && !isDataCleaning && !isDataTransformation && !isSalesforceMigration && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex gap-3 items-start shadow-sm">
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="font-semibold text-xs">Error details</h5>
                    <p className="mt-1.5 text-xs font-mono whitespace-pre-wrap break-all leading-5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {details && !isDataValidation && !isSchemaValidation && !isDataCleaning && !isDataTransformation && !isSkippedIssue && (
                <div className="space-y-2">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operation Metadata</h5>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-[11px] font-mono overflow-auto max-h-72 leading-5 shadow-inner">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Right Section: Snapshots */}
            <div className="space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">File Snapshot</h4>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] leading-4 text-slate-400 font-semibold">
                  Download files active in the project workspace at this timestamp:
                </p>

                {fileStates.length > 0 ? (
                  fileStates.map((file: any) => {
                    const isSource = file.slot === "source";
                    const isMaster = file.slot === "master";
                    
                    return (
                      <div
                        key={file.id || file.s3Key}
                        className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSource ? "bg-blue-50 text-blue-700" :
                            isMaster ? "bg-emerald-50 text-emerald-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            <Table2 size={17} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-200 truncate" title={file.fileName}>
                                {file.fileName}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-semibold uppercase tracking-wide shrink-0 ${
                                isSource ? "bg-blue-100 text-blue-800" :
                                isMaster ? "bg-emerald-100 text-emerald-800" :
                                "bg-slate-200 text-slate-700"
                              }`}>
                                {file.slot}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Size: {file.fileSize || "Unknown"}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadFile(file.s3Key, file.fileName)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                          title={`Download ${file.fileName}`}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 font-semibold text-xs flex flex-col items-center justify-center gap-1.5">
                    <Database size={18} className="text-slate-300" />
                    <span>No active files at this timestamp.</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { currentUser, selectProject, projectList } = useMigration();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  // Custom states requested by user
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  // Simplified Delete & Clear states
  const [isPurging, setIsPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<"all" | "project">("all");

  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/history?userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.activities.map((act: any) => ({
          ...act,
          timestamp: new Date(act.timestamp).toLocaleString(),
        })));
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSelectProject = async (projectId: string) => {
    try {
      await selectProject(projectId);
      router.push("/upload");
    } catch (err) {
      console.error("Error switching workspace project:", err);
    }
  };

  const handleDeleteActivity = async (activityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this activity log permanently?")) return;

    try {
      const res = await fetch(`/api/history?activityId=${activityId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => prev.filter(item => item.id !== activityId));
      } else {
        alert("Failed to delete log entry: " + data.error);
      }
    } catch (err) {
      console.error("Error deleting activity log:", err);
    }
  };

  const handlePurgeHistory = async () => {
    if (!currentUser) return;
    setIsPurging(true);
    try {
      let url = `/api/history?userId=${currentUser.id}`;
      if (purgeTarget === "project" && selectedProjectFilter !== "All") {
        url = `/api/history?projectId=${selectedProjectFilter}`;
      }
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setShowPurgeConfirm(false);
        fetchHistory();
      } else {
        alert("Failed to delete logs: " + data.error);
      }
    } catch (err) {
      console.error("Error clearing logs:", err);
    } finally {
      setIsPurging(false);
    }
  };

  const handleExportHistory = () => {
    const rows = filteredLogs.map((log) => ({
      Timestamp: log.timestamp,
      Project: log.project?.name || "N/A",
      Category: log.category,
      Actor: log.actor,
      Description: log.description,
      Status: log.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Migration_History");
    XLSX.writeFile(wb, "migration_project_history.xlsx");
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.project?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProject =
      selectedProjectFilter === "All" || log.projectId === selectedProjectFilter;

    const matchesCategory =
      selectedCategory === "All" || log.category === selectedCategory;

    const matchesStatus =
      selectedStatus === "All" || log.status === selectedStatus;

    return matchesSearch && matchesProject && matchesCategory && matchesStatus;
  });

  // Calculate statistics based on filtered history
  const totalCount = logs.length;
  const successCount = logs.filter(l => l.status === "Success").length;
  const warningCount = logs.filter(l => l.status === "Warning").length;
  const errorCount = logs.filter(l => l.status === "Error").length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

  // Group logs for Timeline View
  const groupedLogs: Record<string, { projectId: string; logs: AuditLog[] }> = {};
  filteredLogs.forEach((log) => {
    const pName = log.project?.name || "Other Actions";
    if (!groupedLogs[pName]) {
      groupedLogs[pName] = { projectId: log.projectId, logs: [] };
    }
    groupedLogs[pName].logs.push(log);
  });

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-900">
        <div className="max-w-md text-center space-y-3">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Access Denied</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Please login to view migration history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden select-none bg-[#f8fafc] dark:bg-slate-900">

      {/* Header bar */}
      <div className="flex-none flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock size={20} className="text-slate-500" />
            <span>Migration History & Logs</span>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track all migration activities, view files, and inspect execution logs.
          </p>
        </div>

        {/* Global actions: Export and Purge */}
        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/40 dark:border-slate-700/40">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <List size={13} />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid size={13} />
              <span>Timeline</span>
            </button>
          </div>

          <button
            onClick={handleExportHistory}
            disabled={filteredLogs.length === 0}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          <button
            onClick={() => {
              setPurgeTarget(selectedProjectFilter === "All" ? "all" : "project");
              setShowPurgeConfirm(true);
            }}
            className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-none">

        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 rounded-lg flex items-center justify-center shrink-0">
            <Database size={18} />
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Total Activities</span>
            <span className="block text-2xl font-semibold text-slate-900 dark:text-white mt-0.5">
              {isLoading ? "—" : totalCount}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 rounded-lg flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Success Rate</span>
            <span className="block text-2xl font-semibold text-emerald-600 mt-0.5">
              {isLoading ? "—" : `${successRate}%`}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Warnings</span>
            <span className="block text-2xl font-semibold text-amber-600 mt-0.5">
              {isLoading ? "—" : warningCount}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 rounded-lg flex items-center justify-center shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Errors</span>
            <span className="block text-2xl font-semibold text-rose-600 mt-0.5">
              {isLoading ? "—" : errorCount}
            </span>
          </div>
        </div>

      </div>

      {/* Quick Status pills & Filters Area */}
      <div className="flex-none flex flex-col lg:flex-row gap-3 items-center justify-between">

        {/* Quick status filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {[
            { label: "All Statuses", value: "All" },
            { label: "Success Only", value: "Success" },
            { label: "Warnings Only", value: "Warning" },
            { label: "Errors Only", value: "Error" }
          ].map((item) => {
            const isSelected = selectedStatus === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setSelectedStatus(item.value)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-blue-600 border-transparent text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Dropdown Filters & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={15} />
            </div>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-500">
            <span>Project:</span>
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none font-medium cursor-pointer"
            >
              <option value="All">All Projects</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-500">
            <span>Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none font-medium cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Upload">Upload</option>
              <option value="Validation">Validation</option>
              <option value="Mapping">Mapping</option>
              <option value="Transformation">Transformation</option>
              <option value="System">System</option>
            </select>
          </div>
        </div>

      </div>

      {/* Main logs display - List or Timeline */}
      <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl p-5 shadow-sm min-h-[350px] overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : viewMode === "table" ? (
          // TABLE VIEW
          <div className="overflow-x-auto flex-1 min-h-0">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  <th className="pb-4 pl-3">Timestamp</th>
                  <th className="pb-4">Project</th>
                  <th className="pb-4">Category</th>
                  <th className="pb-4">Actor</th>
                  <th className="pb-4">Description</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 border-l-2 border-l-transparent hover:border-l-blue-500 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 pl-3 font-mono text-xs text-slate-400">{log.timestamp}</td>
                      <td className="py-3.5">
                        {log.project ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProject(log.project!.id);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm flex items-center gap-1 text-left bg-transparent border-none cursor-pointer"
                            title="Click to switch workspace to this project"
                          >
                            <span>{log.project.name}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-sm">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${
                          log.category === "Transformation" ? "bg-slate-100 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400" :
                          log.category === "Mapping" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" :
                          log.category === "Validation" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                          log.category === "Upload" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                          "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                        }`}>
                          {log.category}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-700 dark:text-slate-300 font-medium">{log.actor}</td>
                      <td className="py-3.5 text-slate-500 dark:text-slate-400 font-medium max-w-[300px] truncate text-sm" title={log.description}>{log.description}</td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          log.status === "Success" ? "bg-emerald-50 text-emerald-700" :
                          log.status === "Warning" ? "bg-amber-50 text-amber-700" :
                          "bg-rose-50 text-rose-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === "Success" ? "bg-emerald-600" :
                            log.status === "Warning" ? "bg-amber-500" :
                            "bg-rose-500"
                          }`} />
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Inspect log details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteActivity(log.id, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Delete log from history"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                      No activities found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // TIMELINE VIEW (grouped by project)
          <div className="flex-1 overflow-y-auto space-y-6 max-h-full pr-1">
            {Object.entries(groupedLogs).length > 0 ? (
              Object.entries(groupedLogs).map(([projectName, group]) => (
                <div key={projectName} className="bg-slate-50/50 dark:bg-slate-800/10 border border-slate-200/50 dark:border-slate-800 rounded-xl p-5 space-y-4">
                  
                  {/* Timeline Project Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/35 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={16} className="text-blue-600 dark:text-blue-400" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{projectName}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10.5px] font-semibold text-slate-500">
                        {group.logs.length} {group.logs.length === 1 ? "activity" : "activities"}
                      </span>
                    </div>

                    {group.projectId && (
                      <button
                        onClick={() => handleSelectProject(group.projectId)}
                        className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Open Workspace
                      </button>
                    )}
                  </div>

                  {/* Vertical Timeline sequence */}
                  <div className="pl-2.5 pt-1 space-y-0">
                    {group.logs.map((log, idx) => (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="relative pl-6 pb-6 last:pb-2 group cursor-pointer"
                      >
                        {/* Bullet Marker */}
                        <div className={`absolute left-[3px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-800 z-10 transition-transform group-hover:scale-125 ${
                          log.status === "Success" ? "border-emerald-500" :
                          log.status === "Warning" ? "border-amber-500" :
                          "border-rose-500"
                        }`} />
                        
                        {/* Connecting Line */}
                        {idx < group.logs.length - 1 && (
                          <div className="absolute left-[7px] top-3.5 bottom-0 w-[2px] bg-slate-200/60 dark:bg-slate-800" />
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-mono text-slate-400">{log.timestamp}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                log.category === "Transformation" ? "bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400" :
                                log.category === "Mapping" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                log.category === "Validation" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                log.category === "Upload" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400"
                              }`}>
                                {log.category}
                              </span>
                              <span className="text-slate-400/90 font-semibold flex items-center gap-0.5 text-[11px]">
                                <User size={11} /> {log.actor}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {log.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Inspect Details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteActivity(log.id, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Remove Log"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 font-semibold">
                No activities found matching your filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Inspector */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onSelectProject={handleSelectProject}
        />
      )}

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle size={18} /></span>
              <div>
                <h4 className="text-base font-semibold text-slate-900 dark:text-white">Clear History</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-4">
                  Are you sure you want to delete these history records? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="purgeScope"
                  checked={purgeTarget === "all"}
                  onChange={() => setPurgeTarget("all")}
                  className="accent-rose-600 scale-110 cursor-pointer"
                />
                <span>Clear all logs across all projects</span>
              </label>

              {selectedProjectFilter !== "All" && (
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="purgeScope"
                    checked={purgeTarget === "project"}
                    onChange={() => setPurgeTarget("project")}
                    className="accent-rose-600 scale-110 cursor-pointer"
                  />
                  <span>Clear logs for the current project only</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                onClick={() => setShowPurgeConfirm(false)}
                className="px-4 py-2 text-xs font-medium border rounded-lg hover:bg-slate-50 text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeHistory}
                disabled={isPurging}
                className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {isPurging ? "Deleting..." : "Clear Logs"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
