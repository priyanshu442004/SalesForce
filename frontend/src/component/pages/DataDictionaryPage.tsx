"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DictionaryField {
  apiName: string;
  dataType: string;
  required: "Yes" | "No";
  description: string;
  objectType: "Account" | "Contact" | "Opportunity";
}

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

export default function DataDictionaryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObject, setSelectedObject] = useState<"Account" | "Contact" | "Opportunity">("Account");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fields: DictionaryField[] = [
    { apiName: "Id", dataType: "ID / Lookup", required: "Yes", description: "Unique Salesforce primary key identifier.", objectType: "Account" },
    { apiName: "Name", dataType: "Text (255)", required: "Yes", description: "Primary name of the account or corporation.", objectType: "Account" },
    { apiName: "Type", dataType: "Picklist (B2B, B2C, Partner)", required: "No", description: "Categorization of customer segment.", objectType: "Account" },
    { apiName: "AnnualRevenue", dataType: "Currency", required: "No", description: "Estimated annual turnover value.", objectType: "Account" },
    { apiName: "Phone", dataType: "Phone", required: "No", description: "Main primary company contact telephone.", objectType: "Account" },
    { apiName: "OwnerId", dataType: "Lookup (User)", required: "Yes", description: "Identifies the owner assigned to the account record.", objectType: "Account" },
    
    { apiName: "FirstName", dataType: "Text (40)", required: "No", description: "First name of the corporate contact.", objectType: "Contact" },
    { apiName: "LastName", dataType: "Text (80)", required: "Yes", description: "Last name of the corporate contact.", objectType: "Contact" },
    { apiName: "Email", dataType: "Email", required: "No", description: "Primary electronic email contact.", objectType: "Contact" },
    
    { apiName: "Amount", dataType: "Currency", required: "No", description: "Estimated financial deal transaction size.", objectType: "Opportunity" },
    { apiName: "StageName", dataType: "Picklist (Prospecting, Closed Won)", required: "Yes", description: "Represents the active sales funnel stage name.", objectType: "Opportunity" }
  ];

  const filteredFields = fields.filter(f => {
    const matchesSearch = f.apiName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesObject = f.objectType === selectedObject;
    return matchesSearch && matchesObject;
  });

  // Dynamic counts for each selected object
  const totalCount = fields.filter(f => f.objectType === selectedObject).length;
  const requiredCount = fields.filter(f => f.objectType === selectedObject && f.required === "Yes").length;
  const optionalCount = totalCount - requiredCount;
  const picklistLookupCount = fields.filter(f => f.objectType === selectedObject && (f.dataType.includes("Picklist") || f.dataType.includes("Lookup"))).length;

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
          Data Dictionary Viewer
        </h3>
        <span className="text-[14.5px] font-bold text-slate-400">
          Search and browse all source columns, Salesforce APIs, type constraints, and relationships.
        </span>
      </div>

      {/* Stat Header Cards for Dynamic Dictionary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        
        {/* Total Fields */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-blue-50 border border-blue-500/20 text-[#002BFF] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Total Fields</span>
            <span className="block text-[25px] font-black text-[#000839]">
              <AnimatedCount target={totalCount} key={`total-${selectedObject}`} />
            </span>
          </div>
        </div>

        {/* Required Fields */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-rose-50 border border-rose-500/20 text-[#e11d48] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Required</span>
            <span className="block text-[25px] font-black text-[#e11d48]">
              <AnimatedCount target={requiredCount} key={`req-${selectedObject}`} />
            </span>
          </div>
        </div>

        {/* Optional Fields */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-[#e6f4ea] border border-[#e6f4ea]/45 text-[#137333] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Optional</span>
            <span className="block text-[25px] font-black text-[#137333]">
              <AnimatedCount target={optionalCount} key={`opt-${selectedObject}`} />
            </span>
          </div>
        </div>

        {/* Picklist / Lookup fields */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-purple-50 border border-purple-500/20 text-[#7c3aed] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Picklist / Lookup</span>
            <span className="block text-[25px] font-black text-[#7c3aed]">
              <AnimatedCount target={picklistLookupCount} key={`pl-${selectedObject}`} />
            </span>
          </div>
        </div>

      </div>

      {/* Filter panel */}
      <div className="flex-none flex flex-col md:flex-row gap-4 items-center justify-between opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        
        {/* Search */}
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API names or descriptions..."
            className="w-full pl-11 pr-5 py-3.5 rounded-2xl border border-slate-200 text-[#000839] text-[14.5px] font-black placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/10 bg-white"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {(["Account", "Contact", "Opportunity"] as const).map((obj) => {
            const isActive = selectedObject === obj;
            return (
              <button
                key={obj}
                onClick={() => setSelectedObject(obj)}
                className={`px-5 py-3 rounded-xl text-[14px] font-black border transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#002BFF] border-transparent text-white shadow-md shadow-blue-500/10"
                    : "bg-white border-slate-200/60 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {obj} Schema
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Table Card with Enlarged Texts & Row Animation Sequences */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.008)] min-h-[350px] overflow-hidden flex flex-col opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-100/85 text-[14.5px] font-black text-slate-400 uppercase tracking-tight">
                <th className="pb-4 pl-3">Field API Name</th>
                <th className="pb-4">Data Type</th>
                <th className="pb-4">Required</th>
                <th className="pb-4 pr-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[15.5px] font-bold text-[#000839]">
              {filteredFields.length > 0 ? (
                filteredFields.map((field, idx) => (
                  <tr 
                    key={field.apiName} 
                    className="hover:bg-slate-50/20 transition-all opacity-0 animate-row"
                    style={{ animationDelay: `${300 + idx * 45}ms` }}
                  >
                    <td className="py-4.5 pl-3 font-mono text-[15px] text-[#002BFF] font-black">{field.apiName}</td>
                    <td className="py-4.5 text-[#000839]/85 font-black">{field.dataType}</td>
                    <td className="py-4.5">
                      <span className={`px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-wider ${
                        field.required === "Yes" ? "bg-red-50 text-red-600 border border-red-100/40" : "bg-slate-50 text-slate-400 border border-slate-100"
                      }`}>
                        {field.required}
                      </span>
                    </td>
                    <td className="py-4.5 text-slate-400 font-bold max-w-[400px] truncate pr-4">{field.description}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-black">
                    No matching dictionary fields found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
