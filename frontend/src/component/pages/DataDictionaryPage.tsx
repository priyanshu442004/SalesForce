"use client";

import React, { useState } from "react";
import Link from "next/link";

interface DictionaryField {
  apiName: string;
  dataType: string;
  required: "Yes" | "No";
  description: string;
  objectType: "Account" | "Contact" | "Opportunity";
}

export default function DataDictionaryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObject, setSelectedObject] = useState<"Account" | "Contact" | "Opportunity">("Account");

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
          Data Dictionary Viewer
        </h3>
        <span className="text-[14.5px] font-medium text-slate-400">
          Search and browse all source columns, Salesforce APIs, type constraints, and relationships.
        </span>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none">
        
        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 border border-blue-500/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Total Fields</span>
            <span className="block text-2xl font-semibold text-slate-900">{totalCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-rose-50 border border-rose-500/20 text-rose-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Required</span>
            <span className="block text-2xl font-semibold text-rose-600">{requiredCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Optional</span>
            <span className="block text-2xl font-semibold text-emerald-700">{optionalCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-slate-100 border border-slate-1000/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Picklist / Lookup</span>
            <span className="block text-2xl font-semibold text-blue-600">{picklistLookupCount}</span>
          </div>
        </div>

      </div>

      {/* Filter panel */}
      <div className="flex-none flex flex-col md:flex-row gap-4 items-center justify-between">

        {/* Search */}
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API names or descriptions..."
            className="w-full pl-11 pr-5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
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
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 border-transparent text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {obj} Schema
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Table Card */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm min-h-[350px] overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <th className="pb-3 pl-3">Field API Name</th>
                <th className="pb-3">Data Type</th>
                <th className="pb-3">Required</th>
                <th className="pb-3 pr-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
              {filteredFields.length > 0 ? (
                filteredFields.map((field) => (
                  <tr
                    key={field.apiName}
                    className="hover:bg-slate-50/40 transition-colors"
                  >
                    <td className="py-4 pl-3 font-mono text-sm text-blue-600 font-medium">{field.apiName}</td>
                    <td className="py-4 font-medium">{field.dataType}</td>
                    <td className="py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${
                        field.required === "Yes" ? "bg-rose-50 text-rose-600 border border-rose-100/40" : "bg-slate-50 text-slate-400 border border-slate-100"
                      }`}>
                        {field.required}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 font-medium max-w-[400px] truncate pr-4">{field.description}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-medium text-sm">
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
