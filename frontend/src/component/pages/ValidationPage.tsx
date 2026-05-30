"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

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

// Decimal counting hook
function useCountUpDecimal(target: number, duration: number = 800, delay: number = 0) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let timerId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.round(progress * target * 10) / 10);
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

export default function ValidationPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Animate all dashboard count values
  const countTotal = useCountUp(12356, 1000, 100);
  const countValid = useCountUp(11785, 1000, 100);
  const countInvalid = useCountUp(671, 1000, 100);
  const countSuccessRate = useCountUpDecimal(94.6, 1000, 100);

  // Checks counts
  const check1 = useCountUp(25, 900, 200);
  const check2 = useCountUp(136, 900, 200);
  const check3 = useCountUp(290, 900, 200);
  const check4 = useCountUp(87, 900, 200);
  const check5 = useCountUp(104, 900, 200);

  // Errors counts
  const err1 = useCountUp(25, 900, 250);
  const err2 = useCountUp(136, 900, 250);
  const err3 = useCountUp(87, 900, 250);
  const err4 = useCountUp(23, 900, 250);

  return (
    <div className="flex-1 flex flex-col space-y-6 lg:space-y-7 p-7 lg:p-9 min-h-0 bg-[#f8fafd] overflow-y-auto">
      
      {/* Dynamic Keyframe style definitions */}
      <style jsx global>{`
        @keyframes scaleUp {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes drawPath {
          from {
            stroke-dashoffset: 150;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes drawCircle {
          from {
            stroke-dashoffset: 238.76;
          }
          to {
            stroke-dashoffset: ${238.76 - (238.76 * 94.6) / 100};
          }
        }
        .animate-scale-up {
          animation: scaleUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-draw-path {
          stroke-dasharray: 150;
          stroke-dashoffset: 150;
          animation: drawPath 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards;
        }
        .animate-draw-circle {
          stroke-dasharray: 238.76;
          stroke-dashoffset: 238.76;
          animation: drawCircle 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
        }
      `}</style>

      {/* Back to workspace link */}
      <div className="flex-none opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[12px] font-black text-slate-400 hover:text-[#002BFF] transition-all uppercase tracking-wider"
        >
          <span>&lt;</span>
          <span className="text-[#002BFF] lowercase font-bold normal-case text-[13.5px]">Back to workspace</span>
        </Link>
      </div>

      {/* Header titles with enlarged fonts */}
      <div className="flex-none flex flex-col space-y-2 opacity-0 animate-scale-up" style={{ animationDelay: "100ms" }}>
        <h3 className="text-[23px] font-black text-[#000839]">
          Data Validation & Quality Check
        </h3>
        <span className="text-[13.5px] font-bold text-slate-400">
          Validate transformed data against Salesforce rules.
        </span>
      </div>

      {/* Top Metric row - 4 beautiful cards with increased sizing */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        
        {/* Card 1: Total Records */}
        <div className="bg-white border border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
          <div className="w-13 h-13 rounded-full bg-blue-50/70 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#002BFF] flex items-center justify-center text-white shadow-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Total Records</span>
            <span className="block text-[24px] font-black text-[#000839] tracking-tight leading-none">
              {countTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 2: Valid Records */}
        <div className="bg-white border border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
          <div className="w-13 h-13 rounded-full bg-emerald-50/70 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#137333] flex items-center justify-center text-white shadow-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Valid Records</span>
            <span className="block text-[24px] font-black text-[#000839] tracking-tight leading-none">
              {countValid.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 3: Invalid Records */}
        <div className="bg-white border border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
          <div className="w-13 h-13 rounded-full bg-rose-50/70 border border-rose-100 flex items-center justify-center flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#e11d48] flex items-center justify-center text-white shadow-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Invalid Records</span>
            <span className="block text-[24px] font-black text-[#000839] tracking-tight leading-none">
              {countInvalid.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 4: Success Rate with animated Zig-Zag Sparkline */}
        <div className="bg-white border border-slate-200/50 rounded-2xl p-5 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Success Rate</span>
            <span className="block text-[24px] font-black text-[#000839] tracking-tight leading-none">
              {countSuccessRate}%
            </span>
          </div>
          <div className="w-28 h-9 overflow-visible pr-1">
            <svg className="w-full h-full text-[#002BFF] overflow-visible" viewBox="0 0 100 30" fill="none">
              <path
                d="M 5,22 L 24,24 L 43,15 L 62,20 L 81,10 L 98,3"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw-path"
              />
              <circle cx="98" cy="3" r="3.2" className="fill-[#002BFF] stroke-white stroke-[1.5]" />
            </svg>
          </div>
        </div>

      </div>

      {/* Main Grid: Donut, Check list and Recent Errors */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch pb-2 opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        
        {/* Column 1: Validation Summary Donut Card */}
        <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/60 rounded-2xl p-6 lg:p-7 flex flex-col justify-between items-stretch shadow-[0_2px_12px_rgba(0,0,0,0.006)] min-h-[390px]">
          <h4 className="text-[15px] font-bold text-slate-700 pb-2.5">
            Validation Summary
          </h4>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-slate-100"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-[#0ba175] animate-draw-circle"
                  strokeWidth="12"
                  fill="transparent"
                  strokeLinecap="round"
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[40px] font-black text-[#000839] leading-none">
                  {countSuccessRate}%
                </span>
                <span className="text-[14.5px] font-black text-[#0ba175] mt-1.5 tracking-wide">
                  Valid
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Validation Checks List Card */}
        <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/60 rounded-2xl p-6 lg:p-7 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.006)] min-h-[390px]">
          <div className="space-y-4 flex-1 flex flex-col">
            <h4 className="text-[15px] font-bold text-slate-700 border-b border-slate-50 pb-2">
              Validation Checks
            </h4>

            {/* List block with enlarged sizes */}
            <div className="flex-1 flex flex-col justify-between py-1.5 space-y-4.5">
              
              {/* Check Item 1 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9.5 h-9.5 rounded-full bg-[#fff6f0] border border-[#ffe9db] text-[#ff6a00] flex items-center justify-center flex-shrink-0">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <polygon points="12 2 2 22 22 22" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <span className="font-bold text-[#000839]/90">Missing Required Fields</span>
                </div>
                <span className="font-black text-[#000839]">{check1}</span>
              </div>

              {/* Check Item 2 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9.5 h-9.5 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <span className="font-bold text-[#000839]/90">Invalid Date Format</span>
                </div>
                <span className="font-black text-[#000839]">{check2}</span>
              </div>

              {/* Check Item 3 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9.5 h-9.5 rounded-full bg-[#e6f4ea] border border-[#c2e7cd] text-[#137333] flex items-center justify-center flex-shrink-0">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <span className="font-bold text-[#000839]/90">Invalid Picklist Values</span>
                </div>
                <span className="font-black text-[#000839]">{check3}</span>
              </div>

              {/* Check Item 4 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9.5 h-9.5 rounded-full bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <circle cx="18" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                      <path d="M11 18H8a2 2 0 0 1-2-2V9" />
                    </svg>
                  </div>
                  <span className="font-bold text-[#000839]/90">Lookup Values Not Found</span>
                </div>
                <span className="font-black text-[#000839]">{check4}</span>
              </div>

              {/* Check Item 5 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9.5 h-9.5 rounded-full bg-pink-50 border border-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </div>
                  <span className="font-bold text-[#000839]/90">Duplicate External IDs</span>
                </div>
                <span className="font-black text-[#000839]">{check5}</span>
              </div>

            </div>
          </div>
        </div>

        {/* Column 3: Recent Errors Card */}
        <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/60 rounded-2xl p-6 lg:p-7 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.006)] min-h-[390px]">
          <div className="space-y-4 flex-1 flex flex-col">
            <h4 className="text-[15px] font-bold text-slate-700 border-b border-slate-50 pb-2">
              Recent Errors
            </h4>

            {/* Error Rows with enlarged sizes */}
            <div className="flex-1 flex flex-col justify-between py-1.5 space-y-5">
              
              {/* Row 1 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="text-slate-400/90 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                      <path d="M12 2L2 12l10 10 10-10L12 2zM12 8l4 4-4 4-4-4 4-4z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block font-black text-[#000839] text-[15px] leading-none">Phone</span>
                    <span className="block text-[12.5px] font-bold text-slate-400/90 mt-0.5">Invalid phone number format</span>
                  </div>
                </div>
                <span className="font-black text-[#000839]">{err1}</span>
              </div>

              {/* Row 2 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="text-slate-400/90 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                      <path d="M12 2L2 12l10 10 10-10L12 2zM12 8l4 4-4 4-4-4 4-4z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block font-black text-[#000839] text-[15px] leading-none">Start_Date__c</span>
                    <span className="block text-[12.5px] font-bold text-slate-400/90 mt-0.5">Invalid date format</span>
                  </div>
                </div>
                <span className="font-black text-[#000839]">{err2}</span>
              </div>

              {/* Row 3 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="text-slate-400/90 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                      <path d="M12 2L2 12l10 10 10-10L12 2zM12 8l4 4-4 4-4-4 4-4z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block font-black text-[#000839] text-[15px] leading-none">AccountId</span>
                    <span className="block text-[12.5px] font-bold text-slate-400/90 mt-0.5">Lookup value not found</span>
                  </div>
                </div>
                <span className="font-black text-[#000839]">{err3}</span>
              </div>

              {/* Row 4 */}
              <div className="flex items-center justify-between text-[15.5px]">
                <div className="flex items-center gap-3.5">
                  <div className="text-slate-400/90 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                      <path d="M12 2L2 12l10 10 10-10L12 2zM12 8l4 4-4 4-4-4 4-4z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block font-black text-[#000839] text-[15px] leading-none">Amount</span>
                    <span className="block text-[12.5px] font-bold text-slate-400/90 mt-0.5">Must be a number</span>
                  </div>
                </div>
                <span className="font-black text-[#000839]">{err4}</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Bottom CTA Button */}
      <div className="flex items-center justify-end pt-3.5 pb-10 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
        <button className="px-9 py-4 rounded-xl bg-[#002BFF] hover:bg-blue-700 text-white text-[15px] font-black transition-all select-none cursor-pointer shadow-lg shadow-blue-500/10 active:scale-[0.98]">
          View All Errors
        </button>
      </div>

    </div>
  );
}
