"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Database,
  FileSpreadsheet,
  FolderKanban,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Tone = "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";

const toneClasses: Record<Tone, { icon: string; value: string; badge: string }> = {
  blue: {
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    value: "text-slate-950",
    badge: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    value: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  violet: {
    icon: "bg-violet-50 text-violet-700 ring-violet-100",
    value: "text-violet-700",
    badge: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    value: "text-amber-700",
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  rose: {
    icon: "bg-rose-50 text-rose-700 ring-rose-100",
    value: "text-rose-700",
    badge: "bg-rose-50 text-rose-700 ring-rose-100",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600 ring-slate-200",
    value: "text-slate-950",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
  },
};

const iconMap = {
  activity: Sparkles,
  book: BookOpen,
  check: CheckCircle2,
  database: Database,
  file: FileSpreadsheet,
  folder: FolderKanban,
  help: CircleHelp,
  settings: Settings,
  warning: CircleAlert,
};

export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex-1 overflow-y-auto bg-slate-50/80", className)}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-7 sm:px-7 lg:px-9 lg:py-8">
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon = "activity",
  action,
  backHref,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: keyof typeof iconMap;
  action?: React.ReactNode;
  backHref?: string;
}) {
  const IconComponent = iconMap[icon];

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-blue-700"
          >
            <ArrowLeft size={13} />
            Back to workspace
          </Link>
        )}
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
            <IconComponent size={14} />
            {eyebrow}
          </div>
        )}
        <h2 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[28px]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action && <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">{action}</div>}
    </div>
  );
}

export function SectionCard({
  children,
  className = "",
  title,
  description,
  icon,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  icon?: keyof typeof iconMap;
  action?: React.ReactNode;
}) {
  const IconComponent = icon ? iconMap[icon] : null;

  return (
    <section className={cx("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.04)]", className)}>
      {(title || description || action) && (
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-start gap-3.5">
            {IconComponent && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <IconComponent size={20} />
              </span>
            )}
            <div>
              {title && <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>}
              {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  tone = "blue",
  icon = "database",
  helper,
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  icon?: keyof typeof iconMap;
  helper?: React.ReactNode;
}) {
  const IconComponent = iconMap[icon];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <div className={cx("mt-2 text-2xl font-bold tracking-tight tabular-nums", toneClasses[tone].value)}>{value}</div>
          {helper && <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div>}
        </div>
        <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1", toneClasses[tone].icon)}>
          <IconComponent size={20} />
        </span>
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
    secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400",
    danger: "border border-rose-200 bg-white text-rose-700 shadow-sm hover:bg-rose-50 disabled:bg-slate-100 disabled:text-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400",
  };

  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function SearchInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx("relative w-full md:w-96", className)}>
      <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
    </div>
  );
}

export function SegmentedTabs({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange: (item: string) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 md:w-auto md:pb-0">
      {items.map((item) => {
        const isActive = active === item;
        return (
          <button
            key={item}
            onClick={() => onChange(item)}
            className={cx(
              "shrink-0 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all",
              isActive
                ? "border-transparent bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Search size={20} />
      </span>
      <h4 className="mt-3 text-sm font-bold text-slate-800">{title}</h4>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1", toneClasses[tone].badge)}>
      {children}
    </span>
  );
}
