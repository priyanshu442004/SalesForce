"use client";

import React from "react";
import Link from "next/link";

export default function ValidationPage() {
  return (
    <div className="flex-1 flex flex-col space-y-6 lg:space-y-7 p-7 lg:p-9 min-h-0 bg-[#f8fafc] dark:bg-slate-900 overflow-y-auto">

      {/* Back to workspace link */}
      <div className="flex-none">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-blue-600 font-semibold text-sm hover:underline transition-all"
        >
          <span>&lt; Back to workspace</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex-none flex flex-col space-y-1">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
          Data Validation & Quality Check
        </h3>
        <span className="text-sm font-medium text-slate-400 dark:text-slate-400">
          Validate transformed data against Salesforce rules.
        </span>
      </div>

      {/* Top Metric row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 flex-none">

        {/* Card 1: Total Records */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Total Records</span>
            <span className="block text-2xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">
              12,356
            </span>
          </div>
        </div>

        {/* Card 2: Valid Records */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Valid Records</span>
            <span className="block text-2xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">
              11,785
            </span>
          </div>
        </div>

        {/* Card 3: Invalid Records */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Invalid Records</span>
            <span className="block text-2xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">
              671
            </span>
          </div>
        </div>

        {/* Card 4: Success Rate with static sparkline */}
        <div className="bg-white border border-slate-200/50 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Success Rate</span>
            <span className="block text-2xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">
              94.6%
            </span>
          </div>
          <div className="w-28 h-9 overflow-visible pr-1">
            <svg className="w-full h-full text-blue-600 overflow-visible" viewBox="0 0 100 30" fill="none">
              <path
                d="M 5,22 L 24,24 L 43,15 L 62,20 L 81,10 L 98,3"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="98" cy="3" r="3" className="fill-blue-600 stroke-white stroke-[1.5]" />
            </svg>
          </div>
        </div>

      </div>

      {/* Main Grid: Donut, Check list and Recent Errors */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch pb-2">

        {/* Column 1: Validation Summary Donut */}
        <div className="col-span-1 md:col-span-4 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between items-stretch shadow-sm min-h-[390px]">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 pb-2.5">
            Validation Summary
          </h4>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-slate-100 dark:stroke-slate-700"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#10b981"
                  strokeWidth="12"
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray="238.76"
                  strokeDashoffset="12.89"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[40px] font-semibold text-slate-900 dark:text-white leading-none">
                  94.6%
                </span>
                <span className="text-sm font-semibold text-emerald-600 mt-1.5 tracking-wide">
                  Valid
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Validation Checks */}
        <div className="col-span-1 md:col-span-4 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between shadow-sm min-h-[390px]">
          <div className="space-y-4 flex-1 flex flex-col">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2">
              Validation Checks
            </h4>

            <div className="flex-1 flex flex-col justify-between py-1.5 space-y-4">

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <polygon points="12 2 2 22 22 22" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">Missing Required Fields</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">25</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">Invalid Date Format</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">136</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">Invalid Picklist Values</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">290</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <circle cx="18" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                      <path d="M11 18H8a2 2 0 0 1-2-2V9" />
                    </svg>
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">Lookup Values Not Found</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">87</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-50 border border-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">Duplicate External IDs</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">104</span>
              </div>

            </div>
          </div>
        </div>

        {/* Column 3: Recent Errors */}
        <div className="col-span-1 md:col-span-4 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between shadow-sm min-h-[390px]">
          <div className="space-y-4 flex-1 flex flex-col">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2">
              Recent Errors
            </h4>

            <div className="flex-1 flex flex-col justify-between py-1.5 space-y-4">

              {[
                { field: "Phone", desc: "Invalid phone number format", count: 25 },
                { field: "Start_Date__c", desc: "Invalid date format", count: 136 },
                { field: "AccountId", desc: "Lookup value not found", count: 87 },
                { field: "Amount", desc: "Must be a number", count: 23 }
              ].map((row) => (
                <div key={row.field} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="text-slate-300 shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 2L2 12l10 10 10-10L12 2zM12 8l4 4-4 4-4-4 4-4z" />
                      </svg>
                    </div>
                    <div>
                      <span className="block font-semibold text-slate-900 dark:text-slate-100 leading-none">{row.field}</span>
                      <span className="block text-xs font-medium text-slate-400 mt-0.5">{row.desc}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">{row.count}</span>
                </div>
              ))}

            </div>
          </div>
        </div>

      </div>

      {/* Bottom CTA Button */}
      <div className="flex items-center justify-end pt-3.5 pb-10 flex-none">
        <button className="px-6 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors select-none cursor-pointer shadow-sm active:scale-[0.98]">
          View All Errors
        </button>
      </div>

    </div>
  );
}
