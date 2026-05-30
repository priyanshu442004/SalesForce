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
  const [isShowingPreview, setIsShowingPreview] = useState(false);
  
  const { 
    uploadedFiles, 
    handleFileUpload, 
    clearFile, 
    isContinueEnabled,
    
    previewData,
    generatePreview,
    isPreviewLoading,
    previewError
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
    <div className="p-5 sm:p-7 lg:p-9 pb-12 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white">
      
      {/* CSS Animations Injection */}
      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
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
                  <span className="text-[13px] font-black text-[#000839] truncate flex-1 min-w-0">{uploadedFiles.source.name}</span>
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
                  <span className="text-[13px] font-black text-[#000839] truncate flex-1 min-w-0">{uploadedFiles.master.name}</span>
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
                  <span className="text-[13px] font-black text-[#000839] truncate flex-1 min-w-0">{uploadedFiles.logic.name}</span>
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
        className={`flex-none min-h-[220px] border-2 border-dashed rounded-2xl flex flex-col justify-center items-center py-7 px-6 text-center cursor-pointer transition-all duration-300 relative select-none opacity-0 animate-scale-up ${
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
        <div className="space-y-3.5 max-w-md pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-blue-600 transition-transform animate-bounce-slow">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#1a73e8]">
              <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.47 0-.89.09-1.25.26A5 5 0 1 0 5 15.5A3.5 3.5 0 0 0 8.5 19h9Z" />
              <polyline points="12 10 12 16" />
              <polyline points="9 13 12 10 15 13" />
            </svg>
          </div>
          
          <div className="space-y-1.5">
            <p className="text-[18px] lg:text-[19px] font-black text-[#000839]">
              Drop all files here to auto fillout
            </p>
            <p className="text-[13.5px] text-slate-400 font-extrabold leading-relaxed">
              Drag all three files together onto this card to auto-sort, or click <span className="text-[#1a73e8] underline font-black">Browse Files</span>
            </p>
          </div>
        </div>


      </div>

      {/* Bottom Actions Row */}
      <div className="flex-none flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-2 gap-4 opacity-0 animate-scale-up" style={{ animationDelay: "300ms" }}>
        
        {/* Preview Button (Left Side) */}
        <button 
          onClick={async () => {
            if (isContinueEnabled) {
              try {
                await generatePreview();
                setIsShowingPreview(true);
              } catch (e) {
                console.error(e);
              }
            }
          }}
          disabled={!isContinueEnabled}
          className={`px-7 py-4 rounded-xl text-[14.5px] font-black tracking-wide flex items-center justify-center gap-2.5 shadow-sm transition-all duration-300 ${
            isContinueEnabled 
              ? "bg-[#0b0f19] hover:bg-slate-800 text-white cursor-pointer active:scale-[0.98] shadow-md shadow-slate-900/10" 
              : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={isContinueEnabled ? "text-emerald-400 animate-pulse" : "text-slate-300"}>
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Preview Updated Client Data</span>
        </button>

        {/* AI Mapping Continue Button (Right Side) */}
        <button 
          onClick={() => isContinueEnabled && router.push("/mapping")}
          disabled={!isContinueEnabled}
          className={`px-9 py-4 rounded-xl text-[14.5px] font-black tracking-wide flex items-center justify-center gap-2.5 shadow-sm transition-all duration-300 ${
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

      {/* 1. GLASSMORPHIC SERVER CALCULATION LOADING DIALOG */}
      {isPreviewLoading && (
        <div className="fixed inset-0 bg-[#000839]/60 backdrop-blur-md flex items-center justify-center z-50 transition-all duration-300">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 scale-100 flex flex-col space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Spinner */}
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-[#002BFF] animate-spin" />
              <h3 className="text-[20px] font-black text-[#000839]">Compiling Salesforce Preview...</h3>
              <p className="text-[13.5px] text-slate-400 font-semibold leading-relaxed">
                Executing dynamic master sheets lookups, dropping empty fields, and parsing date-times on the Python server.
              </p>
            </div>
            
            {/* Action checklist */}
            <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-200/50 text-[13px] font-bold text-slate-500">
              <div className="flex items-center gap-2.5 text-emerald-600">
                <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-[10px]">✓</span>
                <span>Uploading Excel sheets to Python backend</span>
              </div>
              <div className="flex items-center gap-2.5 text-emerald-600">
                <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-[10px]">✓</span>
                <span>Dropping all-null and all-blank columns</span>
              </div>
              <div className="flex items-center gap-2.5 text-[#002BFF]">
                <span className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-[10px] animate-spin border-t-[#002BFF]">/</span>
                <span>Mapping sheets & matching Salesforce master keys</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400">
                <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px]">-</span>
                <span>Formatting date variables and datetime ISO patterns</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. HIGH-FIDELITY ENTERPRISE SPREADSHEET PREVIEW CENTER */}
      {isShowingPreview && previewData && (
        <div className="fixed inset-0 bg-[#000839]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 md:p-10 transition-all duration-300">
          <div className="bg-white rounded-3xl w-full h-full max-w-[1550px] shadow-2xl border border-slate-200/60 flex flex-col min-h-0 overflow-hidden animate-scale-up">
            
            {/* Header section with metrics highlights */}
            <div className="p-6 sm:p-7 border-b border-slate-100 bg-[#fafbfe]/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1.5 rounded-lg bg-[#e6f4ea] text-[#137333] text-[11.5px] font-black tracking-wider uppercase">Live Preview Active</span>
                  <h3 className="text-[20px] lg:text-[23px] font-black text-[#000839] tracking-tight">Salesforce Client Data Preview</h3>
                </div>
                <p className="text-[13px] text-slate-400 font-bold">
                  Here is the exact representation of <code className="text-[#002BFF] font-black">preview.xlsx</code> after processing with the Work Order mapping logic sheet.
                </p>
              </div>

              {/* Action buttons (Close + Direct Excel Export) */}
              <div className="flex items-center gap-3.5 self-stretch sm:self-auto shrink-0">
                <button
                  onClick={() => {
                    window.open("http://localhost:8000/api/download-preview", "_blank");
                  }}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#107c41] hover:bg-[#0c5d31] text-white text-[13px] font-black transition-all shadow-md shadow-[#107c41]/10 active:scale-[0.98] select-none cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span>Export Completed Excel</span>
                </button>
                <button
                  onClick={() => setIsShowingPreview(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[13px] font-black transition-all active:scale-[0.98] select-none cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* Metrics cards row */}
            <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-100 bg-white p-4.5 sm:p-6 shrink-0 gap-4">
              
              <div className="bg-[#f8fafc] border border-slate-100 p-4 rounded-2xl flex flex-col justify-center">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Output Rows</span>
                <span className="text-[20px] font-black text-[#000839] mt-0.5">{previewData.summary.total_rows}</span>
              </div>

              <div className="bg-[#f8fafc] border border-slate-100 p-4 rounded-2xl flex flex-col justify-center">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Active Columns</span>
                <span className="text-[20px] font-black text-[#000839] mt-0.5">{previewData.summary.total_columns}</span>
              </div>

              <div className="bg-[#fdf4f5] border border-rose-100/50 p-4 rounded-2xl flex flex-col justify-center">
                <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider">Empty Columns Removed</span>
                <span className="text-[20px] font-black text-rose-600 mt-0.5">{previewData.summary.cleaned_columns_count}</span>
              </div>

              <div className="bg-[#eaf5ff] border border-blue-100/50 p-4 rounded-2xl flex flex-col justify-center">
                <span className="text-[11px] text-[#1a73e8] font-bold uppercase tracking-wider">Salesforce Master Lookups</span>
                <span className="text-[20px] font-black text-[#1a73e8] mt-0.5">{previewData.summary.lookups_successful} matches</span>
              </div>

              <div className="bg-[#fff9e6] border border-amber-100/50 p-4 rounded-2xl flex flex-col justify-center">
                <span className="text-[11px] text-amber-500 font-bold uppercase tracking-wider">Dates Formatted</span>
                <span className="text-[20px] font-black text-amber-600 mt-0.5">{previewData.summary.dates_formatted} cells</span>
              </div>

            </div>

            {/* Grid preview area with horizontal and vertical scroll */}
            <div className="flex-1 min-h-0 overflow-auto bg-slate-50/50 p-6 relative">
              <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse text-left text-[12.5px] relative">
                    
                    {/* Sticky table headers */}
                    <thead className="sticky top-0 bg-white z-10 select-none shadow-[0_1.5px_0_rgba(226,232,240,1)]">
                      <tr>
                        <th className="p-3.5 border-r border-slate-100 font-extrabold text-[#000839] bg-slate-50 text-center w-12 shrink-0">#</th>
                        {previewData.columns.map((col: any) => {
                          // Dynamic header styling based on column category
                          let bgClass = "bg-slate-50 text-[#000839]";
                          let badgeText = "Original";
                          let badgeClass = "bg-slate-200/60 text-slate-500";
                          
                          if (col.type === "lookup") {
                            bgClass = "bg-blue-50/30 text-blue-900";
                            badgeText = "ID Lookup";
                            badgeClass = "bg-blue-100/70 text-blue-600";
                          } else if (col.type === "new_lookup") {
                            bgClass = "bg-emerald-50/30 text-emerald-900";
                            badgeText = "New Lookup";
                            badgeClass = "bg-emerald-100 text-emerald-700";
                          } else if (col.type === "new_constant") {
                            bgClass = "bg-purple-50/30 text-purple-900";
                            badgeText = "Constant";
                            badgeClass = "bg-purple-100 text-purple-700";
                          }
                          
                          return (
                            <th 
                              key={col.key} 
                              className={`p-3.5 border-r border-slate-150 font-black whitespace-nowrap min-w-[160px] ${bgClass}`}
                            >
                              <div className="flex flex-col gap-1">
                                <span className="font-extrabold uppercase tracking-tight">{col.name}</span>
                                <span className={`inline-block self-start px-2 py-0.5 rounded text-[9.5px] font-black tracking-wide uppercase ${badgeClass}`}>
                                  {badgeText}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    
                    {/* Table Body rows */}
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                      {previewData.rows.map((row: any, rIdx: number) => (
                        <tr 
                          key={rIdx} 
                          className="hover:bg-slate-50/80 transition-colors odd:bg-white even:bg-slate-50/10"
                        >
                          <td className="p-3.5 border-r border-slate-100 font-extrabold text-slate-400 text-center bg-slate-50/40 select-none">
                            {rIdx + 1}
                          </td>
                          {previewData.columns.map((col: any) => {
                            const val = row[col.key];
                            const isNull = val === null || val === undefined || val === "";
                            
                            // Highlight text colors based on column mapping types
                            let cellTextClass = "text-slate-700";
                            if (col.type === "lookup" || col.type === "new_lookup") {
                              cellTextClass = isNull ? "text-slate-300" : "text-blue-700 font-bold font-mono text-[11.5px]";
                            } else if (col.type === "new_constant") {
                              cellTextClass = "text-purple-700 font-semibold";
                            }
                            
                            return (
                              <td 
                                key={col.key} 
                                className={`p-3.5 border-r border-slate-100 whitespace-nowrap truncate max-w-[240px] ${cellTextClass}`}
                              >
                                {isNull ? (
                                  <span className="text-slate-350 italic">—</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>
                
                {/* Visual grid bottom helper */}
                {previewData.summary.total_rows > 50 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-150 text-center text-[12px] font-extrabold text-slate-400 select-none shrink-0">
                    Showing first 50 rows of data. Click "Export Completed Excel" above to download the full {previewData.summary.total_rows} rows dataset.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
