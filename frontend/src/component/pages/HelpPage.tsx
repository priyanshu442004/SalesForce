"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface HelpTopic {
  title: string;
  description: string;
  readTime: string;
  category: "Guides" | "API & Rules" | "Troubleshoot";
  bgClass: string;
}

// Highly reliable inline dynamic counting component
function AnimatedCount({ target, duration = 850, suffix = "" }: { target: number; duration?: number; suffix?: string }) {
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

export default function HelpPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const topics: HelpTopic[] = [
    {
      title: "Data Migration Quickstart Guide",
      description: "Learn how to prepare CSV/JSON files, structure accounts and contacts, and upload schemas securely.",
      readTime: "5 min read",
      category: "Guides",
      bgClass: "bg-blue-50/10 border-blue-500/20 text-[#002BFF]"
    },
    {
      title: "Transformation Logic Reference",
      description: "Complete glossary of text cleanups, date formatting, picklist mapping logic and custom rules.",
      readTime: "8 min read",
      category: "API & Rules",
      bgClass: "bg-purple-50/10 border-purple-500/20 text-purple-600"
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
    <div className="p-5 sm:p-7 lg:p-9 space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white">
      
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
          Help & Support Desk
        </h3>
        <span className="text-[14.5px] font-bold text-slate-400">
          Search our comprehensive technical docs, access user guides, and contact administrators.
        </span>
      </div>

      {/* Dynamic Count Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        
        {/* Metric 1 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-blue-50 border border-blue-500/20 text-[#002BFF] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Documentation Docs</span>
            <span className="block text-[25px] font-black text-[#000839]">
              <AnimatedCount target={38} />
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-purple-50 border border-purple-500/20 text-[#7c3aed] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Video Walkthroughs</span>
            <span className="block text-[25px] font-black text-[#7c3aed]">
              <AnimatedCount target={12} />
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-[#e6f4ea] border border-[#e6f4ea]/45 text-[#137333] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">System Status</span>
            <span className="block text-[25px] font-black text-[#137333]">
              <AnimatedCount target={100} suffix="%" />
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-amber-50 border border-amber-500/20 text-[#d97706] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Support Response</span>
            <span className="block text-[25px] font-black text-[#d97706]">
              <AnimatedCount target={4} suffix=" min" />
            </span>
          </div>
        </div>

      </div>

      {/* Search Input */}
      <div className="flex-none opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation, guides, or rules..."
            className="w-full pl-11 pr-5 py-3.5 rounded-2xl border border-slate-200 text-[#000839] text-[14.5px] font-black placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/10 bg-white"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start opacity-0 animate-scale-up" style={{ animationDelay: "250ms" }}>
        {filteredTopics.length > 0 ? (
          filteredTopics.map((topic, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200/90 rounded-2xl p-6.5 lg:p-7.5 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.008)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.015)] hover:border-slate-300/90 hover:scale-[1.01] transition-all min-h-[250px] group opacity-0 animate-row"
              style={{ animationDelay: `${250 + idx * 60}ms` }}
            >
              <div className="space-y-4.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-black uppercase bg-slate-100 text-slate-500 px-3.5 py-1 rounded-full tracking-wider">
                    {topic.category}
                  </span>
                  <span className="text-[13px] font-bold text-slate-400">{topic.readTime}</span>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-[17px] font-black text-[#000839] group-hover:text-[#002BFF] transition-all">
                    {topic.title}
                  </h4>
                  <p className="text-[13.5px] font-bold text-slate-400 leading-relaxed">
                    {topic.description}
                  </p>
                </div>
              </div>

              <div className="pt-4.5 mt-5 border-t border-slate-100 flex justify-end">
                <button className="text-[#002BFF] hover:underline text-[14px] font-black cursor-pointer select-none">
                  Read Article &rarr;
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 py-12 text-center text-slate-400 font-black">
            No documentation matching your search queries.
          </div>
        )}
      </div>

    </div>
  );
}
