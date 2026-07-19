"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Database,
  Info,
  Link2,
  LoaderCircle,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Table2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useMigration } from "@/context/MigrationContext";
import type { ImportConfig, MappingStatus } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SfField {
  label: string;
  api_name: string;
  type: string;
  createable: boolean;
  nillable: boolean;
  defaultedOnCreate: boolean;
  externalId?: boolean;
  idLookup?: boolean;
  unique?: boolean;
}

// Hardcoded Salesforce Id field — always available for matching, never in createable describe results
const SF_ID_FIELD: SfField = {
  label: "Id", api_name: "Id", type: "id",
  createable: false, nillable: false, defaultedOnCreate: true,
  externalId: false, idLookup: true, unique: true,
};

type FilterTab = "all" | "mapped" | "unmapped" | "warnings" | "required" | "skipped";

interface ValidationErrors {
  required: string[];
  duplicates: string[];
  invalid: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


const ACTIONS = ["Insert", "Upsert"] as const;
const SF_NUMERIC_TYPES = new Set(["double", "currency", "percent", "int", "long"]);
const SF_DATE_TYPES = new Set(["date", "datetime"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[\s_\-]/g, "");
}

function sfTypeLabel(type: string): string {
  const MAP: Record<string, string> = {
    string: "Text", textarea: "Text Area", email: "Email", phone: "Phone",
    url: "URL", double: "Number", currency: "Currency", percent: "Percent",
    int: "Integer", long: "Long", boolean: "Checkbox", date: "Date",
    datetime: "Date/Time", picklist: "Picklist", multipicklist: "Multi-Pick",
    reference: "Lookup", id: "ID", address: "Address", location: "Location",
  };
  return MAP[type] ?? type;
}

function getTypeWarning(sfType: string, sample: string): string | null {
  if (!sample.trim()) return null;
  const s = sample.trim();
  if (SF_NUMERIC_TYPES.has(sfType)) {
    const n = s.replace(/[,$%\s]/g, "");
    if (n && isNaN(Number(n))) return `Expected ${sfTypeLabel(sfType)} — sample: "${s.slice(0, 12)}"`;
  } else if (SF_DATE_TYPES.has(sfType)) {
    if (isNaN(Date.parse(s))) return `Expected ${sfTypeLabel(sfType)} — sample: "${s.slice(0, 12)}"`;
  } else if (sfType === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "Expected email format";
  } else if (sfType === "boolean") {
    if (!["true", "false", "yes", "no", "1", "0"].includes(s.toLowerCase()))
      return "Expected boolean (true/false)";
  }
  return null;
}

// ---------------------------------------------------------------------------
// SfFieldSelect — searchable dropdown for one mapping row
// ---------------------------------------------------------------------------

function SfFieldSelect({
  value,
  onChange,
  fields,
  isInvalid,
  disabled,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
  fields: SfField[];
  isInvalid: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const filtered = search
    ? fields.filter(f =>
        f.label.toLowerCase().includes(search.toLowerCase()) ||
        f.api_name.toLowerCase().includes(search.toLowerCase()) ||
        f.type.toLowerCase().includes(search.toLowerCase())
      )
    : fields;

  const selectedField = value ? fields.find(f => f.api_name === value) : null;

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={cx(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-left transition-colors",
          disabled && "cursor-not-allowed opacity-50",
          isInvalid && "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400",
          !isInvalid && value && "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
          !isInvalid && !value && "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500",
        )}
      >
        <span className="truncate font-medium">
          {isInvalid ? `⚠ ${value}` : selectedField ? selectedField.label : "Not mapped"}
        </span>
        <ChevronDown size={11} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl">
          <div className="border-b border-slate-100 dark:border-slate-700 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search label, API name, or type…"
              className="w-full text-xs bg-transparent outline-none placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
              className="flex w-full items-center px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Clear mapping
            </button>
            {filtered.map(f => {
              const isReq = !f.nillable && !f.defaultedOnCreate && f.createable;
              return (
                <button
                  key={f.api_name}
                  type="button"
                  onClick={() => { onChange(f.api_name); setOpen(false); setSearch(""); }}
                  className={cx(
                    "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                    f.api_name === value && "bg-blue-50 dark:bg-blue-900/30"
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {f.label}{isReq && <span className="ml-1 text-rose-500">*</span>}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate">{f.api_name}</span>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {sfTypeLabel(f.type)}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-slate-400">No matching fields</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectSelect — searchable dropdown for Target Object
// ---------------------------------------------------------------------------

function ObjectSelect({
  value, onChange, objects, loading, error, disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  objects: { label: string; api_name: string }[];
  loading: boolean;
  error: string | null;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const filtered = search
    ? objects.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.api_name.toLowerCase().includes(search.toLowerCase())
      )
    : objects;

  const selectedObj = objects.find(o => o.api_name === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => !disabled && !loading && setOpen(v => !v)}
        className={cx(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
          "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200",
          (disabled || loading) && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="truncate">
          {loading ? "Loading objects…" : selectedObj ? `${selectedObj.label} (${selectedObj.api_name})` : value || "Select object"}
        </span>
        {loading
          ? <LoaderCircle size={14} className="animate-spin shrink-0 text-slate-400" />
          : <ChevronDown size={14} className="shrink-0 text-slate-400" />
        }
      </button>

      {open && !loading && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl">
          <div className="border-b border-slate-100 dark:border-slate-700 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search objects…"
              className="w-full text-sm bg-transparent outline-none placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-200"
            />
          </div>
          {error
            ? <p className="px-3 py-4 text-center text-xs text-rose-600">{error}</p>
            : (
              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.map(obj => (
                  <button
                    key={obj.api_name}
                    type="button"
                    onClick={() => { onChange(obj.api_name); setOpen(false); setSearch(""); }}
                    className={cx(
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                      obj.api_name === value && "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    )}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">{obj.label}</span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{obj.api_name}</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-400">No matching objects</p>}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ValidationDialog — shown before import if there are blocking issues
// ---------------------------------------------------------------------------

function ValidationDialog({ errors, onClose }: { errors: ValidationErrors; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20 px-6 py-5">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Import Validation Failed</h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Resolve these issues before importing</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
          {errors.required.length > 0 && (
            <div className="px-6 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Missing Required Fields ({errors.required.length})
              </p>
              <ul className="space-y-1">
                {errors.required.map(f => <li key={f} className="pl-3.5 text-xs text-slate-600 dark:text-slate-300">• {f}</li>)}
              </ul>
            </div>
          )}
          {errors.duplicates.length > 0 && (
            <div className="px-6 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Duplicate Mappings ({errors.duplicates.length})
              </p>
              <ul className="space-y-1">
                {errors.duplicates.map(d => <li key={d} className="pl-3.5 text-xs text-slate-600 dark:text-slate-300">• {d} ← multiple sources</li>)}
              </ul>
            </div>
          )}
          {errors.invalid.length > 0 && (
            <div className="px-6 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Invalid Field Mappings ({errors.invalid.length})
              </p>
              <ul className="space-y-1">
                {errors.invalid.map(d => <li key={d} className="pl-3.5 font-mono text-xs text-slate-600 dark:text-slate-300">• {d}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            Fix Issues
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge for the mapping table
// ---------------------------------------------------------------------------

function StatusBadge({ status, isDuplicate, typeWarning }: {
  status: MappingStatus;
  isDuplicate: boolean;
  typeWarning: string | null;
}) {
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Skipped
      </span>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold",
        status === "auto" && "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/30",
        status === "manual" && "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800/30",
        status === "unmapped" && "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/30",
        status === "invalid" && "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800/30",
      )}>
        <span className={cx(
          "h-1.5 w-1.5 rounded-full",
          status === "auto" && "bg-emerald-500",
          status === "manual" && "bg-blue-500",
          status === "unmapped" && "bg-amber-400",
          status === "invalid" && "bg-rose-500",
        )} />
        {status === "auto" && "Auto Mapped"}
        {status === "manual" && "Manually Mapped"}
        {status === "unmapped" && "Unmapped"}
        {status === "invalid" && "Invalid Field"}
      </span>
      {isDuplicate && (
        <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800/30">
          <AlertTriangle size={9} />Duplicate
        </span>
      )}
      {typeWarning && (
        <span className="inline-flex items-center gap-1 rounded-md bg-yellow-50 dark:bg-yellow-900/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:text-yellow-400 ring-1 ring-yellow-200 dark:ring-yellow-800/30 max-w-[180px] truncate" title={typeWarning}>
          <AlertTriangle size={9} />{typeWarning}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IdentifierSelect — searchable dropdown for matching / identifier field
// ---------------------------------------------------------------------------

function IdentifierSelect({
  value, onChange, candidates, loading, placeholder = "Select field…",
}: {
  value: string | null;
  onChange: (val: string | null) => void;
  candidates: SfField[];
  loading: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      minWidth: "16rem",
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    if (inputRef.current) inputRef.current.focus();
    // Reposition when the page scrolls or resizes while dropdown is open
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const filtered = search
    ? candidates.filter(f =>
        f.label.toLowerCase().includes(search.toLowerCase()) ||
        f.api_name.toLowerCase().includes(search.toLowerCase())
      )
    : candidates;

  const selected = candidates.find(f => f.api_name === value);

  const dropdown = open && !loading ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl"
    >
      <div className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-700/30 px-3 py-2.5">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search fields…"
          className="w-full bg-transparent text-sm outline-none placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-200"
        />
      </div>
      <div className="max-h-80 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">No matching fields</p>
        ) : filtered.map(f => {
          const isSelected = f.api_name === value;
          return (
            <button
              key={f.api_name}
              type="button"
              onClick={() => { onChange(f.api_name); setOpen(false); setSearch(""); }}
              className={cx(
                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                isSelected && "bg-blue-50 dark:bg-blue-900/30"
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={cx("truncate font-medium", isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200")}>{f.label}</span>
                {f.type === "id" && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    SF ID
                  </span>
                )}
                {f.externalId && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                    Ext ID
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{f.api_name}</span>
                {isSelected && <Check size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={loading || candidates.length === 0}
        onClick={() => { if (!open) updatePosition(); setOpen(v => !v); }}
        className={cx(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
          "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800",
          !selected && "text-slate-400 dark:text-slate-500",
          (loading || candidates.length === 0) && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected ? (
            <>
              <span className="truncate text-slate-800 dark:text-slate-200">{selected.label}</span>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">{selected.api_name}</span>
              {selected.type === "id" && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  SF ID
                </span>
              )}
              {selected.externalId && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                  Ext ID
                </span>
              )}
            </>
          ) : (
            <span>{loading ? "Loading fields…" : placeholder}</span>
          )}
        </span>
        {loading
          ? <LoaderCircle size={14} className="animate-spin shrink-0 text-slate-400" />
          : <ChevronDown size={14} className="shrink-0 text-slate-400" />
        }
      </button>

      {typeof document !== "undefined" && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter tab button
// ---------------------------------------------------------------------------

function FilterTabBtn({ tab, activeTab, count, onClick }: {
  tab: FilterTab; activeTab: FilterTab; count: number; onClick: () => void;
}) {
  const LABELS: Record<FilterTab, string> = {
    all: "All", mapped: "Mapped", unmapped: "Unmapped", warnings: "Warnings", required: "Required", skipped: "Skipped",
  };
  const isActive = tab === activeTab;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
        isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700",
      )}
    >
      {LABELS[tab]}
      <span className={cx(
        "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
        isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
      )}>
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ImportConfigPage() {
  const router = useRouter();
  const {
    sfAccessToken, sfInstanceUrl, sfSelectedObject, setSfSelectedObject,
    sfUserEmail, setSfAccessToken, setSfInstanceUrl, setSfRefreshToken, setSfUserEmail,
    transformResult,
    importConfig, setImportConfig,
    currentProject,
  } = useMigration();

  // ── Import Settings ─────────────────────────────────────────────────────
  const [targetObject, setTargetObject] = useState<string>(sfSelectedObject ?? "");
  const [action, setAction] = useState<string>("Insert");
  const [batchSize,    setBatchSize]    = useState<number>(200);
  const [batchSizeStr, setBatchSizeStr] = useState<string>("200");
  const [batchSizeError, setBatchSizeError] = useState<string | null>(null);
  const [threads,      setThreads]      = useState<number>(1);
  const [threadsStr,   setThreadsStr]   = useState<string>("1");
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const skipUnknownFields = false;
  const continueOnError   = false;
  const validateOnly      = false;
  const [configRestored, setConfigRestored] = useState(false);

  // ── SF data ─────────────────────────────────────────────────────────────
  const [sfObjects, setSfObjects] = useState<{ label: string; api_name: string }[]>([]);
  const [sfObjectsLoading, setSfObjectsLoading] = useState(false);
  const [sfObjectsError, setSfObjectsError] = useState<string | null>(null);
  const [sfFields, setSfFields] = useState<SfField[]>([]);
  const [sfFieldsLoading, setSfFieldsLoading] = useState(false);
  const [sfFieldsError, setSfFieldsError] = useState<string | null>(null);
  const [sfFieldsLoadedForObject, setSfFieldsLoadedForObject] = useState<string | null>(null);

  // ── Matching field (Update / Upsert / Delete) ────────────────────────────
  const [matchingField, setMatchingField] = useState<string | null>(null);

  // ── Field mapping ────────────────────────────────────────────────────────
  const [fieldMappings, setFieldMappings] = useState<Record<string, string | null>>({});
  const [mappingStatuses, setMappingStatuses] = useState<Record<string, MappingStatus>>({});
  // Snapshot of mapping+status before a field was skipped — used for Undo Skip
  const [preSkipMappings, setPreSkipMappings] = useState<Record<string, string | null>>({});
  const [preSkipStatuses, setPreSkipStatuses] = useState<Record<string, MappingStatus>>({});

  // ── Excel columns (all headers from the transformed file, __ stripped) ───
  const [excelColumns, setExcelColumns] = useState<string[]>([]);

  // ── Sample values ────────────────────────────────────────────────────────
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [sampleLoading, setSampleLoading] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  // ── Upload state ─────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  // Prefer the full column list read from the actual Excel file (populated once
  // preview-payload resolves).  Fall back to transformedColumns only while the
  // fetch is in-flight, and strip any __ helper columns in both cases.
  const sourceColumns: string[] = useMemo(
    () => excelColumns.length > 0
      ? excelColumns
      : (transformResult?.outputs?.[0]?.transformedColumns ?? []).filter(c => !c.startsWith("__")),
    [excelColumns, transformResult]
  );
  const totalRecords = transformResult?.totalRecords ?? 0;
  const s3Key = transformResult?.zipS3Key ?? transformResult?.outputs?.[0]?.transformedS3Key ?? null;

  // ── Memoized SF lookups ──────────────────────────────────────────────────
  const sfFieldMap = useMemo(() => new Map(sfFields.map(f => [f.api_name, f])), [sfFields]);
  const sfFieldApiNames = useMemo(() => new Set(sfFields.map(f => f.api_name)), [sfFields]);
  const requiredSfFields = useMemo(
    () => sfFields.filter(f => !f.nillable && !f.defaultedOnCreate && f.createable),
    [sfFields]
  );

  // ── Duplicate detection ──────────────────────────────────────────────────
  const sfFieldUsageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(fieldMappings).forEach(v => { if (v) counts[v] = (counts[v] ?? 0) + 1; });
    return counts;
  }, [fieldMappings]);

  const duplicateSfFields = useMemo(
    () => new Set(Object.keys(sfFieldUsageCount).filter(k => sfFieldUsageCount[k] > 1)),
    [sfFieldUsageCount]
  );

  // ── Validation derived ───────────────────────────────────────────────────
  const mappedSfNames = useMemo(
    () => new Set(Object.values(fieldMappings).filter((v): v is string => v !== null)),
    [fieldMappings]
  );

  const missingRequiredFields = useMemo(
    () => requiredSfFields.filter(f => !mappedSfNames.has(f.api_name)),
    [requiredSfFields, mappedSfNames]
  );

  const typeWarnings = useMemo(() => {
    const w: Record<string, string> = {};
    sourceColumns.forEach(col => {
      const sfApiName = fieldMappings[col];
      if (!sfApiName) return;
      const sfField = sfFieldMap.get(sfApiName);
      if (!sfField) return;
      const warn = getTypeWarning(sfField.type, sampleValues[col] ?? "");
      if (warn) w[col] = warn;
    });
    return w;
  }, [sourceColumns, fieldMappings, sfFieldMap, sampleValues]);

  // ── Filter counts ────────────────────────────────────────────────────────
  const filterCounts = useMemo(() => {
    let mapped = 0, unmapped = 0, warnings = 0, required = 0, skipped = 0;
    sourceColumns.forEach(col => {
      const status = mappingStatuses[col];
      if (status === "skipped") { skipped++; return; }
      const sfApiName = fieldMappings[col];
      const sfField = sfApiName ? sfFieldMap.get(sfApiName) : null;
      const isDup = sfApiName ? duplicateSfFields.has(sfApiName) : false;
      const isInvalid = sfApiName && sfFieldApiNames.size > 0 && !sfFieldApiNames.has(sfApiName);
      if (sfApiName && !isInvalid) mapped++;
      if (!sfApiName) unmapped++;
      if (isDup || isInvalid || typeWarnings[col]) warnings++;
      if (sfField && !sfField.nillable && !sfField.defaultedOnCreate) required++;
    });
    return { all: sourceColumns.length, mapped, unmapped, warnings, required, skipped };
  }, [sourceColumns, fieldMappings, mappingStatuses, sfFieldMap, sfFieldApiNames, duplicateSfFields, typeWarnings]);

  // ── Filtered + searched columns ──────────────────────────────────────────
  const filteredColumns = useMemo(() => {
    let cols = sourceColumns;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cols = cols.filter(col => {
        const sfApiName = fieldMappings[col];
        const sfField = sfApiName ? sfFieldMap.get(sfApiName) : null;
        return (
          col.toLowerCase().includes(q) ||
          (sfApiName?.toLowerCase().includes(q) ?? false) ||
          (sfField?.label.toLowerCase().includes(q) ?? false) ||
          (sfField?.type.toLowerCase().includes(q) ?? false) ||
          (sampleValues[col]?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    switch (activeFilter) {
      case "mapped":
        return cols.filter(col => {
          const v = fieldMappings[col];
          return mappingStatuses[col] !== "skipped" && v && (sfFieldApiNames.size === 0 || sfFieldApiNames.has(v));
        });
      case "unmapped":
        return cols.filter(col => mappingStatuses[col] !== "skipped" && !fieldMappings[col]);
      case "warnings":
        return cols.filter(col => {
          if (mappingStatuses[col] === "skipped") return false;
          const v = fieldMappings[col];
          const isInvalid = v && sfFieldApiNames.size > 0 && !sfFieldApiNames.has(v);
          return isInvalid || (v && duplicateSfFields.has(v)) || !!typeWarnings[col];
        });
      case "required":
        return cols.filter(col => {
          if (mappingStatuses[col] === "skipped") return false;
          const sfField = fieldMappings[col] ? sfFieldMap.get(fieldMappings[col]!) : null;
          return sfField && !sfField.nillable && !sfField.defaultedOnCreate;
        });
      case "skipped":
        return cols.filter(col => mappingStatuses[col] === "skipped");
      default:
        return cols;
    }
  }, [sourceColumns, searchQuery, activeFilter, fieldMappings, sfFieldMap, sfFieldApiNames, duplicateSfFields, typeWarnings, sampleValues]);

  // ── Identifier candidates for matching field selector ────────────────────
  // Bulk API Upsert only supports Id or fields where externalId === true.
  // idLookup and unique fields (e.g. Email) are not valid Bulk API Upsert keys.
  const identifierCandidates: SfField[] = useMemo(() => {
    if (!sfFields.length) return [];
    const extras = sfFields.filter(f => f.externalId === true);
    return [SF_ID_FIELD, ...extras];
  }, [sfFields]);

  // ── Import readiness ──────────────────────────────────────────────────────
  const totalMapped = filterCounts.mapped;
  const totalUnmapped = filterCounts.unmapped;
  const invalidCount = useMemo(
    () => sourceColumns.filter(col => {
      const v = fieldMappings[col];
      return v && sfFieldApiNames.size > 0 && !sfFieldApiNames.has(v);
    }).length,
    [sourceColumns, fieldMappings, sfFieldApiNames]
  );
  const duplicateCount = useMemo(
    () => sourceColumns.filter(col => {
      const v = fieldMappings[col];
      return v && duplicateSfFields.has(v);
    }).length,
    [sourceColumns, fieldMappings, duplicateSfFields]
  );
  const requiredMissing = missingRequiredFields.length;
  const warningCount = filterCounts.warnings;

  const matchingFieldReady = action === "Insert" || !!matchingField;
  const fieldMappingReady  = requiredMissing === 0 && invalidCount === 0 && duplicateCount === 0;

  const importReady    = !!sfAccessToken && !!targetObject && !!s3Key && fieldMappingReady && matchingFieldReady;
  const canStartImport = importReady && !uploading;
  const estimatedBatches = batchSize > 0 ? Math.max(1, Math.ceil(totalRecords / batchSize)) : 1;

  // ── Readiness panel rows — dynamic by action ──────────────────────────────
  const readinessRows = useMemo((): Array<{ label: string; value: string; tone: string }> => {
    const rows: Array<{ label: string; value: string; tone: string }> = [
      { label: "Fields",           value: sourceColumns.length.toString(), tone: "slate" },
      { label: "Mapped",           value: totalMapped.toString(),          tone: "emerald" },
      { label: "Skipped",          value: filterCounts.skipped.toString(), tone: "slate" },
      { label: "Unmapped",         value: totalUnmapped.toString(),        tone: totalUnmapped > 0 ? "amber" : "slate" },
      { label: "Required Missing", value: requiredMissing.toString(),      tone: requiredMissing > 0 ? "rose" : "emerald" },
      { label: "Warnings",         value: warningCount.toString(),         tone: warningCount > 0 ? "amber" : "slate" },
    ];
    if (action === "Upsert") {
      const mfSet = !!matchingField;
      const mfLabel = matchingField ? (sfFieldMap.get(matchingField)?.label ?? matchingField) : "Not selected";
      rows.push({ label: "External ID / Match", value: mfLabel, tone: mfSet ? "emerald" : "rose" });
    }
    return rows;
  }, [action, matchingField, sfFieldMap, sourceColumns, totalMapped, filterCounts, totalUnmapped, requiredMissing, warningCount]);

  // ── Restore saved config ──────────────────────────────────────────────────
  useEffect(() => {
    if (configRestored) return;
    if (importConfig) {
      setTargetObject(importConfig.targetObject ?? sfSelectedObject ?? "");
      setAction(importConfig.action ?? "Insert");
      setBatchSize(importConfig.batchSize ?? 200);
      setBatchSizeStr(String(importConfig.batchSize ?? 200));
      setThreads(importConfig.threads ?? 1);
      setThreadsStr(String(importConfig.threads ?? 1));
      setFieldMappings(importConfig.fieldMappings ?? {});
      setMappingStatuses((importConfig.mappingStatuses ?? {}) as Record<string, MappingStatus>);
      setPreSkipMappings(importConfig.preSkipMappings ?? {});
      setPreSkipStatuses((importConfig.preSkipStatuses ?? {}) as Record<string, MappingStatus>);
      setMatchingField(importConfig.matchingField ?? null);
    } else if (sfSelectedObject) {
      setTargetObject(sfSelectedObject);
    }
    setConfigRestored(true);
  }, [importConfig, sfSelectedObject, configRestored]);

  // ── Load SF objects ───────────────────────────────────────────────────────
  const loadSfObjects = useCallback(async () => {
    if (!sfAccessToken || !sfInstanceUrl) return;
    setSfObjectsLoading(true); setSfObjectsError(null);
    try {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/salesforce/objects?access_token=${encodeURIComponent(sfAccessToken)}&instance_url=${encodeURIComponent(sfInstanceUrl)}`
      );
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail?.message ?? "Failed to load objects");
      setSfObjects(await res.json());
    } catch (err) {
      setSfObjectsError(err instanceof Error ? err.message : "Failed to load objects");
    } finally {
      setSfObjectsLoading(false);
    }
  }, [sfAccessToken, sfInstanceUrl]);

  useEffect(() => { if (sfAccessToken && sfInstanceUrl) loadSfObjects(); }, [sfAccessToken, sfInstanceUrl, loadSfObjects]);

  // ── Load SF fields ────────────────────────────────────────────────────────
  const loadSfFields = useCallback(async (objectName: string) => {
    if (!sfAccessToken || !sfInstanceUrl || !objectName) return;
    setSfFieldsLoading(true); setSfFieldsError(null); setSfFields([]);
    try {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/salesforce/object-fields?access_token=${encodeURIComponent(sfAccessToken)}&instance_url=${encodeURIComponent(sfInstanceUrl)}&object_name=${encodeURIComponent(objectName)}`
      );
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail?.message ?? "Failed to load fields");
      setSfFields(await res.json());
    } catch (err) {
      setSfFieldsError(err instanceof Error ? err.message : "Failed to load fields");
    } finally {
      setSfFieldsLoading(false);
    }
  }, [sfAccessToken, sfInstanceUrl]);

  useEffect(() => {
    if (sfAccessToken && sfInstanceUrl && targetObject) loadSfFields(targetObject);
  }, [sfAccessToken, sfInstanceUrl, targetObject, loadSfFields]);

  // ── Auto-map / validate when fields or source columns change ─────────────
  useEffect(() => {
    if (!sfFields.length || !sourceColumns.length || !configRestored) return;

    const nameSet      = new Set(sfFields.map(f => f.api_name));
    const normalizedMap = new Map(sfFields.map(f => [normalizeFieldName(f.api_name), f.api_name]));
    const newMappings: Record<string, string | null> = {};
    const newStatuses: Record<string, MappingStatus> = {};

    // Fresh object: auto-map every column from scratch.
    // Same object (sourceColumns expanded by preview-payload): preserve any
    // column already in fieldMappings; auto-map only columns that are new.
    const isNewObject = sfFieldsLoadedForObject !== targetObject;
    if (isNewObject) setSfFieldsLoadedForObject(targetObject);

    sourceColumns.forEach(col => {
      // Never overwrite a user-skipped field during auto-map.
      if (mappingStatuses[col] === "skipped") {
        newMappings[col] = null;
        newStatuses[col] = "skipped";
        return;
      }
      if (!isNewObject && col in fieldMappings) {
        // Column was already mapped (possibly null) — keep it, refresh status.
        const existing = fieldMappings[col];
        newMappings[col] = existing;
        if (!existing)              newStatuses[col] = "unmapped";
        else if (!nameSet.has(existing)) newStatuses[col] = "invalid";
        else                        newStatuses[col] = mappingStatuses[col] ?? "manual";
      } else {
        // New object or column never seen before: attempt auto-map by API name.
        const matched = normalizedMap.get(normalizeFieldName(col)) ?? null;
        newMappings[col] = matched;
        newStatuses[col] = matched ? "auto" : "unmapped";
      }
    });

    setFieldMappings(newMappings);
    setMappingStatuses(newStatuses);
  }, [sfFields, sourceColumns, configRestored, targetObject]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load sample values ────────────────────────────────────────────────────
  useEffect(() => {
    const s3Key = transformResult?.outputs?.[0]?.transformedS3Key;
    if (!s3Key) return;
    setSampleLoading(true);
    fetch(`${NEXT_PUBLIC_API_URL}/salesforce/preview-payload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3_key: s3Key, object_name: "_" }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        // Use the full column list from the Excel file as the definitive source
        // of importable fields.  The endpoint already strips __ helper columns.
        setExcelColumns(data.columns ?? []);
        const values: Record<string, string> = {};
        const rows: Record<string, unknown>[] = data.sample_records ?? [];
        (data.columns ?? []).forEach((col: string) => {
          for (const row of rows) {
            const v = row[col];
            if (v !== null && v !== undefined && String(v).trim() !== "") {
              values[col] = String(v).trim();
              break;
            }
          }
        });
        setSampleValues(values);
      })
      .catch(() => {})
      .finally(() => setSampleLoading(false));
  }, [transformResult]);

  // ── updateMapping: auto-saves to context/localStorage ────────────────────
  const updateMapping = useCallback((col: string, sfApiName: string | null, isManual = true) => {
    let newStatus: MappingStatus;
    if (!sfApiName) newStatus = "unmapped";
    else if (sfFieldApiNames.size > 0 && !sfFieldApiNames.has(sfApiName)) newStatus = "invalid";
    else newStatus = isManual ? "manual" : "auto";

    const newMappings = { ...fieldMappings, [col]: sfApiName };
    const newStatuses = { ...mappingStatuses, [col]: newStatus };
    setFieldMappings(newMappings);
    setMappingStatuses(newStatuses);

    setImportConfig({
      targetObject, action: action as ImportConfig["action"],
      batchSize: batchSize as ImportConfig["batchSize"], threads,
      fieldMappings: newMappings, mappingStatuses: newStatuses,
      skipUnknownFields, continueOnError, validateOnly,
      preSkipMappings, preSkipStatuses, matchingField,
    });
  }, [fieldMappings, mappingStatuses, sfFieldApiNames, targetObject, action, batchSize, threads, skipUnknownFields, continueOnError, validateOnly, setImportConfig, preSkipMappings, preSkipStatuses, matchingField]);

  // ── Skip / Undo Skip ──────────────────────────────────────────────────────
  const handleSkip = useCallback((col: string) => {
    const prevMapping = fieldMappings[col] ?? null;
    const prevStatus  = mappingStatuses[col] ?? "unmapped";
    const newPreSkipMappings = { ...preSkipMappings, [col]: prevMapping };
    const newPreSkipStatuses = { ...preSkipStatuses, [col]: prevStatus };
    const newMappings = { ...fieldMappings,  [col]: null };
    const newStatuses = { ...mappingStatuses, [col]: "skipped" as MappingStatus };
    setPreSkipMappings(newPreSkipMappings);
    setPreSkipStatuses(newPreSkipStatuses);
    setFieldMappings(newMappings);
    setMappingStatuses(newStatuses);
    setImportConfig({
      targetObject, action: action as ImportConfig["action"],
      batchSize: batchSize as ImportConfig["batchSize"], threads,
      fieldMappings: newMappings, mappingStatuses: newStatuses,
      skipUnknownFields, continueOnError, validateOnly,
      preSkipMappings: newPreSkipMappings, preSkipStatuses: newPreSkipStatuses, matchingField,
    });
  }, [fieldMappings, mappingStatuses, preSkipMappings, preSkipStatuses, targetObject, action, batchSize, threads, skipUnknownFields, continueOnError, validateOnly, setImportConfig, matchingField]);

  const handleUndoSkip = useCallback((col: string) => {
    const prevMapping = preSkipMappings[col] ?? null;
    const prevStatus  = (preSkipStatuses[col] ?? (prevMapping ? "manual" : "unmapped")) as MappingStatus;
    const newPreSkipMappings = { ...preSkipMappings };
    const newPreSkipStatuses = { ...preSkipStatuses };
    delete newPreSkipMappings[col];
    delete newPreSkipStatuses[col];
    const newMappings = { ...fieldMappings,  [col]: prevMapping };
    const newStatuses = { ...mappingStatuses, [col]: prevStatus };
    setPreSkipMappings(newPreSkipMappings);
    setPreSkipStatuses(newPreSkipStatuses);
    setFieldMappings(newMappings);
    setMappingStatuses(newStatuses);
    setImportConfig({
      targetObject, action: action as ImportConfig["action"],
      batchSize: batchSize as ImportConfig["batchSize"], threads,
      fieldMappings: newMappings, mappingStatuses: newStatuses,
      skipUnknownFields, continueOnError, validateOnly,
      preSkipMappings: newPreSkipMappings, preSkipStatuses: newPreSkipStatuses, matchingField,
    });
  }, [fieldMappings, mappingStatuses, preSkipMappings, preSkipStatuses, targetObject, action, batchSize, threads, skipUnknownFields, continueOnError, validateOnly, setImportConfig, matchingField]);

  // ── Auto-map button handler ───────────────────────────────────────────────
  const handleAutoMap = () => {
    if (!sfFields.length || !sourceColumns.length) return;
    const normalizedMap = new Map(sfFields.map(f => [normalizeFieldName(f.api_name), f.api_name]));
    const newMappings: Record<string, string | null> = {};
    const newStatuses: Record<string, MappingStatus> = {};
    sourceColumns.forEach(col => {
      // Preserve skipped fields — auto-map must not touch them.
      if (mappingStatuses[col] === "skipped") {
        newMappings[col] = null;
        newStatuses[col] = "skipped";
        return;
      }
      const matched = normalizedMap.get(normalizeFieldName(col)) ?? null;
      newMappings[col] = matched;
      newStatuses[col] = matched ? "auto" : "unmapped";
    });
    setFieldMappings(newMappings);
    setMappingStatuses(newStatuses);
    setImportConfig({
      targetObject, action: action as ImportConfig["action"],
      batchSize: batchSize as ImportConfig["batchSize"], threads,
      fieldMappings: newMappings, mappingStatuses: newStatuses,
      skipUnknownFields, continueOnError, validateOnly,
      preSkipMappings, preSkipStatuses, matchingField,
    });
  };

  // ── Save settings (import config without changing mappings) ───────────────
  const saveConfig = () => {
    setImportConfig({
      targetObject, action: action as ImportConfig["action"],
      batchSize: batchSize as ImportConfig["batchSize"], threads,
      fieldMappings, mappingStatuses,
      skipUnknownFields, continueOnError, validateOnly,
      preSkipMappings, preSkipStatuses, matchingField,
    });
  };

  // ── Object change ─────────────────────────────────────────────────────────
  const handleTargetObjectChange = (val: string) => {
    setTargetObject(val);
    setSfSelectedObject(val);
    setSfFieldsLoadedForObject(null);
    setFieldMappings({});
    setMappingStatuses({});
    setPreSkipMappings({});
    setPreSkipStatuses({});
    setMatchingField(null);
  };

  // ── SF connect / disconnect ───────────────────────────────────────────────
  const handleConnectSalesforce = async () => {
    try {
      sessionStorage.setItem("sfReturnTo", "/import-configuration");
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/login`);
      if (!res.ok) throw new Error("Failed to get login URL");
      window.location.href = (await res.json()).auth_url;
    } catch (err) {
      console.error("[ImportConfig] OAuth initiation failed:", err);
    }
  };

  const handleDisconnect = () => {
    setSfAccessToken(null); setSfInstanceUrl(null); setSfRefreshToken(null);
    setSfUserEmail(null); setSfSelectedObject(null);
    setSfObjects([]); setSfFields([]);
  };

  // ── Start import ───────────────────────────────────────────────────────────
  const handleStartImport = async () => {
    if (!sfAccessToken || !sfInstanceUrl) { handleConnectSalesforce(); return; }
    if (!targetObject || !s3Key) return;
    if (action !== "Insert" && !matchingField) return;

    saveConfig();
    setUploading(true);
    setImportError(null);
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
          threads: threads,
          continue_on_error: continueOnError,
          project_name: currentProject?.name ?? "",
          sf_account: sfUserEmail ?? "",
          field_mappings: Object.fromEntries(
            Object.entries(fieldMappings).filter(([, v]) => v != null)
          ),
          validation_report_s3_key: null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail?.message ?? body?.detail ?? `Failed to start import (${res.status})`);
      }
      const { job_id } = await res.json();
      router.push(`/import-jobs?job=${job_id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to start import.");
      setUploading(false);
    }
  };

  // ── Guard: no transform result ────────────────────────────────────────────
  if (!transformResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center bg-slate-50/80 dark:bg-slate-900">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
          <Settings2 size={26} />
        </span>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No transformation output found</h3>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Run the transformation pipeline first, then return here.
        </p>
        <button
          onClick={() => router.push("/transformation-workspace")}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={14} />Go to Transformation Workspace
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
            onClick={() => router.push("/transformation-workspace")}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 transition-colors hover:text-blue-700 dark:hover:text-blue-400"
          >
            <ArrowLeft size={13} />Back to Transformation Workspace
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-slate-100 sm:text-2xl">
                Import Configuration
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review field mappings and import settings before pushing to Salesforce.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={saveConfig}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Save size={13} />Save Configuration
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={!canStartImport}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors",
                  canStartImport ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                )}
              >
                {uploading ? <><LoaderCircle size={13} className="animate-spin" />Starting…</>
                  : sfAccessToken ? <><Zap size={13} />Start Import</>
                  : <><Cloud size={13} />Connect &amp; Import</>}
              </button>
            </div>
          </div>
        </header>

        {/* ── SF connection banner ────────────────────────────────────────── */}
        {!sfAccessToken ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4">
            <Cloud size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Salesforce not connected</p>
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                  Connect in <span className="font-semibold">Upload Files</span> before reaching this step, or reconnect below if your session expired.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectSalesforce}
                className="mt-2 sm:mt-0 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                <Cloud size={12} />Reconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Connected to Salesforce{sfUserEmail ? ` as ${sfUserEmail}` : ""}
            </p>
            <button type="button" onClick={handleDisconnect} className="ml-auto text-[11px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">
              Disconnect
            </button>
          </div>
        )}

        {/* ── Required fields banner ──────────────────────────────────────── */}
        {sfFields.length > 0 && missingRequiredFields.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                Missing required fields: {missingRequiredFields.map(f => f.label).join(", ")}
              </p>
              <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-300">
                These Salesforce fields are required and must be mapped before you can import.
              </p>
            </div>
          </div>
        )}

        {/* ── Duplicate mapping banner ────────────────────────────────────── */}
        {duplicateSfFields.size > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-xs font-semibold text-orange-900 dark:text-orange-200">
                Duplicate mappings detected
              </p>
              <p className="mt-0.5 text-[11px] text-orange-700 dark:text-orange-300">
                Multiple source fields are mapped to the same Salesforce field:{" "}
                {[...duplicateSfFields].map(f => sfFieldMap.get(f)?.label ?? f).join(", ")}.
                Each Salesforce field should be mapped by at most one source field.
              </p>
            </div>
          </div>
        )}


        {/* ── Settings + Readiness 2-col grid ────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Import Settings */}
          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-800/30">
                <Settings2 size={16} />
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import Settings</h3>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              {/* Target Object */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Target Object</label>
                <ObjectSelect
                  value={targetObject}
                  onChange={handleTargetObjectChange}
                  objects={sfObjects}
                  loading={sfObjectsLoading}
                  error={sfObjectsError}
                  disabled={!sfAccessToken}
                />
                {!sfAccessToken && <p className="text-[11px] text-slate-400">Connect to Salesforce to load objects</p>}
              </div>

              {/* Action */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Action</label>
                <div className="relative">
                  <select
                    value={action}
                    onChange={e => setAction(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 pr-8 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-blue-400 transition-colors cursor-pointer"
                  >
                    {ACTIONS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Batch Size */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Batch Size</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={batchSizeStr}
                  onChange={e => {
                    const raw = e.target.value;
                    setBatchSizeStr(raw);
                    if (raw === "" || isNaN(Number(raw))) {
                      setBatchSizeError("Please enter a number.");
                    } else if (!(/^\d+$/.test(raw))) {
                      setBatchSizeError("Whole numbers only — no decimals.");
                    } else if (parseInt(raw, 10) < 1) {
                      setBatchSizeError("Minimum batch size is 1.");
                    } else {
                      setBatchSizeError(null);
                      setBatchSize(parseInt(raw, 10));
                    }
                  }}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 outline-none transition-colors",
                    batchSizeError
                      ? "border-rose-400 dark:border-rose-500 focus:border-rose-500"
                      : "border-slate-200 dark:border-slate-600 focus:border-blue-400"
                  )}
                />
                {batchSizeError ? (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">{batchSizeError}</p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Number of records to send in each Salesforce batch.</p>
                    {totalRecords > 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Estimated batches: <span className="font-semibold text-slate-700 dark:text-slate-300">{estimatedBatches}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Threads */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Threads</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={threadsStr}
                  onChange={e => {
                    const raw = e.target.value;
                    setThreadsStr(raw);
                    if (raw === "" || isNaN(Number(raw))) {
                      setThreadsError("Please enter a number.");
                    } else if (!(/^\d+$/.test(raw))) {
                      setThreadsError("Whole numbers only — no decimals.");
                    } else if (parseInt(raw, 10) < 1) {
                      setThreadsError("Minimum is 1 thread.");
                    } else {
                      setThreadsError(null);
                      setThreads(parseInt(raw, 10));
                    }
                  }}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 outline-none transition-colors",
                    threadsError
                      ? "border-rose-400 dark:border-rose-500 focus:border-rose-500"
                      : "border-slate-200 dark:border-slate-600 focus:border-blue-400"
                  )}
                />
                {threadsError ? (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">{threadsError}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Number of batches to upload in parallel. Use 1 for sequential.
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* Import Readiness panel */}
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800/30">
                <ShieldCheck size={16} />
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import Readiness</h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {readinessRows.map(({ label, value, tone }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                  <span className={cx(
                    "max-w-[8rem] truncate text-right text-sm font-bold tabular-nums",
                    tone === "emerald" && "text-emerald-700 dark:text-emerald-400",
                    tone === "amber" && "text-amber-700 dark:text-amber-400",
                    tone === "rose" && "text-rose-700 dark:text-rose-400",
                    tone === "slate" && "text-slate-800 dark:text-slate-200",
                  )} title={value}>
                    {value}
                  </span>
                </div>
              ))}

              {/* Import Ready indicator */}
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Import Ready</span>
                {!sfAccessToken ? (
                  <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Not Connected
                  </span>
                ) : importReady ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={10} />YES
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                    <XCircle size={10} />NO
                  </span>
                )}
              </div>

              {/* Config tags */}
              <div className="px-5 pb-4 pt-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-800/30">
                    {action}
                  </span>
                  <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600">
                    Batch {batchSize}
                  </span>
                  <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600">
                    ~{estimatedBatches} batch{estimatedBatches !== 1 ? "es" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Record Matching section — Upsert only ──────────────────────── */}
        {action === "Upsert" && (
          <div className="overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-white dark:bg-slate-800 shadow-sm">
            {/* Card header */}
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-100 dark:ring-indigo-800/30">
                <Link2 size={16} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Record Matching</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Salesforce will update existing records if a match is found, or create new records if no match exists.
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              {/* Matching field picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  External ID / Match Field
                  <span className="ml-1 text-rose-500">*</span>
                </label>
                {!sfAccessToken ? (
                  <p className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2.5 text-[11px] text-slate-400 cursor-not-allowed">
                    Connect Salesforce to load fields
                  </p>
                ) : sfFieldsLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2.5 text-sm text-slate-400">
                    <LoaderCircle size={14} className="animate-spin" />Loading…
                  </div>
                ) : (
                  <IdentifierSelect
                    value={matchingField}
                    onChange={val => {
                      setMatchingField(val);
                      setImportConfig({
                        targetObject, action: action as ImportConfig["action"],
                        batchSize: batchSize as ImportConfig["batchSize"], threads,
                        fieldMappings, mappingStatuses,
                        skipUnknownFields, continueOnError, validateOnly,
                        preSkipMappings, preSkipStatuses, matchingField: val,
                      });
                    }}
                    candidates={identifierCandidates}
                    loading={sfFieldsLoading}
                    placeholder="Select matching field…"
                  />
                )}
                {sfAccessToken && !matchingField && identifierCandidates.length > 0 && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    A matching field is required to proceed.
                  </p>
                )}
              </div>

              {/* Info panel */}
              <div className="rounded-lg border border-slate-100 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Common Choices</p>
                <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                    <span className="font-mono text-slate-700 dark:text-slate-300">Id</span>
                    <span>— Salesforce record ID</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                    <span>External ID fields (ExternalId__c)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                    <span>Email, unique index fields</span>
                  </li>
                  <li className="mt-2 flex items-start gap-1.5 border-t border-slate-100 dark:border-slate-700 pt-2">
                    <Info size={10} className="mt-0.5 shrink-0 text-violet-500" />
                    <span className="text-violet-600 dark:text-violet-400">Bulk API Upsert requires Salesforce Id or a custom External ID field.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Field Mapping table ──────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          {/* Card header */}
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-100 dark:ring-violet-800/30">
                <Database size={16} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Field Mapping</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {sampleLoading ? "Loading sample data…" : `${sourceColumns.length} source field${sourceColumns.length !== 1 ? "s" : ""}. `}
                  <span className="text-rose-500">*</span> = required in Salesforce.
                </p>
              </div>
            </div>
            {sfFields.length > 0 && sourceColumns.length > 0 && (
              <button
                type="button"
                onClick={handleAutoMap}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Zap size={12} />Auto-map by API Name
              </button>
            )}
          </div>

          {/* Search + filter bar */}
          {sourceColumns.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search fields…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-3 text-xs outline-none placeholder-slate-400 text-slate-800 dark:text-slate-200 focus:border-blue-400 transition-colors"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(["all", "mapped", "unmapped", "warnings", "required"] as FilterTab[]).map(tab => (
                  <FilterTabBtn
                    key={tab}
                    tab={tab}
                    activeTab={activeFilter}
                    count={filterCounts[tab]}
                    onClick={() => setActiveFilter(tab)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {sfFieldsLoading && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
              <LoaderCircle size={20} className="animate-spin" />
              <span className="text-sm font-medium">Loading Salesforce fields…</span>
            </div>
          )}

          {/* Error */}
          {sfFieldsError && !sfFieldsLoading && (
            <div className="m-5 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
              <XCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="text-xs text-rose-800 dark:text-rose-300">{sfFieldsError}</p>
            </div>
          )}

          {/* Not connected */}
          {!sfAccessToken && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
              <Info size={18} />
              <span className="text-sm font-medium">Connect to Salesforce to enable field mapping</span>
            </div>
          )}

          {/* No source columns */}
          {sfAccessToken && !sfFieldsLoading && sourceColumns.length === 0 && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
              <Info size={18} />
              <span className="text-sm font-medium">No source columns found in the transformation output</span>
            </div>
          )}

          {/* No target object */}
          {sfAccessToken && !sfFieldsLoading && sourceColumns.length > 0 && !targetObject && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
              <Info size={18} />
              <span className="text-sm font-medium">Select a Target Object above to load Salesforce fields</span>
            </div>
          )}

          {/* Mapping table */}
          {sfAccessToken && !sfFieldsLoading && !sfFieldsError && sourceColumns.length > 0 && targetObject && (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[2fr_1.5fr_2fr_1fr_1.5fr_5rem] gap-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                <span>Source Field</span>
                <span>Sample Value</span>
                <span>Salesforce Field</span>
                <span>Data Type</span>
                <span>Status</span>
                <span>Action</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filteredColumns.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                    <Search size={16} />
                    No fields match the current filter
                  </div>
                ) : filteredColumns.map(col => {
                  const status: MappingStatus = mappingStatuses[col] ?? "unmapped";
                  const isSkipped   = status === "skipped";
                  const sfApiName   = isSkipped ? null : (fieldMappings[col] ?? null);
                  const sfField     = sfApiName ? sfFieldMap.get(sfApiName) : null;
                  const isInvalid   = !isSkipped && !!sfApiName && sfFieldApiNames.size > 0 && !sfFieldApiNames.has(sfApiName);
                  const isDuplicate = !isSkipped && !!sfApiName && duplicateSfFields.has(sfApiName);
                  const typeWarning = isSkipped ? null : (typeWarnings[col] ?? null);
                  const sample      = sampleValues[col];

                  const rowBg = isSkipped
                    ? "bg-slate-50 dark:bg-slate-800/40 opacity-60"
                    : isInvalid
                    ? "bg-rose-50/40 dark:bg-rose-900/10 hover:bg-rose-50/60"
                    : isDuplicate
                    ? "bg-orange-50/40 dark:bg-orange-900/10 hover:bg-orange-50/60"
                    : typeWarning
                    ? "bg-yellow-50/30 dark:bg-yellow-900/10 hover:bg-yellow-50/50"
                    : "hover:bg-slate-50/50 dark:hover:bg-slate-700/20";

                  return (
                    <div
                      key={col}
                      className={cx("grid grid-cols-[2fr_1.5fr_2fr_1fr_1.5fr_5rem] gap-3 items-start px-5 py-3 transition-colors", rowBg)}
                    >
                      {/* Source field */}
                      <div className="flex min-w-0 items-center gap-2 pt-0.5">
                        <span className={cx(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          isSkipped                                                      && "bg-slate-400",
                          !isSkipped && isInvalid                                        && "bg-rose-500",
                          !isSkipped && !isInvalid && isDuplicate                        && "bg-orange-400",
                          !isSkipped && !isInvalid && !isDuplicate && sfApiName && !typeWarning && "bg-emerald-500",
                          !isSkipped && !isInvalid && !isDuplicate && sfApiName && typeWarning  && "bg-yellow-400",
                          !isSkipped && !sfApiName                                       && "bg-amber-400",
                        )} />
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{col}</span>
                      </div>

                      {/* Sample value */}
                      <div className="min-w-0 pt-0.5">
                        {sampleLoading ? (
                          <span className="text-[11px] text-slate-300 dark:text-slate-600 italic">loading…</span>
                        ) : sample ? (
                          <span className="truncate text-[11px] font-mono text-slate-500 dark:text-slate-400 block" title={sample}>
                            {sample.length > 20 ? sample.slice(0, 20) + "…" : sample}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300 dark:text-slate-600 italic">empty</span>
                        )}
                      </div>

                      {/* SF field dropdown — disabled when skipped */}
                      <SfFieldSelect
                        value={isSkipped ? null : sfApiName}
                        onChange={val => updateMapping(col, val, true)}
                        fields={sfFields}
                        isInvalid={isInvalid}
                        disabled={sfFieldsLoading || !sfAccessToken || isSkipped}
                      />

                      {/* Data type */}
                      <div className="pt-0.5">
                        {sfField ? (
                          <span className={cx(
                            "inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                            typeWarning
                              ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 ring-1 ring-yellow-200 dark:ring-yellow-800/30"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600"
                          )}>
                            {sfTypeLabel(sfField.type)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </div>

                      {/* Status badge */}
                      <StatusBadge
                        status={isSkipped ? "skipped" : isInvalid ? "invalid" : status}
                        isDuplicate={isDuplicate}
                        typeWarning={typeWarning}
                      />

                      {/* Action — Skip / Undo Skip */}
                      <div className="flex items-start pt-0.5">
                        {isSkipped ? (
                          <button
                            type="button"
                            onClick={() => handleUndoSkip(col)}
                            className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 transition-colors whitespace-nowrap"
                          >
                            Undo Skip
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSkip(col)}
                            className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 transition-colors"
                          >
                            Skip
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-5 py-3">
                {[
                  { dot: "bg-emerald-500", label: "Auto Mapped" },
                  { dot: "bg-blue-500", label: "Manually Mapped" },
                  { dot: "bg-amber-400", label: "Unmapped" },
                  { dot: "bg-rose-500", label: "Invalid" },
                  { dot: "bg-orange-400", label: "Duplicate" },
                  { dot: "bg-slate-400", label: "Skipped" },
                ].map(({ dot, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={cx("h-2 w-2 rounded-full", dot)} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Bottom action bar ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
          <button
            type="button"
            onClick={() => router.push("/transformation-workspace")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={13} />Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveConfig}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Save size={13} />Save Configuration
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              disabled={!canStartImport}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors",
                canStartImport ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              )}
            >
              {uploading ? <><LoaderCircle size={13} className="animate-spin" />Starting…</>
                : sfAccessToken ? <><Zap size={13} />Start Import</>
                : <><Cloud size={13} />Connect &amp; Import</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Import error banner ──────────────────────────────────────────────── */}
      {importError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">Import failed to start</p>
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{importError}</p>
          </div>
          <button type="button" onClick={() => setImportError(null)} className="shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
