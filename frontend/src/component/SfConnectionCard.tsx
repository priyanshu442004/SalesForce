"use client";

import React, { useState } from "react";
import { Check, Cloud, Link2, Loader2, LogOut, Unlink } from "lucide-react";
import { useMigration } from "@/context/MigrationContext";
import type { SfConnection, SfRole, TargetReuseChoice } from "@/context/MigrationContext";
import { emptySfConnection } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children, variant = "secondary", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const variants = {
    primary:   "bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
    secondary: "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50",
    danger:    "border border-rose-200 dark:border-rose-700/40 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50",
  };
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Connection status badge
// ---------------------------------------------------------------------------

function ConnectionStatus({
  conn,
  label,
  reusedFrom,
}: {
  conn: SfConnection;
  label: string;
  reusedFrom?: string;
}) {
  if (!conn.accessToken) return null;
  const host = conn.instanceUrl
    ? (() => { try { return new URL(conn.instanceUrl).hostname; } catch { return conn.instanceUrl; } })()
    : null;

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-900/20 px-3.5 py-2.5">
      <Check size={13} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {reusedFrom ? `Reusing ${reusedFrom}` : `Connected`}
          {conn.userEmail && (
            <span className="ml-1 font-normal text-emerald-700 dark:text-emerald-400">
              as {conn.userEmail}
            </span>
          )}
        </p>
        {host && (
          <p className="mt-0.5 truncate text-[11px] text-emerald-600/70 dark:text-emerald-500">
            {host}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sandbox checkbox
// ---------------------------------------------------------------------------

function SandboxToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      Sandbox
    </label>
  );
}

// ---------------------------------------------------------------------------
// Single slot (used for Source, and optionally for Master/Target own login)
// ---------------------------------------------------------------------------

function ConnectButton({
  role,
  label,
  returnTo,
  onConnect,
  onDisconnect,
  connection,
}: {
  role: SfRole;
  label: string;
  returnTo: string;
  onConnect: () => void;
  onDisconnect: () => void;
  connection: SfConnection;
}) {
  const [connecting, setConnecting] = useState(false);
  const [sandbox, setSandbox] = useState(false);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      sessionStorage.setItem("sfReturnTo", returnTo);
      const params = new URLSearchParams({
        role,
        force_login: "true",
        ...(sandbox ? { sandbox: "true" } : {}),
      });
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/login?${params}`);
      if (!res.ok) throw new Error("Failed to get login URL");
      window.location.href = (await res.json()).auth_url;
    } catch (err) {
      console.error(`[SfConnectionCard] ${role} connect failed:`, err);
      setConnecting(false);
    }
  };

  if (connection.accessToken) {
    return (
      <div className="flex flex-col gap-2">
        <ConnectionStatus conn={connection} label={label} />
        <div className="flex justify-end">
          <Button variant="danger" onClick={onDisconnect}>
            <LogOut size={12} />
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={handleConnect} disabled={connecting}>
        {connecting ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
        {connecting ? "Connecting…" : `Connect ${label}`}
      </Button>
      <SandboxToggle checked={sandbox} onChange={setSandbox} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot wrappers
// ---------------------------------------------------------------------------

function SlotRow({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="pl-11">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100 dark:border-slate-700/60" />;
}

// ---------------------------------------------------------------------------
// Public component — renders all three connection slots
// ---------------------------------------------------------------------------

export default function SalesforceConnectionsPanel({ returnTo }: { returnTo: string }) {
  const {
    sourceSf, setSourceSf,
    masterSf, setMasterSf,
    targetSf, setTargetSf,
    masterReusesSource, setMasterReusesSource,
    targetReuse, setTargetReuse,
    effectiveMasterSf, effectiveTargetSf,
  } = useMigration();

  // ── Target reuse radio helpers ─────────────────────────────────────────────
  const setTargetReuseExclusive = (choice: TargetReuseChoice) => {
    setTargetReuse(choice);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 px-5 py-3.5">
        <Cloud size={14} className="text-slate-400 dark:text-slate-500" />
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Salesforce Connections</p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700/60 px-5">

        {/* ── Source ──────────────────────────────────────────────────────── */}
        <SlotRow
          icon={<Cloud size={15} />}
          title="Source Salesforce"
          subtitle="Fetches source records when the source system is Salesforce."
        >
          <ConnectButton
            role="source"
            label="Source Salesforce"
            returnTo={returnTo}
            connection={sourceSf}
            onConnect={() => {}}
            onDisconnect={() => setSourceSf(emptySfConnection)}
          />
        </SlotRow>

        {/* ── Master (Lookup) ──────────────────────────────────────────────── */}
        <SlotRow
          icon={<Link2 size={15} />}
          title="Master Salesforce"
          subtitle="Resolves Lookup(S) field values against a Salesforce org."
        >
          <div className="flex flex-col gap-3">
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
                <ConnectionStatus
                  conn={sourceSf}
                  label="Master Salesforce"
                  reusedFrom="Source Salesforce"
                />
              ) : (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Source Salesforce is not connected yet.
                </p>
              )
            ) : (
              <ConnectButton
                role="master"
                label="Master Salesforce"
                returnTo={returnTo}
                connection={masterSf}
                onConnect={() => {}}
                onDisconnect={() => setMasterSf(emptySfConnection)}
              />
            )}
          </div>
        </SlotRow>

        {/* ── Target ──────────────────────────────────────────────────────── */}
        <SlotRow
          icon={<Cloud size={15} />}
          title="Target Salesforce"
          subtitle="Destination org for Insert / Upsert operations."
        >
          <div className="flex flex-col gap-3">
            {/* Reuse options */}
            <div className="flex flex-col gap-1.5">
              {(
                [
                  { value: "source", label: "Use Source Salesforce" },
                  { value: "master", label: "Use Master Salesforce" },
                  { value: "none",   label: "Use separate connection" },
                ] as { value: TargetReuseChoice; label: string }[]
              ).map(opt => (
                <label
                  key={opt.value}
                  className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="targetReuse"
                    className="h-3.5 w-3.5 border-slate-300 dark:border-slate-600 accent-blue-600"
                    checked={targetReuse === opt.value}
                    onChange={() => setTargetReuseExclusive(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Result of reuse selection */}
            {targetReuse === "source" && (
              sourceSf.accessToken ? (
                <ConnectionStatus
                  conn={sourceSf}
                  label="Target Salesforce"
                  reusedFrom="Source Salesforce"
                />
              ) : (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Source Salesforce is not connected yet.
                </p>
              )
            )}

            {targetReuse === "master" && (
              effectiveMasterSf.accessToken ? (
                <ConnectionStatus
                  conn={effectiveMasterSf}
                  label="Target Salesforce"
                  reusedFrom="Master Salesforce"
                />
              ) : (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Master Salesforce is not connected yet.
                </p>
              )
            )}

            {targetReuse === "none" && (
              <ConnectButton
                role="target"
                label="Target Salesforce"
                returnTo={returnTo}
                connection={targetSf}
                onConnect={() => {}}
                onDisconnect={() => setTargetSf(emptySfConnection)}
              />
            )}
          </div>
        </SlotRow>

      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Compact inline status — used in ImportConfigPage / TransformationWorkspacePage
// ---------------------------------------------------------------------------

export function SfInlineStatus({
  connection,
  role,
  label,
  returnTo,
  onDisconnect,
}: {
  connection: SfConnection;
  role: SfRole;
  label: string;
  returnTo: string;
  onDisconnect: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [sandbox, setSandbox] = useState(false);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      sessionStorage.setItem("sfReturnTo", returnTo);
      const params = new URLSearchParams({
        role,
        force_login: "true",
        ...(sandbox ? { sandbox: "true" } : {}),
      });
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/salesforce/login?${params}`);
      if (!res.ok) throw new Error("Failed to get login URL");
      window.location.href = (await res.json()).auth_url;
    } catch (err) {
      console.error(`[SfInlineStatus] ${role} connect failed:`, err);
      setConnecting(false);
    }
  };

  if (connection.accessToken) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Check size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate text-xs text-slate-600 dark:text-slate-300">
            {connection.userEmail
              ? `Connected as ${connection.userEmail}`
              : "Connected to Salesforce"}
          </span>
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          className="shrink-0 text-[11px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={handleConnect} disabled={connecting}>
        {connecting ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
        {connecting ? "Connecting…" : `Connect ${label}`}
      </Button>
      <SandboxToggle checked={sandbox} onChange={setSandbox} />
    </div>
  );
}
