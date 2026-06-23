"use client";

import React, { useRef, useState } from "react";
import { useMigration } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Hash,
  Loader2,
  Search,
  ScanSearch,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface ColumnStat {
  field: string;
  unique_count: number;
  unique_values: string[];
}

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function UniqueIdentifierPage() {
  const { currentProject } = useMigration();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [moduleFile, setModuleFile] = useState<{
    s3Key: string; fileName: string; fileSize: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [results, setResults] = useState<ColumnStat[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const projectSourceFile = currentProject?.files?.find(
    (f) => f.slot === "source" && f.isActive
  );

  const activeFile = moduleFile ?? (
    projectSourceFile
      ? { s3Key: projectSourceFile.s3Key, fileName: projectSourceFile.fileName, fileSize: projectSourceFile.fileSize }
      : null
  );
  const isModuleOverride = moduleFile !== null;
  const busy = analyzing || uploading;
  const hasResults = results !== null && !analyzing;
  const totalUnique = results?.reduce((s, c) => s + c.unique_count, 0) ?? 0;

  async function analyze(s3Key: string, fileName: string) {
    setAnalyzing(true);
    setError(null);
    setResults(null);
    setExpanded(new Set());
    setSearch("");
    try {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/api/unique-identifier/analyze?source_key=${encodeURIComponent(s3Key)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || "Analysis failed");
      setActiveKey(s3Key);
      setActiveFileName(fileName);
      setResults(data.columns);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFileSelected(file: File) {
    if (!currentProject) {
      setError("No active project. Please select a project first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/unique-identifier/upload`, {
        method: "POST",
        headers: { "x-project-id": currentProject.id },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || "Upload failed");
      const next = { s3Key: data.s3Key, fileName: data.fileName, fileSize: data.fileSize };
      setModuleFile(next);
      await analyze(next.s3Key, next.fileName);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDelete() {
    setModuleFile(null);
    setResults(null);
    setActiveKey(null);
    setActiveFileName(null);
    setError(null);
    if (projectSourceFile) {
      analyze(projectSourceFile.s3Key, projectSourceFile.fileName);
    }
  }

  async function handleDownload() {
    if (!activeKey) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/api/unique-identifier/download?source_key=${encodeURIComponent(activeKey)}`
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unique_identifier_${activeFileName?.replace(/\.[^.]+$/, "") ?? "output"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  function toggleExpand(field: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  const filteredResults = results?.filter((c) =>
    c.field.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-[#0F172A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">

        {/* ── Page header ── */}
        <header className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
            <Hash size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-100">
              Unique Identifier
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Discover every distinct non-blank value in each column of a source file.
            </p>
          </div>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.sql"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f);
            e.target.value = "";
          }}
        />

        {/* ── Two-panel card ── */}
        <article className={cx(
          "relative overflow-hidden rounded-2xl border bg-white dark:bg-[#1E293B] shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.06)] transition-all duration-300",
          activeFile ? "border-emerald-200 dark:border-emerald-700/50" : "border-slate-200 dark:border-slate-700"
        )}>
          {/* Accent bar */}
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 to-emerald-600" />

          <div className="flex flex-col lg:flex-row">

            {/* ── LEFT: file info ── */}
            <div className="flex flex-col justify-between gap-5 p-6 lg:w-[400px] xl:w-[440px] shrink-0">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30">
                      <FileSpreadsheet size={20} strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                          Source File
                        </span>
                        {activeFile && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                            <Check size={10} strokeWidth={3} />
                            {isModuleOverride ? "Custom File" : "Project File"}
                          </span>
                        )}
                      </div>
                      <h3 className="text-[15px] font-bold tracking-tight text-slate-950 dark:text-slate-100">
                        Source Data
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Raw records to extract unique values from.
                      </p>
                    </div>
                  </div>
                  {isModuleOverride && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={busy}
                      aria-label="Remove custom file"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="mt-5">
                  {uploading ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
                      <div className="flex items-center gap-3">
                        <Loader2 size={15} className="animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Uploading…</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Saving to S3 workspace</p>
                        </div>
                      </div>
                    </div>
                  ) : activeFile ? (
                    <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                          <FileCheck2 size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                            {activeFile.fileName}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                            {activeFile.fileSize} · Ready for analysis
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-3.5 py-3.5 text-left transition-all hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 focus:outline-none"
                    >
                      <span>
                        <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Choose file</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                          .xlsx · .xls · .csv · .sql
                        </span>
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600">
                        <Upload size={14} />
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className={cx(
                  "rounded-full px-2.5 py-1 ring-1 text-[10px] font-bold",
                  uploading
                    ? "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-600/30"
                    : activeFile
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30"
                      : "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-600/30"
                )}>
                  {uploading ? "Uploading" : activeFile ? (isModuleOverride ? "Custom File" : "Project Source") : "Pending"}
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 transition-colors hover:text-emerald-700 dark:hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {activeFile ? "Replace" : "Browse"}
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Vertical divider (desktop) */}
            <div className="hidden lg:block w-px self-stretch bg-slate-100 dark:bg-slate-700/60" />
            {/* Horizontal divider (mobile) */}
            <div className="lg:hidden border-t border-slate-100 dark:border-slate-700/60 mx-6" />

            {/* ── RIGHT: metrics / CTA ── */}
            <div className="flex flex-1 flex-col justify-center bg-slate-50/60 dark:bg-slate-800/20 rounded-b-2xl lg:rounded-r-2xl lg:rounded-bl-none">

              {/* No file */}
              {!activeFile && !uploading && (
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700/60 ring-1 ring-slate-200 dark:ring-slate-600/40">
                    <ScanSearch size={24} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No file selected</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Upload or select a source file to get started.
                    </p>
                  </div>
                </div>
              )}

              {/* Uploading */}
              {uploading && (
                <div className="flex flex-col items-center justify-center gap-3 px-8 py-10 text-center">
                  <Loader2 size={28} className="animate-spin text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Uploading file…</p>
                </div>
              )}

              {/* File ready, no results */}
              {activeFile && !hasResults && !analyzing && !uploading && (
                <div className="flex flex-col items-center justify-center gap-5 px-8 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-100 dark:ring-indigo-800/30">
                    <Hash size={26} className="text-indigo-600 dark:text-indigo-400" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Ready to analyze</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Scan{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {activeFile.fileName}
                      </span>{" "}
                      to extract unique values per column.
                    </p>
                  </div>
                  <button
                    onClick={() => analyze(activeFile.s3Key, activeFile.fileName)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-600/20 transition-all duration-200 cursor-pointer"
                  >
                    <ScanSearch size={15} />
                    Analyze File
                  </button>
                </div>
              )}

              {/* Analyzing */}
              {analyzing && (
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
                  <div className="relative flex h-14 w-14 items-center justify-center">
                    <div className="absolute inset-0 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-100 dark:ring-indigo-800/30" />
                    <Loader2 size={24} className="relative animate-spin text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Analyzing…</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Extracting unique values from each column.
                    </p>
                  </div>
                </div>
              )}

              {/* Results metrics */}
              {hasResults && (
                <div className="flex flex-col gap-5 p-6 lg:p-8">

                  {/* Stat blocks */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white dark:bg-slate-800/80 p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Columns
                      </p>
                      <p className="mt-1.5 text-4xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                        {results!.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/30 p-4 ring-1 ring-indigo-100 dark:ring-indigo-800/30">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-500 dark:text-indigo-400">
                        Unique Values
                      </p>
                      <p className="mt-1.5 text-4xl font-black tracking-tight text-indigo-600 dark:text-indigo-300 tabular-nums">
                        {totalUnique.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* File name badge */}
                  <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800/60 px-3 py-2 ring-1 ring-slate-200 dark:ring-slate-700">
                    <FileCheck2 size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {activeFileName}
                    </span>
                  </div>

                  {/* Download */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-600/20 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Download Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </article>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/70 dark:bg-red-900/20 px-4 py-3.5">
            <X size={14} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* ── Results: search + column cards ── */}
        {hasResults && (
          <div className="flex flex-col gap-3">

            {/* Search row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search columns…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] pl-9 pr-9 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors shadow-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                {filteredResults?.length ?? 0} of {results!.length}
              </span>
            </div>

            {filteredResults?.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  No columns match &ldquo;{search}&rdquo;
                </p>
              </div>
            )}

            {/* Column cards */}
            <div className="flex flex-col gap-2">
              {filteredResults?.map((col) => {
                const isOpen = expanded.has(col.field);
                const hasValues = col.unique_count > 0;
                return (
                  <div
                    key={col.field}
                    className={cx(
                      "overflow-hidden rounded-xl border bg-white dark:bg-[#1E293B] transition-all duration-200",
                      isOpen
                        ? "border-indigo-200 dark:border-indigo-700/50 shadow-[0_0_0_3px_rgba(99,102,241,0.06)]"
                        : "border-slate-200 dark:border-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    )}
                  >
                    <button
                      onClick={() => toggleExpand(col.field)}
                      className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/20"
                    >
                      <span className={cx(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                        isOpen
                          ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                          : "bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500"
                      )}>
                        {isOpen
                          ? <ChevronDown size={13} strokeWidth={2.5} />
                          : <ChevronRight size={13} strokeWidth={2.5} />
                        }
                      </span>
                      <span className="flex-1 truncate text-sm font-bold text-slate-800 dark:text-slate-200">
                        {col.field}
                      </span>
                      <span className={cx(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 tabular-nums",
                        hasValues
                          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-indigo-100 dark:ring-indigo-800/30"
                          : "bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-slate-600/30"
                      )}>
                        {col.unique_count.toLocaleString()}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/20 px-5 py-4">
                        {!hasValues ? (
                          <p className="text-[12px] italic text-slate-400 dark:text-slate-500">
                            No non-blank values found.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {col.unique_values.map((v, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-full bg-white dark:bg-slate-700/80 px-3 py-1 text-[12px] font-medium text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600/50 shadow-sm"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
