"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, ChevronRight, Cloud, CloudUpload,
  Database, Eye, EyeOff, FileCheck2, FileSpreadsheet, Link2, Loader2,
  Plus, Search, Sparkles, Trash2, Upload, Wifi,
} from "lucide-react";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";
import { useMigration } from "@/context/MigrationContext";
import type { UploadedFile } from "@/context/MigrationContext";
import { emptySfConnection } from "@/context/MigrationContext";
import { SfInlineStatus } from "@/component/SfConnectionCard";

type FileSlot = "source" | "master" | "logic";

const FILE_SLOTS: Array<{
  slot: FileSlot; step: string; title: string; description: string; helper: string;
  tone: "emerald" | "blue" | "violet"; accept: string;
}> = [
  { slot: "source", step: "01", title: "Source Data", description: "Raw records exported from the source system.", helper: "Required source workbook", tone: "emerald", accept: ".xlsx, .xls, .sql, .csv" },
  { slot: "master", step: "02", title: "Salesforce Master Metadata", description: "Reference sheets for Salesforce targets and IDs.", helper: "Required metadata workbook", tone: "blue", accept: ".xlsx, .xls, .sql, .csv" },
  { slot: "logic", step: "03", title: "Mapping Logic", description: "Field mapping, data types, defaults, and rules.", helper: "Required mapping workbook", tone: "violet", accept: ".xlsx, .xls" },
];

const toneStyles = {
  emerald: {
    accent: "bg-emerald-500",
    icon: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30",
    badge: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30",
    progress: "bg-emerald-600",
  },
  blue: {
    accent: "bg-blue-500",
    icon: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-800/30",
    badge: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-800/30",
    progress: "bg-blue-600",
  },
  violet: {
    accent: "bg-blue-500",
    icon: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-700/30",
    badge: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-100 dark:ring-blue-700/30",
    progress: "bg-blue-600",
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children, variant = "primary", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "dark" }) {
  const variants = {
    primary: "bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
    secondary: "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50",
    danger: "border border-rose-200 dark:border-rose-700/40 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50",
    dark: "bg-slate-950 dark:bg-slate-700 text-white shadow-sm hover:bg-slate-800 dark:hover:bg-slate-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  };
  return (
    <button {...props} className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100", variants[variant], className)}>
      {children}
    </button>
  );
}

function UploadCard({ config, file, onUpload, onClear }: {
  config: (typeof FILE_SLOTS)[number]; file: UploadedFile | null; onUpload: () => void; onClear: () => void;
}) {
  const styles = toneStyles[config.tone];
  const isComplete = file?.completed && !file.loading;
  const isLoading = file?.loading;

  return (
    <article className={cx(
      "group relative overflow-hidden rounded-xl border bg-white dark:bg-slate-800 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_28px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
      isComplete ? "border-emerald-200 dark:border-emerald-700/50" : "border-slate-200 dark:border-slate-700"
    )}>
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
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Step {config.step}</span>
                  {isComplete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                      <Check size={11} strokeWidth={3} />Uploaded
                    </span>
                  )}
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">{config.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{config.description}</p>
              </div>
            </div>
            {isComplete && (
              <button type="button" onClick={onClear} aria-label={`Remove ${config.title}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400">
                <Trash2 size={15} />
              </button>
            )}
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{file.name}</span>
                  <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{file.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600">
                  <div className={cx("h-full rounded-full transition-all duration-150", styles.progress)} style={{ width: `${file.progress}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Saving securely to the S3 workspace.</p>
              </div>
            ) : isComplete ? (
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm">
                    <FileCheck2 size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{file.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{file.size} · Ready for processing</span>
                  </span>
                </div>
              </div>
            ) : (
              <button type="button" onClick={onUpload}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-3.5 py-3 text-left transition-all hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <span>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Choose file</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{config.helper}</span>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600">
                  <Upload size={15} />
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className={cx("rounded-full px-2 py-1 ring-1", isComplete ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30" : styles.badge)}>
            {isComplete ? "Complete" : isLoading ? "Uploading" : "Pending"}
          </span>
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-700 dark:hover:text-blue-400">
            {isComplete ? "Replace" : "Browse"}
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

const DB_TYPES = ["PostgreSQL", "MySQL", "MongoDB", "SQL Server", "SAP OData"] as const;
type DbType = (typeof DB_TYPES)[number];
const DB_DEFAULTS: Record<DbType, { port: string; tablePlaceholder: string; tableLabel: string }> = {
  PostgreSQL:    { port: "5432",  tablePlaceholder: "e.g. public.users",       tableLabel: "Table Name" },
  MySQL:         { port: "3306",  tablePlaceholder: "e.g. customers",           tableLabel: "Table Name" },
  MongoDB:       { port: "27017", tablePlaceholder: "e.g. orders",              tableLabel: "Collection Name" },
  "SQL Server":  { port: "1433",  tablePlaceholder: "e.g. dbo.contacts",        tableLabel: "Table Name" },
  "SAP OData":   { port: "",      tablePlaceholder: "e.g. A_BusinessPartner",   tableLabel: "Entity Set" },
};

function SourceDataCard({ file, onUpload, onClear, onModeChange }: {
  file: UploadedFile | null; onUpload: () => void; onClear: () => void;
  onModeChange?: (mode: "upload" | "database" | "salesforce") => void;
}) {
  const config = FILE_SLOTS[0];
  const styles = toneStyles[config.tone];
  const isComplete = file?.completed && !file.loading;
  const isLoading = file?.loading;

  const [sourceMode, setSourceMode] = useState<"upload" | "database" | "salesforce">("upload");
  const handleSourceMode = (mode: "upload" | "database" | "salesforce") => {
    setSourceMode(mode);
    onModeChange?.(mode);
  };
  const [dbType, setDbType] = useState<DbType>("PostgreSQL");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [dbName, setDbName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tableName, setTableName] = useState("");
  const [authDatabase, setAuthDatabase] = useState("admin");
  const [sapBaseUrl, setSapBaseUrl] = useState("");
  const [sapEntity, setSapEntity] = useState("A_BusinessPartner");

  // Connection / fetch status state
  const [connStatus, setConnStatus] = useState<"idle" | "testing" | "success" | "warning" | "error">("idle");
  const [connMessage, setConnMessage] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { currentProject, setUploadedFiles, refreshCurrentProject } = useMigration();

  const handleDbTypeChange = (type: DbType) => {
    setDbType(type);
    setPort(DB_DEFAULTS[type].port);
    setSapBaseUrl("");
    setSapEntity("A_BusinessPartner");
    setConnStatus("idle");
    setConnMessage("");
  };

  const handleTestConnection = async () => {
    if (connStatus === "testing") return;
    setConnStatus("testing");
    setConnMessage("");
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/database/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbType,
          host,
          port: parseInt(port, 10) || 0,
          database: dbName,
          username,
          password,
          auth_database: authDatabase,
          ...(dbType === "SAP OData" ? { sap_base_url: sapBaseUrl, sap_entity: sapEntity } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnStatus("error");
        setConnMessage(data.detail || "Connection failed");
      } else if (data.trust_auth_detected) {
        setConnStatus("warning");
        setConnMessage(data.message);
      } else {
        setConnStatus("success");
        setConnMessage(data.message || "Connection successful");
      }
    } catch (err: any) {
      setConnStatus("error");
      setConnMessage(err.message || "Connection failed");
    }
  };

  const handleFetchData = async () => {
    const entityForFetch = dbType === "SAP OData" ? sapEntity : tableName.trim();
    if (!currentProject || isFetching || !entityForFetch) return;
    setIsFetching(true);
    setFetchError(null);

    // Optimistic loading UI — mirrors what handleFileUpload does for upload mode
    const displayName = dbType === "SAP OData" ? sapEntity : tableName.trim();
    setUploadedFiles((prev) => ({
      ...prev,
      source: {
        name: `${displayName} (${dbType})`,
        size: "Fetching…",
        loading: true,
        progress: 0,
        completed: false,
      },
    }));

    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      const cap = Math.min(prog, 88);
      setUploadedFiles((prev) => {
        const item = prev["source"];
        if (!item?.loading) { clearInterval(interval); return prev; }
        return { ...prev, source: { ...item, progress: cap } };
      });
      if (prog >= 88) clearInterval(interval);
    }, 200);

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
          host,
          port: parseInt(port, 10) || 0,
          database: dbName,
          username,
          password,
          auth_database: authDatabase,
          table: dbType === "SAP OData" ? sapEntity : tableName.trim(),
          ...(dbType === "SAP OData" ? { sap_base_url: sapBaseUrl, sap_entity: sapEntity } : {}),
        }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to fetch data from database");
      }

      const data = await res.json();

      // Register the S3 file in the project DB — identical to what uploadFileToServer does
      const dbRes = await fetch(`/api/projects/${currentProject.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: "source",
          fileName: data.fileName,
          fileSize: data.fileSize,
          s3Key: data.s3Key,
        }),
      });
      const dbData = await dbRes.json();
      if (!dbData.success) throw new Error("Failed to register file in project");

      // Flip to complete state before project refresh so the card doesn't flash blank
      setUploadedFiles((prev) => ({
        ...prev,
        source: {
          name: data.fileName,
          size: data.fileSize,
          loading: false,
          progress: 100,
          completed: true,
        },
      }));
      await refreshCurrentProject();
    } catch (err: any) {
      clearInterval(interval);
      setFetchError(err.message || "Failed to fetch data");
      setUploadedFiles((prev) => ({ ...prev, source: null }));
    } finally {
      setIsFetching(false);
    }
  };

  const { tableLabel, tablePlaceholder } = DB_DEFAULTS[dbType];

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500";

  return (
    <article className={cx(
      "group relative overflow-hidden rounded-xl border bg-white dark:bg-slate-800 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_28px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
      isComplete && sourceMode === "upload" ? "border-emerald-200 dark:border-emerald-700/50" : "border-slate-200 dark:border-slate-700"
    )}>
      <div className={cx("absolute inset-x-0 top-0 h-1", isComplete && sourceMode === "upload" ? "bg-emerald-500" : styles.accent)} />

      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1", styles.icon)}>
              {sourceMode === "database" ? <Database size={21} strokeWidth={2.2} /> : <FileSpreadsheet size={21} strokeWidth={2.2} />}
            </span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Step {config.step}</span>
                {isComplete && sourceMode === "upload" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                    <Check size={11} strokeWidth={3} />Uploaded
                  </span>
                )}
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">{config.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{config.description}</p>
            </div>
          </div>
          {isComplete && sourceMode === "upload" && (
            <button type="button" onClick={onClear} aria-label="Remove Source Data"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400">
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Segmented Toggle */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700/60 p-0.5 gap-0.5">
          {(["upload", "database", "salesforce"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleSourceMode(mode)}
              className={cx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all",
                sourceMode === mode
                  ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              {mode === "upload" ? <Upload size={12} /> : mode === "database" ? <Database size={12} /> : <Cloud size={12} />}
              {mode === "upload" ? "Upload File" : mode === "database" ? "Connect Database" : "Salesforce"}
            </button>
          ))}
        </div>

        {/* Salesforce source mode */}
        {sourceMode === "salesforce" && (
          isLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{file!.name}</span>
                <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{file!.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600">
                <div className={cx("h-full rounded-full transition-all duration-150", styles.progress)} style={{ width: `${file!.progress}%` }} />
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Fetching from Salesforce…</p>
            </div>
          ) : isComplete ? (
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm">
                  <FileCheck2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{file!.name}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{file!.size} · Ready for processing</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-4 py-6 text-center">
              <Cloud size={20} className="mx-auto mb-2 text-slate-400 dark:text-slate-500" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Connect Source Salesforce below</p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Use the Source Salesforce card to select an object and fetch data.</p>
            </div>
          )
        )}

        {/* Upload mode — exact same content as UploadCard */}
        {sourceMode === "upload" && (
          <>
            <div>
              {isLoading ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{file.name}</span>
                    <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{file.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600">
                    <div className={cx("h-full rounded-full transition-all duration-150", styles.progress)} style={{ width: `${file.progress}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Saving securely to the S3 workspace.</p>
                </div>
              ) : isComplete ? (
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm">
                      <FileCheck2 size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{file.name}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{file.size} · Ready for processing</span>
                    </span>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={onUpload}
                  className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-3.5 py-3 text-left transition-all hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <span>
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Choose file</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{config.helper}</span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600">
                    <Upload size={15} />
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className={cx("rounded-full px-2 py-1 ring-1", isComplete ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30" : styles.badge)}>
                {isComplete ? "Complete" : isLoading ? "Uploading" : "Pending"}
              </span>
              <button type="button" onClick={onUpload} className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-700 dark:hover:text-blue-400">
                {isComplete ? "Replace" : "Browse"}
                <ChevronRight size={13} />
              </button>
            </div>
          </>
        )}

        {/* Database connection form */}
        {sourceMode === "database" && (
          <div className="space-y-3">
            {/* DB Type pills */}
            <div>
              <label className={labelCls}>Database Type</label>
              <div className="flex flex-wrap gap-1.5">
                {DB_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleDbTypeChange(type)}
                    className={cx(
                      "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all",
                      dbType === type
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {dbType === "SAP OData" ? (
              <>
                {/* SAP Server URL */}
                <div>
                  <label className={labelCls}>SAP Server URL</label>
                  <input type="text" value={sapBaseUrl} onChange={(e) => setSapBaseUrl(e.target.value)}
                    placeholder="e.g. https://mycompany.sap.com" className={inputCls} />
                </div>

                {/* Username + Password */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Username</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password}
                        onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                        className={cx(inputCls, "pr-8")} />
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200">
                        {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Entity Set */}
                <div>
                  <label className={labelCls}>Entity Set</label>
                  <input type="text" value={sapEntity} onChange={(e) => setSapEntity(e.target.value)}
                    placeholder="e.g. A_BusinessPartner" className={inputCls} />
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    Examples: A_BusinessPartner, A_Customer, A_Supplier
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Host + Port */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Host</label>
                    <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
                      placeholder="e.g. db.example.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Port</label>
                    <input type="text" value={port} onChange={(e) => setPort(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Database Name */}
                <div>
                  <label className={labelCls}>Database Name</label>
                  <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)}
                    placeholder="e.g. salesforce_migration" className={inputCls} />
                </div>

                {/* Username + Password */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Username</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password}
                        onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                        className={cx(inputCls, "pr-8")} />
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200">
                        {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Authentication Database — MongoDB only */}
                {dbType === "MongoDB" && (
                  <div>
                    <label className={labelCls}>Authentication Database</label>
                    <input type="text" value={authDatabase} onChange={(e) => setAuthDatabase(e.target.value)}
                      placeholder="admin" className={inputCls} />
                  </div>
                )}

                {/* Table / Collection Name */}
                <div>
                  <label className={labelCls}>{tableLabel}</label>
                  <input type="text" value={tableName} onChange={(e) => setTableName(e.target.value)}
                    placeholder={tablePlaceholder} className={inputCls} />
                </div>
              </>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={connStatus === "testing" || isFetching}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connStatus === "testing"
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Wifi size={13} />}
                {connStatus === "testing" ? "Testing…" : "Test Connection"}
              </button>
              <button
                type="button"
                onClick={handleFetchData}
                disabled={isFetching || !(dbType === "SAP OData" ? sapEntity.trim() : tableName.trim()) || connStatus === "testing"}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isFetching
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Database size={13} />}
                {isFetching ? "Fetching…" : "Fetch Data"}
              </button>
            </div>

            {/* Connection / fetch status feedback */}
            {connStatus !== "idle" && !isFetching && (
              <div className={cx(
                "flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium",
                connStatus === "success" && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
                connStatus === "warning" && "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
                connStatus === "error" && "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400",
              )}>
                {connStatus === "success"
                  ? <CheckCircle2 size={12} className="mt-px shrink-0" />
                  : <AlertCircle size={12} className="mt-px shrink-0" />}
                <span className="break-all">{connMessage}</span>
              </div>
            )}
            {fetchError && !isFetching && (
              <div className="flex items-start gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-400">
                <AlertCircle size={12} className="mt-px shrink-0" />
                <span className="break-all">{fetchError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Source Salesforce connection (shown when source mode = "salesforce") ────
const SF_OPERATORS = ["=", "!=", "<", ">", "<=", ">=", "LIKE"] as const;

function SourceSfSection() {
  const {
    sourceSf, setSourceSf,
    currentProject, setUploadedFiles, refreshCurrentProject,
  } = useMigration();

  const [sfObjects, setSfObjects] = useState<{ label: string; api_name: string }[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState("");
  const [objectSearch, setObjectSearch] = useState("");

  const [sfFields, setSfFields] = useState<{ label: string; api_name: string; type: string }[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldSearch, setFieldSearch] = useState("");

  const [filters, setFilters] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [recordLimit, setRecordLimit] = useState("");

  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: unknown[][] } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [sfError, setSfError] = useState("");

  // Load objects when connection changes
  useEffect(() => {
    if (!sourceSf.accessToken || !sourceSf.instanceUrl) {
      setSfObjects([]);
      setSelectedObject("");
      return;
    }
    setObjectsLoading(true);
    setSfError("");
    const params = new URLSearchParams({
      access_token: sourceSf.accessToken,
      instance_url: sourceSf.instanceUrl,
    });
    fetch(`${NEXT_PUBLIC_API_URL}/salesforce/objects?${params}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSfObjects(data); else setSfError("Failed to load Salesforce objects"); })
      .catch(() => setSfError("Failed to load Salesforce objects"))
      .finally(() => setObjectsLoading(false));
  }, [sourceSf.accessToken, sourceSf.instanceUrl]);

  // Load fields when object changes
  useEffect(() => {
    if (!sourceSf.accessToken || !sourceSf.instanceUrl || !selectedObject) {
      setSfFields([]);
      setSelectedFields([]);
      return;
    }
    setFieldsLoading(true);
    const params = new URLSearchParams({
      access_token: sourceSf.accessToken,
      instance_url: sourceSf.instanceUrl,
      object_name: selectedObject,
    });
    fetch(`${NEXT_PUBLIC_API_URL}/salesforce/object-fields?${params}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSfFields(data); else setSfFields([]); })
      .catch(() => setSfFields([]))
      .finally(() => setFieldsLoading(false));
  }, [sourceSf.accessToken, sourceSf.instanceUrl, selectedObject]);

  const filteredObjects = sfObjects.filter(o =>
    o.label.toLowerCase().includes(objectSearch.toLowerCase()) ||
    o.api_name.toLowerCase().includes(objectSearch.toLowerCase())
  );
  const filteredFields = sfFields.filter(f =>
    f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
    f.api_name.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const addFilter = () => {
    setFilters(prev => [...prev, { field: sfFields[0]?.api_name ?? "", operator: "=", value: "" }]);
  };
  const removeFilter = (i: number) => setFilters(prev => prev.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, key: "field" | "operator" | "value", val: string) => {
    setFilters(prev => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  };

  const buildBody = (previewOnly: boolean) => ({
    access_token: sourceSf.accessToken,
    instance_url: sourceSf.instanceUrl,
    object_name: selectedObject,
    fields: selectedFields,
    filters: filters.filter(f => f.field && f.value.trim()),
    limit: recordLimit ? parseInt(recordLimit, 10) : null,
    preview_only: previewOnly,
  });

  const handlePreview = async () => {
    if (!selectedObject || selectedFields.length === 0) return;
    setIsPreviewing(true);
    setPreviewData(null);
    setSfError("");
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/fetch-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(true)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Preview failed");
      setPreviewData({ columns: data.columns, rows: data.rows });
    } catch (err: unknown) {
      setSfError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFetch = async () => {
    if (!selectedObject || selectedFields.length === 0 || !currentProject) return;
    setIsFetching(true);
    setSfError("");
    setPreviewData(null);

    setUploadedFiles(prev => ({
      ...prev,
      source: { name: `${selectedObject}.xlsx`, size: "Fetching…", loading: true, progress: 0, completed: false },
    }));

    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      const cap = Math.min(prog, 88);
      setUploadedFiles(prev => {
        const item = prev["source"];
        if (!item?.loading) { clearInterval(interval); return prev; }
        return { ...prev, source: { ...item, progress: cap } };
      });
      if (prog >= 88) clearInterval(interval);
    }, 200);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-project-id": currentProject.id,
      };
      if (currentProject.clientId) headers["x-client-id"] = currentProject.clientId;

      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/fetch-records`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildBody(false)),
      });
      clearInterval(interval);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fetch failed");

      const dbRes = await fetch(`/api/projects/${currentProject.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: "source", fileName: data.fileName, fileSize: data.fileSize, s3Key: data.s3Key }),
      });
      const dbData = await dbRes.json();
      if (!dbData.success) throw new Error("Failed to register file in project");

      setUploadedFiles(prev => ({
        ...prev,
        source: { name: data.fileName, size: data.fileSize, loading: false, progress: 100, completed: true },
      }));
      await refreshCurrentProject();
    } catch (err: unknown) {
      clearInterval(interval);
      setSfError(err instanceof Error ? err.message : "Failed to fetch data");
      setUploadedFiles(prev => ({ ...prev, source: null }));
    } finally {
      setIsFetching(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 px-4 py-3">
        <Cloud size={13} className="text-slate-400 dark:text-slate-500" />
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Source Salesforce</p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-3.5">
        {/* Auth */}
        <SfInlineStatus
          connection={sourceSf}
          role="source"
          label="Source Salesforce"
          returnTo="/upload"
          onDisconnect={() => {
            setSourceSf(emptySfConnection);
            setSfObjects([]);
            setSfFields([]);
            setSelectedObject("");
            setSelectedFields([]);
            setPreviewData(null);
          }}
        />

        {sourceSf.accessToken && (
          <div className="flex flex-col gap-4">
            {/* Object selector */}
            <div>
              <label className={labelCls}>Salesforce Object</label>
              {objectsLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Loading objects…
                </div>
              ) : (
                <>
                  <div className="relative mb-1.5">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search objects…"
                      value={objectSearch}
                      onChange={e => setObjectSearch(e.target.value)}
                      className={cx(inputCls, "pl-7 py-1.5")}
                    />
                  </div>
                  <select
                    value={selectedObject}
                    onChange={e => { setSelectedObject(e.target.value); setSelectedFields([]); setPreviewData(null); }}
                    className={cx(inputCls, "py-1.5")}
                    size={Math.min(filteredObjects.length + 1, 7)}
                  >
                    <option value="">— select an object —</option>
                    {filteredObjects.map(o => (
                      <option key={o.api_name} value={o.api_name}>{o.label} ({o.api_name})</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Fields multi-select */}
            {selectedObject && (
              <div>
                <label className={labelCls}>Fields to Fetch</label>
                {fieldsLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" /> Loading fields…
                  </div>
                ) : (
                  <>
                    <div className="relative mb-1.5">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search fields…"
                        value={fieldSearch}
                        onChange={e => setFieldSearch(e.target.value)}
                        className={cx(inputCls, "pl-7 py-1.5")}
                      />
                    </div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedFields(sfFields.map(f => f.api_name))}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">Select all</button>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <button type="button" onClick={() => setSelectedFields([])}
                        className="text-[10px] text-slate-500 dark:text-slate-400 hover:underline">Clear</button>
                      <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">{selectedFields.length} selected</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
                      {filteredFields.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-400">No fields found</p>
                      ) : filteredFields.map(f => (
                        <label key={f.api_name} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                            checked={selectedFields.includes(f.api_name)}
                            onChange={e => {
                              if (e.target.checked) setSelectedFields(prev => [...prev, f.api_name]);
                              else setSelectedFields(prev => prev.filter(x => x !== f.api_name));
                            }}
                          />
                          <span className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-200">{f.label}</span>
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{f.api_name}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Filters */}
            {selectedObject && sfFields.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Filters (optional)</label>
                  <button type="button" onClick={addFilter}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">
                    <Plus size={10} /> Add Filter
                  </button>
                </div>
                {filters.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {filters.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <select value={f.field} onChange={e => updateFilter(i, "field", e.target.value)}
                          className="flex-1 min-w-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30">
                          {sfFields.map(fld => (
                            <option key={fld.api_name} value={fld.api_name}>{fld.api_name}</option>
                          ))}
                        </select>
                        <select value={f.operator} onChange={e => updateFilter(i, "operator", e.target.value)}
                          className="w-16 shrink-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-1.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30">
                          {SF_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                        <input type="text" value={f.value} onChange={e => updateFilter(i, "value", e.target.value)}
                          placeholder="value"
                          className="flex-1 min-w-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                        <button type="button" onClick={() => removeFilter(i)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Record limit */}
            {selectedObject && (
              <div>
                <label className={labelCls}>Record Limit (optional)</label>
                <input
                  type="number"
                  min="1"
                  max="200000"
                  placeholder="e.g. 5000 (default: all records, max 200 000)"
                  value={recordLimit}
                  onChange={e => setRecordLimit(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            {/* Action buttons */}
            {selectedObject && selectedFields.length > 0 && (
              <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-1">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing || isFetching}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPreviewing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                  {isPreviewing ? "Previewing…" : "Preview (10 rows)"}
                </button>
                <button
                  type="button"
                  onClick={handleFetch}
                  disabled={isFetching || isPreviewing}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isFetching ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
                  {isFetching ? "Fetching…" : "Fetch Source Data"}
                </button>
              </div>
            )}

            {/* Error */}
            {sfError && (
              <div className="flex items-start gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-400">
                <AlertCircle size={12} className="mt-px shrink-0" />
                <span className="break-all">{sfError}</span>
              </div>
            )}

            {/* Preview table */}
            {previewData && (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Preview — {previewData.rows.length} rows
                  </span>
                  <button type="button" onClick={() => setPreviewData(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Dismiss</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        {previewData.columns.map(col => (
                          <th key={col} className="whitespace-nowrap px-3 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/60 dark:bg-slate-700/30"}>
                          {(row as unknown[]).map((cell, ci) => (
                            <td key={ci} className="max-w-[120px] truncate whitespace-nowrap px-3 py-1.5 text-slate-700 dark:text-slate-300">{String(cell ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Master Metadata card — Upload File or Salesforce ────────────────────
function MasterDataCard({ file, onUpload, onClear }: {
  file: UploadedFile | null; onUpload: () => void; onClear: () => void;
}) {
  const config = FILE_SLOTS[1];
  const styles = toneStyles[config.tone];
  const isComplete = file?.completed && !file.loading;
  const isLoading = file?.loading;

  const [masterMode, setMasterMode] = useState<"upload" | "salesforce">("upload");

  const {
    masterSf, setMasterSf,
    masterReusesSource, setMasterReusesSource,
    sourceSf,
    effectiveMasterSf,
    currentProject, setUploadedFiles, refreshCurrentProject,
  } = useMigration();

  const [sfObjects, setSfObjects] = useState<{ label: string; api_name: string }[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState("");
  const [objectSearch, setObjectSearch] = useState("");

  const [sfFields, setSfFields] = useState<{ label: string; api_name: string; type: string }[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldSearch, setFieldSearch] = useState("");

  const [filters, setFilters] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [recordLimit, setRecordLimit] = useState("");
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: unknown[][] } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [sfError, setSfError] = useState("");

  useEffect(() => {
    if (!effectiveMasterSf.accessToken || !effectiveMasterSf.instanceUrl) {
      setSfObjects([]);
      setSelectedObject("");
      return;
    }
    setObjectsLoading(true);
    setSfError("");
    const params = new URLSearchParams({
      access_token: effectiveMasterSf.accessToken,
      instance_url: effectiveMasterSf.instanceUrl,
    });
    fetch(`${NEXT_PUBLIC_API_URL}/salesforce/objects?${params}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSfObjects(data); else setSfError("Failed to load Salesforce objects"); })
      .catch(() => setSfError("Failed to load Salesforce objects"))
      .finally(() => setObjectsLoading(false));
  }, [effectiveMasterSf.accessToken, effectiveMasterSf.instanceUrl]);

  useEffect(() => {
    if (!effectiveMasterSf.accessToken || !effectiveMasterSf.instanceUrl || !selectedObject) {
      setSfFields([]);
      setSelectedFields([]);
      return;
    }
    setFieldsLoading(true);
    const params = new URLSearchParams({
      access_token: effectiveMasterSf.accessToken,
      instance_url: effectiveMasterSf.instanceUrl,
      object_name: selectedObject,
    });
    fetch(`${NEXT_PUBLIC_API_URL}/salesforce/object-fields?${params}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSfFields(data); else setSfFields([]); })
      .catch(() => setSfFields([]))
      .finally(() => setFieldsLoading(false));
  }, [effectiveMasterSf.accessToken, effectiveMasterSf.instanceUrl, selectedObject]);

  const filteredObjects = sfObjects.filter(o =>
    o.label.toLowerCase().includes(objectSearch.toLowerCase()) ||
    o.api_name.toLowerCase().includes(objectSearch.toLowerCase())
  );
  const filteredFields = sfFields.filter(f =>
    f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
    f.api_name.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const addFilter = () => setFilters(prev => [...prev, { field: sfFields[0]?.api_name ?? "", operator: "=", value: "" }]);
  const removeFilter = (i: number) => setFilters(prev => prev.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, key: "field" | "operator" | "value", val: string) =>
    setFilters(prev => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));

  const buildBody = (previewOnly: boolean) => ({
    access_token: effectiveMasterSf.accessToken,
    instance_url: effectiveMasterSf.instanceUrl,
    object_name: selectedObject,
    fields: selectedFields,
    filters: filters.filter(f => f.field && f.value.trim()),
    limit: recordLimit ? parseInt(recordLimit, 10) : null,
    preview_only: previewOnly,
  });

  const handlePreview = async () => {
    if (!selectedObject || selectedFields.length === 0) return;
    setIsPreviewing(true);
    setPreviewData(null);
    setSfError("");
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/fetch-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(true)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Preview failed");
      setPreviewData({ columns: data.columns, rows: data.rows });
    } catch (err: unknown) {
      setSfError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFetch = async () => {
    if (!selectedObject || selectedFields.length === 0 || !currentProject) return;
    setIsFetching(true);
    setSfError("");
    setPreviewData(null);

    setUploadedFiles(prev => ({
      ...prev,
      master: { name: `${selectedObject}.xlsx`, size: "Fetching…", loading: true, progress: 0, completed: false },
    }));

    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      const cap = Math.min(prog, 88);
      setUploadedFiles(prev => {
        const item = prev["master"];
        if (!item?.loading) { clearInterval(interval); return prev; }
        return { ...prev, master: { ...item, progress: cap } };
      });
      if (prog >= 88) clearInterval(interval);
    }, 200);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-project-id": currentProject.id,
      };
      if (currentProject.clientId) headers["x-client-id"] = currentProject.clientId;

      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/fetch-records`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildBody(false)),
      });
      clearInterval(interval);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fetch failed");

      const dbRes = await fetch(`/api/projects/${currentProject.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: "master", fileName: data.fileName, fileSize: data.fileSize, s3Key: data.s3Key }),
      });
      const dbData = await dbRes.json();
      if (!dbData.success) throw new Error("Failed to register file in project");

      setUploadedFiles(prev => ({
        ...prev,
        master: { name: data.fileName, size: data.fileSize, loading: false, progress: 100, completed: true },
      }));
      await refreshCurrentProject();
    } catch (err: unknown) {
      clearInterval(interval);
      setSfError(err instanceof Error ? err.message : "Failed to fetch data");
      setUploadedFiles(prev => ({ ...prev, master: null }));
    } finally {
      setIsFetching(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500";

  return (
    <article className={cx(
      "group relative overflow-hidden rounded-xl border bg-white dark:bg-slate-800 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_28px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
      isComplete && masterMode === "upload" ? "border-emerald-200 dark:border-emerald-700/50" : "border-slate-200 dark:border-slate-700"
    )}>
      <div className={cx("absolute inset-x-0 top-0 h-1", isComplete && masterMode === "upload" ? "bg-emerald-500" : styles.accent)} />

      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1", styles.icon)}>
              {masterMode === "salesforce" ? <Cloud size={21} strokeWidth={2.2} /> : <FileSpreadsheet size={21} strokeWidth={2.2} />}
            </span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Step {config.step}</span>
                {isComplete && masterMode === "upload" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                    <Check size={11} strokeWidth={3} />Uploaded
                  </span>
                )}
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">{config.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{config.description}</p>
            </div>
          </div>
          {isComplete && masterMode === "upload" && (
            <button type="button" onClick={onClear} aria-label="Remove Master Metadata"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400">
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700/60 p-0.5 gap-0.5">
          {(["upload", "salesforce"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMasterMode(mode)}
              className={cx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all",
                masterMode === mode
                  ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              {mode === "upload" ? <Upload size={12} /> : <Cloud size={12} />}
              {mode === "upload" ? "Upload File" : "Salesforce"}
            </button>
          ))}
        </div>

        {/* Salesforce mode */}
        {masterMode === "salesforce" && (
          isLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{file!.name}</span>
                <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{file!.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600">
                <div className={cx("h-full rounded-full transition-all duration-150", styles.progress)} style={{ width: `${file!.progress}%` }} />
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Fetching from Salesforce…</p>
            </div>
          ) : isComplete ? (
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm">
                  <FileCheck2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{file!.name}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{file!.size} · Ready for processing</span>
                </span>
              </div>
            </div>
          ) : !effectiveMasterSf.accessToken ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-4 py-5 text-center">
              <Link2 size={18} className="mx-auto mb-2 text-slate-400 dark:text-slate-500" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Configure Lookup Salesforce below</p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Connect or reuse a Salesforce org in the section below to continue.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Object selector */}
              <div>
                <label className={labelCls}>Salesforce Object</label>
                {objectsLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" /> Loading objects…
                  </div>
                ) : (
                  <>
                    <div className="relative mb-1.5">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search objects…"
                        value={objectSearch}
                        onChange={e => setObjectSearch(e.target.value)}
                        className={cx(inputCls, "pl-7 py-1.5")}
                      />
                    </div>
                    <select
                      value={selectedObject}
                      onChange={e => { setSelectedObject(e.target.value); setSelectedFields([]); setPreviewData(null); }}
                      className={cx(inputCls, "py-1.5")}
                      size={Math.min(filteredObjects.length + 1, 7)}
                    >
                      <option value="">— select an object —</option>
                      {filteredObjects.map(o => (
                        <option key={o.api_name} value={o.api_name}>{o.label} ({o.api_name})</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Fields multi-select */}
              {selectedObject && (
                <div>
                  <label className={labelCls}>Fields to Fetch</label>
                  {fieldsLoading ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 size={12} className="animate-spin" /> Loading fields…
                    </div>
                  ) : (
                    <>
                      <div className="relative mb-1.5">
                        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search fields…"
                          value={fieldSearch}
                          onChange={e => setFieldSearch(e.target.value)}
                          className={cx(inputCls, "pl-7 py-1.5")}
                        />
                      </div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedFields(sfFields.map(f => f.api_name))}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">Select all</button>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <button type="button" onClick={() => setSelectedFields([])}
                          className="text-[10px] text-slate-500 dark:text-slate-400 hover:underline">Clear</button>
                        <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">{selectedFields.length} selected</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
                        {filteredFields.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-400">No fields found</p>
                        ) : filteredFields.map(f => (
                          <label key={f.api_name} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                              checked={selectedFields.includes(f.api_name)}
                              onChange={e => {
                                if (e.target.checked) setSelectedFields(prev => [...prev, f.api_name]);
                                else setSelectedFields(prev => prev.filter(x => x !== f.api_name));
                              }}
                            />
                            <span className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-200">{f.label}</span>
                            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{f.api_name}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Filters */}
              {selectedObject && sfFields.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Filters (optional)</label>
                    <button type="button" onClick={addFilter}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">
                      <Plus size={10} /> Add Filter
                    </button>
                  </div>
                  {filters.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {filters.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <select value={f.field} onChange={e => updateFilter(i, "field", e.target.value)}
                            className="flex-1 min-w-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30">
                            {sfFields.map(fld => (
                              <option key={fld.api_name} value={fld.api_name}>{fld.api_name}</option>
                            ))}
                          </select>
                          <select value={f.operator} onChange={e => updateFilter(i, "operator", e.target.value)}
                            className="w-16 shrink-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-1.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30">
                            {SF_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                          </select>
                          <input type="text" value={f.value} onChange={e => updateFilter(i, "value", e.target.value)}
                            placeholder="value"
                            className="flex-1 min-w-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                          <button type="button" onClick={() => removeFilter(i)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Record limit */}
              {selectedObject && (
                <div>
                  <label className={labelCls}>Record Limit (optional)</label>
                  <input
                    type="number"
                    min="1"
                    max="200000"
                    placeholder="e.g. 5000 (default: all records, max 200 000)"
                    value={recordLimit}
                    onChange={e => setRecordLimit(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}

              {/* Action buttons */}
              {selectedObject && selectedFields.length > 0 && (
                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-1">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={isPreviewing || isFetching}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPreviewing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                    {isPreviewing ? "Previewing…" : "Preview (10 rows)"}
                  </button>
                  <button
                    type="button"
                    onClick={handleFetch}
                    disabled={isFetching || isPreviewing}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    {isFetching ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
                    {isFetching ? "Fetching…" : "Fetch Master Data"}
                  </button>
                </div>
              )}

              {/* Error */}
              {sfError && (
                <div className="flex items-start gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-400">
                  <AlertCircle size={12} className="mt-px shrink-0" />
                  <span className="break-all">{sfError}</span>
                </div>
              )}

              {/* Preview table */}
              {previewData && (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Preview — {previewData.rows.length} rows
                    </span>
                    <button type="button" onClick={() => setPreviewData(null)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Dismiss</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700">
                          {previewData.columns.map(col => (
                            <th key={col} className="whitespace-nowrap px-3 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/60 dark:bg-slate-700/30"}>
                            {(row as unknown[]).map((cell, ci) => (
                              <td key={ci} className="max-w-[120px] truncate whitespace-nowrap px-3 py-1.5 text-slate-700 dark:text-slate-300">{String(cell ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* Upload mode */}
        {masterMode === "upload" && (
          <>
            <div>
              {isLoading ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{file!.name}</span>
                    <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{file!.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600">
                    <div className={cx("h-full rounded-full transition-all duration-150", styles.progress)} style={{ width: `${file!.progress}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Saving securely to the S3 workspace.</p>
                </div>
              ) : isComplete ? (
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm">
                      <FileCheck2 size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{file!.name}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{file!.size} · Ready for processing</span>
                    </span>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={onUpload}
                  className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/50 px-3.5 py-3 text-left transition-all hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <span>
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Choose file</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{config.helper}</span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600">
                    <Upload size={15} />
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className={cx("rounded-full px-2 py-1 ring-1", isComplete ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-800/30" : styles.badge)}>
                {isComplete ? "Complete" : isLoading ? "Uploading" : "Pending"}
              </span>
              <button type="button" onClick={onUpload} className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-700 dark:hover:text-blue-400">
                {isComplete ? "Replace" : "Browse"}
                <ChevronRight size={13} />
              </button>
            </div>
          </>
        )}

        {/* Lookup Salesforce — only visible in Salesforce tab */}
        {masterMode === "salesforce" && <>
        <div className="-mx-5 border-t border-slate-100 dark:border-slate-700" />

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link2 size={13} className="text-slate-400 dark:text-slate-500" />
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Lookup Salesforce</p>
            <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">— for Lookup(S) rules</span>
          </div>

          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
              checked={masterReusesSource}
              onChange={e => setMasterReusesSource(e.target.checked)}
            />
            Use Source Salesforce
          </label>

          {masterReusesSource ? (
            sourceSf.accessToken ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 px-3 py-2.5">
                <Check size={12} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Reusing Source Salesforce
                    {sourceSf.userEmail && (
                      <span className="ml-1 font-normal">as {sourceSf.userEmail}</span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Source Salesforce is not connected yet.
              </p>
            )
          ) : (
            <SfInlineStatus
              connection={masterSf}
              role="master"
              label="Lookup Salesforce"
              returnTo="/upload"
              onDisconnect={() => setMasterSf(emptySfConnection)}
            />
          )}
        </div>
        </>}
      </div>
    </article>
  );
}

export default function UploadFilesPage() {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);
  const logicInputRef = useRef<HTMLInputElement>(null);

  const [newProjName, setNewProjName] = useState("");
  const [selectedProjId, setSelectedProjId] = useState("");
  const [isSubmittingProj, setIsSubmittingProj] = useState(false);
  const [projTab, setProjTab] = useState<"select" | "create">("select");

  // Client dropdown and creation states
  const [selectedClientId, setSelectedClientId] = useState("");
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  const [sourceSfVisible, setSourceSfVisible] = useState(false);

  const {
    currentProject,
    setCurrentProject,
    projectList,
    createProject,
    selectProject,
    uploadedFiles,
    handleFileUpload,
    clearFile,
    isContinueEnabled,
    resetPipelineState,
    clientList,
    currentClient,
    createClient,
    selectClient,
  } = useMigration();

  React.useEffect(() => {
    if (currentClient) {
      setSelectedClientId(currentClient.id);
      setShowNewClientInput(false);
    } else if (clientList.length > 0) {
      setSelectedClientId(clientList[0].id);
      setShowNewClientInput(false);
    } else {
      setShowNewClientInput(true);
    }
  }, [currentClient, clientList]);

  const clientProjects = React.useMemo(() => {
    if (!selectedClientId) return [];
    return projectList.filter((p) => p.clientId === selectedClientId);
  }, [projectList, selectedClientId]);

  React.useEffect(() => {
    if (clientProjects.length > 0) {
      if (!clientProjects.some((p) => p.id === selectedProjId)) {
        setSelectedProjId(clientProjects[0].id);
        setProjTab("select");
      }
    } else {
      setProjTab("create");
      setSelectedProjId("");
    }
  }, [clientProjects, selectedProjId]);

  const inputRefs = { source: sourceInputRef, master: masterInputRef, logic: logicInputRef };

  const handleCreateProjectInline = async () => {
    if (!newProjName.trim() || isSubmittingProj) return;
    setIsSubmittingProj(true);
    try {
      let finalClientId = selectedClientId;
      if (showNewClientInput) {
        if (!newClientName.trim()) {
          setIsSubmittingProj(false);
          return;
        }
        const createdClient = await createClient(newClientName.trim());
        if (createdClient) {
          finalClientId = createdClient.id;
          await selectClient(createdClient.id);
        } else {
          throw new Error("Failed to create client");
        }
      }

      if (!finalClientId) {
        setIsSubmittingProj(false);
        return;
      }

      const project = await createProject(newProjName.trim(), finalClientId);
      if (project) {
        setNewProjName("");
        setNewClientName("");
        setShowNewClientInput(false);
        await selectProject(project.id);
      }
    } catch (err) {
      console.error("Error creating project inline:", err);
    } finally {
      setIsSubmittingProj(false);
    }
  };

  const handleSelectProjectInline = async () => {
    if (!selectedProjId || isSubmittingProj) return;
    setIsSubmittingProj(true);
    try {
      if (selectedClientId) {
        await selectClient(selectedClientId);
      }
      await selectProject(selectedProjId);
    } catch (err) {
      console.error("Error selecting project inline:", err);
    } finally {
      setIsSubmittingProj(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900 min-h-[calc(100vh-60px)]">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="bg-slate-900 px-6 py-5 text-white">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
              <Sparkles size={14} className="animate-pulse" />Setup Workspace
            </div>
            <h3 className="mt-1.5 text-lg font-semibold">Select or Create a Project</h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              Choose a client and project workspace to begin uploading and validating migration files.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-800 space-y-5">
            {/* Client Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Client</label>
              {!showNewClientInput ? (
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {clientList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    {clientList.length === 0 && (
                      <option value="" disabled>No clients found</option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClientInput(true);
                      setProjTab("create");
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    + New
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    required={showNewClientInput}
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="New Client Name (e.g., Acme Corp)"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {clientList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewClientInput(false);
                        setNewClientName("");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Choose Existing
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Project Selection / Creation Section */}
            {!showNewClientInput && clientProjects.length > 0 && (
              <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setProjTab("select")}
                  className={cx(
                    "flex-1 py-2 text-center text-[11px] font-semibold transition-all focus:outline-none",
                    projTab === "select" ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  Choose Project
                </button>
                <button
                  onClick={() => setProjTab("create")}
                  className={cx(
                    "flex-1 py-2 text-center text-[11px] font-semibold transition-all focus:outline-none",
                    projTab === "create" ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  Create Project
                </button>
              </div>
            )}

            {projTab === "select" && !showNewClientInput ? (
              <div className="space-y-4 pt-1">
                {clientProjects.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium">No projects found. Please create a new project to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Select Project Workspace</label>
                    <select
                      value={selectedProjId}
                      onChange={(e) => setSelectedProjId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {clientProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.stage.replace("_", " ")})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  onClick={handleSelectProjectInline}
                  disabled={!selectedProjId || isSubmittingProj}
                  className="w-full py-3 text-xs"
                >
                  {isSubmittingProj ? "Opening Workspace..." : "Open Workspace"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Q3 Salesforce Migration"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <Button
                  onClick={handleCreateProjectInline}
                  disabled={!newProjName.trim() || isSubmittingProj || (showNewClientInput && !newClientName.trim()) || (!showNewClientInput && !selectedClientId)}
                  className="w-full py-3 text-xs"
                >
                  {isSubmittingProj ? "Creating Project..." : "Create & Launch Workspace"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const uploadedCount = FILE_SLOTS.filter(({ slot }) => uploadedFiles[slot]?.completed).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">
        {FILE_SLOTS.map((config) => (
          <input key={config.slot} ref={inputRefs[config.slot]} type="file" accept={config.accept} className="hidden"
            onChange={(event) => handleFileUpload(event.target.files, config.slot)} />
        ))}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">
              <Sparkles size={14} />
              Migration setup
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400">Active Project:</span>
              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-normal ring-1 ring-blue-100 dark:ring-blue-800/30">
                {currentProject.name}
              </span>
              <button onClick={() => setCurrentProject(null)} className="text-slate-400 transition-colors hover:text-rose-600 dark:hover:text-rose-400 text-[10px] font-semibold underline">
                Switch Project
              </button>
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-slate-100 sm:text-[28px]">Prepare your migration files</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Upload the three required workbooks to S3. Once all files are ready, proceed to the Transformation Workspace to validate, clean, and transform your data.
            </p>
          </div>

          <div className="flex min-w-[260px] items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
            <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", uploadedCount === 3 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400")}>
              {uploadedCount === 3 ? <CheckCircle2 size={18} /> : <CloudUpload size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Upload progress</span>
                <span className="font-semibold tabular-nums text-slate-500 dark:text-slate-400">{uploadedCount} of 3</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${(uploadedCount / 3) * 100}%` }} />
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
          {/* Source column: upload card + optional SF connection */}
          <div className="flex flex-col gap-4">
            <SourceDataCard
              file={uploadedFiles["source"]}
              onUpload={() => inputRefs.source.current?.click()}
              onClear={() => clearFile("source")}
              onModeChange={(mode) => setSourceSfVisible(mode === "salesforce")}
            />
            {sourceSfVisible && <SourceSfSection />}
          </div>

          {/* Master column: metadata card with embedded SF fetch and Lookup SF auth */}
          <div className="flex flex-col gap-4">
            <MasterDataCard
              file={uploadedFiles["master"]}
              onUpload={() => inputRefs.master.current?.click()}
              onClear={() => clearFile("master")}
            />
          </div>

          {/* Logic column */}
          <UploadCard config={FILE_SLOTS[2]} file={uploadedFiles["logic"]}
            onUpload={() => inputRefs.logic.current?.click()} onClear={() => clearFile("logic")} />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isContinueEnabled ? "Required files ready — continue when ready" : `${uploadedCount} of 3 files uploaded`}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isContinueEnabled
                  ? "Head to the Transformation Workspace to validate, clean, and transform your data."
                  : "Upload Source Data and Mapping Logic to continue. Master Metadata is only required for Excel Lookup transformations."}
              </p>
            </div>
            <Button type="button" variant="dark"
              onClick={() => { resetPipelineState(); sessionStorage.setItem("autoRunPipeline", "true"); router.push("/transformation-workspace"); }}
              disabled={!isContinueEnabled}>
              Continue to Transformation Workspace
              <ArrowRight size={15} />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
