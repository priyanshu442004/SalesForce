"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface TemplateItem {
  title: string;
  description: string;
  mappingsCount: number;
  rulesCount: number;
  category: "Standard CRM" | "Industry Cloud" | "Nonprofit";
  tag: string;
  iconBg: string;
  iconText: string;
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

export default function TemplatesPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const templates: TemplateItem[] = [
    {
      title: "Sales Cloud B2B Baseline",
      description: "Standard Salesforce B2B schema mapping for high-performance Accounts, Contacts, and Opportunities.",
      mappingsCount: 85,
      rulesCount: 8,
      category: "Standard CRM",
      tag: "Popular",
      iconBg: "bg-blue-50 border-blue-500/20 text-[#002BFF]",
      iconText: "SC"
    },
    {
      title: "Salesforce NPSP Baseline",
      description: "Nonprofit Success Pack custom relationship mapping schema featuring Households and Donations.",
      mappingsCount: 120,
      rulesCount: 12,
      category: "Nonprofit",
      tag: "Standard",
      iconBg: "bg-[#e6f4ea] border-[#e6f4ea]/45 text-[#137333]",
      iconText: "NP"
    },
    {
      title: "Financial Services Cloud Baseline",
      description: "FSC standard core mappings for financial accounts, wealth assets, and household structures.",
      mappingsCount: 190,
      rulesCount: 25,
      category: "Industry Cloud",
      tag: "Enterprise",
      iconBg: "bg-purple-50 border-purple-500/20 text-purple-600",
      iconText: "FS"
    },
    {
      title: "Health Cloud Patient Baseline",
      description: "Clinical patient records, practitioner links, care plans, and health encounters schema mapping.",
      mappingsCount: 240,
      rulesCount: 32,
      category: "Industry Cloud",
      tag: "Enterprise",
      iconBg: "bg-amber-50 border-amber-500/20 text-amber-600",
      iconText: "HC"
    },
    {
      title: "Standard CRM Core",
      description: "Baseline standard model for simple systems containing legacy Accounts and Contacts maps.",
      mappingsCount: 45,
      rulesCount: 5,
      category: "Standard CRM",
      tag: "Minimal",
      iconBg: "bg-slate-100 border-slate-200 text-slate-600",
      iconText: "CR"
    }
  ];

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
          Configuration Templates
        </h3>
        <span className="text-[14.5px] font-bold text-slate-400">
          Access customized mapping schemas, pre-defined rules, and reusable column maps.
        </span>
      </div>

      {/* Dynamic Count Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none opacity-0 animate-scale-up" style={{ animationDelay: "150ms" }}>
        
        {/* Metric 1 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-blue-50 border border-blue-500/20 text-[#002BFF] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Available Blueprints</span>
            <span className="block text-[25px] font-black text-[#000839]">
              <AnimatedCount target={5} />
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-purple-50 border border-purple-500/20 text-[#7c3aed] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Pre-built Mappings</span>
            <span className="block text-[25px] font-black text-[#7c3aed]">
              <AnimatedCount target={680} />
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-[#e6f4ea] border border-[#e6f4ea]/45 text-[#137333] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Logic Rules Included</span>
            <span className="block text-[25px] font-black text-[#137333]">
              <AnimatedCount target={82} />
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
          <div className="w-12 h-12 bg-amber-50 border border-amber-500/20 text-[#d97706] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[13.5px] font-bold text-slate-400">Blueprint Actions</span>
            <span className="block text-[25px] font-black text-[#d97706]">
              <AnimatedCount target={14} />
            </span>
          </div>
        </div>

      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start opacity-0 animate-scale-up" style={{ animationDelay: "200ms" }}>
        {templates.map((template, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200/90 rounded-2xl p-6.5 lg:p-7.5 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.008)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.015)] hover:border-slate-300/90 hover:scale-[1.01] transition-all group min-h-[250px] opacity-0 animate-row"
            style={{ animationDelay: `${250 + idx * 60}ms` }}
          >
            <div className="space-y-4.5">
              
              {/* Header inside card */}
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 ${template.iconBg} border rounded-xl flex items-center justify-center font-black text-[15px]`}>
                  {template.iconText}
                </div>
                <span className="bg-slate-100 text-slate-500 font-black text-[12px] px-3.5 py-1 rounded-full uppercase tracking-wider">
                  {template.tag}
                </span>
              </div>

              {/* Title & Desc */}
              <div className="space-y-1.5">
                <h4 className="text-[17px] font-black text-[#000839] group-hover:text-[#002BFF] transition-all">
                  {template.title}
                </h4>
                <p className="text-[13.5px] font-bold text-slate-400 leading-relaxed">
                  {template.description}
                </p>
              </div>

            </div>

            {/* Counters and action */}
            <div className="pt-4.5 mt-5 border-t border-slate-100 flex items-center justify-between text-[14.5px]">
              <div className="flex items-center gap-3.5 text-slate-400 font-black">
                <span>{template.mappingsCount} Maps</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span>{template.rulesCount} Rules</span>
              </div>
              <button className="text-[#002BFF] hover:underline font-black cursor-pointer select-none">
                Use Template
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
