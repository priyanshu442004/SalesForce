"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

// Highly reliable inline dynamic counting component
function AnimatedCount({ target, duration = 800, suffix = "" }: { target: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let timerId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) {
        timerId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    timerId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(timerId);
  }, [target, duration]);

  return <>{count}{suffix}</>;
}

export default function SettingsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [showSavedOverlay, setShowSavedOverlay] = useState(false);

  const [rateLimit, setRateLimit] = useState("10,000 requests/hr");
  const [batchSize, setBatchSize] = useState("200 records");
  const [strictMode, setStrictMode] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSaveSettings = () => {
    setShowSavedOverlay(true);
    setTimeout(() => {
      setShowSavedOverlay(false);
    }, 1300);
  };

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden select-none bg-white">
      
      {/* CSS Animations Injection */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.97) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-scale-up {
          animation: scaleUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-row {
          animation: fadeInRow 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Success Save Overlay */}
      {showSavedOverlay && (
        <div className="fixed inset-0 bg-[#000839]/30 backdrop-blur-[3px] z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-2xl flex flex-col items-center gap-4 animate-scale-up">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[17px] font-black text-[#000839]">Global Settings Saved!</span>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="flex-none opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <Link
          href="/"
          className="text-[#002BFF] text-[14px] font-black hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
        >
          <span>&lt;</span>
          <span>Back to Workspace</span>
        </Link>
      </div>

      {/* Title and Description */}
      <div className="flex-none flex flex-col space-y-1 border-b border-slate-100/60 pb-3.5 opacity-0 animate-scale-up" style={{ animationDelay: "100ms" }}>
        <h3 className="text-[20px] font-black text-[#000839]">
          Global Settings
        </h3>
        <span className="text-[14.5px] font-bold text-slate-400">
          Configure Salesforce environment authentication, API limits, validation controls, and user profiles.
        </span>
      </div>

      {/* Dynamic Count Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        
        {/* Metric 1 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-blue-50 border border-blue-500/20 text-[#002BFF] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Authorized Orgs</span>
            <span className="block text-[25px] font-black text-[#000839]">
              <AnimatedCount target={4} />
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-purple-50 border border-purple-500/20 text-[#7c3aed] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Batch Record Size</span>
            <span className="block text-[25px] font-black text-[#7c3aed]">
              <AnimatedCount target={200} />
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-[#e6f4ea] border border-[#e6f4ea]/45 text-[#137333] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Hourly API Limit</span>
            <span className="block text-[25px] font-black text-[#137333]">
              <AnimatedCount target={10000} />
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-amber-50 border border-amber-500/20 text-[#d97706] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Strict Validation</span>
            <span className="block text-[25px] font-black text-[#d97706]">
              {strictMode ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

      </div>

      {/* Settings layout grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch min-h-0 pb-2 opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        
        {/* Column 1: Config Form (col-span-8) */}
        <div className="col-span-1 md:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6.5 lg:p-7.5 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.008)]">
          <div className="space-y-6">
            
            <h4 className="text-[17px] font-black text-[#000839] border-b border-slate-50 pb-2">
              Performance & API Throttling
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5.5">
              
              <div className="space-y-2">
                <label className="block text-[13.5px] font-black text-[#000839]/80">Max Daily API Requests</label>
                <div className="relative">
                  <select
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                    className="w-full pl-4.5 pr-10 py-3.5 rounded-xl border border-slate-200 text-[#000839] text-[14.5px] font-black bg-white hover:bg-slate-50 focus:outline-none cursor-pointer appearance-none"
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
                <label className="block text-[13.5px] font-black text-[#000839]/80">Data Import Batch Size</label>
                <div className="relative">
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(e.target.value)}
                    className="w-full pl-4.5 pr-10 py-3.5 rounded-xl border border-slate-200 text-[#000839] text-[14.5px] font-black bg-white hover:bg-slate-50 focus:outline-none cursor-pointer appearance-none"
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

            <h4 className="text-[17px] font-black text-[#000839] border-b border-slate-50 pb-2 pt-2">
              Migration Strictness & AI Engine
            </h4>

            <div className="space-y-5">
              
              <div className="flex items-center justify-between text-[14.5px]">
                <div className="space-y-0.5">
                  <span className="block font-black text-[#000839]">Enable Strict Validation Mode</span>
                  <span className="block text-[12.5px] font-bold text-slate-400">Abort deployment immediately on any schema mismatch or invalid field format.</span>
                </div>
                <button
                  onClick={() => setStrictMode(!strictMode)}
                  className={`w-14 h-7.5 rounded-full p-0.5 transition-all relative cursor-pointer ${
                    strictMode ? "bg-[#002BFF]" : "bg-slate-200"
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                    strictMode ? "translate-x-6.5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between text-[14.5px] pt-2">
                <div className="space-y-0.5">
                  <span className="block font-black text-[#000839]">AI Mapping Auto-Suggestions</span>
                  <span className="block text-[12.5px] font-bold text-slate-400">Enable Gemini LLM engine to predict legacy columns to target API field layouts.</span>
                </div>
                <button
                  onClick={() => setAiSuggestions(!aiSuggestions)}
                  className={`w-14 h-7.5 rounded-full p-0.5 transition-all relative cursor-pointer ${
                    aiSuggestions ? "bg-[#002BFF]" : "bg-slate-200"
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

        {/* Column 2: User profile card (col-span-4) */}
        <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-6.5 lg:p-7.5 flex flex-col justify-between items-center shadow-[0_2px_12px_rgba(0,0,0,0.008)] min-h-[350px]">
          <div className="w-full flex-1 flex flex-col items-center justify-center space-y-5">
            
            <div className="w-22 h-22 bg-blue-50 text-[#002BFF] rounded-full border border-blue-500/20 flex items-center justify-center text-[25px] font-black">
              AU
            </div>
            
            <div className="text-center space-y-1">
              <h4 className="text-[18px] font-black text-[#000839]">Administrator User</h4>
              <span className="block text-[13px] font-extrabold text-[#002BFF] uppercase tracking-wider">System Architect</span>
            </div>

            <div className="w-full border-t border-slate-100 pt-5 space-y-3 text-[14px] font-bold">
              <div className="flex justify-between">
                <span className="text-slate-400">Workspace Tenant:</span>
                <span className="text-[#000839]">Enterprise Sandbox</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Authorized Orgs:</span>
                <span className="text-[#000839]">4 Salesforce Orgs</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Bottom CTA Save Button */}
      <div className="flex items-center justify-end pt-3 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
        <button
          onClick={handleSaveSettings}
          className="px-9 py-4.5 rounded-2xl bg-[#002BFF] hover:bg-blue-700 text-white text-[15px] font-black transition-all select-none cursor-pointer shadow-lg shadow-blue-500/10 active:scale-[0.98]"
        >
          Save Global Settings
        </button>
      </div>

    </div>
  );
}
