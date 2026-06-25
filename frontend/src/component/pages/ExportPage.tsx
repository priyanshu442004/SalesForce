"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function DocumentSvg({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.2)}
      viewBox="0 0 24 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" strokeWidth="2.2" />
      <line x1="8" y1="18" x2="14" y2="18" strokeWidth="2.2" />
    </svg>
  );
}

export default function ExportPage() {
  const router = useRouter();

  const filesGenerated = [
    { name: "Account.csv", size: "2.45 MB" },
    { name: "Contact.csv", size: "3.12 MB" },
    { name: "Opportunity.csv", size: "1.85 MB" },
    { name: "Product.csv", size: "986 KB" },
    { name: "Order.csv", size: "1.23 MB" },
    { name: "Order_Item.csv", size: "1.12 MB" }
  ];

  const reportsGenerated = [
    { name: "Validation Report.xlsx", size: "1.23 MB", color: "green" },
    { name: "Error Report.xlsx", size: "900 KB", color: "green" },
    { name: "Transformation Log.xlsx", size: "1.15 MB", color: "slate" },
    { name: "Mapping Report.xlsx", size: "827 KB", color: "slate" }
  ];

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-7 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white dark:bg-slate-900">

      {/* Header bar */}
      <div className="flex-none flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
          Export – Final Output
        </h2>

        <div className="flex items-center gap-4 text-slate-400">
          <button className="hover:text-blue-600 transition-colors p-1.5 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          <button className="hover:text-blue-600 transition-colors p-1.5 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Back button link */}
      <div className="flex-none">
        <Link
          href="/"
          className="text-blue-600 text-[13.5px] font-semibold hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
        >
          <span>&lt; Back to Workspace</span>
        </Link>
      </div>

      {/* Description block */}
      <div className="flex-none flex flex-col space-y-1.5">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
          Export Salesforce Ready Files
        </h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Your data is ready to export. Download the files below.
        </p>
      </div>

      {/* Three Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-start">

        {/* Column 1: Files Generated */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between shadow-sm min-h-[460px]">
          <div className="space-y-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight border-b border-slate-100 dark:border-slate-700 pb-2.5">
              Files Generated
            </h3>

            <div className="space-y-4">
              {filesGenerated.map((file) => (
                <div key={file.name} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <DocumentSvg size={18} />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{file.size}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100/65 dark:border-slate-700 mt-5">
            <button className="w-full bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-600/10 dark:border-blue-700/30 py-3.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between px-5 select-none cursor-pointer">
              <div className="flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download All Files (ZIP)</span>
              </div>
              <span className="font-semibold text-sm">12.31 MB</span>
            </button>
          </div>
        </div>

        {/* Column 2: Reports */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between shadow-sm min-h-[460px]">
          <div className="space-y-6">
            <h3 className="text-base font-semibold text-blue-600 tracking-tight border-b border-slate-100 dark:border-slate-700 pb-2.5">
              Reports
            </h3>

            <div className="space-y-4">
              {reportsGenerated.map((report) => (
                <div key={report.name} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      report.color === "green"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                      <DocumentSvg size={18} />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{report.name}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{report.size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: Export Summary */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between shadow-sm min-h-[460px]">
          <div className="space-y-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight border-b border-slate-100 dark:border-slate-700 pb-2.5">
              Export Summary
            </h3>

            <div className="space-y-4 text-sm font-medium text-slate-500 dark:text-slate-400">

              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700 pb-2">
                <span>Objects Generated</span>
                <span className="font-semibold text-slate-900 dark:text-white">8</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700 pb-2">
                <span>Files Generated</span>
                <span className="font-semibold text-slate-900 dark:text-white">12</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700 pb-2">
                <span>Total Records</span>
                <span className="font-semibold text-slate-900 dark:text-white">12,356</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700 pb-2">
                <span>Valid Records</span>
                <span className="font-semibold text-slate-900 dark:text-white">11,785</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700 pb-2">
                <span>Invalid Records</span>
                <span className="font-semibold text-slate-900 dark:text-white">571</span>
              </div>

              <div className="flex items-center justify-between py-1 pt-1">
                <span>Exported On</span>
                <span className="font-semibold text-slate-900 dark:text-white">25 May 2024, 10:48 AM</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Bottom Action */}
      <div className="flex items-center justify-end pt-5 pb-12 flex-none">
        <button
          onClick={() => router.push("/")}
          className="px-6 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors select-none cursor-pointer shadow-sm active:scale-[0.98]"
        >
          Go to Dashboard
        </button>
      </div>

    </div>
  );
}
