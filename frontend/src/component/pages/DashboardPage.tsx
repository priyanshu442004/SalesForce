"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useMigration } from "@/context/MigrationContext";
import Icon from "../Icon";

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

export default function DashboardPage() {
  const { metricCount, successRateCount } = useMigration();
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [animateProgress, setAnimateProgress] = useState(false);

  useEffect(() => {
    setAnimateProgress(true);
  }, []);

  // Animate standard counters from MigrationContext
  const countProjects = useCountUp(metricCount.projects, 1000, 100);
  const countCompleted = useCountUp(metricCount.completed, 1000, 100);
  const countProgress = useCountUp(metricCount.progress, 1000, 100);
  const countFailed = useCountUp(metricCount.failed, 1000, 100);
  const animatedSuccessRate = useCountUpDecimal(successRateCount, 1000, 100);

  const completedCoords = [
    { x: 30, y: 155 },
    { x: 95, y: 142 },
    { x: 160, y: 120 },
    { x: 225, y: 142 },
    { x: 290, y: 130 },
    { x: 355, y: 132 },
    { x: 420, y: 105 }
  ];

  const inProgressCoords = [
    { x: 30, y: 110 },
    { x: 95, y: 95 },
    { x: 160, y: 95 },
    { x: 225, y: 78 },
    { x: 290, y: 95 },
    { x: 355, y: 78 },
    { x: 420, y: 83 }
  ];

  const chartData = [
    { date: "May 13", inProgress: 20, completed: 6 },
    { date: "May 14", inProgress: 24, completed: 9 },
    { date: "May 15", inProgress: 24, completed: 15 },
    { date: "May 16", inProgress: 28, completed: 11 },
    { date: "May 17", inProgress: 23, completed: 13 },
    { date: "May 18", inProgress: 28, completed: 12 },
    { date: "May 19", inProgress: 27, completed: 20 }
  ];

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden animate-fade-in-up">
      
      <style jsx global>{`
        @keyframes drawStroke {
          from {
            stroke-dasharray: 600;
            stroke-dashoffset: 600;
          }
          to {
            stroke-dasharray: 600;
            stroke-dashoffset: 0;
          }
        }
        @keyframes drawCircleDash {
          from {
            stroke-dashoffset: 414;
          }
          to {
            stroke-dashoffset: ${414 - (414 * successRateCount) / 100};
          }
        }
        .animate-stroke {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: drawStroke 1.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .animate-circle-dash {
          stroke-dasharray: 414;
          stroke-dashoffset: 414;
          animation: drawCircleDash 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
        }
      `}</style>

      {/* Welcome Card Banner (No Emoji) */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-6 lg:p-7 flex items-center gap-6 lg:gap-7 shadow-[0_3px_15px_-1px_rgba(148,163,184,0.04)] flex-none">
        <div className="w-[72px] lg:w-[80px] h-[72px] lg:h-[80px] shrink-0 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-center relative overflow-hidden group shadow-sm">
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
          <h2 className="text-[19px] lg:text-[21px] font-black text-slate-800 tracking-tight leading-snug">Good Morning, Admin</h2>
          <p className="text-[13.5px] lg:text-[14.5px] text-slate-400 leading-normal font-bold">Welcome back to AI-Powered Migration Platform</p>
        </div>
      </div>

      {/* Metrics grid row with increased layout fonts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 flex-none">
        
        {/* Card 1: Total Projects */}
        <div className="bg-[#f8fafc] border border-slate-200/70 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.06)] hover:border-blue-200 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 uppercase tracking-wider">Total Projects</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-blue-100/70 text-blue-600 border border-blue-200/50">
                &uarr; 12%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] tracking-tight leading-none">
                {countProjects}
              </h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-blue-500/[0.03] rounded-full flex items-center justify-center border border-blue-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="database" className="w-8 h-8 text-blue-500/5" />
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="bg-[#f4faf7] border border-emerald-100 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.06)] hover:border-emerald-200 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 uppercase tracking-wider">Completed</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-emerald-100/70 text-emerald-600 border border-emerald-200/50">
                &uarr; 8%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] tracking-tight leading-none">
                {countCompleted}
              </h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-emerald-500/[0.03] rounded-full flex items-center justify-center border border-emerald-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="checkCircle" className="w-8 h-8 text-emerald-500/5" />
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div className="bg-[#fffbf2] border border-amber-100 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(245,158,11,0.06)] hover:border-amber-200 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 uppercase tracking-wider">In Progress</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-amber-100/70 text-amber-600 border border-amber-200/50">
                - 0%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] tracking-tight leading-none">
                {countProgress}
              </h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-amber-500/[0.03] rounded-full flex items-center justify-center border border-amber-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="clock" className="w-8 h-8 text-amber-500/5" />
          </div>
        </div>

        {/* Card 4: Failed */}
        <div className="bg-[#fef5f5] border border-rose-100 p-6 rounded-2xl relative overflow-hidden group shadow-[0_2px_8px_-1px_rgba(148,163,184,0.03)] hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(244,63,94,0.06)] hover:border-rose-200 transition-all duration-300 ease-out cursor-pointer">
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] lg:text-[13px] font-bold text-slate-400 uppercase tracking-wider">Failed</span>
              <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] lg:text-[11.5px] font-black bg-rose-100/70 text-rose-600 border border-rose-200/50">
                &darr; 5%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-[38px] lg:text-[42px] font-black text-[#000839] tracking-tight leading-none">
                {countFailed}
              </h3>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-18 h-18 bg-rose-500/[0.03] rounded-full flex items-center justify-center border border-rose-500/[0.02] transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Icon name="alertCircle" className="w-8 h-8 text-rose-500/5" />
          </div>
        </div>

      </div>

      {/* Charts & Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 flex-1 min-h-[500px] lg:min-h-0">
        
        {/* Migration Activity Line Chart Panel */}
        <div className="lg:col-span-6 bg-white border border-slate-200/60 rounded-2xl p-5 lg:p-6 flex flex-col justify-between shadow-[0_3px_12px_rgba(148,163,184,0.03)] h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 flex-none">
            <h4 className="text-[14px] lg:text-[15px] font-black text-slate-800 tracking-tight">Migration Activity</h4>
            
            {/* Legend dots */}
            <div className="flex items-center gap-3 lg:gap-3.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10.5px] lg:text-[11px] font-bold text-slate-500 uppercase tracking-wide">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-[10.5px] lg:text-[11px] font-bold text-slate-500 uppercase tracking-wide">In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[10.5px] lg:text-[11px] font-bold text-slate-500 uppercase tracking-wide">Failed</span>
              </div>
            </div>
          </div>

          {/* Animated SVG */}
          <div className="relative flex-1 min-h-[220px] lg:min-h-0 w-full mt-4 lg:mt-5 flex items-end">
            <svg className="w-full h-full" viewBox="0 0 450 180" preserveAspectRatio="none">
              
              {/* Horizontal grids */}
              <line x1="0" y1="40" x2="450" y2="40" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="80" x2="450" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="120" x2="450" y2="120" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="160" x2="450" y2="160" stroke="#f1f5f9" strokeWidth="1" />

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

              {/* Area under charts */}
              <path
                d="M 30 110 L 95 95 L 160 95 L 225 78 L 290 95 L 355 78 L 420 83 L 420 160 L 30 160 Z"
                fill="url(#blueUnderlay)"
              />
              <path
                d="M 30 160 L 95 142 L 160 120 L 225 142 L 290 130 L 355 132 L 420 105 L 420 160 L 30 160 Z"
                fill="url(#greenUnderlay)"
              />

              {/* Blue line path with stroke drawing animation */}
              <path
                d="M 30 110 L 95 95 L 160 95 L 225 78 L 290 95 L 355 78 L 420 83"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.8"
                strokeLinecap="round"
                className="animate-stroke"
              />

              {/* Green line path with stroke drawing animation */}
              <path
                d="M 30 155 L 95 142 L 160 120 L 225 142 L 290 130 L 355 132 L 420 105"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.8"
                strokeLinecap="round"
                className="animate-stroke"
                style={{ animationDelay: "200ms" }}
              />

              {/* Blue nodes */}
              {inProgressCoords.map((coord, idx) => (
                <g key={`blue-node-${idx}`}>
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r="5.5"
                    fill="white"
                    stroke="#2563eb"
                    strokeWidth="2.8"
                    className="cursor-pointer transition-all duration-200 hover:r-[7.5px]"
                    onMouseEnter={() => setActiveTooltip(idx)}
                    onMouseLeave={() => setActiveTooltip(null)}
                  />
                  {activeTooltip === idx && (
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="9"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="1.2"
                      strokeOpacity="0.4"
                      className="animate-ping"
                    />
                  )}
                </g>
              ))}

              {/* Green nodes */}
              {completedCoords.map((coord, idx) => (
                <circle
                  key={`green-node-${idx}`}
                  cx={coord.x}
                  cy={coord.y}
                  r="5.5"
                  fill="white"
                  stroke="#10b981"
                  strokeWidth="2.8"
                  className="cursor-pointer transition-all duration-200 hover:r-[7.5px]"
                />
              ))}

            </svg>

            {/* Nodes tooltip hover card */}
            {activeTooltip !== null && (
              <div
                className="absolute bg-slate-900 text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 pointer-events-none animate-scale-in z-20"
                style={{
                  left: `${(inProgressCoords[activeTooltip].x / 450) * 100 - 8}%`,
                  bottom: `${180 - inProgressCoords[activeTooltip].y + 12}px`
                }}
              >
                {chartData[activeTooltip].date}: {chartData[activeTooltip].inProgress} Migrations
              </div>
            )}

            {/* Horizontal Dates Axis */}
            <div className="absolute left-[30px] bottom-[-22px] right-[30px] flex justify-between text-[11px] font-bold text-slate-400 pointer-events-none select-none">
              {chartData.map((d, i) => (
                <span key={i} className="text-center">{d.date}</span>
              ))}
            </div>

            {/* Vertical Guideline Labels */}
            <div className="absolute left-[-15px] top-0 bottom-0 flex flex-col justify-between text-[10px] font-bold text-slate-400 pointer-events-none select-none">
              <span>40</span>
              <span>30</span>
              <span>20</span>
              <span>10</span>
              <span>0</span>
            </div>
          </div>

        </div>

        {/* Success Rate Circle Panel */}
        <div className="lg:col-span-3 bg-white border border-slate-200/60 rounded-2xl p-5 lg:p-6 flex flex-col justify-between items-center shadow-[0_3px_12_rgba(148,163,184,0.03)] h-full overflow-hidden">
          <div className="w-full text-left pb-3.5 border-b border-slate-100 flex-none">
            <h4 className="text-[14px] lg:text-[15px] font-black text-slate-800 tracking-tight">Success Rate</h4>
          </div>

          {/* Vector Donut Circle progress loader */}
          <div className="relative flex-1 flex items-center justify-center my-4 min-h-[180px] lg:min-h-0 w-full group">
            <div className="w-44 h-44 lg:w-48 lg:h-48 relative flex items-center justify-center transition-transform duration-350 group-hover:scale-103">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="66"
                  stroke="#f1f5f9"
                  strokeWidth="13"
                  fill="transparent"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="66"
                  stroke="#0d9488"
                  strokeWidth="13"
                  fill="transparent"
                  className="animate-circle-dash"
                  strokeLinecap="round"
                />
              </svg>
              
              {/* Inside Circle live loading decimals */}
              <div className="absolute text-center space-y-0.5">
                <span className="text-[30px] lg:text-[34px] font-black text-[#000839] tracking-tight leading-none block font-sans">
                  {animatedSuccessRate}%
                </span>
                <p className="text-[11px] lg:text-[12px] font-bold text-slate-400 uppercase tracking-wider">Success</p>
              </div>
            </div>
          </div>

          <div className="w-full h-1 flex-none" />
        </div>

        {/* Quick Actions List Column Panel */}
        <div className="lg:col-span-3 bg-white border border-slate-200/60 rounded-2xl p-5 lg:p-6 flex flex-col justify-between shadow-[0_3px_12_rgba(148,163,184,0.03)] h-full overflow-hidden">
          <div className="w-full text-left pb-3.5 border-b border-slate-100 flex-none">
            <h4 className="text-[14px] lg:text-[15px] font-black text-slate-800 tracking-tight">Quick Actions</h4>
          </div>

          {/* Interactive Flex list with enlarged typography */}
          <div className="flex-1 flex flex-col justify-evenly py-2 space-y-2 lg:space-y-0">
            
            {/* Action 1: New Migration */}
            <Link 
              href="/upload"
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-100/80 text-violet-600 flex items-center justify-center font-bold shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="plus" size={15.5} />
                </div>
                <span className="text-[13.5px] lg:text-[14px] font-black text-slate-700 transition-colors group-hover:text-violet-600">New Migration</span>
              </div>
            </Link>

            {/* Action 2: Upload Files */}
            <Link 
              href="/upload"
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="upload" size={15.5} />
                </div>
                <span className="text-[13.5px] lg:text-[14px] font-black text-slate-700 transition-colors group-hover:text-blue-600">Upload Files</span>
              </div>
            </Link>

            {/* Action 3: Create Template */}
            <Link 
              href="/templates"
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-100/80 text-teal-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="fileText" size={15.5} />
                </div>
                <span className="text-[13.5px] lg:text-[14px] font-black text-slate-700 transition-colors group-hover:text-teal-600">Create Template</span>
              </div>
            </Link>

            {/* Action 4: View Templates */}
            <Link 
              href="/templates"
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-250 hover:bg-slate-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100/90 text-slate-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="folder" size={15.5} />
                </div>
                <span className="text-[13.5px] lg:text-[14px] font-black text-slate-700 transition-colors group-hover:text-slate-900">View Templates</span>
              </div>
            </Link>

            {/* Action 5: Data Dictionary */}
            <Link 
              href="/data-dictionary"
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-500/[0.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group text-left cursor-pointer focus:outline-none"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-100/80 text-sky-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-12">
                  <Icon name="fileCode" size={15.5} />
                </div>
                <span className="text-[13.5px] lg:text-[14px] font-black text-slate-700 transition-colors group-hover:text-sky-600">Data Dictionary</span>
              </div>
            </Link>

          </div>
        </div>

      </div>

    </div>
  );
}
