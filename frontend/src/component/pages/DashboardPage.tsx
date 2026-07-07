"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMigration } from "@/context/MigrationContext";
import Icon from "../Icon";

export default function DashboardPage() {
  const {
    currentUser,
    currentProject,
    currentClient,
    projectList,
    clientList,
    createClient,
    createProject,
    selectClient,
    selectProject,
    revertFileToVersion,
    revertOutputToVersion,
    metricCount,
    successRateCount
  } = useMigration();
  const router = useRouter();
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const switchRef = useRef<HTMLDivElement>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Client dropdown and creation states
  const [selectedClientId, setSelectedClientId] = useState("");
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  // Keep selectedClientId in sync with currentClient or clientList
  useEffect(() => {
    if (currentClient) {
      setSelectedClientId(currentClient.id);
      setShowNewClientInput(false);
    } else if (clientList.length > 0) {
      setSelectedClientId(clientList[0].id);
      setShowNewClientInput(false);
    } else {
      setShowNewClientInput(true);
    }
  }, [currentClient, clientList, isNewProjectOpen]);

  useEffect(() => {
    if (!switchOpen) return;
    const handler = (e: MouseEvent) => {
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) {
        setSwitchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switchOpen]);

  const handleSwitch = async (projectId: string) => {
    setIsSwitching(projectId);
    await selectProject(projectId);
    setSwitchOpen(false);
    setIsSwitching(null);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      let finalClientId = selectedClientId;

      if (showNewClientInput) {
        if (!newClientName.trim()) {
          setIsCreating(false);
          return;
        }
        const createdClient = await createClient(newClientName.trim());
        if (createdClient) {
          finalClientId = createdClient.id;
          await selectClient(createdClient.id);
        } else {
          throw new Error("Failed to create client");
        }
      }

      if (!finalClientId) {
        setIsCreating(false);
        return;
      }

      const project = await createProject(newProjectName.trim(), finalClientId);
      if (project) {
        setNewProjectName("");
        setNewClientName("");
        setShowNewClientInput(false);
        setIsNewProjectOpen(false);
        await selectProject(project.id);
        router.push("/upload");
      }
    } catch (err) {
      console.error("Error creating project:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // ── Real chart data from projectList ──────────────────────────────────────
  const { chartData, inProgressCoords, completedCoords, yMax, yLabels, xPositions } = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const fmtDay = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const data = days.map(day => {
      const dayStr = day.toDateString();
      const inProgress = projectList.filter(
        p => new Date(p.createdAt).toDateString() === dayStr
      ).length;
      const completed = projectList.filter(
        p => p.status === "Completed" && new Date(p.updatedAt).toDateString() === dayStr
      ).length;
      return { date: fmtDay(day), inProgress, completed };
    });

    const maxVal = Math.max(...data.map(d => Math.max(d.inProgress, d.completed)), 1);
    const yMax = Math.ceil(maxVal / 5) * 5 || 5;

    const SVG_TOP = 40;
    const SVG_BOTTOM = 160;
    const yScale = (v: number) => SVG_BOTTOM - (v / yMax) * (SVG_BOTTOM - SVG_TOP);

    const xPos = [30, 95, 160, 225, 290, 355, 420];
    const ipCoords  = data.map((d, i) => ({ x: xPos[i], y: yScale(d.inProgress) }));
    const cmpCoords = data.map((d, i) => ({ x: xPos[i], y: yScale(d.completed) }));

    const labels = [
      yMax,
      Math.round(yMax * 0.75),
      Math.round(yMax * 0.5),
      Math.round(yMax * 0.25),
      0,
    ];

    return {
      chartData: data,
      inProgressCoords: ipCoords,
      completedCoords: cmpCoords,
      yMax,
      yLabels: labels,
      xPositions: xPos,
    };
  }, [projectList]);

  const toPath = (coords: { x: number; y: number }[]) =>
    coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const toFill = (coords: { x: number; y: number }[]) =>
    `${toPath(coords)} L ${coords[coords.length - 1].x} 160 L ${coords[0].x} 160 Z`;

  const circleDashOffset = 414 - (414 * successRateCount) / 100;

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-[#f8fafc] dark:bg-slate-900">

      {/* Welcome Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 lg:p-6 flex items-center gap-5 shadow-sm flex-none">
        <div className="w-16 h-16 shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-center justify-center">
          <svg width="38" height="38" viewBox="0 0 46 46" fill="none">
            <path d="M23 4L5 12.5L23 21L41 12.5L23 4Z" fill="#3b82f6" fillOpacity="0.85" />
            <path d="M5 12.5V19.5L23 28L41 19.5V12.5L23 21L5 12.5Z" fill="#2563eb" fillOpacity="0.95" />
            <path d="M5 21V28L23 36.5L41 28V21L23 29.5L5 21Z" fill="#1d4ed8" />
          </svg>
        </div>

        {/* Greeting */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            Welcome back, {currentUser?.name || ""}
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Salesforce Migration Workspace</p>
        </div>

        {/* Project Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active project display + switch dropdown */}
          <div className="relative" ref={switchRef}>
            <button
              onClick={() => setSwitchOpen(v => !v)}
              className={`flex items-center gap-2 pl-3 pr-2.5 h-9 rounded-lg border text-sm font-medium transition-colors cursor-pointer focus:outline-none ${
                currentProject
                  ? "border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span className="max-w-[160px] truncate">
                {currentProject ? currentProject.name : "No project selected"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 transition-transform ${switchOpen ? "rotate-180" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown */}
            {switchOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Switch Project</p>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {projectList.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-400 text-center">No projects yet.</p>
                  ) : (
                    projectList.map((p) => {
                      const isActive = currentProject?.id === p.id;
                      const isLoading = isSwitching === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => !isActive && handleSwitch(p.id)}
                          disabled={isActive || isLoading}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer focus:outline-none ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-900/20 cursor-default"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${isActive ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"}`}>
                              {p.name}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{p.stage} · {p.status}</p>
                          </div>
                          {isActive && (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide shrink-0">Active</span>
                          )}
                          {isLoading && (
                            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* New Project button */}
          <button
            onClick={() => { setNewProjectName(""); setIsNewProjectOpen(true); }}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-sm font-medium transition-colors cursor-pointer focus:outline-none"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-none">

        <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 p-5 rounded-xl shadow-sm hover:border-blue-200 dark:hover:border-blue-700 transition-colors cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Projects</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800/30">
              &uarr; 12%
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">{metricCount.projects}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 p-5 rounded-xl shadow-sm hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Completed</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/30">
              &uarr; 8%
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">{metricCount.completed}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 p-5 rounded-xl shadow-sm hover:border-amber-200 dark:hover:border-amber-700 transition-colors cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">In Progress</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-800/30">
              — 0%
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">{metricCount.progress}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 p-5 rounded-xl shadow-sm hover:border-rose-200 dark:hover:border-rose-700 transition-colors cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Failed</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-800/30">
              &darr; 5%
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none">{metricCount.failed}</h3>
          </div>
        </div>

      </div>

      {/* Charts & Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-none">

        {/* Migration Activity Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 lg:p-6 flex flex-col justify-between shadow-sm h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 flex-none">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Migration Activity</h4>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Created</span>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-[220px] w-full mt-4 flex items-end">
            <svg className="w-full h-full" viewBox="0 0 450 180" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="40"  x2="450" y2="40"  className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <line x1="0" y1="80"  x2="450" y2="80"  className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <line x1="0" y1="120" x2="450" y2="120" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <line x1="0" y1="160" x2="450" y2="160" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="1" />
              <defs>
                <linearGradient id="blueUnderlay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="greenUnderlay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Fill areas */}
              <path d={toFill(inProgressCoords)}  fill="url(#blueUnderlay)" />
              <path d={toFill(completedCoords)}   fill="url(#greenUnderlay)" />

              {/* Lines */}
              <path d={toPath(inProgressCoords)}  fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d={toPath(completedCoords)}   fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

              {/* In Progress dots */}
              {inProgressCoords.map((coord, idx) => (
                <g key={`blue-node-${idx}`}>
                  <circle
                    cx={coord.x} cy={coord.y} r="4"
                    className="fill-white dark:fill-slate-800"
                    stroke="#2563eb" strokeWidth="2"
                    onMouseEnter={() => setActiveTooltip(idx)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    style={{ cursor: "pointer" }}
                  />
                </g>
              ))}

              {/* Completed dots */}
              {completedCoords.map((coord, idx) => (
                <circle
                  key={`green-node-${idx}`}
                  cx={coord.x} cy={coord.y} r="4"
                  className="fill-white dark:fill-slate-800"
                  stroke="#10b981" strokeWidth="2"
                />
              ))}
            </svg>

            {/* Tooltip */}
            {activeTooltip !== null && (
              <div
                className="absolute bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700 pointer-events-none z-20 space-y-0.5"
                style={{
                  left: `${(xPositions[activeTooltip] / 450) * 100 - 8}%`,
                  bottom: `${180 - inProgressCoords[activeTooltip].y + 14}px`,
                }}
              >
                <p className="text-slate-300 text-[10px]">{chartData[activeTooltip].date}</p>
                <p><span className="text-blue-400">●</span> Created: {chartData[activeTooltip].inProgress}</p>
                <p><span className="text-emerald-400">●</span> Completed: {chartData[activeTooltip].completed}</p>
              </div>
            )}

            {/* X-axis labels */}
            <div className="absolute left-[30px] bottom-[-22px] right-[30px] flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 pointer-events-none select-none">
              {chartData.map((d, i) => <span key={i} className="text-center">{d.date}</span>)}
            </div>

            {/* Y-axis labels */}
            <div className="absolute left-[-18px] top-0 bottom-0 flex flex-col justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 pointer-events-none select-none">
              {yLabels.map((v, i) => <span key={i}>{v}</span>)}
            </div>
          </div>
        </div>

        {/* Success Rate Circle */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 lg:p-6 flex flex-col justify-between items-center shadow-sm h-full overflow-hidden">
          <div className="w-full text-left pb-3 border-b border-slate-100 dark:border-slate-700 flex-none">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Success Rate</h4>
          </div>
          <div className="relative flex-1 flex items-center justify-center my-4 min-h-[180px] w-full">
            <div className="w-40 h-40 lg:w-44 lg:h-44 relative flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="88" cy="88" r="66" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="12" fill="transparent" />
                <circle cx="88" cy="88" r="66" stroke="#0d9488" strokeWidth="12" fill="transparent"
                  strokeDasharray="414" strokeDashoffset={circleDashOffset} strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <span className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none block">
                  {successRateCount}%
                </span>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Success</p>
              </div>
            </div>
          </div>
          <div className="w-full h-1 flex-none" />
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 lg:p-6 flex flex-col justify-between shadow-sm h-full overflow-hidden">
          <div className="w-full text-left pb-3 border-b border-slate-100 dark:border-slate-700 flex-none">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Quick Actions</h4>
          </div>
          <div className="flex-1 flex flex-col justify-between py-1.5 space-y-1">
            <Link href="/upload" className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-blue-100 dark:hover:border-blue-700 hover:bg-blue-50/30 transition-colors group text-left cursor-pointer focus:outline-none">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Icon name="plus" size={14} />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">New Migration</span>
            </Link>
            <Link href="/transformation-workspace" className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50/30 transition-colors group text-left cursor-pointer focus:outline-none">
              <div className="w-8 h-8 rounded-lg bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Icon name="layers" size={14} />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">Transformation Workspace</span>
            </Link>
            <Link href="/projects" className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-700 hover:bg-rose-50/30 transition-colors group text-left cursor-pointer focus:outline-none">
              <div className="w-8 h-8 rounded-lg bg-rose-100/90 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                <Icon name="folder" size={14} />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">Projects</span>
            </Link>
            <Link href="/activity-log" className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-sky-200 dark:hover:border-sky-700 hover:bg-sky-50/30 transition-colors group text-left cursor-pointer focus:outline-none">
              <div className="w-8 h-8 rounded-lg bg-sky-100/80 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Icon name="activity" size={14} />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors">Activity Log</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Version Rollback Control Center */}
      {currentProject && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-5 lg:p-6 shadow-sm space-y-4 flex-none">
          <div className="border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Version Rollback</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Restore files and outputs from Neon S3 history.</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.12em] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2.5 py-1 rounded-full ring-1 ring-blue-100 dark:ring-blue-800/30">
              {currentProject.name}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Uploaded File Versions</h5>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 border border-slate-100 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                {currentProject.files && currentProject.files.length > 0 ? (
                  currentProject.files.map((file: any) => (
                    <div key={file.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0 ${
                            file.slot === "source" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
                            file.slot === "master" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
                            "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          }`}>
                            {file.slot}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate block max-w-[150px]">{file.fileName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(file.uploadedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {file.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30 text-[10px] font-medium">Active</span>
                        ) : (
                          <button onClick={() => revertFileToVersion(file.id)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-medium text-blue-600 dark:text-blue-400 transition-all cursor-pointer">
                            Revert
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 font-medium text-xs">No uploaded file history.</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Generated Output Runs</h5>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 border border-slate-100 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                {currentProject.outputs && currentProject.outputs.length > 0 ? (
                  currentProject.outputs.map((out: any) => (
                    <div key={out.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[9px] font-semibold uppercase shrink-0">
                            {out.fileType.replace("_", " ")}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate block max-w-[150px]">{out.fileName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(out.generatedAt).toLocaleString()} {out.recordsCount > 0 ? `(${out.recordsCount} records)` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {out.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30 text-[10px] font-medium">Active</span>
                        ) : (
                          <button onClick={() => revertOutputToVersion(out.id)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-medium text-blue-600 dark:text-blue-400 transition-all cursor-pointer">
                            Revert
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 font-medium text-xs">No generated output runs history.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isNewProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">New Migration Project</h3>
              <button
                onClick={() => setIsNewProjectOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {/* Client Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Client</label>
                {!showNewClientInput ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="flex-1 px-3 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white dark:bg-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                    >
                      {clientList.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                      {clientList.length === 0 && (
                        <option value="" disabled>No clients found</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewClientInput(true)}
                      className="px-3 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      + New
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required={showNewClientInput}
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="New Client Name (e.g., Acme Corp)"
                        className="flex-1 px-3 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white dark:bg-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      />
                      {clientList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewClientInput(false);
                            setNewClientName("");
                          }}
                          className="px-3 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Choose Existing
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Project Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Enterprise Migration Phase 1"
                  className="w-full px-4 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white dark:bg-slate-700 dark:placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewProjectOpen(false)}
                  className="px-4 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newProjectName.trim() || (showNewClientInput && !newClientName.trim()) || (!showNewClientInput && !selectedClientId)}
                  className="px-5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
