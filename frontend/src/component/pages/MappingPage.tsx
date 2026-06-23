"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icon";

export default function MappingPage() {
  const router = useRouter();
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [activeTimelineIdx, setActiveTimelineIdx] = useState<number | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
    }, 900);
  };

  const timelineObjects = [
    { name: "Account", desc: "Base organization record with standard billing metadata." },
    { name: "Contact", desc: "Individual people record associated with core accounts." },
    { name: "Opportunity", desc: "Sales deal forecasting, products, and close cycles." },
    { name: "Product", desc: "Standard goods, units, and inventory definitions." },
    { name: "Pricebook", desc: "Global pricing configurations and multi-currency rules." },
    { name: "Order", desc: "Customer acquisition transaction data and histories." },
    { name: "Order Item", desc: "Line-level purchase details mapped with catalog SKU." },
    { name: "Campaign", desc: "Inbound pipeline tracking, sources, and target markets." }
  ];

  return (
    <div className="p-5 sm:p-6 lg:p-7 pb-12 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none">
      
      {/* Title & Action Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-none">
        <div className="space-y-0.5">
          <h2 className="text-[23px] lg:text-[25px] font-semibold text-slate-900 tracking-tight">AI Mapping Summary</h2>
          <p className="text-[13.5px] lg:text-[14.5px] text-slate-400 font-medium">AI has analyzed your files and generated the following migration plan.</p>
        </div>

        <button 
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className={`px-5 py-3 rounded-xl border border-slate-200 text-indigo-600 text-[13.5px] font-semibold hover:bg-slate-50 transition-all duration-300 active:scale-[0.97] shrink-0 inline-flex items-center gap-2 shadow-sm bg-white cursor-pointer select-none ${isRegenerating ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <Icon name="sparkles" size={14.5} className={`text-indigo-600 ${isRegenerating ? "animate-spin" : ""}`} />
          <span>{isRegenerating ? "Analyzing Files..." : "Regenerate Mapping"}</span>
        </button>
      </div>

      {/* Row of 5 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-none">

        <div className="bg-white border border-slate-200 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[88px] shadow-sm">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Objects Detected</span>
          <h3 className="text-3xl font-semibold text-slate-900 tracking-tight leading-none mt-1.5">8</h3>
        </div>

        <div className="bg-white border border-slate-200 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[88px] shadow-sm">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fields Mapped</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h3 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none whitespace-nowrap">
              342 <span className="text-sm text-slate-400 font-medium">/ 387</span>
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 leading-none shrink-0">88%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[88px] shadow-sm">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Transformations</span>
          <h3 className="text-3xl font-semibold text-slate-900 tracking-tight leading-none mt-1.5">156</h3>
        </div>

        <div className="bg-white border border-slate-200 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[88px] shadow-sm">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Relationships</span>
          <h3 className="text-3xl font-semibold text-slate-900 tracking-tight leading-none mt-1.5">12</h3>
        </div>

        <div className="bg-white border border-slate-200 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[88px] shadow-sm">
          <span className="text-xs font-medium text-rose-500 uppercase tracking-wider">Unmapped Fields</span>
          <h3 className="text-3xl font-semibold text-slate-900 tracking-tight leading-none mt-1.5">45</h3>
        </div>

      </div>

      {/* Main 3-Column Content Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-none">
        
        {/* Column 1: Objects & Execution Order */}
        <div className="lg:col-span-3 bg-white border border-slate-200/60 rounded-xl p-5 lg:p-6 flex flex-col shadow-sm">
          <h4 className="text-[13.5px] lg:text-[14.5px] font-semibold text-slate-800 tracking-tight pb-3 border-b border-slate-100 flex-none uppercase">
            Objects & Execution Order
          </h4>
          
          <div className="flex-1 mt-3.5 flex flex-col justify-between relative py-1.5">
            
            {/* connecting vertical blue line */}
            <div
               className="absolute right-[36px] top-6 bottom-6 w-[2px] bg-blue-600/20 pointer-events-none"
              style={{ minHeight: "85%" }}
            />

            {timelineObjects.map((obj, idx) => {
              const isHovered = activeTimelineIdx === idx;
              return (
                <div 
                  key={idx}
                  className={`flex items-center justify-between py-1.5 pl-3.5 pr-6 rounded-lg border border-transparent transition-all duration-150 relative group cursor-pointer ${isHovered ? "bg-slate-50 border-slate-200/40" : "hover:bg-slate-50/20"}`}
                  onMouseEnter={() => setActiveTimelineIdx(idx)}
                  onMouseLeave={() => setActiveTimelineIdx(null)}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-semibold text-[12px] flex items-center justify-center border border-slate-200/80">
                      {idx + 1}
                    </span>
                    <span className="text-[14.5px] lg:text-[15.5px] font-semibold text-slate-900 leading-tight">
                      {obj.name}
                    </span>
                  </div>

                  <div className="relative shrink-0 w-6 flex items-center justify-center">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 border-white transition-all duration-200 z-10 bg-blue-600 shadow-sm ${isHovered ? "scale-125" : ""}`} />
                  </div>

                  {isHovered && (
                    <div className="absolute left-[36px] top-[-52px] w-68 p-4.5 bg-slate-900 border border-slate-800 text-white text-[12.5px] rounded-xl shadow-2xl z-30 animate-scale-in font-bold pointer-events-none leading-relaxed">
                      <span className="block text-[11px] font-semibold uppercase text-blue-400 mb-0.5">{obj.name} Metadata</span>
                      {obj.desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Mapping Overview */}
        <div className="lg:col-span-5 bg-white border border-slate-200/60 rounded-xl p-5 lg:p-6 flex flex-col justify-between shadow-sm">
          <h4 className="text-[13.5px] lg:text-[14.5px] font-semibold text-slate-800 tracking-tight pb-3 border-b border-slate-100 flex-none uppercase">
            Mapping Overview
          </h4>
          
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 my-4">
            
            {/* Massive Vector SVG Donut Chart with animated segments */}
            <div className="relative w-56 h-56 shrink-0 flex items-center justify-center">
              <svg width="224" height="224" className="transform -rotate-90">
                <circle cx="112" cy="112" r="80" stroke="#f1f5f9" strokeWidth="15" fill="transparent" />
                
                <circle
                  cx="112"
                  cy="112"
                  r="80"
                  stroke="#2563eb"
                  strokeWidth={activeSegment === "mapped" ? "18" : "15"}
                  fill="transparent"
                  strokeDasharray="502"
                  strokeDashoffset="60"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setActiveSegment("mapped")}
                  onMouseLeave={() => setActiveSegment(null)}
                />

                <circle
                  cx="112"
                  cy="112"
                  r="80"
                  stroke="#7c3aed"
                  strokeWidth={activeSegment === "unmapped" ? "18" : "15"}
                  fill="transparent"
                  strokeDasharray="502"
                  strokeDashoffset="447"
                  className="cursor-pointer transition-all"
                  transform="rotate(316.8 112 112)"
                  onMouseEnter={() => setActiveSegment("unmapped")}
                  onMouseLeave={() => setActiveSegment(null)}
                />

                <circle
                  cx="112"
                  cy="112"
                  r="80"
                  stroke="#f59e0b"
                  strokeWidth={activeSegment === "not_required" ? "18" : "15"}
                  fill="transparent"
                  strokeDasharray="502"
                  strokeDashoffset="472"
                  className="cursor-pointer transition-all"
                  transform="rotate(358.5 112 112)"
                  onMouseEnter={() => setActiveSegment("not_required")}
                  onMouseLeave={() => setActiveSegment(null)}
                />
              </svg>

              <div className="absolute text-center">
                <span className="text-[38px] font-semibold text-slate-900 tracking-tight leading-none block font-sans">
                  342
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mt-1">Fields Mapped</span>
              </div>
            </div>
 
            <div className="flex-1 space-y-4.5 w-full">
              
              <div 
                className={`flex items-center justify-between p-2 rounded-xl transition-all ${activeSegment === "mapped" ? "bg-blue-50/50 scale-[1.01]" : ""}`}
                onMouseEnter={() => setActiveSegment("mapped")}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-600 shrink-0" />
                  <span className="text-[14.5px] text-slate-500 font-semibold">Mapped</span>
                </div>
                <span className="text-[14.5px] font-semibold text-slate-800">342 (88%)</span>
              </div>

              <div 
                className={`flex items-center justify-between p-2 rounded-xl transition-all ${activeSegment === "unmapped" ? "bg-purple-50/50 scale-[1.01]" : ""}`}
                onMouseEnter={() => setActiveSegment("unmapped")}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-600 shrink-0" />
                  <span className="text-[14.5px] text-slate-500 font-semibold">Unmapped</span>
                </div>
                <span className="text-[14.5px] font-semibold text-slate-800">45 (11%)</span>
              </div>

              <div 
                className={`flex items-center justify-between p-2 rounded-xl transition-all ${activeSegment === "not_required" ? "bg-amber-50/50 scale-[1.01]" : ""}`}
                onMouseEnter={() => setActiveSegment("not_required")}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-[14.5px] text-slate-500 font-semibold">Not Required</span>
                </div>
                <span className="text-[14.5px] font-semibold text-slate-800">25 (6%)</span>
              </div>

            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-[14.5px] font-semibold text-slate-800 flex-none px-1">
            <span>Total Fields</span>
            <span>387</span>
          </div>

        </div>

        {/* Column 3: AI Insights */}
        <div className="lg:col-span-4 bg-white border border-slate-200/60 rounded-xl p-5 lg:p-6 flex flex-col justify-between shadow-sm relative">
          
          <div className="space-y-4.5">
            <h4 className="text-[13.5px] lg:text-[14.5px] font-semibold text-slate-800 tracking-tight pb-3 border-b border-slate-100 flex-none uppercase">
              AI Insights
            </h4>
            
            <div className="space-y-4 select-none pr-1">
              
              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-medium text-slate-700 leading-snug">5 potential duplicate records found.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-medium text-slate-700 leading-snug">12 columns need transformation.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-medium text-slate-700 leading-snug">8 fields require lookup mapping.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-medium text-slate-700 leading-snug">3 date fields need format standardization.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-medium text-slate-700 leading-snug">2 fields are not in Salesforce metadata.</p>
              </div>

            </div>
          </div>

          <div className="flex justify-end pt-5">
            <button 
              onClick={() => router.push("/transformation-workspace")}
              className="px-7 py-4 rounded-xl bg-blue-600 text-white text-[14.5px] font-semibold flex items-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all duration-250 shadow-md shadow-blue-500/10 cursor-pointer select-none"
            >
              <span>Review Mapping Details</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
