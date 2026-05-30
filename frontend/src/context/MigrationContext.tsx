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
  
  // REAL SERVER STATE INTEGRATIONS
  previewData: any | null;
  setPreviewData: React.Dispatch<React.SetStateAction<any | null>>;
  generatePreview: () => Promise<void>;
  isPreviewLoading: boolean;
  previewError: string | null;
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

  // Server state variables
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Clear any existing server-side files on initial load to ensure a fresh upload session
  useEffect(() => {
    const clearServerFilesOnStart = async () => {
      try {
        await fetch("http://localhost:8000/api/clear-all-files", { method: "POST" });
        console.log("Server migration files cleared for a fresh session.");
      } catch (err) {
        console.warn("Could not clear server files on mount:", err);
      }
    };
    clearServerFilesOnStart();
  }, []);

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

  // Helper function to send files to the FastAPI server in the background
  const uploadFileToServer = async (file: File, slot: string) => {
    try {
      const formData = new FormData();
      formData.append(slot, file);
      
      const response = await fetch("http://localhost:8000/api/upload-migration-files", {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload returned status ${response.status}`);
      }
      
      const resData = await response.json();
      console.log(`Server upload completed for slot [${slot}]:`, resData);
    } catch (err) {
      console.error(`Error uploading file [${file.name}] for slot [${slot}] to backend:`, err);
    }
  };

  const handleFileUpload = (files: FileList | File[] | null, forcedSlot?: string) => {
    if (!files) return;
    const fileList = Array.from(files).slice(0, 3);

    const newUploads: Record<string, { file: File; name: string; size: string; slot: string }> = {};
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
      newUploads[slot] = { file, name: file.name, size: sizeStr, slot };
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
      const uploadDetails = newUploads[slot];
      
      // 1. Kick off real backend upload
      uploadFileToServer(uploadDetails.file, slot);

      // 2. Play beautiful micro-progress animation
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

  const clearFile = async (slot: string) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [slot]: null
    }));
    try {
      await fetch(`http://localhost:8000/api/clear-file/${slot}`, {
        method: "DELETE"
      });
      console.log(`Server file in slot [${slot}] successfully cleared.`);
    } catch (err) {
      console.error(`Failed to clear slot [${slot}] on server:`, err);
    }
  };



  // Triggers backend calculations and parses Excel preview
  const generatePreview = async () => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const response = await fetch("http://localhost:8000/api/generate-preview", {
        method: "POST"
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.detail || "Server calculations failed.");
      }
      const data = await response.json();
      setPreviewData(data);
    } catch (err: any) {
      console.error("Failed to compile Salesforce mapping preview:", err);
      setPreviewError(err.message || "An unexpected error occurred during mappings generation.");
      throw err;
    } finally {
      setIsPreviewLoading(false);
    }
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
        isContinueEnabled,
        successRateCount,
        metricCount,
        transformationsView,
        setTransformationsView,
        transformationsTab,
        setTransformationsTab,
        
        // SERVER EXPORTS
        previewData,
        setPreviewData,
        generatePreview,
        isPreviewLoading,
        previewError
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
