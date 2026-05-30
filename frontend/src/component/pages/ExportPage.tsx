"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Premium detailed custom document SVG icon (identical to UploadFilesPage)
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

// Highly reliable premium inline dynamic counting component
function AnimatedCount({ target, duration = 1200, suffix = "", format = false }: { target: number; duration?: number; suffix?: string; format?: boolean }) {
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

  if (format) {
    return <>{count.toLocaleString()}{suffix}</>;
  }
  return <>{count}{suffix}</>;
}

export default function ExportPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    { name: "Transformation Log.xlsx", size: "1.15 MB", color: "purple" },
    { name: "Mapping Report.xlsx", size: "827 KB", color: "purple" }
  ];

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-7 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white">
      
      {/* CSS Animations Injection */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.98) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-scale-up {
          animation: scaleUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-row {
          animation: fadeInRow 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header bar styled exactly as in the mockup */}
      <div className="flex-none flex items-center justify-between opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <h2 className="text-[24px] font-black text-[#002BFF] tracking-tight">
          11. Export – Final Output
        </h2>
        
        {/* Right header actions */}
        <div className="flex items-center gap-4 text-slate-400">
          <button className="hover:text-[#002BFF] transition-colors p-1.5 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          <button className="hover:text-[#002BFF] transition-colors p-1.5 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Back button link */}
      <div className="flex-none opacity-0 animate-scale-up" style={{ animationDelay: "100ms" }}>
        <Link
          href="/"
          className="text-[#002BFF] text-[13.5px] font-black hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
        >
          <span>&lt; Back to Workspace</span>
        </Link>
      </div>

      {/* Description block exactly as mockup */}
      <div className="flex-none flex flex-col space-y-1.5 opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        <h1 className="text-[26px] font-black text-[#000839] tracking-tight">
          Export Salesforce Ready Files
        </h1>
        <p className="text-[14.5px] font-extrabold text-slate-500">
          Your data is ready to export. Download the files below.
        </p>
      </div>

      {/* Three Column Widescreen Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-start opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        
        {/* Column 1: Files Generated */}
        <div className="bg-[#FFFFFF] border border-slate-200/60 rounded-3xl p-6.5 lg:p-8 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.015)] min-h-[460px]">
          <div className="space-y-6">
            <h3 className="text-[19px] font-black text-[#000839] tracking-tight border-b border-slate-50 pb-2.5">
              Files Generated
            </h3>

            {/* List of generated CSV files */}
            <div className="space-y-4">
              {filesGenerated.map((file, idx) => (
                <div 
                  key={file.name}
                  className="flex items-center justify-between py-1 opacity-0 animate-row"
                  style={{ animationDelay: `${250 + idx * 50}ms` }}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Beautiful green custom document SVG icon */}
                    <div className="w-10 h-10 bg-[#e6f4ea] text-[#137333] rounded-xl flex items-center justify-center flex-shrink-0">
                      <DocumentSvg size={18} />
                    </div>
                    <span className="text-[15.5px] font-black text-[#000839]">{file.name}</span>
                  </div>
                  <span className="text-[14.5px] font-extrabold text-slate-500">{file.size}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Download all zip button at the bottom */}
          <div className="pt-6 border-t border-slate-100/65 mt-5">
            <button className="w-full bg-[#f4f7ff] hover:bg-[#ebf0ff] text-[#002BFF] border border-[#002BFF]/10 py-4.5 rounded-2xl text-[15.5px] font-black transition-all flex items-center justify-between px-5 select-none cursor-pointer">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download All Files (ZIP)</span>
              </div>
              <span className="font-extrabold text-[14.5px]">12.31 MB</span>
            </button>
          </div>
        </div>

        {/* Column 2: Reports */}
        <div className="bg-[#FFFFFF] border border-slate-200/60 rounded-3xl p-6.5 lg:p-8 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.015)] min-h-[460px]">
          <div className="space-y-6">
            <h3 className="text-[19px] font-black text-[#002BFF] tracking-tight border-b border-slate-50 pb-2.5">
              Reports
            </h3>

            {/* List of reports */}
            <div className="space-y-4">
              {reportsGenerated.map((report, idx) => (
                <div 
                  key={report.name}
                  className="flex items-center justify-between py-1 opacity-0 animate-row"
                  style={{ animationDelay: `${250 + idx * 55}ms` }}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Conditional green / purple document icons */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      report.color === "green" 
                        ? "bg-[#e6f4ea] text-[#137333]" 
                        : "bg-[#f3e8ff] text-[#7c3aed]"
                    }`}>
                      <DocumentSvg size={18} />
                    </div>
                    <span className="text-[15.5px] font-black text-[#000839]">{report.name}</span>
                  </div>
                  <span className="text-[14.5px] font-extrabold text-slate-500">{report.size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: Export Summary */}
        <div className="bg-[#FFFFFF] border border-slate-200/60 rounded-3xl p-6.5 lg:p-8 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.015)] min-h-[460px]">
          <div className="space-y-6">
            <h3 className="text-[19px] font-black text-[#000839] tracking-tight border-b border-slate-50 pb-2.5">
              Export Summary
            </h3>

            {/* List of summary statistics matching mockup exactly */}
            <div className="space-y-4 text-[15.5px] font-extrabold text-slate-500">
              
              <div className="flex items-center justify-between py-1 border-b border-slate-50 pb-2">
                <span>Objects Generated</span>
                <span className="font-black text-[#000839] text-[16.5px]">
                  <AnimatedCount target={8} />
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50 pb-2">
                <span>Files Generated</span>
                <span className="font-black text-[#000839] text-[16.5px]">
                  <AnimatedCount target={12} />
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50 pb-2">
                <span>Total Records</span>
                <span className="font-black text-[#000839] text-[16.5px]">
                  <AnimatedCount target={12356} format={true} />
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50 pb-2">
                <span>Valid Records</span>
                <span className="font-black text-[#000839] text-[16.5px]">
                  <AnimatedCount target={11785} format={true} />
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50 pb-2">
                <span>Invalid Records</span>
                <span className="font-black text-[#000839] text-[16.5px]">
                  <AnimatedCount target={571} />
                </span>
              </div>

              <div className="flex items-center justify-between py-1 pt-1">
                <span>Exported On</span>
                <span className="font-black text-[#000839] text-[15.5px]">25 May 2024, 10:48 AM</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Bottom Action bar with "Go to Dashboard" button styled exactly like in mockup */}
      <div className="flex items-center justify-end pt-5 pb-12 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
        <button
          onClick={() => router.push("/")}
          className="px-9 py-4 rounded-xl bg-[#002BFF] hover:bg-blue-700 text-white text-[15px] font-black transition-all select-none cursor-pointer shadow-lg shadow-blue-500/10 active:scale-[0.98]"
        >
          Go to Dashboard
        </button>
      </div>

    </div>
  );
}
