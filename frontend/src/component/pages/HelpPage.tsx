"use client";

import React, { useState } from "react";
import Link from "next/link";

interface HelpTopic {
  title: string;
  description: string;
  readTime: string;
  category: "Guides" | "API & Rules" | "Troubleshoot";
  bgClass: string;
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const topics: HelpTopic[] = [
    {
      title: "Data Migration Quickstart Guide",
      description: "Learn how to prepare CSV/JSON files, structure accounts and contacts, and upload schemas securely.",
      readTime: "5 min read",
      category: "Guides",
      bgClass: "bg-blue-50/10 border-blue-500/20 text-blue-600"
    },
    {
      title: "Transformation Logic Reference",
      description: "Complete glossary of text cleanups, date formatting, picklist mapping logic and custom rules.",
      readTime: "8 min read",
      category: "API & Rules",
      bgClass: "bg-slate-100/10 border-slate-1000/20 text-slate-600"
    },
    {
      title: "Resolving Common Validation Errors",
      description: "Step-by-step checklist to troubleshoot duplicate external IDs, invalid date formats, and missing lookups.",
      readTime: "12 min read",
      category: "Troubleshoot",
      bgClass: "bg-amber-50/10 border-amber-500/20 text-amber-600"
    }
  ];

  const filteredTopics = topics.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-5 sm:p-7 lg:p-9 pb-12 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white">

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
          Help & Support Desk
        </h3>
        <span className="text-[14.5px] font-medium text-slate-400">
          Search our comprehensive technical docs, access user guides, and contact administrators.
        </span>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none">

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 border border-blue-500/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Documentation Docs</span>
            <span className="block text-2xl font-semibold text-slate-900">38</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-slate-100 border border-slate-1000/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Video Walkthroughs</span>
            <span className="block text-2xl font-semibold text-blue-600">12</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">System Status</span>
            <span className="block text-2xl font-semibold text-emerald-700">100%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 border border-amber-500/20 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-xs font-medium text-slate-400">Support Response</span>
            <span className="block text-2xl font-semibold text-amber-600">4 min</span>
          </div>
        </div>

      </div>

      {/* Search Input */}
      <div className="flex-none">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation, guides, or rules..."
            className="w-full pl-11 pr-5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {filteredTopics.length > 0 ? (
          filteredTopics.map((topic, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200/90 rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-300/90 transition-all min-h-[250px] group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full tracking-wider">
                    {topic.category}
                  </span>
                  <span className="text-xs font-medium text-slate-400">{topic.readTime}</span>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {topic.title}
                  </h4>
                  <p className="text-sm font-medium text-slate-400 leading-relaxed">
                    {topic.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                <button className="text-blue-600 hover:underline text-sm font-semibold cursor-pointer select-none">
                  Read Article &rarr;
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 py-12 text-center text-slate-400 font-medium text-sm">
            No documentation matching your search queries.
          </div>
        )}
      </div>

    </div>
  );
}
