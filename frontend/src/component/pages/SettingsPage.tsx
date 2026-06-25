"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [showSavedOverlay, setShowSavedOverlay] = useState(false);

  const [rateLimit, setRateLimit] = useState("10,000 requests/hr");
  const [batchSize, setBatchSize] = useState("200 records");
  const [strictMode, setStrictMode] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);

  const handleSaveSettings = () => {
    setShowSavedOverlay(true);
    setTimeout(() => {
      setShowSavedOverlay(false);
    }, 1300);
  };

  return (
    <div className="p-5 sm:p-7 lg:p-9 pb-12 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white">
      
      {/* Success Save Overlay */}
      {showSavedOverlay && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[3px] z-50 flex items-center justify-center">
          <div className="bg-white border border-slate-100 rounded-xl p-7 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[17px] font-semibold text-slate-900">Global Settings Saved!</span>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="flex-none">
        <Link
          href="/"
          className="text-blue-600 text-[14px] font-semibold hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
        >
          <span>&lt;</span>
          <span>Back to Workspace</span>
        </Link>
      </div>

      {/* Title and Description */}
      <div className="flex-none flex flex-col space-y-1 border-b border-slate-100/60 pb-3.5">
        <h3 className="text-[20px] font-semibold text-slate-900">
          Global Settings
        </h3>
        <span className="text-[14.5px] font-medium text-slate-400">
          Configure Salesforce environment authentication, API limits, validation controls, and user profiles.
        </span>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none">
        
        {/* Metric 1 */}
        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 border border-blue-500/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Authorized Orgs</span>
            <span className="block text-2xl font-semibold text-slate-900">4</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-slate-100 border border-slate-1000/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Batch Record Size</span>
            <span className="block text-2xl font-semibold text-blue-600">200</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Hourly API Limit</span>
            <span className="block text-2xl font-semibold text-emerald-700">10,000</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 border border-amber-500/20 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Strict Validation</span>
            <span className="block text-2xl font-semibold text-amber-600">
              {strictMode ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

      </div>

      {/* Settings layout grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch pb-2">
        
        {/* Column 1: Config Form (col-span-8) */}
        <div className="col-span-1 md:col-span-8 bg-white border border-slate-200/90 rounded-xl p-6.5 lg:p-7.5 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.008)]">
          <div className="space-y-6">
            
            <h4 className="text-[17px] font-semibold text-slate-900 border-b border-slate-50 pb-2">
              Performance & API Throttling
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5.5">
              
              <div className="space-y-2">
                <label className="block text-[13.5px] font-semibold text-slate-900/80">Max Daily API Requests</label>
                <div className="relative">
                  <select
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                    className="w-full pl-4.5 pr-10 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-[14.5px] font-semibold bg-white hover:bg-slate-50 focus:outline-none cursor-pointer appearance-none"
                  >
                    <option value="10,000 requests/hr">10,000 requests/hr</option>
                    <option value="50,000 requests/hr">50,000 requests/hr (Bulk)</option>
                    <option value="Unlimited requests">Unlimited requests</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[13.5px] font-semibold text-slate-900/80">Data Import Batch Size</label>
                <div className="relative">
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(e.target.value)}
                    className="w-full pl-4.5 pr-10 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-[14.5px] font-semibold bg-white hover:bg-slate-50 focus:outline-none cursor-pointer appearance-none"
                  >
                    <option value="200 records">200 records (Recommended)</option>
                    <option value="2,000 records">2,000 records (Bulk API v2)</option>
                    <option value="10,000 records">10,000 records (High Density)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

            </div>

            <h4 className="text-[17px] font-semibold text-slate-900 border-b border-slate-50 pb-2 pt-2">
              Migration Strictness & AI Engine
            </h4>

            <div className="space-y-5">
              
              <div className="flex items-center justify-between text-[14.5px]">
                <div className="space-y-0.5">
                  <span className="block font-semibold text-slate-900">Enable Strict Validation Mode</span>
                  <span className="block text-[12.5px] font-medium text-slate-400">Abort deployment immediately on any schema mismatch or invalid field format.</span>
                </div>
                <button
                  onClick={() => setStrictMode(!strictMode)}
                  className={`w-14 h-7.5 rounded-full p-0.5 transition-all relative cursor-pointer ${
                    strictMode ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                    strictMode ? "translate-x-6.5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between text-[14.5px] pt-2">
                <div className="space-y-0.5">
                  <span className="block font-semibold text-slate-900">AI Mapping Auto-Suggestions</span>
                  <span className="block text-[12.5px] font-medium text-slate-400">Enable Gemini LLM engine to predict legacy columns to target API field layouts.</span>
                </div>
                <button
                  onClick={() => setAiSuggestions(!aiSuggestions)}
                  className={`w-14 h-7.5 rounded-full p-0.5 transition-all relative cursor-pointer ${
                    aiSuggestions ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                    aiSuggestions ? "translate-x-6.5" : "translate-x-0"
                  }`} />
                </button>
              </div>

            </div>

          </div>
        </div>

        {/* Column 2: User profile & Org list (col-span-4) */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
          {/* User profile card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6.5 lg:p-7.5 flex flex-col justify-between items-center shadow-[0_2px_12px_rgba(0,0,0,0.008)] min-h-[300px]">
            <div className="w-full flex-1 flex flex-col items-center justify-center space-y-5">
              
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full border border-blue-500/20 flex items-center justify-center text-[24px] font-semibold">
                AU
              </div>
              
              <div className="text-center space-y-1">
                <h4 className="text-[17px] font-semibold text-slate-900">Administrator User</h4>
                <span className="block text-[12.5px] font-semibold text-blue-600 uppercase tracking-wider">System Architect</span>
              </div>

              <div className="w-full border-t border-slate-100 pt-5 space-y-3 text-[14px] font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Workspace Tenant:</span>
                  <span className="text-slate-900">Enterprise Sandbox</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Authorized Orgs:</span>
                  <span className="text-slate-900">4 Salesforce Orgs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Environments card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6.5 lg:p-7.5 flex flex-col shadow-[0_2px_12px_rgba(0,0,0,0.008)]">
            <h4 className="text-[16px] font-semibold text-slate-900 border-b border-slate-50 pb-2.5 mb-4">
              Connected Orgs
            </h4>
            <div className="space-y-4">
              {[
                { name: "Production (Primary)", url: "acme.my.salesforce.com", status: "Connected", api: "v60.0" },
                { name: "UAT Sandbox", url: "acme--uat.my.salesforce.com", status: "Connected", api: "v60.0" },
                { name: "QA Sandbox", url: "acme--qa.my.salesforce.com", status: "Connected", api: "v59.0" },
                { name: "Dev Sandbox 1", url: "acme--dev1.my.salesforce.com", status: "Connected", api: "v60.0" }
              ].map((org, index) => (
                <div key={index} className="flex items-center justify-between text-[13.5px]">
                  <div className="space-y-0.5">
                    <span className="block font-semibold text-slate-900">{org.name}</span>
                    <span className="block text-[12px] font-medium text-slate-400">{org.url}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                      {org.status}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">{org.api}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA Save Button */}
      <div className="flex items-center justify-end pt-3 flex-none">
        <button
          onClick={handleSaveSettings}
          className="px-6 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors select-none cursor-pointer shadow-sm active:scale-[0.98]"
        >
          Save Global Settings
        </button>
      </div>

    </div>
  );
}
