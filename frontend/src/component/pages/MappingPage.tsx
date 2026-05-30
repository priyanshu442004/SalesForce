"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icon";

// Custom light-weight React counting hook
function useCountUp(target: number, duration: number = 800, delay: number = 0) {
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

    const delayTimer = setTimeout(() => {
      timerId = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(delayTimer);
      cancelAnimationFrame(timerId);
    };
  }, [target, duration, delay]);

  return count;
}

export default function MappingPage() {
  const router = useRouter();
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [activeTimelineIdx, setActiveTimelineIdx] = useState<number | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Counter targets
  const [targetObj, setTargetObj] = useState(8);
  const [targetMap, setTargetMap] = useState(342);
  const [targetTrans, setTargetTrans] = useState(156);
  const [targetRel, setTargetRel] = useState(12);
  const [targetUnmap, setTargetUnmap] = useState(45);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reactive counters
  const objectsCount = useCountUp(targetObj, 900, 100);
  const mappedCount = useCountUp(targetMap, 900, 100);
  const transformCount = useCountUp(targetTrans, 900, 100);
  const relationshipCount = useCountUp(targetRel, 900, 100);
  const unmappedCount = useCountUp(targetUnmap, 900, 100);

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTargetObj(0);
    setTargetMap(0);
    setTargetTrans(0);
    setTargetRel(0);
    setTargetUnmap(0);

    setTimeout(() => {
      setIsRegenerating(false);
      setTargetObj(8);
      setTargetMap(342);
      setTargetTrans(156);
      setTargetRel(12);
      setTargetUnmap(45);
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
      
      {/* Dynamic Keyframes Animation Injection */}
      <style jsx global>{`
        @keyframes drawLine {
          from { height: 0%; opacity: 0; }
          to { height: 100%; opacity: 1; }
        }
        @keyframes drawBlueCircle {
          from { stroke-dashoffset: 502; }
          to { stroke-dashoffset: ${502 - (502 * 88) / 100}; }
        }
        @keyframes drawPurpleCircle {
          from { stroke-dashoffset: 502; }
          to { stroke-dashoffset: ${502 - (502 * 11) / 100}; }
        }
        @keyframes drawAmberCircle {
          from { stroke-dashoffset: 502; }
          to { stroke-dashoffset: ${502 - (502 * 6) / 100}; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-scale-up {
          animation: scaleUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-left {
          animation: slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-right {
          animation: slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-draw-line {
          animation: drawLine 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
        }
        .animate-blue-circle {
          stroke-dasharray: 502;
          stroke-dashoffset: 502;
          animation: drawBlueCircle 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
        }
        .animate-purple-circle {
          stroke-dasharray: 502;
          stroke-dashoffset: 502;
          animation: drawPurpleCircle 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards;
        }
        .animate-amber-circle {
          stroke-dasharray: 502;
          stroke-dashoffset: 502;
          animation: drawAmberCircle 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
        }
      `}</style>

      {/* Title & Action Block with enlarged fonts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <div className="space-y-0.5">
          <h2 className="text-[23px] lg:text-[25px] font-black text-[#000839] tracking-tight">AI Mapping Summary</h2>
          <p className="text-[13.5px] lg:text-[14.5px] text-slate-400 font-bold">AI has analyzed your files and generated the following migration plan.</p>
        </div>

        <button 
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className={`px-5 py-3 rounded-xl border border-[#eceff8] text-[#4f46e5] text-[13.5px] font-black hover:bg-slate-50 transition-all duration-300 active:scale-[0.97] shrink-0 inline-flex items-center gap-2 shadow-sm bg-white cursor-pointer select-none ${isRegenerating ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <Icon name="sparkles" size={14.5} className={`text-[#4f46e5] ${isRegenerating ? "animate-spin" : ""}`} />
          <span>{isRegenerating ? "Analyzing Files..." : "Regenerate Mapping"}</span>
        </button>
      </div>

      {/* Row of 5 Cards with increased sizing */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4.5 flex-none">
        
        {/* Card 1: Objects Detected */}
        <div className="bg-[#f5f8ff] border border-blue-150 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[92px] lg:min-h-[100px] shadow-[0_2px_8px_rgba(148,163,184,0.01)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300 opacity-0 animate-scale-up" style={{ animationDelay: "100ms" }}>
          <span className="text-[12.5px] lg:text-[13px] font-bold text-[#2b59c3] uppercase tracking-wider">Objects Detected</span>
          <h3 className="text-[32px] lg:text-[38px] font-black text-[#000839] tracking-tight leading-none mt-1.5">
            {objectsCount}
          </h3>
        </div>

        {/* Card 2: Fields Mapped */}
        <div className="bg-[#f0fbf6] border border-emerald-150 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[92px] lg:min-h-[100px] shadow-[0_2px_8px_rgba(148,163,184,0.01)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300 opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
          <span className="text-[12.5px] lg:text-[13px] font-bold text-[#117a4c] uppercase tracking-wider">Fields Mapped</span>
          <div className="flex items-baseline gap-2.5 mt-1.5">
            <h3 className="text-[25px] lg:text-[28px] font-black text-[#000839] tracking-tight leading-none whitespace-nowrap">
              {mappedCount} <span className="text-[14.5px] text-slate-400 font-bold">/ 387</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10.5px] font-black bg-[#e6f4ea] text-[#137333] leading-none shrink-0">
              88%
            </span>
          </div>
        </div>

        {/* Card 3: Transformations */}
        <div className="bg-[#fffbf0] border border-amber-150 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[92px] lg:min-h-[100px] shadow-[0_2px_8px_rgba(148,163,184,0.01)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300 opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
          <span className="text-[12.5px] lg:text-[13px] font-bold text-[#ca8a04] uppercase tracking-wider">Transformations</span>
          <h3 className="text-[32px] lg:text-[38px] font-black text-[#000839] tracking-tight leading-none mt-1.5">
            {transformCount}
          </h3>
        </div>

        {/* Card 4: Relationships */}
        <div className="bg-[#faf5ff] border border-purple-150 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[92px] lg:min-h-[100px] shadow-[0_2px_8px_rgba(148,163,184,0.01)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300 opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
          <span className="text-[12.5px] lg:text-[13px] font-bold text-[#7c3aed] uppercase tracking-wider">Relationships</span>
          <h3 className="text-[32px] lg:text-[38px] font-black text-[#000839] tracking-tight leading-none mt-1.5">
            {relationshipCount}
          </h3>
        </div>

        {/* Card 5: Unmapped Fields */}
        <div className="bg-[#fff5f5] border border-rose-150 py-4 px-5 rounded-xl flex flex-col justify-center min-h-[92px] lg:min-h-[100px] shadow-[0_2px_8px_rgba(148,163,184,0.01)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300 opacity-0 animate-scale-up" style={{ animationDelay: "300ms" }}>
          <span className="text-[12.5px] lg:text-[13px] font-bold text-[#e11d48] uppercase tracking-wider">Unmapped Fields</span>
          <h3 className="text-[32px] lg:text-[38px] font-black text-[#000839] tracking-tight leading-none mt-1.5">
            {unmappedCount}
          </h3>
        </div>

      </div>

      {/* Main 3-Column Content Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-none">
        
        {/* Column 1: Objects & Execution Order */}
        <div className="lg:col-span-3 bg-white border border-slate-200/60 rounded-2xl p-5 lg:p-6 flex flex-col shadow-[0_3px_14px_rgba(148,163,184,0.01)] opacity-0 animate-scale-up" style={{ animationDelay: "350ms" }}>
          <h4 className="text-[13.5px] lg:text-[14.5px] font-extrabold text-slate-800 tracking-tight pb-3 border-b border-slate-100 flex-none uppercase">
            Objects & Execution Order
          </h4>
          
          <div className="flex-1 mt-3.5 flex flex-col justify-between relative py-1.5">
            
            {/* connecting vertical blue line precisely connecting dots */}
            <div 
               className="absolute right-[36px] top-6 bottom-6 w-[2px] bg-blue-600/90 pointer-events-none opacity-0 animate-draw-line"
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
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-extrabold text-[12px] flex items-center justify-center border border-slate-200/80">
                      {idx + 1}
                    </span>
                    <span className="text-[14.5px] lg:text-[15.5px] font-black text-[#000839] leading-tight">
                      {obj.name}
                    </span>
                  </div>

                  <div className="relative shrink-0 w-6 flex items-center justify-center">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 border-white transition-all duration-200 z-10 bg-blue-600 shadow-sm ${isHovered ? "scale-125" : ""}`} />
                  </div>

                  {isHovered && (
                    <div className="absolute left-[36px] top-[-52px] w-68 p-4.5 bg-slate-900 border border-slate-800 text-white text-[12.5px] rounded-xl shadow-2xl z-30 animate-scale-in font-bold pointer-events-none leading-relaxed">
                      <span className="block text-[11px] font-black uppercase text-blue-400 mb-0.5">{obj.name} Metadata</span>
                      {obj.desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Mapping Overview with Prominent Donut Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200/60 rounded-2xl p-5 lg:p-6 flex flex-col justify-between shadow-[0_3px_14px_rgba(148,163,184,0.01)] opacity-0 animate-scale-up" style={{ animationDelay: "400ms" }}>
          <h4 className="text-[13.5px] lg:text-[14.5px] font-extrabold text-slate-800 tracking-tight pb-3 border-b border-slate-100 flex-none uppercase">
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
                  className="animate-blue-circle cursor-pointer"
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
                  className="animate-purple-circle cursor-pointer"
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
                  className="animate-amber-circle cursor-pointer"
                  transform="rotate(358.5 112 112)"
                  onMouseEnter={() => setActiveSegment("not_required")}
                  onMouseLeave={() => setActiveSegment(null)}
                />
              </svg>

              <div className="absolute text-center">
                <span className="text-[38px] font-black text-[#000839] tracking-tight leading-none block font-sans">
                  {mappedCount}
                </span>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mt-1">Fields Mapped</span>
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
                  <span className="text-[14.5px] text-slate-500 font-extrabold">Mapped</span>
                </div>
                <span className="text-[14.5px] font-black text-slate-800">342 (88%)</span>
              </div>

              <div 
                className={`flex items-center justify-between p-2 rounded-xl transition-all ${activeSegment === "unmapped" ? "bg-purple-50/50 scale-[1.01]" : ""}`}
                onMouseEnter={() => setActiveSegment("unmapped")}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-600 shrink-0" />
                  <span className="text-[14.5px] text-slate-500 font-extrabold">Unmapped</span>
                </div>
                <span className="text-[14.5px] font-black text-slate-800">45 (11%)</span>
              </div>

              <div 
                className={`flex items-center justify-between p-2 rounded-xl transition-all ${activeSegment === "not_required" ? "bg-amber-50/50 scale-[1.01]" : ""}`}
                onMouseEnter={() => setActiveSegment("not_required")}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-[14.5px] text-slate-500 font-extrabold">Not Required</span>
                </div>
                <span className="text-[14.5px] font-black text-slate-800">25 (6%)</span>
              </div>

            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-[14.5px] font-black text-slate-800 flex-none px-1">
            <span>Total Fields</span>
            <span>387</span>
          </div>

        </div>

        {/* Column 3: AI Insights */}
        <div className="lg:col-span-4 bg-white border border-slate-200/60 rounded-2xl p-5 lg:p-6 flex flex-col justify-between shadow-[0_3px_14px_rgba(148,163,184,0.01)] relative opacity-0 animate-scale-up" style={{ animationDelay: "450ms" }}>
          
          <div className="space-y-4.5">
            <h4 className="text-[13.5px] lg:text-[14.5px] font-extrabold text-slate-800 tracking-tight pb-3 border-b border-slate-100 flex-none uppercase">
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
                <p className="text-[14.5px] lg:text-[15.5px] font-bold text-slate-700 leading-snug">5 potential duplicate records found.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-bold text-slate-700 leading-snug">12 columns need transformation.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-bold text-slate-700 leading-snug">8 fields require lookup mapping.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-bold text-slate-700 leading-snug">3 date fields need format standardization.</p>
              </div>

              <div className="flex items-start gap-3.5 py-1 px-1.5 rounded-lg hover:bg-slate-50/60 transition-all duration-200">
                <span className="w-6 h-6 rounded-full border border-blue-400/80 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 bg-blue-50/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="1" />
                    <line x1="12" y1="16" x2="12" y2="10" />
                  </svg>
                </span>
                <p className="text-[14.5px] lg:text-[15.5px] font-bold text-slate-700 leading-snug">2 fields are not in Salesforce metadata.</p>
              </div>

            </div>
          </div>

          <div className="flex justify-end pt-5">
            <button 
              onClick={() => router.push("/transformations")}
              className="px-7 py-4 rounded-xl bg-[#002BFF] text-white text-[14.5px] font-black flex items-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all duration-250 shadow-md shadow-blue-500/10 cursor-pointer select-none"
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

      {/* Dynamic inline styles for count animation variables */}
      <style jsx>{`
        :global(.animate-blue-circle) {
          --target-offset: ${502 - (502 * 88) / 100};
        }
        :global(.animate-purple-circle) {
          --target-offset: ${502 - (502 * 11) / 100};
        }
        :global(.animate-amber-circle) {
          --target-offset: ${502 - (502 * 6) / 100};
        }
      `}</style>

    </div>
  );
}
