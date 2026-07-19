"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMigration } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Layers,
  Loader2,
  Paperclip,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Terminal,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type SourceFileType = "excel" | "csv" | "file";

type ProjectFileSource = {
  id: string;
  slot: string;
  fileName: string;
  fileSize: string;
  s3Key: string;
  alias: string;
  enabled: boolean;
  sourceType: SourceFileType;
};

type DbType = "PostgreSQL" | "MySQL" | "MongoDB" | "SQL Server" | "SAP OData";

type DbSource = {
  id: string;
  dbType: DbType;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  authDatabase: string;
  table: string;
  alias: string;
  enabled: boolean;
  sapBaseUrl?: string;
  sapEntity?: string;
};

type TableSchema = {
  table_name: string;
  columns: string[];
  row_count?: number;
  source_type: string;
  error?: string;
};

type QueryResult = {
  columns: string[];
  rows: unknown[][];
  total_rows: number;
  preview_rows: number;
  s3_key: string;
  file_name: string;
  file_size: string;
};

type AttachableFile = {
  id: string;
  slot: string;
  fileName: string;
  fileSize: string;
  s3Key: string;
};

type Suggestion = {
  text: string;
  kind: "keyword" | "function" | "table" | "column";
  detail?: string;
};

type AcState = {
  visible: boolean;
  suggestions: Suggestion[];
  selectedIndex: number;
  top: number;
  left: number;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const DB_TYPES: DbType[] = ["PostgreSQL", "MySQL", "MongoDB", "SQL Server", "SAP OData"];
const DB_PORTS: Record<DbType, string> = {
  PostgreSQL: "5432",
  MySQL: "3306",
  MongoDB: "27017",
  "SQL Server": "1433",
  "SAP OData": "",
};

const SLOT_ALIAS: Record<string, string> = {
  source: "source_file",
  master: "master_file",
  logic: "logic_file",
};

const PAGE_SIZE = 50;

const SQL_KEYWORDS: string[] = [
  "SELECT", "DISTINCT", "FROM", "WHERE", "AND", "OR", "NOT",
  "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN",
  "FULL OUTER JOIN", "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "CROSS JOIN",
  "ON", "USING", "AS",
  "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
  "UNION", "UNION ALL", "INTERSECT", "EXCEPT",
  "CASE", "WHEN", "THEN", "ELSE", "END",
  "IN", "NOT IN", "LIKE", "ILIKE", "BETWEEN",
  "IS NULL", "IS NOT NULL", "EXISTS", "NOT EXISTS",
  "ASC", "DESC", "WITH", "NULL", "TRUE", "FALSE",
];

const SQL_FUNCTIONS: string[] = [
  "COUNT(*)", "COUNT(", "SUM(", "AVG(", "MIN(", "MAX(",
  "COALESCE(", "NULLIF(", "IFNULL(",
  "ROUND(", "FLOOR(", "CEIL(", "ABS(",
  "LOWER(", "UPPER(", "TRIM(", "LTRIM(", "RTRIM(",
  "LENGTH(", "SUBSTR(", "SUBSTRING(", "REPLACE(", "CONCAT(",
  "CAST(", "TRY_CAST(",
  "DATE(", "YEAR(", "MONTH(", "DAY(", "NOW(", "CURRENT_DATE",
  "STRFTIME(", "DATE_TRUNC(",
  "ROW_NUMBER()", "RANK()", "DENSE_RANK()",
  "LAG(", "LEAD(",
];

const KIND_BADGE: Record<Suggestion["kind"], string> = {
  keyword: "KW",
  function: "fn",
  table: "tbl",
  column: "col",
};

const KIND_COLOR: Record<Suggestion["kind"], string> = {
  keyword: "text-blue-400",
  function: "text-yellow-400",
  table: "text-violet-400",
  column: "text-emerald-400",
};

const FILE_TYPE_LABEL: Record<SourceFileType, string> = {
  excel: "xls",
  csv: "csv",
  file: "file",
};

const FILE_TYPE_COLOR: Record<SourceFileType, string> = {
  excel: "bg-emerald-500",
  csv: "bg-amber-500",
  file: "bg-slate-500",
};

const SQL_TEMPLATES = (aliases: string[]) => {
  const a = aliases[0] ?? "source_file";
  const b = aliases[1] ?? "master_file";
  return [
    { label: "SELECT all", sql: `SELECT *\nFROM ${a}\nLIMIT 100` },
    { label: "Filter rows", sql: `SELECT *\nFROM ${a}\nWHERE column_name = 'value'\nLIMIT 100` },
    { label: "Left join", sql: `SELECT a.*, b.column_name\nFROM ${a} a\nLEFT JOIN ${b} b\n  ON a.id = b.id` },
    { label: "Union all", sql: `SELECT * FROM ${a}\nUNION ALL\nSELECT * FROM ${b}` },
    { label: "Group & count", sql: `SELECT column_name, COUNT(*) AS count\nFROM ${a}\nGROUP BY column_name\nORDER BY count DESC` },
  ];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500";

function detectSourceType(fileName: string): SourceFileType {
  const lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
  return "file";
}

function makeAlias(slot: string, fileName: string): string {
  if (SLOT_ALIAS[slot]) return SLOT_ALIAS[slot];
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return base || slot.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase() || "table";
}

// ── Caret position helper for autocomplete ─────────────────────────────────────

function getCaretXY(
  el: HTMLTextAreaElement,
  pos: number
): { top: number; left: number } {
  const cs = window.getComputedStyle(el);
  const div = document.createElement("div");
  for (const p of [
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "fontFamily", "fontSize", "fontWeight", "fontStyle",
    "lineHeight", "letterSpacing", "wordSpacing", "tabSize",
  ]) {
    (div.style as unknown as Record<string, string>)[p] =
      (cs as unknown as Record<string, string>)[p];
  }
  div.style.position = "absolute";
  div.style.top = "-9999px";
  div.style.left = "-9999px";
  div.style.overflow = "auto";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordBreak = "break-word";
  div.style.width = el.offsetWidth + "px";
  div.style.boxSizing = cs.boxSizing;
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = "​";
  div.appendChild(span);
  document.body.appendChild(div);
  div.scrollTop = el.scrollTop;
  div.scrollLeft = el.scrollLeft;
  const { offsetTop, offsetLeft } = span;
  document.body.removeChild(div);
  return { top: offsetTop, left: offsetLeft };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SQLWorkspacePage() {
  const { currentProject, refreshCurrentProject } = useMigration();

  // ── Source state ───────────────────────────────────────────────────────────
  const [projectSources, setProjectSources] = useState<ProjectFileSource[]>([]);
  const [dbSources, setDbSources] = useState<DbSource[]>([]);

  // ── Editor state ───────────────────────────────────────────────────────────
  const [query, setQuery] = useState("SELECT *\nFROM source_file\nLIMIT 100");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // ── Schema / autocomplete state ────────────────────────────────────────────
  const [schemas, setSchemas] = useState<TableSchema[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [ac, setAc] = useState<AcState>({
    visible: false,
    suggestions: [],
    selectedIndex: 0,
    top: 0,
    left: 0,
  });

  // ── Execution state ────────────────────────────────────────────────────────
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [resultPage, setResultPage] = useState(0);

  // ── Use-as-source state ────────────────────────────────────────────────────
  const [usingAsSource, setUsingAsSource] = useState(false);
  const [sourceApplied, setSourceApplied] = useState(false);

  // ── Panel collapse state ───────────────────────────────────────────────────
  const [projectFilesOpen, setProjectFilesOpen] = useState(true);
  const [dbSourcesOpen, setDbSourcesOpen] = useState(true);

  // ── Upload state ───────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Attach existing modal state ────────────────────────────────────────────
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachable, setAttachable] = useState<AttachableFile[]>([]);
  const [attachSelected, setAttachSelected] = useState<Set<string>>(new Set());

  // ── Add-DB modal state ─────────────────────────────────────────────────────
  const [showAddDb, setShowAddDb] = useState(false);
  const [addDbType, setAddDbType] = useState<DbType>("PostgreSQL");
  const [addDbHost, setAddDbHost] = useState("");
  const [addDbPort, setAddDbPort] = useState("5432");
  const [addDbDatabase, setAddDbDatabase] = useState("");
  const [addDbUsername, setAddDbUsername] = useState("");
  const [addDbPassword, setAddDbPassword] = useState("");
  const [showAddDbPw, setShowAddDbPw] = useState(false);
  const [addDbAuthDb, setAddDbAuthDb] = useState("admin");
  const [addDbTable, setAddDbTable] = useState("");
  const [addDbAlias, setAddDbAlias] = useState("");
  const [addDbSapBaseUrl, setAddDbSapBaseUrl] = useState("");
  const [addDbSapEntity, setAddDbSapEntity] = useState("A_BusinessPartner");

  // ── Load ALL active project files on project change ────────────────────────
  useEffect(() => {
    if (!currentProject?.files) return;
    const active = currentProject.files
      .filter((f) => f.isActive)
      .map((f) => ({
        id: f.id,
        slot: f.slot,
        fileName: f.fileName,
        fileSize: f.fileSize,
        s3Key: f.s3Key,
        alias: makeAlias(f.slot, f.fileName),
        enabled: ["source", "master"].includes(f.slot),
        sourceType: detectSourceType(f.fileName),
      }));
    setProjectSources(active);
    const first = active.find((s) => s.enabled) ?? active[0];
    if (first) setQuery(`SELECT *\nFROM ${first.alias}\nLIMIT 100`);
    setQueryResult(null);
    setSourceApplied(false);
    setSchemas([]);
  }, [currentProject?.id]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const enabledAliases = [
    ...projectSources.filter((s) => s.enabled).map((s) => s.alias),
    ...dbSources.filter((db) => db.enabled).map((db) => db.alias),
  ];

  const schemaCache = useMemo(() => {
    const cache: Record<string, string[]> = {};
    for (const s of schemas) {
      if (s.columns) cache[s.table_name] = s.columns;
    }
    return cache;
  }, [schemas]);

  // Duplicate alias detection
  const duplicateAliases = useMemo(() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const a of enabledAliases) {
      if (seen.has(a)) dups.add(a);
      seen.add(a);
    }
    return dups;
  }, [enabledAliases]);

  function getSourceSubtitle(alias: string): string {
    const projSrc = projectSources.find((s) => s.alias === alias && s.enabled);
    if (projSrc) return projSrc.fileName;
    const dbSrc = dbSources.find((s) => s.alias === alias);
    if (dbSrc) return `${dbSrc.dbType} · ${dbSrc.table}`;
    return "";
  }

  const buildSources = () => [
    ...projectSources
      .filter((s) => s.enabled)
      .map((s) => ({
        source_type: "file",
        table_name: s.alias,
        s3_key: s.s3Key,
        file_name: s.fileName,
      })),
    ...dbSources
      .filter((db) => db.enabled)
      .map((db) => ({
        source_type: "database",
        table_name: db.alias,
        dbType: db.dbType,
        host: db.host,
        port: parseInt(db.port, 10) || 0,
        database: db.database,
        username: db.username,
        password: db.password,
        auth_database: db.authDatabase,
        table: db.table,
        ...(db.dbType === "SAP OData" ? { sap_base_url: db.sapBaseUrl, sap_entity: db.sapEntity } : {}),
      })),
  ];

  const totalPages = queryResult
    ? Math.ceil(queryResult.rows.length / PAGE_SIZE)
    : 0;
  const pagedRows = queryResult?.rows.slice(
    resultPage * PAGE_SIZE,
    (resultPage + 1) * PAGE_SIZE
  );

  // ── Auto-load schema when enabled sources change ───────────────────────────
  useEffect(() => {
    if (enabledAliases.length === 0) { setSchemas([]); return; }
    const sources = buildSources();
    if (sources.length === 0) return;
    const ctrl = new AbortController();
    setLoadingSchema(true);
    fetch(`${NEXT_PUBLIC_API_URL}/api/sql-workspace/schema`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data) => { if (data.schemas) setSchemas(data.schemas); })
      .catch(() => {})
      .finally(() => setLoadingSchema(false));
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledAliases.join(",")]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleLoadSchema() {
    const sources = buildSources();
    if (sources.length === 0) return;
    setLoadingSchema(true);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/sql-workspace/schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources }),
      });
      const data = await res.json();
      if (data.schemas) setSchemas(data.schemas);
    } catch {
      // silent
    } finally {
      setLoadingSchema(false);
    }
  }

  async function handleExecute() {
    if (duplicateAliases.size > 0) {
      setExecError(
        `Duplicate aliases detected: ${[...duplicateAliases].join(", ")}. Each enabled source must have a unique alias.`
      );
      return;
    }
    const sources = buildSources();
    if (sources.length === 0) {
      setExecError("Add at least one data source before running a query.");
      return;
    }
    if (!query.trim()) {
      setExecError("Please enter a SQL query.");
      return;
    }
    setExecuting(true);
    setExecError(null);
    setQueryResult(null);
    setResultPage(0);
    setSourceApplied(false);
    const t0 = Date.now();
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentProject) headers["x-project-id"] = currentProject.id;
      if (currentProject?.clientId) headers["x-client-id"] = currentProject.clientId;
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/sql-workspace/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sources, query }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.detail || data.error || "Execution failed");
      setQueryResult(data);
      setExecTime(Date.now() - t0);
    } catch (e: unknown) {
      setExecError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setExecuting(false);
    }
  }

  async function handleUseAsSource() {
    if (!queryResult || !currentProject) return;
    setUsingAsSource(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: "source",
          fileName: queryResult.file_name,
          fileSize: queryResult.file_size,
          s3Key: queryResult.s3_key,
        }),
      });
      if (!res.ok) throw new Error("Failed to register as project source");
      await refreshCurrentProject();
      setSourceApplied(true);
    } catch (e: unknown) {
      setExecError(e instanceof Error ? e.message : "Failed to set as source");
    } finally {
      setUsingAsSource(false);
    }
  }

  function handleDownloadResult() {
    if (!queryResult) return;
    window.open(
      `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(queryResult.s3_key)}`,
      "_blank"
    );
  }

  // ── File upload ────────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    setUploading(true);
    setExecError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const headers: Record<string, string> = {};
      headers["x-project-id"] = currentProject.id;
      if (currentProject.clientId) headers["x-client-id"] = currentProject.clientId;

      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/sql-workspace/upload`, {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || "Upload failed");

      // Register with project using a unique slot
      const slot = `sql_ws_${Date.now()}`;
      await fetch(`/api/projects/${currentProject.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          fileName: data.fileName,
          fileSize: data.fileSize,
          s3Key: data.s3Key,
        }),
      });

      // Add to local state immediately
      const newSource: ProjectFileSource = {
        id: `upload_${Date.now()}`,
        slot,
        fileName: data.fileName,
        fileSize: data.fileSize,
        s3Key: data.s3Key,
        alias: makeAlias(slot, data.fileName),
        enabled: true,
        sourceType: detectSourceType(data.fileName),
      };
      setProjectSources((prev) => [...prev, newSource]);

      // Sync project in background (no state reset since project ID unchanged)
      refreshCurrentProject().catch(() => {});
    } catch (err: unknown) {
      setExecError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Attach existing files ──────────────────────────────────────────────────

  function openAttachModal() {
    const existingKeys = new Set(projectSources.map((s) => s.s3Key));
    const available = (currentProject?.files ?? [])
      .filter((f) => f.isActive && !existingKeys.has(f.s3Key))
      .map((f) => ({
        id: f.id,
        slot: f.slot,
        fileName: f.fileName,
        fileSize: f.fileSize,
        s3Key: f.s3Key,
      }));
    setAttachable(available);
    setAttachSelected(new Set());
    setShowAttachModal(true);
  }

  function handleAttach() {
    const toAdd = attachable.filter((f) => attachSelected.has(f.id));
    const newSources: ProjectFileSource[] = toAdd.map((f) => ({
      id: f.id,
      slot: f.slot,
      fileName: f.fileName,
      fileSize: f.fileSize,
      s3Key: f.s3Key,
      alias: makeAlias(f.slot, f.fileName),
      enabled: true,
      sourceType: detectSourceType(f.fileName),
    }));
    setProjectSources((prev) => [...prev, ...newSources]);
    setShowAttachModal(false);
  }

  // ── Add DB source ──────────────────────────────────────────────────────────

  function handleAddDb() {
    const tableOrEntity = addDbType === "SAP OData" ? addDbSapEntity : addDbTable;
    const alias =
      addDbAlias.trim() ||
      tableOrEntity.trim().replace(/\W+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() ||
      `db_${dbSources.length + 1}`;
    const newDb: DbSource = {
      id: crypto.randomUUID(),
      dbType: addDbType,
      host: addDbHost,
      port: addDbPort,
      database: addDbDatabase,
      username: addDbUsername,
      password: addDbPassword,
      authDatabase: addDbAuthDb,
      table: tableOrEntity,
      alias,
      enabled: true,
      sapBaseUrl: addDbType === "SAP OData" ? addDbSapBaseUrl : undefined,
      sapEntity: addDbType === "SAP OData" ? addDbSapEntity : undefined,
    };
    setDbSources((prev) => [...prev, newDb]);
    setShowAddDb(false);
    setAddDbType("PostgreSQL");
    setAddDbHost("");
    setAddDbPort("5432");
    setAddDbDatabase("");
    setAddDbUsername("");
    setAddDbPassword("");
    setAddDbAuthDb("admin");
    setAddDbTable("");
    setAddDbAlias("");
    setAddDbSapBaseUrl("");
    setAddDbSapEntity("A_BusinessPartner");
  }

  // ── Autocomplete ───────────────────────────────────────────────────────────

  function buildSuggestions(textBefore: string): { items: Suggestion[]; filter: string } {
    const dotMatch = textBefore.match(/(\w+)\.(\w*)$/);
    if (dotMatch) {
      const qualifier = dotMatch[1];
      const colFilter = dotMatch[2];
      let cols = schemaCache[qualifier];
      if (!cols) {
        const asRe = new RegExp(`\\b(\\w+)\\s+(?:AS\\s+)?${qualifier}\\b`, "i");
        const m = textBefore.match(asRe);
        if (m) cols = schemaCache[m[1]];
      }
      return {
        items: (cols ?? []).map((c) => ({ text: c, kind: "column" as const, detail: qualifier })),
        filter: colFilter,
      };
    }

    const tableCtxMatch = textBefore.match(
      /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT(?:\s+OUTER)?\s+JOIN|RIGHT(?:\s+OUTER)?\s+JOIN|FULL(?:\s+OUTER)?\s+JOIN|CROSS\s+JOIN|UPDATE|INTO)\s+(\w*)$/i
    );
    if (tableCtxMatch) {
      return {
        items: enabledAliases.map((a) => ({ text: a, kind: "table" as const, detail: getSourceSubtitle(a) })),
        filter: tableCtxMatch[1],
      };
    }

    const wordMatch = textBefore.match(/(\w+)$/);
    const filter = wordMatch?.[1] ?? "";
    if (!filter) return { items: [], filter: "" };

    const keywords: Suggestion[] = SQL_KEYWORDS.map((k) => ({ text: k, kind: "keyword" as const }));
    const functions: Suggestion[] = SQL_FUNCTIONS.map((f) => ({ text: f, kind: "function" as const }));
    const tables: Suggestion[] = enabledAliases.map((a) => ({ text: a, kind: "table" as const, detail: getSourceSubtitle(a) }));
    const allCols: Suggestion[] = [];
    const seen = new Set<string>();
    for (const [alias, cols] of Object.entries(schemaCache)) {
      for (const col of cols) {
        if (!seen.has(col)) { seen.add(col); allCols.push({ text: col, kind: "column", detail: alias }); }
      }
    }
    return { items: [...keywords, ...functions, ...tables, ...allCols], filter };
  }

  function updateAutocomplete(text: string, cursorPos: number) {
    const textBefore = text.slice(0, cursorPos);
    const { items, filter } = buildSuggestions(textBefore);
    if (!filter || items.length === 0) { setAc((p) => ({ ...p, visible: false })); return; }
    const lower = filter.toLowerCase();
    const filtered = items
      .filter((s) => s.text.toLowerCase().startsWith(lower) && s.text.toLowerCase() !== lower)
      .slice(0, 20);
    if (filtered.length === 0) { setAc((p) => ({ ...p, visible: false })); return; }
    const el = editorRef.current;
    if (!el) return;
    const { top: caretTop, left: caretLeft } = getCaretXY(el, cursorPos);
    const lh = parseFloat(window.getComputedStyle(el).lineHeight) || 21;
    setAc({ visible: true, suggestions: filtered, selectedIndex: 0, top: caretTop - el.scrollTop + lh, left: caretLeft - el.scrollLeft });
  }

  function insertSuggestion(s: Suggestion) {
    const el = editorRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart ?? 0;
    const textBefore = query.slice(0, cursorPos);
    let filterLen = 0;
    const dotMatch = textBefore.match(/(\w+\.\w*)$/);
    if (dotMatch && s.kind === "column") {
      filterLen = dotMatch[1].split(".")[1]?.length ?? 0;
    } else {
      const wordMatch = textBefore.match(/(\w+)$/);
      filterLen = wordMatch?.[1]?.length ?? 0;
    }
    const newQuery = textBefore.slice(0, textBefore.length - filterLen) + s.text + query.slice(cursorPos);
    setQuery(newQuery);
    const newPos = cursorPos - filterLen + s.text.length;
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = newPos; el.focus(); });
    setAc((p) => ({ ...p, visible: false }));
  }

  function handleEditorChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setQuery(val);
    updateAutocomplete(val, e.target.selectionStart ?? 0);
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ac.visible && ac.suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAc((p) => ({ ...p, selectedIndex: Math.min(p.selectedIndex + 1, p.suggestions.length - 1) }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAc((p) => ({ ...p, selectedIndex: Math.max(p.selectedIndex - 1, 0) }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertSuggestion(ac.suggestions[ac.selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setAc((p) => ({ ...p, visible: false }));
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = el;
      const next = query.slice(0, s) + "  " + query.slice(end);
      setQuery(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">

        {/* ── Page header ── */}
        <header className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 shadow-lg">
            <Terminal size={22} className="text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-slate-100">
              SQL Workspace
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Combine any number of files and database sources with SQL. Join, filter, and transform data from any source.
            </p>
          </div>
        </header>

        {/* ── Main card: Sources + Editor ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.06)]">
          <div className="h-[3px] bg-violet-600" />

          <div className="flex flex-col lg:flex-row min-h-[560px]">

            {/* ── LEFT: Sources panel ── */}
            <div className="flex flex-col p-4 lg:w-[300px] xl:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-700 gap-0 overflow-y-auto max-h-[600px] lg:max-h-none">

              {/* Panel header */}
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  Data Sources
                  {loadingSchema && <Loader2 size={9} className="animate-spin" />}
                </span>
                {duplicateAliases.size > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700/40">
                    <AlertTriangle size={9} />
                    Dup alias
                  </span>
                )}
              </div>

              {/* ── Project Files section ── */}
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setProjectFilesOpen((v) => !v)}
                  className="flex w-full items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {projectFilesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Project Files
                  <span className="ml-auto font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                    {projectSources.filter((s) => s.enabled).length}/{projectSources.length}
                  </span>
                </button>

                {projectFilesOpen && (
                  <div className="space-y-1.5">
                    {projectSources.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-600 px-3 py-4 text-center">
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          No files yet.{" "}
                          <Link href="/upload" className="text-violet-600 dark:text-violet-400 hover:underline">
                            Upload files
                          </Link>
                        </p>
                      </div>
                    ) : (
                      projectSources.map((src) => (
                        <SourceCard
                          key={src.id}
                          icon={<FileSpreadsheet size={12} />}
                          label={src.fileName}
                          sub={src.fileSize}
                          alias={src.alias}
                          enabled={src.enabled}
                          typeBadge={FILE_TYPE_LABEL[src.sourceType]}
                          typeBadgeColor={FILE_TYPE_COLOR[src.sourceType]}
                          isDuplicate={duplicateAliases.has(src.alias) && src.enabled}
                          onToggle={() =>
                            setProjectSources((prev) =>
                              prev.map((s) => s.id === src.id ? { ...s, enabled: !s.enabled } : s)
                            )
                          }
                          onAliasChange={(v) =>
                            setProjectSources((prev) =>
                              prev.map((s) => s.id === src.id ? { ...s, alias: v } : s)
                            )
                          }
                          onRemove={() =>
                            setProjectSources((prev) => prev.filter((s) => s.id !== src.id))
                          }
                        />
                      ))
                    )}

                    {/* Upload & Attach buttons */}
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || !currentProject}
                        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 transition-colors hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!currentProject ? "Select a project first" : "Upload a new file"}
                      >
                        {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={openAttachModal}
                        disabled={!currentProject}
                        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 transition-colors hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!currentProject ? "Select a project first" : "Attach an existing project file"}
                      >
                        <Paperclip size={10} />
                        Attach
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

              {/* ── Database Sources section ── */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setDbSourcesOpen((v) => !v)}
                  className="flex w-full items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {dbSourcesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Database Sources
                  <span className="ml-auto font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                    {dbSources.filter((d) => d.enabled).length}/{dbSources.length}
                  </span>
                </button>

                {dbSourcesOpen && (
                  <div className="space-y-1.5">
                    {dbSources.map((db) => (
                      <SourceCard
                        key={db.id}
                        icon={<Database size={12} />}
                        label={`${db.dbType} · ${db.table}`}
                        sub={db.host}
                        alias={db.alias}
                        enabled={db.enabled}
                        typeBadge={db.dbType === "PostgreSQL" ? "pg" : db.dbType === "MySQL" ? "sql" : db.dbType === "SQL Server" ? "mssql" : db.dbType === "SAP OData" ? "sap" : "mdb"}
                        typeBadgeColor="bg-blue-500"
                        isDuplicate={duplicateAliases.has(db.alias) && db.enabled}
                        onToggle={() =>
                          setDbSources((prev) =>
                            prev.map((s) => s.id === db.id ? { ...s, enabled: !s.enabled } : s)
                          )
                        }
                        onAliasChange={(v) =>
                          setDbSources((prev) =>
                            prev.map((s) => s.id === db.id ? { ...s, alias: v } : s)
                          )
                        }
                        onRemove={() =>
                          setDbSources((prev) => prev.filter((s) => s.id !== db.id))
                        }
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowAddDb(true)}
                      className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 transition-colors hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20"
                    >
                      <Plus size={10} />
                      Add Database
                    </button>
                  </div>
                )}
              </div>

              {/* Active alias chips */}
              {enabledAliases.length > 0 && (
                <div className="mt-auto pt-4 flex flex-wrap gap-1">
                  {enabledAliases.map((a) => (
                    <span
                      key={a}
                      className={cx(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                        duplicateAliases.has(a)
                          ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-700/40"
                          : "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-violet-100 dark:ring-violet-800/30"
                      )}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT: SQL Editor ── */}
            <div className="flex flex-1 flex-col">

              {/* Editor header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  SQL Editor
                </span>
                <div className="flex items-center gap-2">
                  <TemplateMenu aliases={enabledAliases} onSelect={(sql) => setQuery(sql)} />
                  <button
                    type="button"
                    onClick={handleLoadSchema}
                    disabled={loadingSchema || enabledAliases.length === 0}
                    title="Refresh column autocomplete"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingSchema ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    title="Clear editor"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <RotateCcw size={10} />
                    Clear
                  </button>
                </div>
              </div>

              {/* Textarea + autocomplete */}
              <div className="relative flex-1 bg-slate-950 dark:bg-slate-950">
                <textarea
                  ref={editorRef}
                  value={query}
                  onChange={handleEditorChange}
                  onKeyDown={handleEditorKeyDown}
                  onBlur={() => setTimeout(() => setAc((p) => ({ ...p, visible: false })), 150)}
                  spellCheck={false}
                  placeholder={"-- Write your SQL query here\nSELECT *\nFROM source_file\nLIMIT 100"}
                  className="absolute inset-0 w-full h-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none"
                />

                {/* IntelliSense dropdown */}
                {ac.visible && ac.suggestions.length > 0 && (
                  <div
                    style={{ position: "absolute", top: ac.top, left: ac.left, zIndex: 50 }}
                    className="max-h-52 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl py-1 min-w-[180px] max-w-[320px]"
                  >
                    {ac.suggestions.map((s, i) => (
                      <button
                        key={`${s.kind}:${s.text}`}
                        type="button"
                        className={cx(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[12px] transition-colors",
                          i === ac.selectedIndex
                            ? "bg-violet-600 text-white"
                            : "text-slate-200 hover:bg-slate-700/60"
                        )}
                        onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s); }}
                      >
                        <span
                          className={cx(
                            "w-6 shrink-0 text-right text-[9px] font-sans font-semibold uppercase tracking-wide",
                            i === ac.selectedIndex ? "text-violet-200" : KIND_COLOR[s.kind]
                          )}
                        >
                          {KIND_BADGE[s.kind]}
                        </span>
                        <span className="flex-1 truncate">{s.text}</span>
                        {s.detail && (
                          <span
                            className={cx(
                              "ml-auto shrink-0 max-w-[80px] truncate font-sans text-[10px]",
                              i === ac.selectedIndex ? "text-violet-200" : "text-slate-500"
                            )}
                          >
                            {s.detail}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Execute bar */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30">
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Tab/Enter selects · Esc closes · Ctrl+Enter to run
                  </span>
                  {duplicateAliases.size > 0 && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={10} />
                      Duplicate aliases will block execution: {[...duplicateAliases].join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={executing || !query.trim() || duplicateAliases.size > 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:active:scale-100"
                  >
                    {executing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    {executing ? "Executing…" : "Run Query"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {execError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/70 dark:bg-red-900/20 px-4 py-3.5">
            <X size={14} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
            <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
              {execError}
            </pre>
          </div>
        )}

        {/* ── Results ── */}
        {queryResult && (
          <div className="overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-700/50 bg-white dark:bg-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.06)]">
            <div className="h-[3px] bg-emerald-600" />

            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  <Check size={13} strokeWidth={2.5} />
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Query Result</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {queryResult.total_rows.toLocaleString()} rows
                </span>
                <span>·</span>
                <span>{queryResult.columns.length} columns</span>
                {execTime !== null && (
                  <><span>·</span><span>{(execTime / 1000).toFixed(2)}s</span></>
                )}
                {queryResult.preview_rows < queryResult.total_rows && (
                  <><span>·</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    showing first {queryResult.preview_rows} rows
                  </span></>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleDownloadResult}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-all"
                >
                  <Download size={12} />
                  Download
                </button>

                {sourceApplied ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700/40">
                    <Check size={12} strokeWidth={2.5} />
                    Applied as Source
                    <Link href="/transformation-workspace" className="ml-1 text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5">
                      Go to Transformations
                      <ArrowRight size={10} />
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleUseAsSource}
                    disabled={usingAsSource || !currentProject}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all"
                    title={!currentProject ? "Select a project first" : "Register this result as the project source file"}
                  >
                    {usingAsSource ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
                    {usingAsSource ? "Applying…" : "Use as Source"}
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60">
                    <th className="w-10 shrink-0 px-3 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-center">#</th>
                    {queryResult.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows?.map((row, ri) => (
                    <tr
                      key={ri}
                      className={cx(
                        "border-b border-slate-50 dark:border-slate-700/50 transition-colors",
                        ri % 2 === 0
                          ? "bg-white dark:bg-slate-800"
                          : "bg-slate-50/50 dark:bg-slate-800/40",
                        "hover:bg-violet-50/40 dark:hover:bg-violet-900/10"
                      )}
                    >
                      <td className="px-3 py-1.5 text-center text-slate-400 dark:text-slate-600 tabular-nums select-none">
                        {resultPage * PAGE_SIZE + ri + 1}
                      </td>
                      {(row as unknown[]).map((v, ci) => (
                        <td
                          key={ci}
                          className="max-w-[280px] truncate px-4 py-1.5 text-slate-700 dark:text-slate-300"
                          title={v == null ? "" : String(v)}
                        >
                          {v == null ? (
                            <span className="text-slate-300 dark:text-slate-600 italic">null</span>
                          ) : (
                            String(v)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Page {resultPage + 1} of {totalPages} · {queryResult.rows.length.toLocaleString()} rows in preview
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setResultPage((p) => Math.max(0, p - 1))}
                    disabled={resultPage === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={resultPage >= totalPages - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ── Attach Existing Files Modal ── */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAttachModal(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl">
            <div className="h-[3px] bg-violet-600" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                  <Paperclip size={15} />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Attach Project Files
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto px-5 py-3">
              {attachable.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
                  All project files are already in the workspace.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {attachable.map((f) => {
                    const selected = attachSelected.has(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setAttachSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.id)) next.delete(f.id);
                            else next.add(f.id);
                            return next;
                          })
                        }
                        className={cx(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                          selected
                            ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-800/60 hover:bg-violet-50/40 dark:hover:bg-violet-900/10"
                        )}
                      >
                        <div
                          className={cx(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                            selected
                              ? "border-violet-500 bg-violet-500 text-white"
                              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                          )}
                        >
                          {selected && <Check size={10} strokeWidth={3} />}
                        </div>
                        <FileSpreadsheet size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                            {f.fileName}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {f.fileSize} · slot: {f.slot}
                          </p>
                        </div>
                        <span
                          className={cx(
                            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white",
                            FILE_TYPE_COLOR[detectSourceType(f.fileName)]
                          )}
                        >
                          {FILE_TYPE_LABEL[detectSourceType(f.fileName)]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-slate-700">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {attachSelected.size > 0 ? `${attachSelected.size} selected` : "Select files to add"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttachModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAttach}
                  disabled={attachSelected.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all"
                >
                  <Plus size={12} />
                  Add {attachSelected.size > 0 ? `${attachSelected.size} file${attachSelected.size > 1 ? "s" : ""}` : "Selected"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Database Modal ── */}
      {showAddDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddDb(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl">
            <div className="h-[3px] bg-violet-600" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                  <Database size={15} />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Add Database Source
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDb(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div>
                <label className={labelCls}>Database Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {DB_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setAddDbType(t); setAddDbPort(DB_PORTS[t]); }}
                      className={cx(
                        "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all",
                        addDbType === t
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                          : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {addDbType === "SAP OData" ? (
                <div>
                  <label className={labelCls}>SAP Server URL</label>
                  <input type="text" value={addDbSapBaseUrl} onChange={(e) => setAddDbSapBaseUrl(e.target.value)}
                    placeholder="e.g. https://mycompany.sap.com" className={inputCls} />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>Host</label>
                      <input type="text" value={addDbHost} onChange={(e) => setAddDbHost(e.target.value)} placeholder="e.g. localhost" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Port</label>
                      <input type="text" value={addDbPort} onChange={(e) => setAddDbPort(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Database Name</label>
                    <input type="text" value={addDbDatabase} onChange={(e) => setAddDbDatabase(e.target.value)} placeholder="e.g. salesforce_migration" className={inputCls} />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Username</label>
                  <input type="text" value={addDbUsername} onChange={(e) => setAddDbUsername(e.target.value)} placeholder="e.g. admin" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <div className="relative">
                    <input
                      type={showAddDbPw ? "text" : "password"}
                      value={addDbPassword}
                      onChange={(e) => setAddDbPassword(e.target.value)}
                      placeholder="••••••••"
                      className={cx(inputCls, "pr-8")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddDbPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showAddDbPw ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {addDbType === "MongoDB" && (
                <div>
                  <label className={labelCls}>Authentication Database</label>
                  <input type="text" value={addDbAuthDb} onChange={(e) => setAddDbAuthDb(e.target.value)} placeholder="admin" className={inputCls} />
                </div>
              )}

              {addDbType === "SAP OData" ? (
                <div>
                  <label className={labelCls}>Entity Set</label>
                  <input type="text" value={addDbSapEntity} onChange={(e) => setAddDbSapEntity(e.target.value)}
                    placeholder="e.g. A_BusinessPartner" className={inputCls} />
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    Examples: A_BusinessPartner, A_Customer, A_Supplier
                  </p>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>{addDbType === "MongoDB" ? "Collection Name" : "Table Name"}</label>
                  <input
                    type="text"
                    value={addDbTable}
                    onChange={(e) => setAddDbTable(e.target.value)}
                    placeholder={addDbType === "MongoDB" ? "e.g. orders" : addDbType === "SQL Server" ? "e.g. dbo.contacts" : "e.g. public.users"}
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>SQL Alias (table name in query)</label>
                <input
                  type="text"
                  value={addDbAlias}
                  onChange={(e) => setAddDbAlias(e.target.value)}
                  placeholder={
                    (addDbType === "SAP OData" ? addDbSapEntity : addDbTable)
                      ? (addDbType === "SAP OData" ? addDbSapEntity : addDbTable).replace(/\W+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()
                      : "e.g. db_orders"
                  }
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                  Use this name in your SQL: <code className="font-mono">SELECT * FROM {addDbAlias || "alias"}</code>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowAddDb(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDb}
                disabled={!addDbTable.trim() || !addDbHost.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all"
              >
                <Plus size={12} />
                Add Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SourceCard({
  icon,
  label,
  sub,
  alias,
  enabled,
  typeBadge,
  typeBadgeColor,
  isDuplicate,
  onToggle,
  onAliasChange,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  alias: string;
  enabled: boolean;
  typeBadge?: string;
  typeBadgeColor?: string;
  isDuplicate?: boolean;
  onToggle: () => void;
  onAliasChange: (v: string) => void;
  onRemove: () => void;
}) {
  const [editingAlias, setEditingAlias] = useState(false);
  const [draftAlias, setDraftAlias] = useState(alias);

  return (
    <div
      className={cx(
        "rounded-xl border px-3 py-2 transition-all",
        enabled && !isDuplicate
          ? "border-violet-100 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-900/10"
          : enabled && isDuplicate
            ? "border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/10"
            : "border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Toggle checkbox */}
        <button
          type="button"
          onClick={onToggle}
          className={cx(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
            enabled
              ? isDuplicate
                ? "border-amber-400 bg-amber-400 text-white"
                : "border-violet-500 bg-violet-500 text-white"
              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          )}
        >
          {enabled && <Check size={9} strokeWidth={3} />}
        </button>

        {/* Icon + labels */}
        <div className={cx("shrink-0 text-slate-400 dark:text-slate-500")}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200 leading-tight">
            {label}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{sub}</p>
        </div>

        {/* Type badge */}
        {typeBadge && (
          <span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white", typeBadgeColor)}>
            {typeBadge}
          </span>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Alias editor */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <Eye size={9} className={cx("shrink-0", isDuplicate ? "text-amber-400" : "text-slate-400 dark:text-slate-500")} />
        {editingAlias ? (
          <input
            autoFocus
            type="text"
            value={draftAlias}
            onChange={(e) => setDraftAlias(e.target.value)}
            onBlur={() => {
              const safe = draftAlias.trim().replace(/\W+/g, "_").replace(/^_+|_+$/g, "") || alias;
              onAliasChange(safe);
              setDraftAlias(safe);
              setEditingAlias(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            className="flex-1 rounded border border-violet-300 dark:border-violet-600 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-violet-700 dark:text-violet-300 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraftAlias(alias); setEditingAlias(true); }}
            className={cx(
              "font-mono text-[10px] hover:underline truncate max-w-[160px]",
              isDuplicate
                ? "text-amber-600 dark:text-amber-400"
                : "text-violet-600 dark:text-violet-400"
            )}
            title="Click to rename SQL alias"
          >
            {alias}
          </button>
        )}
        {isDuplicate && (
          <span className="ml-auto shrink-0 text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
            dup!
          </span>
        )}
      </div>
    </div>
  );
}

function TemplateMenu({
  aliases,
  onSelect,
}: {
  aliases: string[];
  onSelect: (sql: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const templates = SQL_TEMPLATES(aliases);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        Templates
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
            {templates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => { onSelect(t.sql); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                <Play size={10} className="text-slate-400 dark:text-slate-500 shrink-0" />
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
