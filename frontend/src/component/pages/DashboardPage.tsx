"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useMigration } from "@/context/MigrationContext";
import Icon from "../Icon";

function useCountUp(target: number, duration: number = 800, delay: number = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTimestamp: number | null = null;
    let timerId: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) timerId = requestAnimationFrame(step);
      else setCount(target);
    };
    const delayTimer = setTimeout(() => { timerId = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(delayTimer); cancelAnimationFrame(timerId); };
  }, [target, duration, delay]);
  return count;
}

function useCountUpDecimal(target: number, duration: number = 800, delay: number = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTimestamp: number | null = null;
    let timerId: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.round(progress * target * 10) / 10);
      if (progress < 1) timerId = requestAnimationFrame(step);
      else setCount(target);
    };
    const delayTimer = setTimeout(() => { timerId = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(delayTimer); cancelAnimationFrame(timerId); };
  }, [target, duration, delay]);
  return count;
}

export default function DashboardPage() {
  const { currentUser, currentProject, revertFileToVersion, revertOutputToVersion, metricCount, successRateCount } = useMigration();
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [animateProgress, setAnimateProgress] = useState(false);

  useEffect(() => { setAnimateProgress(true); }, []);

  const countProjects = useCountUp(metricCount.projects, 1000, 100);
  const countCompleted = useCountUp(metricCount.completed, 1000, 100);
  const countProgress = useCountUp(metricCount.progress, 1000, 100);
  const countFailed = useCountUp(metricCount.failed, 1000, 100);
  const animatedSuccessRate = useCountUpDecimal(successRateCount, 1000, 100);

  const completedCoords = [
    { x: 30, y: 155 }, { x: 95, y: 142 }, { x: 160, y: 120 },
    { x: 225, y: 142 }, { x: 290, y: 130 }, { x: 355, y: 132 }, { x: 420, y: 105 }
  ];
  const inProgressCoords = [
    { x: 30, y: 110 }, { x: 95, y: 95 }, { x: 160, y: 95 },
    { x: 225, y: 78 }, { x: 290, y: 95 }, { x: 355, y: 78 }, { x: 420, y: 83 }
  ];
  const chartData = [
    { date: "May 13", inProgress: 20, completed: 6 }, { date: "May 14", inProgress: 24, completed: 9 },
    { date: "May 15", inProgress: 24, completed: 15 }, { date: "May 16", inProgress: 28, completed: 11 },
    { date: "May 17", inProgress: 23, completed: 13 }, { date: "May 18", inProgress: 28, completed: 12 },
    { date: "May 19", inProgress: 27, completed: 20 }
  ];

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white dark:bg-[#0F172A]">

      <style jsx global>{`
        @keyframes drawStroke {
          from { stroke-dasharray: 600; stroke-dashoffset: 600; }
          to { stroke-dasharray: 600; stroke-dashoffset: 0; }
        }
        @keyframes drawCircleDash {
          from { stroke-dashoffset: 414; }
          to { stroke-dashoffset: ${414 - (414 * successRateCount) / 100}; }
        }
        .animate-stroke { stroke-dasharray: 600; stroke-dashoffset: 600; animation: drawStroke 1.6s cubic-bezier(0.4,0,0.2,1) forwards; }
        .animate-circle-dash { stroke-dasharray: 414; stroke-dashoffset: 414; animation: drawCircleDash 1.5s cubic-bezier(0.4,0,0.2,1) 0.1s forwards; }
      `}</style>

      {/* Welcome Card */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-2xl p-6 lg:p-7 flex items-center gap-6 lg:gap-7 shadow-[0_3px_15px_-1px_rgba(148,163,184,0.04)] flex-none">
        <div className="w-[72px] lg:w-[80px] h-[72px] lg:h-[80px] shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30 flex items-center justify-center relative overflow-hidden group shadow-sm">
          <svg width="44" height="44" viewBox="0 0 46 46" fill="none" className="transform group-hover:scale-108 transition-transform duration-500">
            <path d="M23 4L5 12.5L23 21L41 12.5L23 4Z" fill="#3b82f6" fillOpacity="0.85" />
            <path d="M5 12.5V19.5L23 28L41 19.5V12.5L23 21L5 12.5Z" fill="#2563eb" fillOpacity="0.95" />
            <path d="M5 21V28L23 36.5L41 28V21L23 29.5L5 21Z" fill="#1d4ed8" />
            <circle cx="23" cy="12.5" r="1.5" fill="#93c5fd" />
            <circle cx="14" cy="16.7" r="1" fill="#93c5fd" />
            <circle cx="32" cy="16.7" r="1" fill="#93c5fd" />
            <circle cx="23" cy="21" r="1.5" fill="#93c5fd" />
            <circle cx="23" cy="29.5" r="1.5" fill="#60a5fa" />
          </svg>
        </div>
        <div className="space-y-0.5">
          <h2 className="text-[19px] lg:text-[21px] font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
            Good Morning, {currentUser?.name || "Tester"}
          </h2>
          <p className="text-[13.5px] lg:text-[14.5px] text-slate-400 dark:text-slate-400 leading-normal font-bold">Welcome back to AI-Powered Migration Platform</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 flex-none">

        <div className="bg-[#f8fafc] dark:bg-[#1E293B] border border-slate-200/70 dark:border-slate-700 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.06)] hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Projects</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-blue-100/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/30">
                &uarr; 12%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] dark:text-white tracking-tight leading-none">{countProjects}</h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-blue-500/[0.03] rounded-full flex items-center justify-center border border-blue-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="database" className="w-8 h-8 text-blue-500/5" />
          </div>
        </div>

        <div className="bg-[#f4faf7] dark:bg-[#1E293B] border border-emerald-100 dark:border-slate-700 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.06)] hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Completed</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30">
                &uarr; 8%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] dark:text-white tracking-tight leading-none">{countCompleted}</h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-emerald-500/[0.03] rounded-full flex items-center justify-center border border-emerald-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="checkCircle" className="w-8 h-8 text-emerald-500/5" />
          </div>
        </div>

        <div className="bg-[#fffbf2] dark:bg-[#1E293B] border border-amber-100 dark:border-slate-700 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(245,158,11,0.06)] hover:border-amber-200 dark:hover:border-amber-700 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">In Progress</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-amber-100/70 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border border-amber-200/50 dark:border-amber-700/30">
                - 0%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] dark:text-white tracking-tight leading-none">{countProgress}</h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-amber-500/[0.03] rounded-full flex items-center justify-center border border-amber-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="clock" className="w-8 h-8 text-amber-500/5" />
          </div>
        </div>

        <div className="bg-[#fef5f5] dark:bg-[#1E293B] border border-rose-100 dark:border-slate-700 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(244,63,94,0.06)] hover:border-rose-200 dark:hover:border-rose-700 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Failed</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-rose-100/70 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 border border-rose-200/50 dark:border-rose-700/30">
                &darr; 5%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] dark:text-white tracking-tight leading-none">{countFailed}</h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-rose-500/[0.03] rounded-full flex items-center justify-center border border-rose-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="alertCircle" className="w-8 h-8 text-rose-500/5" />
          </div>
        </div>

      </div>

      {/* Charts & Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 flex-none">

        {/* Migration Activity Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-2xl p-5 lg:p-6 flex flex-col justify-between shadow-[0_3px_12px_rgba(148,163,184,0.03)] h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-700 flex-none">
            <h4 className="text-[14px] lg:text-[15px] font-black text-slate-800 dark:text-slate-100 tracking-tight">Migration Activity</h4>
            <div className="flex items-center gap-3 lg:gap-3.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10.5px] lg:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-[10.5px] lg:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[10.5px] lg:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Failed</span>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-[220px] w-full mt-4 lg:mt-5 flex items-end">
            <svg className="w-full h-full" viewBox="0 0 450 180" preserveAspectRatio="none">
              <line x1="0" y1="40" x2="450" y2="40" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <line x1="0" y1="80" x2="450" y2="80" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <line x1="0" y1="120" x2="450" y2="120" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <line x1="0" y1="160" x2="450" y2="160" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <defs>
                <linearGradient id="blueUnderlay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="greenUnderlay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 30 110 L 95 95 L 160 95 L 225 78 L 290 95 L 355 78 L 420 83 L 420 160 L 30 160 Z" fill="url(#blueUnderlay)" />
              <path d="M 30 160 L 95 142 L 160 120 L 225 142 L 290 130 L 355 132 L 420 105 L 420 160 L 30 160 Z" fill="url(#greenUnderlay)" />
              <path d="M 30 110 L 95 95 L 160 95 L 225 78 L 290 95 L 355 78 L 420 83" fill="none" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round" className="animate-stroke" />
              <path d="M 30 155 L 95 142 L 160 120 L 225 142 L 290 130 L 355 132 L 420 105" fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" className="animate-stroke" style={{ animationDelay: "200ms" }} />
              {inProgressCoords.map((coord, idx) => (
                <g key={`blue-node-${idx}`}>
                  <circle cx={coord.x} cy={coord.y} r="5.5" className="fill-white dark:fill-[#1E293B]" stroke="#2563eb" strokeWidth="2.8"
                    onMouseEnter={() => setActiveTooltip(idx)} onMouseLeave={() => setActiveTooltip(null)} />
                  {activeTooltip === idx && (
                    <circle cx={coord.x} cy={coord.y} r="9" fill="none" stroke="#2563eb" strokeWidth="1.2" strokeOpacity="0.4" className="animate-ping" />
                  )}
                </g>
              ))}
              {completedCoords.map((coord, idx) => (
                <circle key={`green-node-${idx}`} cx={coord.x} cy={coord.y} r="5.5" className="fill-white dark:fill-[#1E293B]" stroke="#10b981" strokeWidth="2.8" />
              ))}
            </svg>

            {activeTooltip !== null && (
              <div className="absolute bg-slate-900 text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 pointer-events-none animate-scale-in z-20"
                style={{ left: `${(inProgressCoords[activeTooltip].x / 450) * 100 - 8}%`, bottom: `${180 - inProgressCoords[activeTooltip].y + 12}px` }}>
                {chartData[activeTooltip].date}: {chartData[activeTooltip].inProgress} Migrations
              </div>
            )}

            <div className="absolute left-[30px] bottom-[-22px] right-[30px] flex justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 pointer-events-none select-none">
              {chartData.map((d, i) => <span key={i} className="text-center">{d.date}</span>)}
            </div>
            <div className="absolute left-[-15px] top-0 bottom-0 flex flex-col justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 pointer-events-none select-none">
              <span>40</span><span>30</span><span>20</span><span>10</span><span>0</span>
            </div>
          </div>
        </div>

        {/* Success Rate Circle */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-2xl p-5 lg:p-6 flex flex-col justify-between items-center shadow-[0_3px_12_rgba(148,163,184,0.03)] h-full overflow-hidden">
          <div className="w-full text-left pb-3.5 border-b border-slate-100 dark:border-slate-700 flex-none">
            <h4 className="text-[14px] lg:text-[15px] font-black text-slate-800 dark:text-slate-100 tracking-tight">Success Rate</h4>
          </div>
          <div className="relative flex-1 flex items-center justify-center my-4 min-h-[180px] w-full group">
            <div className="w-44 h-44 lg:w-48 lg:h-48 relative flex items-center justify-center transition-transform duration-350 group-hover:scale-103">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="88" cy="88" r="66" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="13" fill="transparent" />
                <circle cx="88" cy="88" r="66" stroke="#0d9488" strokeWidth="13" fill="transparent" className="animate-circle-dash" strokeLinecap="round" />
              </svg>
              <div className="absolute text-center space-y-0.5">
                <span className="text-[30px] lg:text-[34px] font-black text-[#000839] dark:text-white tracking-tight leading-none block font-sans">
                  {animatedSuccessRate}%
                </span>
                <p className="text-[11px] lg:text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Success</p>
              </div>
            </div>
          </div>
          <div className="w-full h-1 flex-none" />
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-2xl p-5 lg:p-6 flex flex-col justify-between shadow-[0_3px_12_rgba(148,163,184,0.03)] h-full overflow-hidden">
          <div className="w-full text-left pb-3.5 border-b border-slate-100 dark:border-slate-700 flex-none">
            <h4 className="text-[14px] lg:text-[15px] font-black text-slate-800 dark:text-slate-100 tracking-tight">Quick Actions</h4>
          </div>
          <div className="flex-1 flex flex-col justify-between py-1.5 space-y-2 lg:space-y-0.5">
            <Link href="/upload" className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-700 hover:bg-violet-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none">
              <div className="flex flex-1 items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-full bg-violet-100/80 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex items-center justify-center font-bold shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="plus" size={14} />
                </div>
                <span className="text-[12.5px] lg:text-[13px] font-black text-slate-700 dark:text-slate-200 transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300">New Migration</span>
              </div>
            </Link>
            <Link href="/transformation-workspace" className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none">
              <div className="flex flex-1 items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-full bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="layers" size={14} />
                </div>
                <span className="text-[12.5px] lg:text-[13px] font-black text-slate-700 dark:text-slate-200 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-300">Transformation Workspace</span>
              </div>
            </Link>
            <Link href="/projects" className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-700 hover:bg-rose-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none">
              <div className="flex flex-1 items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-full bg-rose-100/90 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="folder" size={14} />
                </div>
                <span className="text-[12.5px] lg:text-[13px] font-black text-slate-700 dark:text-slate-200 transition-colors group-hover:text-rose-600 dark:group-hover:text-rose-300">Projects</span>
              </div>
            </Link>
            <Link href="/activity-log" className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-sky-200 dark:hover:border-sky-700 hover:bg-sky-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none">
              <div className="flex flex-1 items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-full bg-sky-100/80 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="activity" size={14} />
                </div>
                <span className="text-[12.5px] lg:text-[13px] font-black text-slate-700 dark:text-slate-200 transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-300">Activity Log</span>
              </div>
            </Link>
          </div>
        </div>

      </div>

      {/* Version Rollback Control Center */}
      {currentProject && (
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-700 rounded-2xl p-5 lg:p-6 shadow-[0_3px_12px_rgba(148,163,184,0.03)] space-y-4 flex-none">
          <div className="border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center justify-between">
            <div>
              <h4 className="text-[15px] font-black text-slate-800 dark:text-slate-100 tracking-tight">Project Version Rollback Control Center</h4>
              <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500">Restore or roll back files and outputs dynamically from Neon S3 history.</p>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full ring-1 ring-blue-100 dark:ring-blue-800/30">
              {currentProject.name}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h5 className="text-[13px] font-black text-slate-700 dark:text-slate-200">Uploaded File Versions</h5>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 border border-slate-100 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                {currentProject.files && currentProject.files.length > 0 ? (
                  currentProject.files.map((file: any) => (
                    <div key={file.id} className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                            file.slot === "source" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
                            file.slot === "master" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
                            "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                          }`}>
                            {file.slot}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[150px]">{file.fileName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(file.uploadedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {file.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30 text-[10px] font-black">Active</span>
                        ) : (
                          <button onClick={() => revertFileToVersion(file.id)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-black text-blue-600 dark:text-blue-400 transition-all cursor-pointer">
                            Revert
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 font-bold text-xs">No uploaded file history.</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-[13px] font-black text-slate-700 dark:text-slate-200">Generated Output Runs</h5>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 border border-slate-100 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                {currentProject.outputs && currentProject.outputs.length > 0 ? (
                  currentProject.outputs.map((out: any) => (
                    <div key={out.id} className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase shrink-0">
                            {out.fileType.replace("_", " ")}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[150px]">{out.fileName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(out.generatedAt).toLocaleString()} {out.recordsCount > 0 ? `(${out.recordsCount} records)` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {out.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30 text-[10px] font-black">Active</span>
                        ) : (
                          <button onClick={() => revertOutputToVersion(out.id)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-black text-blue-600 dark:text-blue-400 transition-all cursor-pointer">
                            Revert
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 font-bold text-xs">No generated output runs history.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
