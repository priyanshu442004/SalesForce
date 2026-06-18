"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

export interface UploadedFile {
  name: string;
  size: string;
  loading: boolean;
  progress: number;
  completed: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ProjectFile {
  id: string;
  slot: string;
  fileName: string;
  fileSize: string;
  s3Key: string;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  status: string;
  progress: number;
  stage: string;
  recordsCount: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  files: ProjectFile[];
  activities: any[];
  outputs: any[];
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

  // Real Database + S3 integrations
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  userList: User[];
  projectList: Project[];
  isLoadingUsers: boolean;
  isLoadingProjects: boolean;
  loadUsers: () => Promise<void>;
  loadProjects: (userId: string) => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  selectProject: (projectId: string) => Promise<void>;
  refreshCurrentProject: () => Promise<void>;
  updateProjectStage: (stage: string, progress: number) => Promise<void>;
  logActivity: (category: string, actor: string, description: string, status: string) => Promise<void>;
  revertFileToVersion: (fileId: string) => Promise<void>;
  revertOutputToVersion: (outputId: string) => Promise<void>;

  previewData: any | null;
  setPreviewData: React.Dispatch<React.SetStateAction<any | null>>;
  generatePreview: (cleanedSourceKey?: string | null) => Promise<void>;
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

  const [sessionUploadedSourceKey, setSessionUploadedSourceKey] = useState<string | null>(null);

  // DB States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [userList, setUserList] = useState<User[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

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

  const [transformationsView, setTransformationsView] = useState<"list" | "create">("list");
  const [transformationsTab, setTransformationsTab] = useState<string>("Transformation Center");

  // Reset session-uploaded source key when project changes
  useEffect(() => {
    setSessionUploadedSourceKey(null);
  }, [currentProject?.id]);

  // Load Users List
  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUserList(data.users);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Load Project List for active user
  const loadProjects = useCallback(async (userId: string) => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch(`/api/projects?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setProjectList(data.projects);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Seed / Initialize users list on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load user session from local storage on load
  useEffect(() => {
    const savedUser = localStorage.getItem("salesforce_migration_user");
    const savedProject = localStorage.getItem("salesforce_migration_project");

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      loadProjects(parsedUser.id);

      if (savedProject) {
        const parsedProject = JSON.parse(savedProject);
        // Refresh project details to load any changes
        fetch(`/api/projects/${parsedProject.id}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setCurrentProject(data.project);
            } else {
              setCurrentProject(parsedProject);
            }
          })
          .catch((err) => {
            console.error("Error fetching stored project:", err);
            setCurrentProject(parsedProject);
          });
      }
    }
  }, [loadUsers, loadProjects]);

  // Sync dashboard counters based on active project state
  useEffect(() => {
    if (projectList.length > 0) {
      const total = projectList.length;
      const completed = projectList.filter((p) => p.status === "Completed").length;
      const progress = projectList.filter((p) => p.status === "In Progress").length;
      const failed = projectList.filter((p) => p.status === "Failed").length;

      setMetricCount({ projects: total, completed, progress, failed });
      const rate = total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0;
      setSuccessRateCount(rate);
    } else {
      setMetricCount({ projects: 0, completed: 0, progress: 0, failed: 0 });
      setSuccessRateCount(0);
    }
  }, [projectList]);

  // Sync React file upload list with active S3 references in current project
  useEffect(() => {
    if (currentProject) {
      const newFilesState: Record<string, UploadedFile | null> = {
        source: null,
        master: null,
        logic: null
      };

      // DEBUG — remove after confirming source card displays correctly
      console.log("[MigrationContext] project.files:", currentProject.files);

      currentProject.files.forEach((f) => {
        if (f.isActive && (f.slot === "source" || f.slot === "master" || f.slot === "logic")) {
          const uploadedFile = {
            name: f.fileName,
            size: f.fileSize,
            loading: false,
            progress: 100,
            completed: true
          };
          newFilesState[f.slot] = uploadedFile;

          // DEBUG — remove after confirming source card displays correctly
          if (f.slot === "source") {
            console.log("[MigrationContext] active source file found:", f.s3Key);
            console.log("[MigrationContext] state assigned to source card:", uploadedFile);
          }
        }
      });

      setUploadedFiles(newFilesState);
    } else {
      setUploadedFiles({
        source: null,
        master: null,
        logic: null
      });
    }
  }, [currentProject]);

  // Handle active user switching
  const handleSetUser = (user: User | null) => {
    setCurrentUser(user);
    setCurrentProject(null);
    setProjectList([]);
    localStorage.removeItem("salesforce_migration_project");
    if (user) {
      localStorage.setItem("salesforce_migration_user", JSON.stringify(user));
      loadProjects(user.id);
    } else {
      localStorage.removeItem("salesforce_migration_user");
    }
  };

  // Handle active project selection
  const handleSetProject = (project: Project | null) => {
    setCurrentProject(project);
    if (project) {
      localStorage.setItem("salesforce_migration_project", JSON.stringify(project));
    } else {
      localStorage.removeItem("salesforce_migration_project");
    }
  };

  // Refresh active project detail
  const refreshCurrentProject = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`);
      const data = await res.json();
      if (data.success) {
        setCurrentProject(data.project);
        localStorage.setItem("salesforce_migration_project", JSON.stringify(data.project));
        // Refresh project list to keep UI synchronized
        if (currentUser) {
          loadProjects(currentUser.id);
        }
      }
    } catch (err) {
      console.error("Failed to refresh active project state:", err);
    }
  };

  // Create project API
  const createProject = async (name: string): Promise<Project | null> => {
    if (!currentUser) return null;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, name })
      });
      const data = await res.json();
      if (data.success) {
        await loadProjects(currentUser.id);
        return data.project;
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    }
    return null;
  };

  // Select project
  const selectProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success) {
        handleSetProject(data.project);
      }
    } catch (err) {
      console.error("Failed to select project:", err);
    }
  };

  // Update project stage
  const updateProjectStage = async (stage: string, progress: number) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, progress })
      });
      const data = await res.json();
      if (data.success) {
        await refreshCurrentProject();
      }
    } catch (err) {
      console.error("Failed to update project progress:", err);
    }
  };

  // Create audit activity log
  const logActivity = async (category: string, actor: string, description: string, status: string) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, actor, description, status })
      });
      await refreshCurrentProject();
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  // Revert File to previous version (Undo file modification)
  const revertFileToVersion = async (fileId: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId })
      });
      const data = await res.json();
      if (data.success) {
        const revertedFile = currentProject.files.find((f) => f.id === fileId);
        if (revertedFile && revertedFile.slot === "source") {
          setSessionUploadedSourceKey(revertedFile.s3Key);
        }
        await refreshCurrentProject();
      }
    } catch (err) {
      console.error("Failed to rollback file version:", err);
    }
  };

  // Revert Generated Output to previous version (Undo output modification)
  const revertOutputToVersion = async (outputId: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/outputs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputId })
      });
      const data = await res.json();
      if (data.success) {
        await refreshCurrentProject();
      }
    } catch (err) {
      console.error("Failed to rollback output version:", err);
    }
  };

  // S3 Background upload function
  const uploadFileToServer = async (file: File, slot: string) => {
    if (!currentProject) return;
    try {
      const formData = new FormData();
      formData.append(slot, file);

      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/upload-migration-files`, {
        method: "POST",
        body: formData,
        headers: {
          "x-project-id": currentProject.id
        }
      });

      if (!response.ok) {
        throw new Error(`Upload returned status ${response.status}`);
      }

      const resData = await response.json();
      console.log(`Server upload completed for slot [${slot}]:`, resData);

      // Register S3 file details in database
      const uploadedFile = resData.files.find((f: any) => f.slot === slot);
      if (uploadedFile) {
        if (slot === "source") {
          setSessionUploadedSourceKey(uploadedFile.s3Key);
        }
        const dbRes = await fetch(`/api/projects/${currentProject.id}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slot: uploadedFile.slot,
            fileName: uploadedFile.fileName,
            fileSize: uploadedFile.fileSize,
            s3Key: uploadedFile.s3Key
          })
        });
        const dbData = await dbRes.json();
        if (dbData.success) {
          await refreshCurrentProject();
        }
      }
    } catch (err) {
      console.error(`Error uploading file [${file.name}] for slot [${slot}] to backend:`, err);
    }
  };

  // Upload local Excel files
  const handleFileUpload = (files: FileList | File[] | null, forcedSlot?: string) => {
    if (!files || !currentProject) return;
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

      // Real S3 upload
      uploadFileToServer(uploadDetails.file, slot);

      // Played micro-progress animation
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

  // Clear slot references
  const clearFile = async (slot: string) => {
    if (!currentProject) return;
    if (slot === "source") {
      setSessionUploadedSourceKey(null);
    }
    setUploadedFiles((prev) => ({
      ...prev,
      [slot]: null
    }));
    try {
      await fetch(`/api/projects/${currentProject.id}/files?slot=${slot}`, {
        method: "DELETE"
      });
      await refreshCurrentProject();
      console.log(`Server file in slot [${slot}] successfully cleared.`);
    } catch (err) {
      console.error(`Failed to clear slot [${slot}] on server:`, err);
    }
  };

  // Compile Salesforce mappings using active S3 keys
  const generatePreview = async (cleanedSourceKey?: string | null) => {
    if (!currentProject) return;
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const activeFiles = currentProject.files || [];
      const rawSourceKey = activeFiles.find((f: any) => f.slot === "source" && f.isActive)?.s3Key;
      const masterKey = activeFiles.find((f: any) => f.slot === "master" && f.isActive)?.s3Key;
      const logicKey = activeFiles.find((f: any) => f.slot === "logic" && f.isActive)?.s3Key;
      // Prefer the cleaned file produced by the cleaning step over the raw upload.
      const sourceKey = cleanedSourceKey || rawSourceKey;

      if (!sourceKey || !masterKey || !logicKey) {
        throw new Error("Missing active source, master or logic files needed for mapping.");
      }

      const url = `${NEXT_PUBLIC_API_URL}/api/generate-preview?source_key=${encodeURIComponent(sourceKey)}&master_key=${encodeURIComponent(masterKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-project-id": currentProject.id
        }
      });
      if (!response.ok) {
        const errorBody = await response.json();
        const detail = errorBody?.detail;
        throw new Error(
          Array.isArray(detail)
            ? detail.map((e: any) => e.msg ?? JSON.stringify(e)).join("; ")
            : typeof detail === "string"
            ? detail
            : "Server calculations failed."
        );
      }
      const data = await response.json();
      setPreviewData(data);

      // Register output file details
      if (data.previewS3Key) {
        await fetch(`/api/projects/${currentProject.id}/outputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "preview.xlsx",
            fileType: "preview",
            s3Key: data.previewS3Key,
            recordsCount: data.total_rows || 0
          })
        });
        await refreshCurrentProject();
      }
    } catch (err: any) {
      console.error("Failed to compile Salesforce mapping preview:", err);
      setPreviewError(err.message || "An unexpected error occurred during mappings generation.");
      throw err;
    } finally {
      setIsPreviewLoading(false);
    }
  };

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

        // Database + S3 configurations
        currentUser,
        setCurrentUser: handleSetUser,
        currentProject,
        setCurrentProject: handleSetProject,
        userList,
        projectList,
        isLoadingUsers,
        isLoadingProjects,
        loadUsers,
        loadProjects,
        createProject,
        selectProject,
        refreshCurrentProject,
        updateProjectStage,
        logActivity,
        revertFileToVersion,
        revertOutputToVersion,

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
