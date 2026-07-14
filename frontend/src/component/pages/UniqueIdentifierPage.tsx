"use client";

import React, { useRef, useState } from "react";
import { useMigration } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Eye,
  EyeOff,
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

// ── Types ──────────────────────────────────────────────────────────────────────

type TypeSource = "mapping" | "db_schema" | "auto_detected";

interface ColumnStat {
  field: string;
  unique_count: number;
  unique_values: string[];
  detected_type?: string;
  type_source?: TypeSource;
}

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

// ── DB form styling constants ──────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500";

// Default port for each DB type
const DB_PORTS: Record<string, string> = {
  PostgreSQL: "5432",
  MySQL: "3306",
  MongoDB: "27017",
  "SQL Server": "1433",
};

type DbType = "PostgreSQL" | "MySQL" | "MongoDB" | "SQL Server";

// ── Type display constants ─────────────────────────────────────────────────────


const SOURCE_LABEL: Record<TypeSource, string> = {
  mapping:       "From Mapping",
  db_schema:     "From DB Schema",
  auto_detected: "Auto Detected",
};

const SOURCE_DOT_COLOR: Record<TypeSource, string> = {
  mapping:       "bg-violet-500",
  db_schema:     "bg-blue-500",
  auto_detected: "bg-amber-500",
};


// ── Component ──────────────────────────────────────────────────────────────────

export default function UniqueIdentifierPage() {
  const { currentProject } = useMigration();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Source state ───────────────────────────────────────────────────────────
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

  // ── DB source state ────────────────────────────────────────────────────────
  const [sourceMode, setSourceMode] = useState<"upload" | "database">("upload");
  const [dbType, setDbType] = useState<DbType>("PostgreSQL");
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState("5432");
  const [dbName, setDbName] = useState("");
  const [dbUsername, setDbUsername] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [dbAuthDatabase, setDbAuthDatabase] = useState("admin");
  const [dbTable, setDbTable] = useState("");
  const [dbFetching, setDbFetching] = useState(false);

  // ── Type metadata state (Priorities 2–4) ─────────────────────────────────
  const [dbSchema, setDbSchema] = useState<Record<string, string> | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [dismissedSource, setDismissedSource] = useState(false);

  // ── Derived values ─────────────────────────────────────────────────────────
  const projectSourceFile = currentProject?.files?.find(
    (f) => f.slot === "source" && f.isActive
  );
  const projectLogicFile = currentProject?.files?.find(
    (f) => f.slot === "logic" && f.isActive
  );

  const activeFile = moduleFile ?? (
    !dismissedSource && projectSourceFile
      ? { s3Key: projectSourceFile.s3Key, fileName: projectSourceFile.fileName, fileSize: projectSourceFile.fileSize }
      : null
  );
  const isModuleOverride = moduleFile !== null;
  const busy = analyzing || uploading || dbFetching;
  const hasResults = results !== null && !analyzing;
  const totalUnique = results?.reduce((s, c) => s + c.unique_count, 0) ?? 0;

  // ── Analysis ───────────────────────────────────────────────────────────────

  async function analyze(
    s3Key: string,
    fileName: string,
    schema?: Record<string, string> | null
  ) {
    setAnalyzing(true);
    setError(null);
    setResults(null);
    setExpanded(new Set());
    setSearch("");
    const logicKey = projectLogicFile?.s3Key;
    try {
      let url = `${NEXT_PUBLIC_API_URL}/api/unique-identifier/analyze?source_key=${encodeURIComponent(s3Key)}`;
      if (logicKey) url += `&logic_key=${encodeURIComponent(logicKey)}`;
      if (!logicKey && schema && Object.keys(schema).length > 0) {
        url += `&db_schema=${encodeURIComponent(JSON.stringify(schema))}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || "Analysis failed");
      setActiveKey(s3Key);
      setActiveFileName(fileName);
      setResults(data.columns);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
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
    setDbSchema(null);
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
      setDismissedSource(false);
      setModuleFile(next);
      await analyze(next.s3Key, next.fileName, null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDelete() {
    setResults(null);
    setActiveKey(null);
    setActiveFileName(null);
    setError(null);
    setDbSchema(null);
    if (isModuleOverride) {
      setModuleFile(null);
      if (projectSourceFile && !dismissedSource) {
        analyze(projectSourceFile.s3Key, projectSourceFile.fileName, null);
      }
    } else {
      setDismissedSource(true);
    }
  }

  async function handleDownload() {
    if (!activeKey) return;
    setDownloading(true);
    const logicKey = projectLogicFile?.s3Key;
    try {
      let downloadUrl = `${NEXT_PUBLIC_API_URL}/api/unique-identifier/download?source_key=${encodeURIComponent(activeKey)}`;
      if (logicKey) downloadUrl += `&logic_key=${encodeURIComponent(logicKey)}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unique_identifier_${activeFileName?.replace(/\.[^.]+$/, "") ?? "output"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed");
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

  // ── DB source helpers ──────────────────────────────────────────────────────

  function handleDbTypeChange(type: DbType) {
    setDbType(type);
    setDbPort(DB_PORTS[type] ?? "5432");
  }

  async function handleDbFetch() {
    if (!currentProject || dbFetching || !dbTable.trim()) return;
    setDbFetching(true);
    setError(null);
    setDbSchema(null);
    let fetched: { s3Key: string; fileName: string; fileSize: string } | null = null;
    let fetchedSchema: Record<string, string> | null = null;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-project-id": currentProject.id,
      };
      if (currentProject.clientId) {
        headers["x-client-id"] = currentProject.clientId;
      }
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/database/fetch`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          dbType,
          host: dbHost,
          port: parseInt(dbPort, 10) || 5432,
          database: dbName,
          username: dbUsername,
          password: dbPassword,
          auth_database: dbAuthDatabase,
          table: dbTable.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || "Failed to fetch data from database");
      fetched = { s3Key: data.s3Key, fileName: data.fileName, fileSize: data.fileSize };
      fetchedSchema = data.dbSchema ?? null;
      setModuleFile(fetched);
      if (fetchedSchema) setDbSchema(fetchedSchema);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Database fetch failed");
    } finally {
      setDbFetching(false);
    }
    if (fetched) {
      await analyze(fetched.s3Key, fetched.fileName, fetchedSchema);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">

        {/* ── Page header ── */}
        <header className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <Hash size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-slate-100">
              Unique Identifier
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Discover every distinct non-blank value in each column — from any file, database, or auto-profiled source.
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
          "relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.06)] transition-all duration-300",
          activeFile ? "border-emerald-200 dark:border-emerald-700/50" : "border-slate-200 dark:border-slate-700"
        )}>
          <div className="absolute inset-x-0 top-0 h-[3px] bg-emerald-600" />

          <div className="flex flex-col lg:flex-row">

            {/* ── LEFT: source selection ── */}
            <div className="flex flex-col gap-5 p-6 lg:w-[400px] xl:w-[440px] shrink-0">

              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30">
                    {sourceMode === "database" ? <Database size={20} strokeWidth={2.2} /> : <FileSpreadsheet size={20} strokeWidth={2.2} />}
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {sourceMode === "upload" ? "Source File" : "Source Database"}
                      </span>
                      {activeFile && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                          <Check size={10} strokeWidth={3} />
                          {isModuleOverride ? (sourceMode === "database" ? "DB Fetched" : "Custom File") : "Project File"}
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                      Source Data
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {sourceMode === "upload"
                        ? "Raw records to extract unique values from."
                        : "Connect to a database to load source records."}
                    </p>
                  </div>
                </div>
                {isModuleOverride && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    aria-label="Remove custom source"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Source mode toggle */}
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700/60 p-0.5 gap-0.5">
                {(["upload", "database"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSourceMode(mode)}
                    className={cx(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all",
                      sourceMode === mode
                        ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    {mode === "upload" ? <Upload size={12} /> : <Database size={12} />}
                    {mode === "upload" ? "Upload File" : "Fetch from Database"}
                  </button>
                ))}
              </div>

              {/* ── Upload File mode ── */}
              {sourceMode === "upload" && (
                <div className="flex flex-col justify-between gap-5 flex-1">
                  <div>
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
                            <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                              {activeFile.fileName}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                              {activeFile.fileSize} · Ready for analysis
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={busy}
                            aria-label="Remove file"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 dark:hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-3.5 py-3.5 text-left transition-all hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 focus:outline-none"
                      >
                        <span>
                          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Choose file</span>
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

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className={cx(
                      "rounded-full px-2.5 py-1 ring-1 text-[10px] font-semibold",
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
              )}

              {/* ── Fetch from Database mode ── */}
              {sourceMode === "database" && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Database Type</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(["PostgreSQL", "MySQL", "MongoDB", "SQL Server"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleDbTypeChange(type)}
                          className={cx(
                            "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all",
                            dbType === type
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>Host</label>
                      <input type="text" value={dbHost} onChange={(e) => setDbHost(e.target.value)}
                        placeholder="e.g. localhost" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Port</label>
                      <input type="text" value={dbPort} onChange={(e) => setDbPort(e.target.value)}
                        className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Database Name</label>
                    <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)}
                      placeholder="e.g. salesforce_migration" className={inputCls} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Username</label>
                      <input type="text" value={dbUsername} onChange={(e) => setDbUsername(e.target.value)}
                        placeholder="e.g. admin" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Password</label>
                      <div className="relative">
                        <input
                          type={showDbPassword ? "text" : "password"}
                          value={dbPassword}
                          onChange={(e) => setDbPassword(e.target.value)}
                          placeholder="••••••••"
                          className={cx(inputCls, "pr-8")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowDbPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showDbPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {dbType === "MongoDB" && (
                    <div>
                      <label className={labelCls}>Authentication Database</label>
                      <input type="text" value={dbAuthDatabase} onChange={(e) => setDbAuthDatabase(e.target.value)}
                        placeholder="admin" className={inputCls} />
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>{dbType === "MongoDB" ? "Collection Name" : "Table Name"}</label>
                    <input
                      type="text"
                      value={dbTable}
                      onChange={(e) => setDbTable(e.target.value)}
                      placeholder={dbType === "MongoDB" ? "e.g. orders" : "e.g. public.users"}
                      className={inputCls}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDbFetch}
                    disabled={!dbTable.trim() || dbFetching || analyzing || !currentProject}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:active:scale-100"
                  >
                    {dbFetching
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Database size={14} />}
                    {dbFetching ? "Fetching…" : "Fetch & Analyze"}
                  </button>

                  {activeFile && isModuleOverride && !dbFetching && (
                    <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3">
                      <div className="flex items-center gap-2.5">
                        <FileCheck2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                            {activeFile.fileName}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                            {activeFile.fileSize}
                            {dbSchema && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-500 dark:text-blue-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                DB schema loaded
                              </span>
                            )}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={busy}
                          aria-label="Remove fetched data"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 dark:hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vertical divider (desktop) */}
            <div className="hidden lg:block w-px self-stretch bg-slate-100 dark:bg-slate-700/60" />
            {/* Horizontal divider (mobile) */}
            <div className="lg:hidden border-t border-slate-100 dark:border-slate-700 mx-6" />

            {/* ── RIGHT: metrics / CTA ── */}
            <div className="flex flex-1 flex-col justify-center bg-slate-50/60 dark:bg-slate-800/20 rounded-b-2xl lg:rounded-r-2xl lg:rounded-bl-none">

              {!activeFile && !uploading && !dbFetching && (
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700/60 ring-1 ring-slate-200 dark:ring-slate-600/40">
                    <ScanSearch size={24} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No source selected</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {sourceMode === "upload"
                        ? "Upload or select a source file to get started."
                        : "Fill in the connection details and click Fetch & Analyze."}
                    </p>
                  </div>
                </div>
              )}

              {uploading && (
                <div className="flex flex-col items-center justify-center gap-3 px-8 py-10 text-center">
                  <Loader2 size={28} className="animate-spin text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Uploading file…</p>
                </div>
              )}

              {dbFetching && (
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
                  <div className="relative flex h-14 w-14 items-center justify-center">
                    <div className="absolute inset-0 rounded-2xl bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-700/30" />
                    <Loader2 size={24} className="relative animate-spin text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Fetching from database…</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Loading <span className="font-semibold">{dbTable || "data"}</span> and detecting column types
                    </p>
                  </div>
                </div>
              )}

              {activeFile && !hasResults && !analyzing && !uploading && !dbFetching && (
                <div className="flex flex-col items-center justify-center gap-5 px-8 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-700/30">
                    <Hash size={26} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Ready to analyze</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Scan{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {activeFile.fileName}
                      </span>{" "}
                      to extract unique values per column.
                    </p>
                  </div>
                  <button
                    onClick={() => analyze(activeFile.s3Key, activeFile.fileName, dbSchema)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 cursor-pointer"
                  >
                    <ScanSearch size={15} />
                    Analyze File
                  </button>
                </div>
              )}

              {analyzing && (
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
                  <div className="relative flex h-14 w-14 items-center justify-center">
                    <div className="absolute inset-0 rounded-2xl bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-700/30" />
                    <Loader2 size={24} className="relative animate-spin text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Analyzing…</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {projectLogicFile
                        ? "Filtering by Salesforce mapping types"
                        : dbSchema
                          ? "Mapping DB column types"
                          : "Auto-detecting column types"}
                    </p>
                  </div>
                </div>
              )}

              {hasResults && (
                <div className="flex flex-col gap-5 p-6 lg:p-8">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white dark:bg-slate-800/80 p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Columns
                      </p>
                      <p className="mt-1.5 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
                        {results!.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 p-4 ring-1 ring-blue-100 dark:ring-blue-700/30">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-500 dark:text-blue-400">
                        Unique Values
                      </p>
                      <p className="mt-1.5 text-4xl font-semibold tracking-tight text-blue-600 dark:text-blue-300 tabular-nums">
                        {totalUnique.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Detection source summary */}
                  {results && results.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(["mapping", "db_schema", "auto_detected"] as const).map((src) => {
                        const count = results.filter((c) => c.type_source === src).length;
                        if (count === 0) return null;
                        return (
                          <span key={src} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700/50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600/30">
                            <span className={cx("h-1.5 w-1.5 rounded-full", SOURCE_DOT_COLOR[src])} />
                            {count} {SOURCE_LABEL[src]}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800/60 px-3 py-2 ring-1 ring-slate-200 dark:ring-slate-700">
                    <FileCheck2 size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {activeFileName}
                    </span>
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
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

        {/* ── Results ── */}
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
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-9 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-400 dark:focus:border-blue-600 transition-colors shadow-sm"
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

            {/* Empty state */}
            {results!.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {projectLogicFile
                    ? "No Picklist or Checkbox fields available for unique value analysis."
                    : "No columns found in this file."}
                </p>
                {projectLogicFile && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Unique values are only shown for Picklist, Checkbox, and MultiSelect fields defined in your mapping logic file.
                  </p>
                )}
              </div>
            )}

            {results!.length > 0 && filteredResults?.length === 0 && (
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
                      "overflow-visible rounded-xl border bg-white dark:bg-slate-800 transition-all duration-200",
                      isOpen
                        ? "border-blue-300 dark:border-blue-600/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
                        : "border-slate-200 dark:border-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    )}
                  >
                    {/* Card header */}
                    <div className="flex w-full items-center gap-3 px-4 py-3.5">
                      {/* Expand toggle */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(col.field)}
                        className={cx(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                          isOpen
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                            : "bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500"
                        )}
                      >
                        {isOpen
                          ? <ChevronDown size={13} strokeWidth={2.5} />
                          : <ChevronRight size={13} strokeWidth={2.5} />
                        }
                      </button>

                      {/* Field name (click to expand) */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(col.field)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {col.field}
                        </span>
                      </button>


                      {/* Unique count badge */}
                      <span className={cx(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 tabular-nums",
                        hasValues
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-700/30"
                          : "bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-slate-600/30"
                      )}>
                        {col.unique_count.toLocaleString()}
                      </span>
                    </div>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="border-t border-slate-100 dark:border-slate-700">
                        {/* Type source strip */}
                        {col.type_source && (
                          <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              <span className={cx("h-1.5 w-1.5 rounded-full", SOURCE_DOT_COLOR[col.type_source])} />
                              {SOURCE_LABEL[col.type_source]}
                            </span>
                          </div>
                        )}

                        {/* Unique values */}
                        <div className="bg-slate-50/60 dark:bg-slate-800/20 px-4 py-3.5">
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

