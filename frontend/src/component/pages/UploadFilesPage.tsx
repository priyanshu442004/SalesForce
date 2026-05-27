"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMigration } from "@/context/MigrationContext";

// Premium detailed custom document SVG icon
function DocumentSvg({ className = "", size = 48 }: { className?: string; size?: number }) {
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

export default function UploadFilesPage() {
  const router = useRouter();
  
  // Dedicated input refs for individual file slots
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);
  const logicInputRef = useRef<HTMLInputElement>(null);
  const globalInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { 
    uploadedFiles, 
    handleFileUpload, 
    clearFile, 
    autofillMockFiles, 
    isContinueEnabled 
  } = useMigration();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Global drop auto-detects slots
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden select-none bg-white">
      
      {/* CSS Animations Injection */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-scale-up {
          animation: scaleUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-bounce-slow {
          animation: bounceSlow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Hidden file inputs for precise slot routing */}
      <input 
        type="file" 
        ref={sourceInputRef} 
        onChange={(e) => handleFileUpload(e.target.files, "source")} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={masterInputRef} 
        onChange={(e) => handleFileUpload(e.target.files, "master")} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={logicInputRef} 
        onChange={(e) => handleFileUpload(e.target.files, "logic")} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />

      {/* Title block with enlarged fonts */}
      <div className="flex-none space-y-0.5 opacity-0 animate-scale-up" style={{ animationDelay: "50ms" }}>
        <h2 className="text-[23px] lg:text-[25px] font-black text-[#000839] tracking-tight">Upload Your Migration Files</h2>
        <p className="text-[13.5px] lg:text-[14.5px] text-slate-400 font-bold">Upload the 3 required files individually, or drop them all below to auto-sort.</p>
      </div>

      {/* Three Large Cards Grid with custom high-fidelity SVG document icons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 flex-none">
        
        {/* Card 1: Source Data */}
        <div className="bg-white border border-slate-200/60 p-6 rounded-2xl relative shadow-[0_2px_12px_rgba(148,163,184,0.02)] flex flex-col justify-between min-h-[235px] lg:min-h-[250px] hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.03)] transition-all duration-300 ease-out opacity-0 animate-scale-up" style={{ animationDelay: "100ms" }}>
          
          <div className="space-y-4.5">
            {/* Top Badge and Heading */}
            <div className="flex items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-[#e6f4ea] text-[#137333] font-black text-[17px] flex items-center justify-center shrink-0">1</span>
              <div>
                <h3 className="text-[17px] font-black text-[#000839] leading-tight">Source Data</h3>
                <p className="text-[13px] text-slate-400 font-bold leading-tight mt-0.5">Upload your raw data file.</p>
              </div>
            </div>

            {/* Custom high-fidelity green document SVG graphic */}
            <div className="flex items-center justify-center h-20 py-1 select-none">
              {uploadedFiles.source && uploadedFiles.source.loading ? (
                /* Progress Bar */
                <div className="w-full space-y-2.5 px-3.5">
                  <div className="flex justify-between text-[12px] font-black text-slate-500">
                    <span className="truncate max-w-[170px]">{uploadedFiles.source.name}</span>
                    <span>{uploadedFiles.source.progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-100" style={{ width: `${uploadedFiles.source.progress}%` }} />
                  </div>
                </div>
              ) : (
                /* Large mockup-perfect green document SVG icon */
                <div 
                  onClick={() => sourceInputRef.current?.click()}
                  className="relative hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                  <div className="w-15 h-19 bg-[#e6f4ea] text-[#137333] rounded-2xl flex items-center justify-center shadow-md border border-[#137333]/10">
                    <DocumentSvg size={38} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom loaded details box / specific upload trigger */}
          <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between min-h-[42px]">
            {uploadedFiles.source && !uploadedFiles.source.loading ? (
              <div className="flex items-center justify-between w-full bg-[#f8fafc] border border-slate-150 p-3 rounded-xl animate-scale-up">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[#e6f4ea] text-[#137333] flex items-center justify-center shrink-0">
                    <DocumentSvg size={15} />
                  </span>
                  <span className="text-[13px] font-black text-[#000839] truncate max-w-[130px]">{uploadedFiles.source.name}</span>
                  <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">({uploadedFiles.source.size})</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-5.5 h-5.5 rounded-full bg-[#107c41] flex items-center justify-center text-white font-black text-[11px] shadow-sm shrink-0">✓</span>
                  <button onClick={() => clearFile("source")} className="text-[11px] text-rose-500 font-black hover:underline select-none cursor-pointer">Clear</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => sourceInputRef.current?.click()} 
                className="w-full py-2.5 border border-[#002BFF]/10 bg-[#f4f7ff] text-[#002BFF] hover:bg-[#ebf0ff] rounded-xl text-[13px] font-black transition-all text-center select-none cursor-pointer"
              >
                Upload Source File
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Salesforce Master */}
        <div className="bg-white border border-slate-200/60 p-6 rounded-2xl relative shadow-[0_2px_12px_rgba(148,163,184,0.02)] flex flex-col justify-between min-h-[235px] lg:min-h-[250px] hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.03)] transition-all duration-300 ease-out opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
          
          <div className="space-y-4.5">
            {/* Top Badge and Heading */}
            <div className="flex items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-[#e8f0fe] text-[#1a73e8] font-black text-[17px] flex items-center justify-center shrink-0">2</span>
              <div>
                <h3 className="text-[17px] font-black text-[#000839] leading-tight">Salesforce Master</h3>
                <p className="text-[13px] text-slate-400 font-bold leading-tight mt-0.5">Upload Salesforce master metadata</p>
              </div>
            </div>

            {/* Custom high-fidelity blue document SVG graphic */}
            <div className="flex items-center justify-center h-20 py-1 select-none">
              {uploadedFiles.master && uploadedFiles.master.loading ? (
                /* Progress Bar */
                <div className="w-full space-y-2.5 px-3.5">
                  <div className="flex justify-between text-[12px] font-black text-slate-500">
                    <span className="truncate max-w-[170px]">{uploadedFiles.master.name}</span>
                    <span>{uploadedFiles.master.progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-100" style={{ width: `${uploadedFiles.master.progress}%` }} />
                  </div>
                </div>
              ) : (
                /* Large mockup-perfect blue Salesforce document SVG icon */
                <div 
                  onClick={() => masterInputRef.current?.click()}
                  className="relative hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                  <div className="w-15 h-19 bg-[#e8f0fe] text-[#1a73e8] rounded-2xl flex items-center justify-center shadow-md border border-[#1a73e8]/10">
                    <DocumentSvg size={38} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom loaded details box / specific upload trigger */}
          <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between min-h-[42px]">
            {uploadedFiles.master && !uploadedFiles.master.loading ? (
              <div className="flex items-center justify-between w-full bg-[#f8fafc] border border-slate-155 p-3 rounded-xl animate-scale-up">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center shrink-0">
                    <DocumentSvg size={15} />
                  </span>
                  <span className="text-[13px] font-black text-[#000839] truncate max-w-[130px]">{uploadedFiles.master.name}</span>
                  <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">({uploadedFiles.master.size})</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-5.5 h-5.5 rounded-full bg-[#107c41] flex items-center justify-center text-white font-black text-[11px] shadow-sm shrink-0">✓</span>
                  <button onClick={() => clearFile("master")} className="text-[11px] text-rose-500 font-black hover:underline select-none cursor-pointer">Clear</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => masterInputRef.current?.click()} 
                className="w-full py-2.5 border border-[#002BFF]/10 bg-[#f4f7ff] text-[#002BFF] hover:bg-[#ebf0ff] rounded-xl text-[13px] font-black transition-all text-center select-none cursor-pointer"
              >
                Upload Master File
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Mapping Logic */}
        <div className="bg-white border border-slate-200/60 p-6 rounded-2xl relative shadow-[0_2px_12px_rgba(148,163,184,0.02)] flex flex-col justify-between min-h-[235px] lg:min-h-[250px] hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.03)] transition-all duration-300 ease-out opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
          
          <div className="space-y-4.5">
            {/* Top Badge and Heading */}
            <div className="flex items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-[#f3e8ff] text-[#9333ea] font-black text-[17px] flex items-center justify-center shrink-0">3</span>
              <div>
                <h3 className="text-[17px] font-black text-[#000839] leading-tight">Mapping Logic</h3>
                <p className="text-[13px] text-slate-400 font-bold leading-tight mt-0.5">Upload mapping & business logic</p>
              </div>
            </div>

            {/* Custom high-fidelity purple document SVG graphic */}
            <div className="flex items-center justify-center h-20 py-1 select-none">
              {uploadedFiles.logic && uploadedFiles.logic.loading ? (
                /* Progress Bar */
                <div className="w-full space-y-2.5 px-3.5">
                  <div className="flex justify-between text-[12px] font-black text-slate-500">
                    <span className="truncate max-w-[170px]">{uploadedFiles.logic.name}</span>
                    <span>{uploadedFiles.logic.progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-400 to-purple-500 transition-all duration-100" style={{ width: `${uploadedFiles.logic.progress}%` }} />
                  </div>
                </div>
              ) : (
                /* Large mockup-perfect purple document SVG icon */
                <div 
                  onClick={() => logicInputRef.current?.click()}
                  className="relative hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                  <div className="w-15 h-19 bg-[#f3e8ff] text-[#9333ea] rounded-2xl flex items-center justify-center shadow-md border border-[#9333ea]/10">
                    <DocumentSvg size={38} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom loaded details box / specific upload trigger */}
          <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between min-h-[42px]">
            {uploadedFiles.logic && !uploadedFiles.logic.loading ? (
              <div className="flex items-center justify-between w-full bg-[#f8fafc] border border-slate-155 p-3 rounded-xl animate-scale-up">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[#f3e8ff] text-[#9333ea] flex items-center justify-center shrink-0">
                    <DocumentSvg size={15} />
                  </span>
                  <span className="text-[13px] font-black text-[#000839] truncate max-w-[130px]">{uploadedFiles.logic.name}</span>
                  <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">({uploadedFiles.logic.size})</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-5.5 h-5.5 rounded-full bg-[#107c41] flex items-center justify-center text-white font-black text-[11px] shadow-sm shrink-0">✓</span>
                  <button onClick={() => clearFile("logic")} className="text-[11px] text-rose-500 font-black hover:underline select-none cursor-pointer">Clear</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => logicInputRef.current?.click()} 
                className="w-full py-2.5 border border-[#002BFF]/10 bg-[#f4f7ff] text-[#002BFF] hover:bg-[#ebf0ff] rounded-xl text-[13px] font-black transition-all text-center select-none cursor-pointer"
              >
                Upload Logic File
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Auto-sorting Drag & Drop Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => globalInputRef.current?.click()}
        className={`flex-1 min-h-[240px] lg:min-h-0 border-2 border-dashed rounded-2xl flex flex-col justify-center items-center p-8 lg:p-12 text-center cursor-pointer transition-all duration-300 relative select-none opacity-0 animate-scale-up ${
          isDragging 
            ? "border-blue-500 bg-blue-50/30 scale-[0.99]" 
            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50/[0.02]"
        }`}
        style={{ animationDelay: "250ms" }}
      >
        <input 
          type="file" 
          ref={globalInputRef} 
          multiple 
          onChange={(e) => handleFileUpload(e.target.files)} 
          accept=".xlsx, .xls, .csv" 
          className="hidden" 
        />
        
        {/* Drag zone inner blue cloud icon */}
        <div className="space-y-4.5 max-w-md pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-blue-600 transition-transform animate-bounce-slow">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#1a73e8]">
              <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.47 0-.89.09-1.25.26A5 5 0 1 0 5 15.5A3.5 3.5 0 0 0 8.5 19h9Z" />
              <polyline points="12 10 12 16" />
              <polyline points="9 13 12 10 15 13" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <p className="text-[19px] lg:text-[21px] font-black text-[#000839]">
              Drop all files here to auto fillout
            </p>
            <p className="text-[14px] text-slate-400 font-extrabold leading-relaxed">
              Drag all three files together onto this card to auto-sort, or click <span className="text-[#1a73e8] underline font-black">Browse Files</span>
            </p>
          </div>
        </div>

        {/* Demo trigger float action */}
        <div className="absolute bottom-4 right-4 z-10" onClick={e => e.stopPropagation()}>
          <button 
            onClick={autofillMockFiles}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-black active:scale-[0.97] transition-all border border-slate-200 select-none cursor-pointer"
          >
            <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-600">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Autofill Mock Files</span>
          </button>
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="flex-none flex justify-end items-center pt-2 opacity-0 animate-scale-up" style={{ animationDelay: "300ms" }}>
        <button 
          onClick={() => isContinueEnabled && router.push("/mapping")}
          disabled={!isContinueEnabled}
          className={`px-9 py-4 rounded-xl text-[14.5px] font-black tracking-wide flex items-center gap-2.5 shadow-sm transition-all duration-300 ${
            isContinueEnabled 
              ? "bg-[#002BFF] hover:bg-blue-700 text-white cursor-pointer active:scale-[0.98] shadow-md shadow-blue-500/10" 
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          <span>Continue to AI Mapping</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

    </div>
  );
}
