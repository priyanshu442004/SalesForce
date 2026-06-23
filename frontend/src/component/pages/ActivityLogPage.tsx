"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMigration } from "@/context/MigrationContext";
import * as XLSX from "xlsx";
import {
  X,
  Download,
  AlertTriangle,
  CheckCircle2,
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
  ShieldCheck,
  Wrench,
  FileCheck2,
  Wand2,
  Trash2,
  Scissors,
  AtSign,
  RefreshCw,
  XCircle
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
}

// Normalise validation issues to the aggregated format regardless of whether
// they were stored in the old granular shape ({ row, field, issue_type, … })
// or the current aggregated shape ({ field, issue_types, count }).
function aggregateValidationIssues(
  rawIssues: any[]
): Array<{ field: string; issue_types: string; count: number }> {
  if (!rawIssues.length) return [];
  // New aggregated format — already correct.
  if ("issue_types" in rawIssues[0] && "count" in rawIssues[0]) {
    return rawIssues as Array<{ field: string; issue_types: string; count: number }>;
  }
  // Old granular format — aggregate client-side for backward compatibility.
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

// Reusable detailed modal for granular log analytics and downloads
function LogDetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
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

  // 1. Parse Data Validation
  const isDataValidation = log.category === "Validation" && details && typeof details === "object" && "issues" in details;
  const issues = isDataValidation && Array.isArray(details.issues) ? details.issues : [];

  const aggregatedIssues = aggregateValidationIssues(issues);
  const filteredIssues = issueSearch
    ? aggregatedIssues.filter(i =>
        i.field.toLowerCase().includes(issueSearch.toLowerCase()) ||
        i.issue_types.toLowerCase().includes(issueSearch.toLowerCase())
      )
    : aggregatedIssues;

  // 2. Parse Schema Validation
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

  // 3. Parse Data Cleaning
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

  // 4. Parse Data Transformation
  const isDataTransformation = log.category === "Transformation" && details && typeof details === "object" && "outputs" in details;
  const transformOutputs = isDataTransformation && Array.isArray(details.outputs) ? details.outputs : [];

  // Derived transformation statistics
  const transformTotalRows = transformOutputs.reduce((sum: number, o: any) => sum + (o.totalRows ?? o.total_rows ?? 0), 0);
  const transformTotalMatched = transformOutputs.reduce((sum: number, o: any) => {
    const stats = o.lookupStats ?? o.lookup_stats ?? [];
    return sum + stats.reduce((s: number, l: any) => s + (l.matched ?? 0), 0);
  }, 0);
  const transformTotalMissed = transformOutputs.reduce((sum: number, o: any) => {
    const stats = o.lookupStats ?? o.lookup_stats ?? [];
    return sum + stats.reduce((s: number, l: any) => s + (l.missed ?? 0), 0);
  }, 0);

  // Generic errors
  const isGenericError = log.status === "Error" || (details && typeof details === "object" && "error" in details);
  const errorMsg = details && typeof details === "object" && "error" in details ? details.error : null;

  // Custom helper for metric styling
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
      <div className="flex h-full max-h-[85vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-2xl animate-scale-up-modal">
        
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-6 py-4.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${
                log.category === "Transformation" ? "bg-purple-50 text-purple-700 ring-1 ring-purple-100" :
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
            </div>
            <h3 className="text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {log.description}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 dark:border-slate-700 text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Info Bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">
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

        {/* Modal Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 bg-slate-50/45 dark:bg-[#0F172A]/50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full">
            
            {/* Left Column: Granular Reports / Logs */}
            <div className="lg:col-span-2 space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                  Granular Details
                </h4>
              </div>

              {/* Data Validation Output UI */}
              {isDataValidation && (
                <div className="space-y-4">
                  {/* Stats tiles */}
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Validation Execution Metrics
                    </h5>
                    {details.reportS3Key && (
                      <button
                        onClick={() => downloadFile(details.reportS3Key, "data_validation_report.xlsx")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
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

                  {/* Aggregated issues table — Field | Issue Types | Count */}
                  {issues.length > 0 ? (
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
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
                                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-200 whitespace-nowrap">{issue.field}</td>
                                <td className="px-3 py-2.5 text-rose-700 dark:text-rose-400">{issue.issue_types}</td>
                                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">{issue.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filteredIssues.length === 0 && issueSearch && (
                        <p className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700">
                          No issues match "{issueSearch}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl shadow-sm text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={24} className="text-emerald-600" />
                      <span>Data validation passed cleanly. No issues detected!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Schema Validation Output UI */}
              {isSchemaValidation && schemaResult && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Schema Validation Metrics
                    </h5>
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
                  
                  {/* Summary Metric tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <MetricTile label="Source Fields" value={schemaResult.source_field_count ?? 0} icon={Table2} />
                    <MetricTile label="Mapping Fields" value={schemaResult.mapping_field_count ?? 0} icon={Database} tone="blue" />
                    <MetricTile label="Matched Fields" value={schemaResult.matched_field_count ?? 0} icon={CheckCircle2} tone="emerald" />
                    <MetricTile label="Missing Fields" value={schemaResult.missing_fields?.length || 0} icon={AlertTriangle} tone={schemaResult.missing_fields?.length > 0 ? "rose" : "slate"} />
                    <MetricTile label="Extra Fields" value={schemaResult.additional_fields?.length || 0} icon={AlertTriangle} tone={schemaResult.additional_fields?.length > 0 ? "amber" : "slate"} />
                  </div>

                  {/* Schema Validation Status Callout */}
                  <div className={`p-4 rounded-xl border flex gap-3 items-start ${
                    schemaResult.schema_valid ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" : "bg-rose-50/70 border-rose-200 text-rose-800"
                  }`}>
                    <span className={`p-1 bg-white rounded-full shadow-sm ${schemaResult.schema_valid ? "text-emerald-600" : "text-rose-600"}`}>
                      {schemaResult.schema_valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    </span>
                    <div>
                      <h5 className="font-bold text-xs">
                        {schemaResult.schema_valid ? "Compatible Field Schema Match" : "Field Discrepancies Found"}
                      </h5>
                      <p className="text-[11.5px] mt-0.5 leading-4 font-bold opacity-90">
                        {schemaResult.schema_valid
                          ? "Source fields match perfectly with the mapping rules."
                          : "Review discrepancies below to align source columns with target specifications."}
                      </p>
                    </div>
                  </div>

                  {/* Missing/Additional fields details */}
                  {!schemaResult.schema_valid && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Missing from Source */}
                      <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                          Missing from source data ({schemaResult.missing_fields?.length || 0})
                        </h5>
                        <div className="mt-3 max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                          {Array.isArray(schemaResult.missing_fields) && schemaResult.missing_fields.length > 0 ? (
                            schemaResult.missing_fields.map((f: string) => (
                              <span key={f} className="px-2 py-1 bg-rose-50 text-rose-700 rounded-md text-[10.5px] font-bold border border-rose-100/30">
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic font-bold">None</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Missing from Logic */}
                      <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          Missing from mapping logic ({schemaResult.additional_fields?.length || 0})
                        </h5>
                        <div className="mt-3 max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                          {Array.isArray(schemaResult.additional_fields) && schemaResult.additional_fields.length > 0 ? (
                            schemaResult.additional_fields.map((f: string) => (
                              <span key={f} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-[10.5px] font-bold border border-amber-100/30">
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic font-bold">None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Data Cleaning Output UI */}
              {isDataCleaning && details.summary && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Cleaning Execution Metrics
                    </h5>
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
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                              <th className="px-3 py-2.5">Row</th>
                              <th className="px-3 py-2.5">Column</th>
                              <th className="px-3 py-2.5">Original Value</th>
                              <th className="px-3 py-2.5">Cleaned Value</th>
                              <th className="px-3 py-2.5">Rule</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 font-medium">
                            {paginatedCleaningChanges.map((change: any, index: number) => (
                              <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30">
                                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white font-mono">{change.row}</td>
                                <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{change.column}</td>
                                <td className="px-3 py-2.5 max-w-[130px] truncate font-mono text-[11px] text-rose-700 dark:text-rose-400">{change.original_value === null || change.original_value === "" ? <span className="italic text-slate-300">empty</span> : String(change.original_value)}</td>
                                <td className="px-3 py-2.5 max-w-[130px] truncate font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{change.cleaned_value === null || change.cleaned_value === "" ? <span className="italic text-slate-300">empty</span> : String(change.cleaned_value)}</td>
                                <td className="px-3 py-2.5">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold ring-1 ring-amber-100 dark:ring-amber-800/30">
                                    {change.rule}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Pagination Controls */}
                      {totalCleaningPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>
                            Showing {(cleaningPage - 1) * cleaningItemsPerPage + 1} to {Math.min(cleaningPage * cleaningItemsPerPage, cleaningChanges.length)} of {cleaningChanges.length} modifications
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setCleaningPage(prev => Math.max(1, prev - 1))}
                              disabled={cleaningPage === 1}
                              className="p-1 rounded border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <span className="px-2">{cleaningPage} / {totalCleaningPages}</span>
                            <button
                              onClick={() => setCleaningPage(prev => Math.min(totalCleaningPages, prev + 1))}
                              disabled={cleaningPage === totalCleaningPages}
                              className="p-1 rounded border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl shadow-sm text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={24} className="text-emerald-600" />
                      <span>Data cleaning complete. No changes were necessary!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Data Transformation Output UI */}
              {isDataTransformation && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Transformation Results Summary
                    </h5>
                    {details.zipS3Key ? (
                      <button
                        onClick={() => downloadFile(details.zipS3Key, details.zipFileName || "transformed_data.zip")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 transition-all cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Download Transformed Files (ZIP)</span>
                      </button>
                    ) : transformOutputs[0]?.transformedS3Key ? (
                      <button
                        onClick={() => downloadFile(transformOutputs[0].transformedS3Key, transformOutputs[0].fileName || "transformed_data.xlsx")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 transition-all cursor-pointer"
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

                  <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        Per-sheet Output Statistics
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/20 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                          <tr>
                            <th className="px-4 py-3">Sheet Name</th>
                            <th className="px-4 py-3">Output File</th>
                            <th className="px-4 py-3">Total Rows</th>
                            <th className="px-4 py-3">Lookups (Matched/Missed)</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 font-medium">
                          {transformOutputs.map((out: any, index: number) => {
                            const stats = out.lookupStats ?? out.lookup_stats ?? [];
                            const matched = stats.reduce((s: number, l: any) => s + (l.matched ?? 0), 0);
                            const missed = stats.reduce((s: number, l: any) => s + (l.missed ?? 0), 0);
                            
                            return (
                              <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30">
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{out.sheetName}</td>
                                <td className="px-4 py-3 text-slate-500 font-mono truncate max-w-[150px]" title={out.fileName}>{out.fileName}</td>
                                <td className="px-4 py-3 font-bold tabular-nums">{out.totalRows ?? out.total_rows ?? 0}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{matched}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className={missed > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-400 font-bold"}>{missed}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => downloadFile(out.transformedS3Key, out.fileName)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex"
                                    title="Download this file"
                                  >
                                    <Download size={13} />
                                  </button>
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

              {/* Generic Error message display */}
              {isGenericError && errorMsg && !isDataValidation && !isSchemaValidation && !isDataCleaning && !isDataTransformation && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex gap-3 items-start shadow-sm">
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="font-bold text-xs">Error details</h5>
                    <p className="mt-1.5 text-xs text-rose-700 font-mono whitespace-pre-wrap break-all leading-5">
                      {errorMsg}
                    </p>
                  </div>
                </div>
              )}

              {/* General details formatting */}
              {details && !isDataValidation && !isSchemaValidation && !isDataCleaning && !isDataTransformation && (
                <div className="space-y-2">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Operation Metadata
                  </h5>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-[11px] font-mono overflow-auto max-h-72 leading-5 shadow-inner">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </div>
              )}

              {/* No details metadata */}
              {!details && (
                <div className="p-8 text-center bg-white border border-slate-200/50 rounded-xl shadow-sm text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-1.5">
                  <Info size={20} className="text-slate-300" />
                  <span>No granular metadata or issue logs captured for this activity.</span>
                </div>
              )}
            </div>

            {/* Right Column: File State Snapshot Download */}
            <div className="space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                  File State Snapshot
                </h4>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] leading-4 text-slate-400 font-bold">
                  Download the specific version of files active in the project workspace at this timestamp:
                </p>

                {fileStates.length > 0 ? (
                  fileStates.map((file: any) => {
                    const isSource = file.slot === "source";
                    const isMaster = file.slot === "master";
                    
                    return (
                      <div
                        key={file.id || file.s3Key}
                        className="bg-white dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSource ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                            isMaster ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                            "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
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
                                "bg-purple-100 text-purple-800"
                              }`}>
                                {file.slot}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              Size: {file.fileSize || "Unknown"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadFile(file.s3Key, file.fileName)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors shrink-0"
                          title={`Download ${file.fileName}`}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center bg-white dark:bg-[#0F172A] border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-1.5">
                    <Database size={18} className="text-slate-300" />
                    <span>No active file state snapshot captured at this timestamp.</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivityLogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { currentProject } = useMigration();

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-[#0F172A]">
        <div className="max-w-md text-center space-y-4">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">No active project workspace</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Please select or create a project first to view the activity audit logs.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    );
  }

  // Parse activities from current project
  const logs: AuditLog[] = (currentProject.activities || []).map((act: any) => ({
    id: act.id,
    timestamp: new Date(act.timestamp).toLocaleString(),
    category: act.category as any,
    actor: act.actor,
    description: act.description,
    status: act.status as any,
    details: act.details,
    fileStates: act.fileStates,
  }));

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.actor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || log.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const warningCount = logs.filter(l => l.status === "Warning").length;
  const errorCount = logs.filter(l => l.status === "Error").length;
  const successCount = logs.filter(l => l.status === "Success").length;
  const successRate = logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 100;

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden select-none bg-[#f8fafc] dark:bg-[#0F172A]">

      {/* Back link */}
      <div className="flex-none">
        <Link
          href="/"
          className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
        >
          <span>&lt;</span>
          <span>Back to Workspace</span>
        </Link>
      </div>

      {/* Title and Description */}
      <div className="flex-none flex flex-col space-y-1 border-b border-slate-200/60 dark:border-slate-800 pb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Activity Log — {currentProject.name}
        </h3>
        <span className="text-sm text-slate-400 dark:text-slate-500">
          Review operations, file history, and validation audit trails. Click any log entry to view details.
        </span>
      </div>

      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-none">

        <div className="bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
              <path d="M22 7c0 2.761-4.477 5-10 5S2 9.761 2 7" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Total Operations</span>
            <span className="block text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{logs.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800/30 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Warnings / Errors</span>
            <span className="block text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{warningCount + errorCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Success Rate</span>
            <span className="block text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{successRate}%</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800/30 text-violet-600 dark:text-violet-400 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400">Active Files</span>
            <span className="block text-2xl font-bold text-violet-600 dark:text-violet-400 mt-0.5">
              {currentProject.files?.filter((f: any) => f.isActive).length || 0}
            </span>
          </div>
        </div>

      </div>

      {/* Controls */}
      <div className="flex-none flex flex-col md:flex-row gap-3 items-center justify-between">

        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by actor or description..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-[#1E293B]"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {["All", "Transformation", "Mapping", "Validation", "Upload", "System"].map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 border-transparent text-white shadow-sm"
                    : "bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Logs Table */}
      <div className="flex-1 bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-700 rounded-xl p-5 shadow-sm min-h-[350px] overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <th className="pb-3 pl-3">Timestamp</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-sm text-slate-700 dark:text-slate-200">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 border-l-2 border-l-transparent hover:border-l-blue-500 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 pl-3 font-mono text-xs text-slate-400">{log.timestamp}</td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        log.category === "Transformation" ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" :
                        log.category === "Mapping" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" :
                        log.category === "Validation" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                        log.category === "Upload" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                        "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      }`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-700 dark:text-slate-300 font-semibold">{log.actor}</td>
                    <td className="py-3.5 text-slate-500 dark:text-slate-400 font-medium max-w-[350px] truncate">{log.description}</td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        log.status === "Success" ? "bg-emerald-50 text-emerald-700" :
                        log.status === "Warning" ? "bg-amber-50 text-amber-600" :
                        "bg-rose-50 text-rose-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          log.status === "Success" ? "bg-emerald-600" :
                          log.status === "Warning" ? "bg-amber-500" :
                          "bg-rose-500"
                        }`} />
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white transition-colors text-slate-600 dark:text-slate-300"
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No activity logs found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

    </div>
  );
}
