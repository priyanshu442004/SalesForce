"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface UploadedFile {
  name: string;
  size: string;
  loading: boolean;
  progress: number;
  completed: boolean;
}

interface MigrationContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  uploadedFiles: Record<string, UploadedFile | null>;
  setUploadedFiles: React.Dispatch<React.SetStateAction<Record<string, UploadedFile | null>>>;
  clearFile: (slot: string) => void;
  handleFileUpload: (files: FileList | File[] | null, forcedSlot?: string) => void;
  autofillMockFiles: () => void;
  isContinueEnabled: boolean;
  successRateCount: number;
  metricCount: {
    projects: number;
    completed: number;
    progress: number;
    failed: number;
  };
  transformationsView: "list" | "create";
  setTransformationsView: (val: "list" | "create") => void;
  transformationsTab: string;
  setTransformationsTab: (val: string) => void;
}

const MigrationContext = createContext<MigrationContextType | undefined>(undefined);

export function MigrationProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile | null>>({
    source: null,
    master: null,
    logic: null
  });

  const [successRateCount, setSuccessRateCount] = useState(0);
  const [metricCount, setMetricCount] = useState({
    projects: 0,
    completed: 0,
    progress: 0,
    failed: 0
  });

  // Numbers increment simulation
  useEffect(() => {
    const duration = 1200;
    const steps = 50;
    const stepTime = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      
      setMetricCount({
        projects: Math.min(Math.round(24 * ratio), 24),
        completed: Math.min(Math.round(16 * ratio), 16),
        progress: Math.min(Math.round(5 * ratio), 5),
        failed: Math.min(Math.round(3 * ratio), 3)
      });
      
      setSuccessRateCount(parseFloat((92.3 * ratio).toFixed(1)));

      if (currentStep >= steps) {
        clearInterval(timer);
        setSuccessRateCount(92.3);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, []);

  const detectFileSlot = (filename: string): string => {
    const fn = filename.toLowerCase();
    if (fn.includes("source") || fn.includes("customer") || fn.includes("data") || fn.includes("raw") || fn.includes("user")) {
      return "source";
    }
    if (fn.includes("master") || fn.includes("salesforce") || fn.includes("metadata") || fn.includes("sf")) {
      return "master";
    }
    if (fn.includes("mapping") || fn.includes("logic") || fn.includes("business") || fn.includes("rules") || fn.includes("map")) {
      return "logic";
    }
    if (!uploadedFiles.source) return "source";
    if (!uploadedFiles.master) return "master";
    return "logic";
  };

  const handleFileUpload = (files: FileList | File[] | null, forcedSlot?: string) => {
    if (!files) return;
    const fileList = Array.from(files).slice(0, 3);

    const newUploads: Record<string, { name: string; size: string }> = {};
    const usedSlots = new Set<string>();

    fileList.forEach((file) => {
      let slot = "";
      if (forcedSlot) {
        slot = forcedSlot;
      } else {
        const fn = file.name.toLowerCase();
        if (fn.includes("source") || fn.includes("customer") || fn.includes("data") || fn.includes("raw") || fn.includes("user")) {
          slot = "source";
        } else if (fn.includes("master") || fn.includes("salesforce") || fn.includes("metadata") || fn.includes("sf")) {
          slot = "master";
        } else if (fn.includes("mapping") || fn.includes("logic") || fn.includes("business") || fn.includes("rules") || fn.includes("map")) {
          slot = "logic";
        }

        if (!slot || usedSlots.has(slot) || uploadedFiles[slot]) {
          if (!uploadedFiles.source && !usedSlots.has("source")) {
            slot = "source";
          } else if (!uploadedFiles.master && !usedSlots.has("master")) {
            slot = "master";
          } else if (!uploadedFiles.logic && !usedSlots.has("logic")) {
            slot = "logic";
          } else {
            const fallback = ["source", "master", "logic"].find((s) => !usedSlots.has(s));
            slot = fallback || "source";
          }
        }
      }

      usedSlots.add(slot);
      const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";
      newUploads[slot] = { name: file.name, size: sizeStr };
    });

    setUploadedFiles((prev) => {
      const nextState = { ...prev };
      Object.keys(newUploads).forEach((slot) => {
        nextState[slot] = {
          name: newUploads[slot].name,
          size: newUploads[slot].size,
          loading: true,
          progress: 0,
          completed: false
        };
      });
      return nextState;
    });

    Object.keys(newUploads).forEach((slot) => {
      let prog = 0;
      const interval = setInterval(() => {
        prog += 8;
        const currentProg = Math.min(prog, 100);
        setUploadedFiles((prev) => {
          const item = prev[slot];
          if (!item) return prev;
          return {
            ...prev,
            [slot]: {
              ...item,
              progress: currentProg,
              loading: currentProg < 100,
              completed: currentProg >= 100
            }
          };
        });

        if (prog >= 100) {
          clearInterval(interval);
        }
      }, 100);
    });
  };

  const clearFile = (slot: string) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [slot]: null
    }));
  };

  const autofillMockFiles = () => {
    const mockData = [
      { name: "customer_data.xlsx", size: 25585254, slot: "source" },
      { name: "salesforce_master.xlsx", size: 13736345, slot: "master" },
      { name: "mapping_logic.xlsx", size: 9227468, slot: "logic" }
    ];

    mockData.forEach((item) => {
      const sizeStr = (item.size / (1024 * 1024)).toFixed(1) + " MB";
      setUploadedFiles((prev) => ({
        ...prev,
        [item.slot]: {
          name: item.name,
          size: sizeStr,
          loading: true,
          progress: 0,
          completed: false
        }
      }));

      let prog = 0;
      const interval = setInterval(() => {
        prog += 10;
        setUploadedFiles((prev) => {
          const slotItem = prev[item.slot];
          if (!slotItem) return prev;
          const currentProg = Math.min(prog, 100);
          return {
            ...prev,
            [item.slot]: {
              ...slotItem,
              progress: currentProg,
              loading: currentProg < 100,
              completed: currentProg >= 100
            }
          };
        });

        if (prog >= 100) {
          clearInterval(interval);
        }
      }, 80);
    });
  };

  const [transformationsView, setTransformationsView] = useState<"list" | "create">("list");
  const [transformationsTab, setTransformationsTab] = useState<string>("Transformation Center");

  const isContinueEnabled = 
    !!(uploadedFiles.source?.completed && 
    uploadedFiles.master?.completed && 
    uploadedFiles.logic?.completed);

  return (
    <MigrationContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        uploadedFiles,
        setUploadedFiles,
        clearFile,
        handleFileUpload,
        autofillMockFiles,
        isContinueEnabled,
        successRateCount,
        metricCount,
        transformationsView,
        setTransformationsView,
        transformationsTab,
        setTransformationsTab
      }}
    >
      {children}
    </MigrationContext.Provider>
  );
}

export function useMigration() {
  const context = useContext(MigrationContext);
  if (!context) {
    throw new Error("useMigration must be used within a MigrationProvider");
  }
  return context;
}
