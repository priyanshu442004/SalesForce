"use client";

import React, { useState } from "react";
import Icon from "../Icon";
import { useMigration } from "../../context/MigrationContext";

interface TransformationRule {
  sourceColumn: string;
  targetField: string;
  transformation: string;
  preview: string;
  status: "Executed" | "Pending";
}

interface ObjectDataset {
  total: number;
  mapped: number;
  unmapped: number;
  transformations: number;
  rules: TransformationRule[];
}

interface LibraryCard {
  title: string;
  description: string;
  category: "Data Cleaning" | "Date & Time" | "Text" | "Number" | "Lookups & Join" | "Business Logic";
  colorClass: string;
  bgIconClass: string;
  iconSvg: React.ReactNode;
}

export default function TransformationsPage() {
  const { transformationsView, setTransformationsView, transformationsTab, setTransformationsTab } = useMigration();
  const [selectedObject, setSelectedObject] = useState<string>("Account");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Search filter and Category filter states for the Library
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activePage, setActivePage] = useState<number>(0);

  // New rule form states for listing modal
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newTrans, setNewTrans] = useState("Trim, Title Case");
  const [newPreview, setNewPreview] = useState("");
  const [newStatus, setNewStatus] = useState<"Executed" | "Pending">("Executed");

  // Create Sub-module states (Section 2)
  const [transType, setTransType] = useState("Date Conversion");
  const [inputFormat, setInputFormat] = useState("DD/MM/YYYY");
  const [outputFormat, setOutputFormat] = useState("YYYY-MM-DD");
  const [handleNulls, setHandleNulls] = useState(true);
  const [defaultValOption, setDefaultValOption] = useState(true);
  const [trimSpaces, setTrimSpaces] = useState(true);

  // Interactive Approval State
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // Human Feedback Loop sub-module states
  const [feedbackMappings, setFeedbackMappings] = useState([
    { source: "Business", target: "B2B" },
    { source: "Individual", target: "B2C" },
    { source: "Partner", target: "Partner" },
    { source: "Others", target: "Other" }
  ]);
  const [feedbackNotes, setFeedbackNotes] = useState("");

  const handleAddFeedbackRow = () => {
    setFeedbackMappings(prev => [...prev, { source: "Business", target: "B2B" }]);
  };
  const handleUpdateFeedbackSource = (index: number, val: string) => {
    setFeedbackMappings(prev => prev.map((m, i) => i === index ? { ...m, source: val } : m));
  };
  const handleUpdateFeedbackTarget = (index: number, val: string) => {
    setFeedbackMappings(prev => prev.map((m, i) => i === index ? { ...m, target: val } : m));
  };

  const handleTabChange = (tabName: string) => {
    setTransformationsTab(tabName);
    if (tabName !== "Transformation Center") {
      setTransformationsView("list");
    }
  };

  // Multi-object dataset for real-time interactive switching
  const [datasets, setDatasets] = useState<Record<string, ObjectDataset>>({
    Account: {
      total: 50,
      mapped: 40,
      unmapped: 6,
      transformations: 10,
      rules: [
        { sourceColumn: "Customer Name", targetField: "Name", transformation: "Trim, Title Case", preview: "ACME CORP", status: "Executed" },
        { sourceColumn: "Start Date", targetField: "Start_Date__c", transformation: "Date: DD/MM/YYYY to YYYY-MM-DD", preview: "2024-05-05", status: "Executed" },
        { sourceColumn: "Account Type", targetField: "Type", transformation: "Picklist Mapping", preview: "Business", status: "Executed" },
        { sourceColumn: "Phone No", targetField: "Phone", transformation: "Phone Cleanup", preview: "(125) 456-7890", status: "Pending" },
        { sourceColumn: "Customer Code", targetField: "External_ID__c", transformation: "No Transformation", preview: "CUST001", status: "Executed" },
        { sourceColumn: "Account Owner", targetField: "OwnerId", transformation: "VLOOKUP (User)", preview: "John Smith", status: "Pending" },
        { sourceColumn: "Annual Revenue", targetField: "AnnualRevenue", transformation: "Number Format", preview: "2500000", status: "Executed" }
      ]
    },
    Contact: {
      total: 35,
      mapped: 28,
      unmapped: 4,
      transformations: 6,
      rules: [
        { sourceColumn: "First Name", targetField: "FirstName", transformation: "Trim", preview: "John", status: "Executed" },
        { sourceColumn: "Last Name", targetField: "LastName", transformation: "Trim, Title Case", preview: "Doe", status: "Executed" },
        { sourceColumn: "Mail Address", targetField: "MailingStreet", transformation: "Concatenate", preview: "123 Main St", status: "Pending" },
        { sourceColumn: "Mobile No", targetField: "MobilePhone", transformation: "Phone Cleanup", preview: "(987) 654-3210", status: "Executed" }
      ]
    },
    Opportunity: {
      total: 42,
      mapped: 32,
      unmapped: 7,
      transformations: 8,
      rules: [
        { sourceColumn: "Deal Value", targetField: "Amount", transformation: "Float Conversion", preview: "50000.00", status: "Executed" },
        { sourceColumn: "Stage Name", targetField: "StageName", transformation: "Standardize Value", preview: "Prospecting", status: "Executed" },
        { sourceColumn: "Closed Date", targetField: "CloseDate", transformation: "Date Format", preview: "2025-12-31", status: "Pending" }
      ]
    }
  });

  const activeData = datasets[selectedObject] || datasets["Account"];

  const handleAddTransformation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource || !newTarget || !newPreview) return;

    const newRule: TransformationRule = {
      sourceColumn: newSource,
      targetField: newTarget,
      transformation: newTrans,
      preview: newPreview,
      status: newStatus
    };

    setDatasets(prev => {
      const currentDataset = prev[selectedObject];
      const updatedRules = [newRule, ...currentDataset.rules];
      return {
        ...prev,
        [selectedObject]: {
          total: currentDataset.total + 1,
          mapped: newStatus === "Executed" ? currentDataset.mapped + 1 : currentDataset.mapped,
          unmapped: newStatus === "Pending" ? currentDataset.unmapped + 1 : currentDataset.unmapped,
          transformations: currentDataset.transformations + 1,
          rules: updatedRules
        }
      };
    });

    setNewSource("");
    setNewTarget("");
    setNewPreview("");
    setShowAddModal(false);
  };

  const handleSaveSubmoduleTransformation = () => {
    const customRule: TransformationRule = {
      sourceColumn: "Start Date",
      targetField: "Start_Date__c",
      transformation: `Date: ${inputFormat} to ${outputFormat}`,
      preview: "2024-05-05",
      status: "Executed"
    };

    setDatasets(prev => {
      const currentDataset = prev["Account"];
      const dup = currentDataset.rules.some(r => r.sourceColumn === "Start Date" && r.transformation.includes(inputFormat));
      if (dup) {
        setTransformationsView("list");
        return prev;
      }
      const updatedRules = [customRule, ...currentDataset.rules];
      return {
        ...prev,
        Account: {
          total: currentDataset.total + 1,
          mapped: currentDataset.mapped + 1,
          unmapped: Math.max(0, currentDataset.unmapped - 1),
          transformations: currentDataset.transformations + 1,
          rules: updatedRules
        }
      };
    });

    setTransformationsView("list");
  };

  const handleApproveExecution = () => {
    setShowSuccessOverlay(true);
    setTimeout(() => {
      setShowSuccessOverlay(false);
      handleTabChange("Transformation Center");
    }, 1500);
  };

  const tabs = [
    { name: "Transformation Center", icon: "database" },
    { name: "Transformation Library", icon: "folder" },
    { name: "Preview Engine", icon: "help" }, 
    { name: "Human Feedback Loop", icon: "activity" }, 
    { name: "Execution Engine", icon: "settings" },
    { name: "Audit Log", icon: "fileText" }
  ];

  const libraryCategories = [
    "All",
    "Data Cleaning",
    "Date & Time",
    "Text",
    "Number",
    "Lookups & Join",
    "Business Logic"
  ];

  const libraryCards: LibraryCard[] = [
    {
      title: "Trim",
      description: "Remove leading and trailing spaces",
      category: "Data Cleaning",
      colorClass: "text-emerald-700",
      bgIconClass: "bg-emerald-50 border-[#e6f4ea]/45",
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 2v20M17 5l-5-5-5 5" />
        </svg>
      )
    },
    {
      title: "Upper Case",
      description: "Convert text to uppercase",
      category: "Text",
      colorClass: "text-blue-600",
      bgIconClass: "bg-[#e0e7ff] border-[#e0e7ff]/40",
      iconSvg: (
        <span className="text-[17px] font-semibold leading-none tracking-tight">AK</span>
      )
    },
    {
      title: "Lower Case",
      description: "Convert text to lowercase",
      category: "Text",
      colorClass: "text-blue-600",
      bgIconClass: "bg-[#e0e7ff] border-[#e0e7ff]/40",
      iconSvg: (
        <span className="text-[17px] font-semibold leading-none tracking-tight">Ac</span>
      )
    },
    {
      title: "Date Conversion",
      description: "Convert date format",
      category: "Date & Time",
      colorClass: "text-[#c2410c]",
      bgIconClass: "bg-[#fff7ed] border-[#fff7ed]/50",
      iconSvg: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    {
      title: "Picklist Mapping",
      description: "Map values to picklist",
      category: "Lookups & Join",
      colorClass: "text-violet-600",
      bgIconClass: "bg-[#faf5ff] border-[#faf5ff]/50",
      iconSvg: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    },
    {
      title: "VLOOKUP (Lookup)",
      description: "Lookup and fetch values",
      category: "Lookups & Join",
      colorClass: "text-blue-600",
      bgIconClass: "bg-[#e0e7ff] border-[#e0e7ff]/40",
      iconSvg: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )
    },
    {
      title: "Remove Duplicates",
      description: "Remove duplicate records",
      category: "Data Cleaning",
      colorClass: "text-rose-600",
      bgIconClass: "bg-rose-50 border-[#fff5f5]/55",
      iconSvg: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )
    },
    {
      title: "Merge Columns",
      description: "Merge multiple columns",
      category: "Lookups & Join",
      colorClass: "text-[#c2410c]",
      bgIconClass: "bg-[#fff7ed] border-[#fff7ed]/50",
      iconSvg: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <path d="M12 22V2M17 5l-5-5-5 5M7 19l5 5 5-5" />
        </svg>
      )
    },
    {
      title: "Conditional Logic",
      description: "IF/ELSE conditions",
      category: "Business Logic",
      colorClass: "text-emerald-700",
      bgIconClass: "bg-emerald-50 border-[#e6f4ea]/45",
      iconSvg: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <polygon points="12 2 22 12 12 22 2 12 12 2" />
        </svg>
      )
    },
    {
      title: "Impute Value",
      description: "Set default values",
      category: "Business Logic",
      colorClass: "text-[#0891b2]",
      bgIconClass: "bg-[#ecfeff] border-[#ecfeff]/50",
      iconSvg: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        </svg>
      )
    },
    {
      title: "Default Value",
      description: "Set default values",
      category: "Business Logic",
      colorClass: "text-[#0f172a]",
      bgIconClass: "bg-[#f1f5f9] border-[#f1f5f9]/55",
      iconSvg: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      )
    },
    {
      title: "Text Replace",
      description: "Find and replace text",
      category: "Text",
      colorClass: "text-blue-600",
      bgIconClass: "bg-[#e0e7ff] border-[#e0e7ff]/40",
      iconSvg: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3" />
        </svg>
      )
    }
  ];

  const filteredCards = libraryCards.filter(card => {
    const matchesCat = selectedCategory === "All" || card.category === selectedCategory;
    const matchesSearch = card.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          card.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-5 sm:p-7 lg:p-9 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white dark:bg-[#0F172A]">
      
      {/* Persistent success Overlay */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[3px] z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-700 rounded-xl p-7 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[17px] font-semibold text-slate-900 dark:text-white">Transformation Approved for Execution!</span>
          </div>
        </div>
      )}

      {/* Top Page Sub-navigation tabs (Mockup exact layout and larger sizes) */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 border-b border-slate-100/50 dark:border-slate-700/50 flex-none">
        {tabs.map((tab, idx) => {
          const isActive = transformationsTab === tab.name;
          return (
            <button
              key={idx}
              onClick={() => handleTabChange(tab.name)}
              className={`px-5 py-3 rounded-xl text-[14.5px] lg:text-[15px] font-semibold flex items-center gap-2.5 border transition-all shrink-0 cursor-pointer ${
                isActive
                  ? "bg-blue-50/10 dark:bg-blue-900/20 border-blue-500/40 text-blue-600 shadow-none"
                  : "bg-white dark:bg-[#1E293B] border-slate-200/60 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/45 dark:hover:bg-slate-700"
              }`}
            >
              <Icon name={tab.icon as any} size={15.5} className={isActive ? "text-blue-600" : "text-slate-400"} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TRANSFORMATION CENTER VIEW */}
      {transformationsTab === "Transformation Center" && (
        <>
          {/* Sub-module View or List Workspace */}
          {transformationsView === "create" ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-5 lg:space-y-6">
              
              <div className="flex-none">
                <button
                  onClick={() => setTransformationsView("list")}
                  className="text-blue-600 text-[14px] font-semibold hover:underline flex items-center gap-1.5 transition-all select-none cursor-pointer"
                >
                  <span>&lt;</span>
                  <span>Back to Workspace</span>
                </button>
              </div>

              {/* High-Fidelity 3-Column Panels Layout */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 min-h-0 items-stretch">
                
                {/* Panel 1: Source Information */}
                <div 
                  className="col-span-1 md:col-span-3 bg-white dark:bg-[#1E293B] border border-slate-100/90 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.01)]"
                 
                >
                  <div className="space-y-6">
                    <h3 className="text-[19px] font-semibold text-slate-900 dark:text-white tracking-tight">
                      Source Information
                    </h3>
                    
                    <div className="space-y-2">
                      <span className="block text-[13px] font-semibold text-slate-400 uppercase tracking-wider">
                        Column Name
                      </span>
                      <span className="block text-[19px] font-semibold text-slate-900 dark:text-white">
                        Start Date
                      </span>
                    </div>

                    <div className="space-y-3.5 pt-5 border-t border-slate-50 dark:border-slate-700">
                      <span className="block text-[13px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Sample Values
                      </span>
                      <div className="space-y-3">
                        <div className="text-[16.5px] font-bold text-slate-500">25/05/2024</div>
                        <div className="text-[16.5px] font-bold text-slate-500">31/01/2024</div>
                        <div className="text-[16.5px] font-bold text-slate-500">05/03/2024</div>
                        <div className="text-[16.5px] font-bold text-slate-500">12/12/2023</div>
                        <div className="text-[16.5px] font-bold text-slate-500">12/12/2023</div>
                        <div className="text-[16.5px] font-bold text-slate-400/80 tracking-widest pt-1">...</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Transformation Configuration */}
                <div 
                  className="col-span-1 md:col-span-6 bg-white dark:bg-[#1E293B] border border-slate-100/90 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.01)]"
                 
                >
                  <div className="space-y-6">
                    <h3 className="text-[19px] font-semibold text-slate-900 dark:text-white tracking-tight">
                      Transformation Configuration
                    </h3>

                    <div className="space-y-6">
                      <div className="space-y-2.5">
                        <label className="block text-[13px] font-semibold text-slate-400 uppercase tracking-wider">
                          Transformation Type
                        </label>
                        <div className="relative">
                          <select
                            value={transType}
                            onChange={(e) => setTransType(e.target.value)}
                            className="w-full pl-4.5 pr-10 py-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-[15.5px] font-semibold bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer appearance-none"
                          >
                            <option value="Date Conversion">Date Conversion</option>
                            <option value="Trim, Title Case">Trim, Title Case</option>
                            <option value="Picklist Mapping">Picklist Mapping</option>
                            <option value="Phone Cleanup">Phone Cleanup</option>
                          </select>
                          <div className="absolute right-4.5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-600">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2.5">
                          <label className="block text-[13px] font-semibold text-slate-400 uppercase tracking-wider">
                            Input Format
                          </label>
                          <div className="relative">
                            <select
                              value={inputFormat}
                              onChange={(e) => setInputFormat(e.target.value)}
                              className="w-full pl-4.5 pr-10 py-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-[15.5px] font-semibold bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-800 appearance-none"
                            >
                              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                            </select>
                            <div className="absolute right-4.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <label className="block text-[13px] font-semibold text-slate-400 uppercase tracking-wider">
                            Output Format
                          </label>
                          <div className="relative">
                            <select
                              value={outputFormat}
                              onChange={(e) => setOutputFormat(e.target.value)}
                              className="w-full pl-4.5 pr-10 py-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-[15.5px] font-semibold bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-800 appearance-none"
                            >
                              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                              <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                            </select>
                            <div className="absolute right-4.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-b border-slate-100/70 dark:border-slate-700 py-5 mt-2">
                        <div className="space-y-1">
                          <span className="block text-[15.5px] font-semibold text-slate-900 dark:text-white">
                            Handle Null Values
                          </span>
                          <span className="block text-[13px] font-bold text-slate-400">
                            Set as Null <span className="ml-1 text-blue-600 font-semibold">-</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHandleNulls(!handleNulls)}
                          className={`w-13 h-7 rounded-full p-0.5 transition-all select-none cursor-pointer duration-200 focus:outline-none ${
                            handleNulls ? "bg-blue-600" : "bg-slate-200"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200 ${handleNulls ? "translate-x-6" : "translate-x-0"}`} />
                        </button>
                      </div>

                      <div className="space-y-4 pt-1">
                        <button
                          type="button"
                          onClick={() => setDefaultValOption(!defaultValOption)}
                          className="flex items-center gap-4 text-left w-full cursor-pointer focus:outline-none select-none group"
                        >
                          <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                            defaultValOption ? "bg-blue-50 border-blue-500 text-blue-600" : "border-slate-300 text-transparent"
                          }`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-200 group-hover:text-slate-800 dark:group-hover:text-white">
                            Default Value (Option) before conversion
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTrimSpaces(!trimSpaces)}
                          className="flex items-center gap-4 text-left w-full cursor-pointer focus:outline-none select-none group"
                        >
                          <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                            trimSpaces ? "bg-blue-50 border-blue-500 text-blue-600" : "border-slate-300 text-transparent"
                          }`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-200 group-hover:text-slate-800">
                            Trim spaces before
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-4 pt-7 border-t border-slate-100/50 dark:border-slate-700 mt-4">
                    <button
                      onClick={() => alert("Previewing: Date formatting logic...")}
                      className="px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-blue-600 text-[14px] font-semibold transition-all duration-200 select-none cursor-pointer"
                    >
                      Preview Transformation
                    </button>
                    <button
                      onClick={handleSaveSubmoduleTransformation}
                      className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold flex items-center gap-1.5 transition-all duration-200 select-none cursor-pointer shadow-sm"
                    >
                      <span>Save Transformation</span>
                      <span className="text-[15px] font-bold">&rarr;</span>
                    </button>
                  </div>

                </div>

                {/* Panel 3: AI Suggestion & Impact */}
                <div className="col-span-1 md:col-span-3 flex flex-col justify-between gap-5 lg:gap-6">
                  <div className="bg-white dark:bg-[#1E293B] border border-slate-100/90 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex-1 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
                    <div className="space-y-4">
                      <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight">AI Suggestion</h3>
                      <p className="text-[15.5px] text-slate-500 font-bold leading-relaxed">Convert &ldquo;Start Date&rdquo; values from {inputFormat} to {outputFormat}</p>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-slate-50 mt-4">
                      <span className="block text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Confidence Score</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[28px] font-semibold text-emerald-700 leading-none">95%</span>
                        <div className="flex-1 h-2.5 rounded-full bg-emerald-50 overflow-hidden">
                          <div className="h-full rounded-full bg-[#137333]" style={{ width: "95%" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#1E293B] border border-slate-100/90 dark:border-slate-700 rounded-xl p-6 lg:p-7 flex-1 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
                    <div className="space-y-4.5">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-3.5">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center border border-[#e6f4ea]/45">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="9" y1="9" x2="15" y2="9" />
                            <line x1="9" y1="13" x2="15" y2="13" />
                            <line x1="9" y1="17" x2="15" y2="17" />
                          </svg>
                        </div>
                        <span className="text-[18px] font-semibold text-emerald-700">Impact</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[15.5px] font-bold text-slate-500">The transformation will affect</p>
                        <div className="text-[30px] font-semibold text-emerald-700">1,256 records</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <>
              {/* DEFAULT WORKSPACE VIEW */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[15px] lg:text-[15.5px] font-semibold text-slate-900 dark:text-white">Object:</span>
                    <div className="relative">
                      <select
                        value={selectedObject}
                        onChange={(e) => setSelectedObject(e.target.value)}
                        className="pl-4 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-[14.5px] font-semibold bg-white dark:bg-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer appearance-none min-w-[140px]"
                      >
                        <option value="Account">Account</option>
                        <option value="Contact">Contact</option>
                        <option value="Opportunity">Opportunity</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-4.5 py-3 rounded-xl bg-slate-100/70 dark:bg-slate-700/50 border border-slate-200/40 dark:border-slate-700 text-[14px] lg:text-[14.5px] font-semibold text-slate-600 dark:text-slate-300">
                      Total Fields: <span className="text-slate-900 dark:text-white font-semibold ml-0.5">{activeData.total}</span>
                    </span>
                    <span className="px-4.5 py-3 rounded-xl bg-emerald-50/45 border border-[#e6f4ea]/30 text-[14px] lg:text-[14.5px] font-semibold text-emerald-700">
                      Mapped: <span className="font-semibold ml-0.5">{activeData.mapped}</span>
                    </span>
                    <span className="px-4.5 py-3 rounded-xl bg-rose-50/65 border border-rose-100/45 text-[14px] lg:text-[14.5px] font-semibold text-rose-600">
                      Unmapped: <span className="font-semibold ml-0.5">{activeData.unmapped}</span>
                    </span>
                    <span className="px-4.5 py-3 rounded-xl bg-[#faf5ff]/70 border border-purple-100/40 text-[14px] lg:text-[14.5px] font-semibold text-violet-600">
                      Transformations: <span className="font-semibold ml-0.5">{activeData.transformations}</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setTransformationsView("create")}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white text-[14.5px] font-semibold hover:bg-blue-700 active:scale-[0.97] transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-blue-500/10"
                >
                  <span className="text-[18px] font-semibold leading-none">+</span>
                  <span>Add Transformation</span>
                </button>
              </div>

              {/* Table Workspace with Enlarged Text and Padding */}
              <div className="flex-1 overflow-hidden flex flex-col h-full">
                <div className="overflow-x-auto flex-1 min-h-0">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-100/80 dark:border-slate-700 bg-slate-50/10 dark:bg-transparent text-[14.5px] font-semibold text-slate-500 uppercase tracking-tight">
                        <th className="py-5 px-5">Source Column</th>
                        <th className="py-5 px-5">Target Field (Salesforce)</th>
                        <th className="py-5 px-5">Transformation</th>
                        <th className="py-5 px-5">Preview</th>
                        <th className="py-5 px-5">Status</th>
                        <th className="py-5 px-5 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80 dark:divide-slate-700/50 text-[15.5px] lg:text-[16px]">
                      {activeData.rules.map((rule, idx) => (
                        <tr 
                          key={`${selectedObject}-${idx}`} 
                          className="hover:bg-slate-50/15 dark:hover:bg-slate-700/30 transition-all duration-150 group"
                          style={{ animationDelay: `${200 + idx * 40}ms` }}
                        >
                          <td className="py-5 px-5 font-semibold text-slate-900 dark:text-white">{rule.sourceColumn}</td>
                          <td className="py-5 px-5 font-bold text-slate-500 dark:text-slate-400">{rule.targetField}</td>
                          <td className="py-5 px-5 font-semibold text-slate-900/85 dark:text-slate-300">{rule.transformation}</td>
                          <td className="py-5 px-5 font-bold text-slate-600 dark:text-slate-400">{rule.preview}</td>
                          <td className="py-5 px-5">
                            <span className={`px-4 py-2 rounded-lg text-[13px] font-semibold inline-block leading-none ${
                              rule.status === "Executed" ? "bg-emerald-50 text-emerald-700" : "bg-[#fff7ed] text-[#c2410c]"
                            }`}>
                              {rule.status}
                            </span>
                          </td>
                          <td className="py-5 px-5 text-right pr-6">
                            <div className="flex items-center justify-end gap-4">
                              <button className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50/40 cursor-pointer">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100/50 cursor-pointer">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-5 pb-8 flex items-center justify-between text-[14px] text-slate-400 font-bold border-t border-slate-100/55 dark:border-slate-700 flex-none mt-1">
                  <span>Showing {activeData.rules.length} transformation records</span>
                  <span>Object: {selectedObject} Schema</span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 2: TRANSFORMATION LIBRARY VIEW */}
      {transformationsTab === "Transformation Library" && (
        <div className="flex-1 flex flex-col space-y-5 lg:space-y-6 min-h-0">
          
          <div className="w-full flex-none">
            <div className="relative">
              <span className="absolute inset-y-0 left-4.5 flex items-center pointer-events-none text-slate-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transformations..."
                className="w-full py-4.5 pl-13 pr-6 rounded-xl border border-slate-200/80 dark:border-slate-600 bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white text-[16px] font-semibold placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 shadow-[0_2px_10px_rgba(0,0,0,0.005)]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 flex-none">
            {libraryCategories.map((cat, idx) => {
              const isCatActive = selectedCategory === cat;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-3 rounded-xl text-[14.5px] font-semibold border transition-all shrink-0 cursor-pointer ${
                    isCatActive
                      ? "bg-slate-100/90 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                      : "bg-white dark:bg-[#1E293B] border-slate-150 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Cards Resized to cover the full width and heighten structural parity */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1.5 scrollbar-thin">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-5">
              {filteredCards.map((card, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#1E293B] border border-slate-100/90 dark:border-slate-700 hover:border-slate-200/85 dark:hover:border-slate-600 hover:shadow-[0_4px_20px_rgba(0,43,255,0.035)] transition-all duration-200 rounded-xl p-6.5 lg:p-7 flex items-center gap-5.5 group cursor-pointer min-h-[105px]"
                  style={{ animationDelay: `${150 + idx * 30}ms` }}
                >
                  <div className={`w-14 h-14 ${card.bgIconClass} border rounded-xl flex items-center justify-center ${card.colorClass} group-hover:scale-[1.04] transition-transform flex-shrink-0`}>
                    {card.iconSvg}
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <h4 className={`text-[17.5px] lg:text-[18px] font-semibold ${card.colorClass} truncate`}>
                      {card.title}
                    </h4>
                    <p className="text-[14px] text-slate-400 font-bold leading-normal truncate">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-50 dark:border-slate-700 flex-none mt-2">
            <button 
              onClick={() => setActivePage(0)}
              className="w-6 h-6 rounded-full flex items-center justify-center border border-blue-500/40 focus:outline-none cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-blue-600" />
            </button>
            <button onClick={() => setActivePage(1)} className="w-3 h-3 rounded-full border border-slate-300 cursor-pointer" />
            <button onClick={() => setActivePage(2)} className="w-3 h-3 rounded-full border border-slate-300 cursor-pointer" />
            <button onClick={() => setActivePage(3)} className="w-3 h-3 rounded-full border border-slate-300 cursor-pointer" />
          </div>

        </div>
      )}

      {/* TAB 3: PREVIEW ENGINE VIEW */}
      {transformationsTab === "Preview Engine" && (
        <div className="flex-1 flex flex-col space-y-5 lg:space-y-6 min-h-0">
          
          <div className="flex-none">
            <button
              onClick={() => handleTabChange("Transformation Center")}
              className="text-blue-600 text-[14px] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>&lt;</span>
              <span>Back to Workspace</span>
            </button>
          </div>

          <div className="flex-none flex items-center justify-between border-b border-slate-50 dark:border-slate-700 pb-2">
            <div className="space-y-1">
              <h3 className="text-[20px] font-semibold text-slate-900 dark:text-white">
                Preview Transformation
              </h3>
              <div className="text-[14px] font-bold text-slate-500 flex items-center gap-1.5">
                <span>Object:</span>
                <span className="text-slate-900 font-semibold">Account</span>
                <span className="text-slate-300">&gt;</span>
                <span className="text-blue-600 font-semibold">Start_Date__c</span>
              </div>
            </div>
          </div>

          {/* Row of 4 Premium Metric Cards with Count Ups */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 flex-none">
            
            <div className="bg-white border border-slate-100 rounded-xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-blue-50 border border-blue-500/20 text-blue-600 rounded-xl flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
                  <path d="M22 7c0 2.761-4.477 5-10 5S2 9.761 2 7" />
                  <path d="M22 12c0 2.761-4.477 5-10 5S2 14.761 2 12" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[13.5px] font-bold text-slate-400">Total Records</span>
                <span className="block text-[25px] font-semibold text-slate-900">
                  1,256
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-emerald-50 border border-[#e6f4ea]/45 text-emerald-700 rounded-xl flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <polyline points="9 11 12 14 22 4" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[13.5px] font-bold text-slate-400">Preview Records</span>
                <span className="block text-[25px] font-semibold text-slate-900">
                  20
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100/40 text-rose-600 rounded-xl flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[13.5px] font-bold text-slate-400">Errors Found</span>
                <span className="block text-[25px] font-semibold text-slate-900">
                  0
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-5.5 flex items-center gap-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-emerald-50 border border-[#e6f4ea]/45 text-emerald-700 rounded-xl flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M17 5l-5-5-5 5" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[13.5px] font-bold text-slate-400">Success Rate</span>
                <span className="block text-[25px] font-semibold text-emerald-700">
                  100%
                </span>
              </div>
            </div>

          </div>

          {/* Middle Layout Grid: Before Card, Arrow Flow, After Card, Metadata Column */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch min-h-0 pb-2">
            
            {/* Column 1: Before Transformation */}
            <div className="col-span-1 md:col-span-4 flex flex-col space-y-2">
              <span className="block text-[14.5px] font-semibold text-slate-700 tracking-wide">
                Before Transformation
              </span>
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.008)] flex-1 flex flex-col justify-between">
                <div className="flex-1 flex flex-col">
                  <div className="bg-gradient-to-b from-[#eef2ff]/70 via-[#f8fafc]/40 to-white border-b border-slate-200/80 py-4 px-6 flex-none">
                    <span className="block text-[16px] font-semibold text-blue-600">
                      Start Date
                    </span>
                  </div>
                  
                  <div className="flex-1 flex flex-col text-[15.5px] font-bold text-slate-900">
                    <div className="border-b border-slate-100 py-4 px-6">25/05/2024</div>
                    <div className="border-b border-slate-100 py-4 px-6">31/01/2024</div>
                    <div className="border-b border-slate-100 py-4 px-6">15/08/2024</div>
                    <div className="border-b border-slate-100 py-4 px-6">05/03/2024</div>
                    <div className="border-b border-slate-100 py-4 px-6">12/12/2003</div>
                    <div className="py-3 px-6 text-slate-400 tracking-widest font-semibold">...</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Center Arrow Spacer */}
            <div className="col-span-1 md:col-span-1 flex items-center justify-center flex-none md:flex-1 pt-6">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform select-none cursor-pointer">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <polyline points="12 5 19 12 12 19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
            </div>

            {/* Column 3: After Transformation */}
            <div className="col-span-1 md:col-span-4 flex flex-col space-y-2">
              <span className="block text-[14.5px] font-semibold text-slate-700 tracking-wide">
                After Transformation
              </span>
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.008)] flex-1 flex flex-col justify-between">
                <div className="flex-1 flex flex-col">
                  <div className="bg-gradient-to-b from-[#eef2ff]/70 via-[#f8fafc]/40 to-white border-b border-slate-200/80 py-4 px-6 flex-none">
                    <span className="block text-[16px] font-semibold text-blue-600">
                      Start_Date__c
                    </span>
                  </div>
                  
                  <div className="flex-1 flex flex-col text-[15.5px] font-bold text-slate-900">
                    <div className="border-b border-slate-100 py-4 px-6">2024-05-25</div>
                    <div className="border-b border-slate-100 py-4 px-6">2024-01-31</div>
                    <div className="border-b border-slate-100 py-4 px-6">2024-08-15</div>
                    <div className="border-b border-slate-100 py-4 px-6">2024-03-05</div>
                    <div className="border-b border-slate-100 py-4 px-6">2003-12-12</div>
                    <div className="py-3 px-6 text-slate-400 tracking-widest font-semibold">...</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 4: Transformation Info & Big Approve Button */}
            <div className="col-span-1 md:col-span-3 flex flex-col justify-between gap-5">
              
              <div className="bg-white border border-slate-100 rounded-xl p-6 lg:p-7 flex-1 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.005)]">
                <div className="space-y-4">
                  <h4 className="text-[15.5px] font-semibold text-slate-900 border-b border-slate-50 pb-2">
                    Transformation Info
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[14.5px]">
                      <span className="font-bold text-slate-400">Type</span>
                      <span className="font-semibold text-slate-900">Date Conversion</span>
                    </div>

                    <div className="flex items-center justify-between text-[14.5px]">
                      <span className="font-bold text-slate-400">Input Format</span>
                      <span className="font-semibold text-slate-500">DD/MM/YYYY</span>
                    </div>

                    <div className="flex items-center justify-between text-[14.5px]">
                      <span className="font-bold text-slate-400">Output Format</span>
                      <span className="font-semibold text-slate-500">YYYY-MM-DD</span>
                    </div>

                    <div className="flex items-center justify-between text-[14.5px]">
                      <span className="font-bold text-slate-400">Applied On</span>
                      <span className="font-semibold text-emerald-700">1,256 records</span>
                    </div>

                    <div className="flex items-center justify-between text-[14.5px]">
                      <span className="font-bold text-slate-400">Executed By</span>
                      <span className="font-semibold text-blue-600">AI Suggestion</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleApproveExecution}
                className="w-full py-4.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-semibold flex items-center justify-center gap-2 hover:scale-[0.98] active:scale-[0.96] transition-all cursor-pointer shadow-lg shadow-blue-500/10"
              >
                <span>Approve & Add to Execution</span>
                <span className="text-[16px] font-bold">&rarr;</span>
              </button>

            </div>

          </div>

        </div>
      )}

      {/* TAB 4: HUMAN FEEDBACK LOOP VIEW */}
      {transformationsTab === "Human Feedback Loop" && (
        <div className="flex-1 flex flex-col space-y-5 lg:space-y-6 min-h-0">
          
          <div className="flex-none">
            <button
              onClick={() => handleTabChange("Transformation Center")}
              className="text-blue-600 text-[14px] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>&lt;</span>
              <span>Back to Workspace</span>
            </button>
          </div>

          <div className="flex-none flex flex-col space-y-1 border-b border-slate-100/60 pb-3">
            <h3 className="text-[20px] font-semibold text-slate-900">
              Review & Provide Feedback
            </h3>
            <span className="text-[14px] font-bold text-slate-400">
              Review AI suggestions and provide your feedback.
            </span>
          </div>

          {/* Layout Grid: 3 Columns with Count Ups */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch min-h-0 pb-2">
            
            {/* Column 1: AI Suggestion Card */}
            <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/90 rounded-xl p-6 lg:p-7 flex flex-col justify-between overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.008)]">
              <div className="space-y-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-6.5 h-6.5 bg-emerald-50 text-emerald-700 border border-[#e6f4ea]/45 rounded-lg flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <span className="text-[15.5px] font-semibold text-emerald-700">
                    AI Suggestion
                  </span>
                </div>

                <div className="text-[17px] font-semibold text-slate-900 leading-snug">
                  Map &ldquo;Account Type&rdquo; values using picklist
                </div>

                <div className="space-y-3.5 pt-1">
                  <span className="block text-[13.5px] font-semibold text-violet-600 uppercase tracking-wider">
                    Mapping Suggestion
                  </span>
                  
                  <div className="space-y-3.5 pt-0.5 text-[15px] font-bold">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-900">Business</span>
                      <span className="text-slate-300 font-bold">&rarr;</span>
                      <span className="text-slate-900/80">B2B</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-900">Individual</span>
                      <span className="text-slate-300 font-bold">&rarr;</span>
                      <span className="text-slate-900/80">B2C</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-900">Partner</span>
                      <span className="text-slate-300 font-bold">&rarr;</span>
                      <span className="text-slate-900/80">Partner</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-900">Others</span>
                      <span className="text-slate-300 font-bold">&rarr;</span>
                      <span className="text-slate-900/80">Other</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100/70 mt-4">
                <span className="block text-[12.5px] font-semibold text-slate-400 uppercase tracking-wider">
                  Confidence Score
                </span>
                <div className="flex items-center gap-3.5">
                  <div className="flex-1 h-3 rounded-full bg-emerald-50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#137333]" style={{ width: "90%" }} />
                  </div>
                  <span className="text-[19px] font-semibold text-emerald-700 leading-none">
                    90%
                  </span>
                </div>
              </div>

            </div>

            {/* Column 2: Your Feedback Card */}
            <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/90 rounded-xl p-6 lg:p-7 flex flex-col justify-between overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.008)]">
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <h4 className="text-[18px] font-semibold text-slate-900 flex-none">
                  Your Feedback
                </h4>

                <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[300px] scrollbar-thin">
                  {feedbackMappings.map((mapping, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-3.5 items-center">
                      
                      <div className="relative">
                        <select
                          value={mapping.source}
                          onChange={(e) => handleUpdateFeedbackSource(idx, e.target.value)}
                          className="w-full pl-4 pr-9 py-3 rounded-xl border border-slate-200 text-slate-900 text-[14.5px] font-semibold bg-white hover:bg-slate-50 appearance-none cursor-pointer"
                        >
                          <option value="Business">Business</option>
                          <option value="Individual">Individual</option>
                          <option value="Partner">Partner</option>
                          <option value="Others">Others</option>
                          <option value="Enterprise">Enterprise</option>
                          <option value="Standard">Standard</option>
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>

                      <div className="relative">
                        <select
                          value={mapping.target}
                          onChange={(e) => handleUpdateFeedbackTarget(idx, e.target.value)}
                          className="w-full pl-4 pr-9 py-3 rounded-xl border border-slate-200 text-slate-900 text-[14.5px] font-semibold bg-white hover:bg-slate-50 appearance-none cursor-pointer"
                        >
                          <option value="B2B">B2B</option>
                          <option value="B2C">B2C</option>
                          <option value="Partner">Partner</option>
                          <option value="Other">Other</option>
                          <option value="VIP">VIP</option>
                          <option value="Public">Public</option>
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

                <div className="pt-2.5 flex-none">
                  <button
                    onClick={handleAddFeedbackRow}
                    className="text-blue-600 hover:underline text-[14px] font-semibold flex items-center gap-1 cursor-pointer select-none"
                  >
                    <span>+</span>
                    <span>Add New Mapping</span>
                  </button>
                </div>

              </div>
            </div>

            {/* Column 3: Feedback Notes Card */}
            <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/90 rounded-xl p-6 lg:p-7 flex flex-col space-y-4.5 shadow-[0_2px_12px_rgba(0,0,0,0.008)]">
              <h4 className="text-[18px] font-semibold text-slate-900 flex-none">
                Feedback Notes (Optional)
              </h4>
              <textarea
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="Add any comments or notes for this mapping..."
                className="w-full flex-1 p-5 rounded-xl border border-slate-200 text-slate-900 text-[15.5px] font-semibold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/10 resize-none min-h-[160px]"
              />
            </div>

          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100 flex-none">
            <button
              onClick={() => {
                setFeedbackMappings([
                  { source: "Business", target: "B2B" },
                  { source: "Individual", target: "B2C" },
                  { source: "Partner", target: "Partner" },
                  { source: "Others", target: "Other" }
                ]);
                setFeedbackNotes("");
              }}
              className="px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-[14px] font-semibold transition-all select-none cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setShowSuccessOverlay(true);
                setTimeout(() => {
                  setShowSuccessOverlay(false);
                  handleTabChange("Preview Engine");
                }, 1300);
              }}
              className="px-9 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold flex items-center gap-1.5 transition-all select-none cursor-pointer shadow-lg shadow-blue-500/10"
            >
              Save & Execute Preview
            </button>
          </div>

        </div>
      )}

      {/* TAB 5: EXECUTION ENGINE VIEW */}
      {transformationsTab === "Execution Engine" && (
        <div className="flex-1 flex flex-col space-y-5 lg:space-y-6 min-h-0">
          
          <div className="flex-none">
            <button
              onClick={() => handleTabChange("Transformation Center")}
              className="text-blue-600 text-[14px] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>&lt;</span>
              <span>Back to Workspace</span>
            </button>
          </div>

          <div className="flex-none flex flex-col space-y-1 border-b border-slate-100/60 pb-3">
            <h3 className="text-[20px] font-semibold text-slate-900">
              Transformation Execution
            </h3>
            <span className="text-[14px] font-bold text-slate-400">
              Executing all approved transformations.
            </span>
          </div>

          {/* Upper Section: Split circular progress on left, Table on right */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch min-h-0 pb-2">
            
            {/* Column 1: Donut Progress Chart Card */}
            <div className="col-span-1 md:col-span-4 bg-white border border-slate-200/90 rounded-xl p-6 lg:p-7 flex flex-col items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.008)] min-h-[350px]">
              <div className="w-full flex-1 flex flex-col items-center justify-center space-y-6">
                
                {/* SVG Circular Donut Progress with Drawing Keyframe */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-[#f1f5f9]"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-[#10b981]"
                      strokeWidth="10"
                      fill="transparent"
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Internal Progress Text with Count Up */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
                    <span className="text-[40px] font-semibold text-slate-900 leading-none">
                      75%
                    </span>
                    <span className="text-[14px] font-semibold text-emerald-700">
                      In Progress
                    </span>
                  </div>
                </div>

                {/* Remaining Estimated Timer */}
                <div className="text-center space-y-1.5">
                  <span className="block text-[14px] font-semibold text-slate-400">
                    Estimated Time Remaining
                  </span>
                  <span className="block text-[30px] font-semibold text-slate-900 font-mono tracking-wider">
                    00:02:15
                  </span>
                </div>

              </div>
            </div>

            {/* Column 2: Execution Progress Table Card */}
            <div className="col-span-1 md:col-span-8 bg-white border border-slate-200/90 rounded-xl p-6 lg:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.008)] min-h-[350px] flex flex-col justify-between">
              <div className="space-y-4 flex-1 flex flex-col">
                <h4 className="text-[16px] font-semibold text-blue-600 uppercase tracking-wider pb-1">
                  Execution Progress
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-slate-100/80 text-[13px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="pb-4 pl-2">Step</th>
                        <th className="pb-4">Object</th>
                        <th className="pb-4">Transformations</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 text-right pr-4">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-[15px] font-bold text-slate-900">
                      
                      <tr className="hover:bg-slate-50/20 transition-all">
                        <td className="py-4.5 pl-2 font-semibold">1</td>
                        <td className="py-4.5">Account</td>
                        <td className="py-4.5 text-slate-500 font-semibold">18 / 20</td>
                        <td className="py-4.5 text-emerald-700 font-semibold">Completed</td>
                        <td className="py-4.5 pr-4">
                          <div className="flex items-center justify-end gap-3.5">
                            <div className="w-28 h-2.5 bg-emerald-50 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#137333]" style={{ width: "100%" }} />
                            </div>
                            <span className="text-[13.5px] font-semibold text-slate-600 min-w-[32px] text-right">100%</span>
                          </div>
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/20 transition-all">
                        <td className="py-4.5 pl-2 font-semibold">2</td>
                        <td className="py-4.5">Contact</td>
                        <td className="py-4.5 text-slate-500 font-semibold">25 / 25</td>
                        <td className="py-4.5 text-emerald-700 font-semibold">Completed</td>
                        <td className="py-4.5 pr-4">
                          <div className="flex items-center justify-end gap-3.5">
                            <div className="w-28 h-2.5 bg-blue-50 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: "100%" }} />
                            </div>
                            <span className="text-[13.5px] font-semibold text-slate-600 min-w-[32px] text-right">100%</span>
                          </div>
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/20 transition-all">
                        <td className="py-4.5 pl-2 font-semibold">3</td>
                        <td className="py-4.5">Opportunity</td>
                        <td className="py-4.5 text-slate-500 font-semibold">15 / 18</td>
                        <td className="py-4.5 text-blue-600 font-semibold">In Progress</td>
                        <td className="py-4.5 pr-4">
                          <div className="flex items-center justify-end gap-3.5">
                            <div className="w-28 h-2.5 bg-blue-50 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: "75%" }} />
                            </div>
                            <span className="text-[13.5px] font-semibold text-slate-600 min-w-[32px] text-right">75%</span>
                          </div>
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/20 transition-all">
                        <td className="py-4.5 pl-2 font-semibold">4</td>
                        <td className="py-4.5">Product</td>
                        <td className="py-4.5 text-slate-500 font-semibold">10 / 12</td>
                        <td className="py-4.5 text-rose-600 font-semibold">Pending</td>
                        <td className="py-4.5 pr-4">
                          <div className="flex items-center justify-end gap-3.5">
                            <div className="w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-slate-300" style={{ width: "0%" }} />
                            </div>
                            <span className="text-[13.5px] font-semibold text-slate-400 min-w-[32px] text-right">0%</span>
                          </div>
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/20 transition-all">
                        <td className="py-4.5 pl-2 font-semibold">5</td>
                        <td className="py-4.5">Order</td>
                        <td className="py-4.5 text-slate-500 font-semibold">8 / 10</td>
                        <td className="py-4.5 text-rose-600 font-semibold">Pending</td>
                        <td className="py-4.5 pr-4">
                          <div className="flex items-center justify-end gap-3.5">
                            <div className="w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-slate-300" style={{ width: "0%" }} />
                            </div>
                            <span className="text-[13.5px] font-semibold text-slate-400 min-w-[32px] text-right">0%</span>
                          </div>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

              </div>
            </div>

          </div>

          {/* Lower Section: 5 Metric Cards filling the screen width beautifully with Count Ups */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5 flex-none pt-2">
            
            <div className="bg-white border border-slate-150 rounded-xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-blue-50 border border-blue-500/20 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z" />
                  <path d="M22 7c0 2.761-4.477 5-10 5S2 9.761 2 7" />
                  <path d="M22 12c0 2.761-4.477 5-10 5S2 14.761 2 12" />
                </svg>
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-400 truncate">Total Transformations</span>
                <span className="block text-[23px] font-semibold text-slate-900">
                  156
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-emerald-50 border border-[#e6f4ea]/45 text-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-400 truncate">Completed</span>
                <span className="block text-[23px] font-semibold text-slate-900">
                  43
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-amber-50 border border-amber-500/20 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-400 truncate">In Progress</span>
                <span className="block text-[23px] font-semibold text-slate-900">
                  13
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-500/20 text-[#6366f1] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="8" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-400 truncate">Pending</span>
                <span className="block text-[23px] font-semibold text-slate-900">
                  100
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.005)]">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100/40 text-rose-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12" y2="17.01" />
                </svg>
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-400 truncate">Failed</span>
                <span className="block text-[23px] font-semibold text-rose-600">
                  0
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Pop-up Overlay modal for direct fast adding */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl p-6 lg:p-7 space-y-4">
            
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h3 className="text-[18px] font-semibold text-slate-900 tracking-tight">Add Transformation Rule</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTransformation} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[12.5px] font-semibold text-slate-500 uppercase tracking-wider">Source Column</label>
                <input 
                  type="text" 
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  placeholder="e.g. Account Balance"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-[14px] font-semibold focus:outline-none focus:border-blue-600/65"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12.5px] font-semibold text-slate-500 uppercase tracking-wider">Target Field (Salesforce)</label>
                <input 
                  type="text" 
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="e.g. AnnualRevenue"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-[14px] font-semibold focus:outline-none focus:border-blue-600/65"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12.5px] font-semibold text-slate-500 uppercase tracking-wider">Transformation Type</label>
                <select 
                  value={newTrans}
                  onChange={(e) => setNewTrans(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-[14px] font-semibold bg-white focus:outline-none focus:border-blue-600/65 appearance-none"
                >
                  <option value="Trim, Title Case">Trim, Title Case</option>
                  <option value="Date Format">Date: DD/MM/YYYY to YYYY-MM-DD</option>
                  <option value="Picklist Mapping">Picklist Mapping</option>
                  <option value="Phone Cleanup">Phone Cleanup</option>
                  <option value="VLOOKUP (User)">VLOOKUP (User)</option>
                  <option value="Number Format">Number Format</option>
                  <option value="No Transformation">No Transformation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[12.5px] font-semibold text-slate-500 uppercase tracking-wider">Preview Example</label>
                <input 
                  type="text" 
                  value={newPreview}
                  onChange={(e) => setNewPreview(e.target.value)}
                  placeholder="e.g. ACME CORP"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-[14px] font-semibold focus:outline-none focus:border-blue-600/65"
                />
              </div>

              <div className="flex items-center justify-end gap-3.5 pt-3.5">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-[13.5px] font-semibold hover:bg-slate-50 transition-all select-none cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white text-[13.5px] font-semibold hover:bg-blue-700 active:scale-[0.97] transition-all select-none cursor-pointer"
                >
                  Add Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
