"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useMigration } from "@/context/MigrationContext";
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
  Search
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

// Highly reliable inline dynamic counting component
function AnimatedCount({ target, duration = 850, suffix = "" }: { target: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let timerId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) {
        timerId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    timerId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(timerId);
  }, [target, duration]);

  return <>{count}{suffix}</>;
}

// Reusable detailed modal for granular log analytics and downloads
function LogDetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const [issueSearch, setIssueSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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

  // Parse if it is a data validation activity
  const isDataValidation = log.category === "Validation" && details && typeof details === "object" && "issues" in details;
  const issues = isDataValidation && Array.isArray(details.issues) ? details.issues : [];

  const filteredIssues = issues.filter((issue: any) => {
    const term = issueSearch.toLowerCase();
    return (
      String(issue.row).includes(term) ||
      String(issue.field).toLowerCase().includes(term) ||
      String(issue.issue_type).toLowerCase().includes(term) ||
      String(issue.value).toLowerCase().includes(term) ||
      String(issue.expected).toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / itemsPerPage));
  const paginatedIssues = filteredIssues.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Parse if it is a schema validation activity
  const isSchemaValidation = (log.category === "Validation" || log.category === "System") && details && typeof details === "object" && "schema_valid" in details;
  const schemaResult = isSchemaValidation ? details : null;

  // Generic errors
  const isGenericError = log.status === "Error" || (details && typeof details === "object" && "error" in details);
  const errorMsg = details && typeof details === "object" && "error" in details ? details.error : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm sm:p-6 animate-fade-in">
      <div className="flex h-full max-h-[85vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-2xl animate-scale-up-modal">
        
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-6 py-4.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
                log.category === "Transformation" ? "bg-purple-50 text-purple-700 ring-1 ring-purple-100" :
                log.category === "Mapping" ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" :
                log.category === "Validation" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" :
                log.category === "Upload" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" :
                "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
              }`}>
                {log.category}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${
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
            <h3 className="text-[17px] font-black tracking-tight text-slate-950 dark:text-white">
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
              <span className="rounded bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 font-extrabold">{fileStates.length}</span>
            </div>
          )}
        </div>

        {/* Modal Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 bg-slate-50/45 dark:bg-[#0F172A]/50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full">
            
            {/* Left Column: Granular Reports / Logs */}
            <div className="lg:col-span-2 space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="text-[12px] font-black uppercase tracking-wider text-slate-400">
                  Granular Details
                </h4>
              </div>

              {/* Data Validation Output UI */}
              {isDataValidation && (
                <div className="space-y-4">
                  {/* Stats tiles */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Records Checked</p>
                      <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{details.total_records ?? "N/A"}</p>
                    </div>
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Issues Detected</p>
                      <p className={`text-2xl font-black mt-1 ${issues.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {details.total_issues ?? issues.length}
                      </p>
                    </div>
                  </div>

                  {/* Issues search and grid */}
                  {issues.length > 0 ? (
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-50/30 dark:bg-slate-800/30">
                        <Search size={14} className="text-slate-400" />
                        <input
                          type="text"
                          value={issueSearch}
                          onChange={(e) => {
                            setIssueSearch(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Filter issues..."
                          className="w-full text-xs font-semibold focus:outline-none bg-transparent dark:text-slate-200 dark:placeholder-slate-500"
                        />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                              <th className="px-3 py-2.5">Row</th>
                              <th className="px-3 py-2.5">Field</th>
                              <th className="px-3 py-2.5">Issue Type</th>
                              <th className="px-3 py-2.5">Value</th>
                              <th className="px-3 py-2.5">Expected</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 font-medium">
                            {paginatedIssues.map((issue: any, index: number) => (
                              <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30">
                                <td className="px-3 py-2.5 font-bold text-slate-400 dark:text-slate-500 font-mono">{issue.row}</td>
                                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-200">{issue.field}</td>
                                <td className="px-3 py-2.5">
                                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10.5px] font-bold">
                                    {issue.issue_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-slate-600 truncate max-w-[120px]">{issue.value === null || issue.value === "" ? <span className="italic text-slate-300">empty</span> : String(issue.value)}</td>
                                <td className="px-3 py-2.5 text-slate-500 truncate max-w-[150px]">{issue.expected}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Pagination Controls */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span>
                          Showing {filteredIssues.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredIssues.length)} of {filteredIssues.length} issues
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="px-2">{currentPage} / {totalPages}</span>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
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
                  {/* Summary Metric tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 p-3 rounded-xl shadow-sm">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Source Fields</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{schemaResult.source_field_count ?? 0}</p>
                    </div>
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 p-3 rounded-xl shadow-sm">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Mapping Fields</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{schemaResult.mapping_field_count ?? 0}</p>
                    </div>
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 p-3 rounded-xl shadow-sm">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Matched Fields</p>
                      <p className="text-xl font-black text-emerald-600 mt-1">{schemaResult.matched_field_count ?? 0}</p>
                    </div>
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 p-3 rounded-xl shadow-sm">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Discrepancies</p>
                      <p className={`text-xl font-black mt-1 ${schemaResult.schema_valid ? "text-emerald-600" : "text-rose-600"}`}>
                        {((schemaResult.missing_fields?.length || 0) + (schemaResult.additional_fields?.length || 0))}
                      </p>
                    </div>
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
                        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
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
                        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
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

              {/* Generic Error message display */}
              {isGenericError && errorMsg && !isDataValidation && !isSchemaValidation && (
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
              {details && !isDataValidation && !isSchemaValidation && (
                <div className="space-y-2">
                  <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
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
                <h4 className="text-[12px] font-black uppercase tracking-wider text-slate-400">
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
                              <span className="text-[12.5px] font-black text-slate-900 dark:text-slate-200 truncate" title={file.fileName}>
                                {file.fileName}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase tracking-wide shrink-0 ${
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
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#002BFF] hover:bg-slate-100 transition-colors shrink-0"
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
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { currentProject } = useMigration();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-[#0F172A]">
        <div className="max-w-md text-center space-y-4">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">No active project workspace</h3>
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
    <div className="p-5 sm:p-7 lg:p-9 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden select-none bg-white dark:bg-[#0F172A]">
      
      {/* CSS Animations Injection */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.97) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUpModal {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-up {
          animation: scaleUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-row {
          animation: fadeInRow 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-scale-up-modal {
          animation: scaleUpModal 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Back link */}
      <div className="flex-none opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <Link
          href="/"
          className="text-[#002BFF] text-[14px] font-black hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
        >
          <span>&lt;</span>
          <span>Back to Workspace</span>
        </Link>
      </div>

      {/* Title and Description */}
      <div className="flex-none flex flex-col space-y-1 border-b border-slate-100/60 pb-3.5 opacity-0 animate-scale-up" style={{ animationDelay: "100ms" }}>
        <h3 className="text-[20px] font-black text-[#000839] dark:text-white">
          System Activity Log — {currentProject.name}
        </h3>
        <span className="text-[14.5px] font-bold text-slate-400 dark:text-slate-400">
          Review real-time operations, file history, and validation audit trails. Click any log entry to view details.
        </span>
      </div>

      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        
        {/* Metric 1: Total Operations */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-700 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 border border-blue-500/20 text-[#002BFF] dark:text-blue-400 rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
              <path d="M22 7c0 2.761-4.477 5-10 5S2 9.761 2 7" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Total Operations</span>
            <span className="block text-[25px] font-black text-[#000839] dark:text-white">
              <AnimatedCount target={logs.length} />
            </span>
          </div>
        </div>

        {/* Metric 2: Warnings/Errors */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-700 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 border border-amber-500/20 text-[#d97706] dark:text-amber-400 rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Warnings/Errors</span>
            <span className="block text-[25px] font-black text-[#d97706]">
              <AnimatedCount target={warningCount + errorCount} />
            </span>
          </div>
        </div>

        {/* Metric 3: Success Rate */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-700 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-[#e6f4ea] dark:bg-emerald-900/30 border border-[#e6f4ea]/45 text-[#137333] dark:text-emerald-400 rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Success Rate</span>
            <span className="block text-[25px] font-black text-[#137333]">
              <AnimatedCount target={successRate} suffix="%" />
            </span>
          </div>
        </div>

        {/* Metric 4: Active Files */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-700 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 border border-purple-500/20 text-[#7c3aed] dark:text-purple-400 rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Active Files</span>
            <span className="block text-[25px] font-black text-[#7c3aed] dark:text-purple-400">
              <AnimatedCount target={currentProject.files?.filter((f: any) => f.isActive).length || 0} />
            </span>
          </div>
        </div>

      </div>

      {/* Interactive Controls Panel */}
      <div className="flex-none flex flex-col md:flex-row gap-4 items-center justify-between opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        
        {/* Search */}
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by actor or description..."
            className="w-full pl-11 pr-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-600 text-[#000839] dark:text-white text-[14.5px] font-black placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/10 bg-white dark:bg-[#1E293B]"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Filter Categories */}
        <div className="flex items-center gap-2.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {["All", "Transformation", "Mapping", "Validation", "Upload", "System"].map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-3 rounded-xl text-[13.5px] font-black border transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#002BFF] border-transparent text-white shadow-md shadow-blue-500/10"
                    : "bg-white dark:bg-[#1E293B] border-slate-200/60 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Logs Table Grid */}
      <div className="flex-1 bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-700 rounded-2xl p-6 lg:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.008)] min-h-[350px] overflow-hidden flex flex-col opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100/85 dark:border-slate-700 text-[14.5px] font-black text-slate-400 uppercase tracking-tight">
                <th className="pb-4 pl-3">Timestamp</th>
                <th className="pb-4">Category</th>
                <th className="pb-4">Actor</th>
                <th className="pb-4">Action Description</th>
                <th className="pb-4">Status</th>
                <th className="pb-4 text-right pr-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-[15.5px] font-bold text-[#000839] dark:text-slate-200">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => (
                  <tr 
                    key={log.id || idx} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 hover:border-l-[#002BFF] border-l-4 border-l-transparent cursor-pointer transition-all opacity-0 animate-row"
                    style={{ animationDelay: `${300 + idx * 35}ms` }}
                  >
                    <td className="py-4.5 pl-3 font-mono text-[14px] text-slate-400">{log.timestamp}</td>
                    <td className="py-4.5">
                      <span className={`px-3 py-1.5 rounded-xl text-[12.5px] font-black ${
                        log.category === "Transformation" ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100/40 dark:border-purple-800/30" :
                        log.category === "Mapping" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100/40 dark:border-blue-800/30" :
                        log.category === "Validation" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100/40 dark:border-amber-800/30" :
                        log.category === "Upload" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100/40 dark:border-emerald-800/30" :
                        "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200/40 dark:border-slate-600/40"
                      }`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="py-4.5 text-[#000839]/85 dark:text-slate-300 font-black">{log.actor}</td>
                    <td className="py-4.5 text-[#000839]/70 dark:text-slate-400 font-medium max-w-[350px] truncate">{log.description}</td>
                    <td className="py-4.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-black ${
                        log.status === "Success" ? "bg-[#e6f4ea] text-[#137333]" :
                        log.status === "Warning" ? "bg-amber-50 text-amber-600" :
                        "bg-[#fff5f5] text-[#e11d48]"
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          log.status === "Success" ? "bg-[#137333]" :
                          log.status === "Warning" ? "bg-amber-600" :
                          "bg-[#e11d48]"
                        }`} />
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="py-4.5 text-right pr-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-700 hover:bg-[#002BFF] hover:text-white transition-all duration-200 text-[#002BFF] dark:text-blue-400"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-black">
                    No system log history found matching your search.
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
