"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

// ---------------------------------------------------------------------------
// Pipeline types (exported so TransformationWorkspacePage can import them)
// ---------------------------------------------------------------------------

export type PipelineStage = "schema" | "cleaning" | "validation" | "transformation";
export type StageStatus = "idle" | "running" | "passed" | "failed";
export type StepKey = PipelineStage | "export";

export type SchemaResult = {
  schema_valid: boolean;
  source_field_count: number;
  mapping_field_count: number;
  matched_field_count: number;
  missing_fields: string[];
  additional_fields: string[];
  error?: string;
};

export type DataValidationIssue = {
  field: string;
  issue_types: string;
  count: number;
};

export type DataValidationResult = {
  success: boolean;
  total_records: number;
  total_issues: number;
  issues: DataValidationIssue[];
  error?: string;
  reportS3Key?: string;
};

export type CleaningChange = {
  row: number;
  column: string;
  original_value: string;
  cleaned_value: string;
  rule: string;
};

export type CleaningResult = {
  success: boolean;
  cleanedS3Key: string | null;
  summary: {
    total_rows_processed: number;
    rows_removed: number;
    values_trimmed: number;
    extra_spaces_fixed: number;
    email_corrections: number;
    null_conversions: number;
  };
  changes: CleaningChange[];
  total_changes: number;
  error?: string;
};

export type LookupStat = {
  column: string;
  matched: number;
  missed: number;
  total: number;
};

export type SheetOutput = {
  sheetName: string;
  fileName: string;
  transformedS3Key: string;
  totalRows: number;
  transformedColumns: string[];
  lookupStats: LookupStat[];
};

export type TransformResult = {
  outputs: SheetOutput[];
  zipS3Key: string | null;
  zipFileName: string | null;
  generatedAt: string;
  totalRecords: number;
};

function parseErrorDetail(detail: any, fallback: string): string {
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e?.msg ?? JSON.stringify(e)).join("; ");
  }
  return typeof detail === "string" ? detail : fallback;
}

const IDLE_STAGE_STATUS: Record<PipelineStage, StageStatus> = {
  schema: "idle",
  cleaning: "idle",
  validation: "idle",
  transformation: "idle",
};

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
  logActivity: (category: string, actor: string, description: string, status: string, details?: any) => Promise<void>;
  revertFileToVersion: (fileId: string) => Promise<void>;
  revertOutputToVersion: (outputId: string) => Promise<void>;

  previewData: any | null;
  setPreviewData: React.Dispatch<React.SetStateAction<any | null>>;
  generatePreview: (cleanedSourceKey?: string | null) => Promise<void>;
  isPreviewLoading: boolean;
  previewError: string | null;

  // Pipeline
  pipelineRunning: boolean;
  stageStatus: Record<PipelineStage, StageStatus>;
  schemaResult: SchemaResult | null;
  cleaningResult: CleaningResult | null;
  dataValidationResult: DataValidationResult | null;
  transformResult: TransformResult | null;
  transformError: string | null;
  runPipeline: () => Promise<void>;
  proceedWithSkips: (skippedFields: string[]) => Promise<void>;
  resetPipelineState: () => void;
  restorePipelineState: (saved: {
    stageStatus?: Record<PipelineStage, StageStatus>;
    schemaResult?: SchemaResult | null;
    cleaningResult?: CleaningResult | null;
    dataValidationResult?: DataValidationResult | null;
    transformResult?: TransformResult | null;
  }) => void;
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

  // Pipeline state — lives in context so it survives page navigation
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [stageStatus, setStageStatus] = useState<Record<PipelineStage, StageStatus>>(IDLE_STAGE_STATUS);
  const [schemaResult, setSchemaResult] = useState<SchemaResult | null>(null);
  const [cleaningResult, setCleaningResult] = useState<CleaningResult | null>(null);
  const [dataValidationResult, setDataValidationResult] = useState<DataValidationResult | null>(null);
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);

  const pipelineProjectIdRef = useRef<string | null>(null);
  // Monotonic counter: only the latest in-flight refreshCurrentProject() response is applied.
  const refreshGenRef = useRef(0);

  // Reset session-uploaded source key when project changes
  useEffect(() => {
    setSessionUploadedSourceKey(null);
  }, [currentProject?.id]);

  // Reset pipeline state when the user switches to a different project
  useEffect(() => {
    if (!currentProject?.id) return;
    if (pipelineProjectIdRef.current === null) {
      pipelineProjectIdRef.current = currentProject.id;
      return;
    }
    if (pipelineProjectIdRef.current !== currentProject.id) {
      pipelineProjectIdRef.current = currentProject.id;
      setPipelineRunning(false);
      setStageStatus(IDLE_STAGE_STATUS);
      setSchemaResult(null);
      setCleaningResult(null);
      setDataValidationResult(null);
      setTransformResult(null);
      setTransformError(null);
    }
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

  // Sync React file upload list with active S3 references in current project.
  // Slots that are currently mid-upload (loading === true) are never overwritten
  // by a DB refresh — doing so causes the card to flicker to blank while the
  // upload is still in progress.
  useEffect(() => {
    if (currentProject) {
      console.log("[MigrationContext] syncing uploadedFiles from project.files:", currentProject.files);
      setUploadedFiles((prev) => {
        const next: Record<string, UploadedFile | null> = {
          source: null,
          master: null,
          logic: null,
        };

        currentProject.files.forEach((f) => {
          if (f.isActive && (f.slot === "source" || f.slot === "master" || f.slot === "logic")) {
            if (prev[f.slot]?.loading) {
              // An upload is in progress for this slot — keep the optimistic state.
              console.log(`[MigrationContext] slot=${f.slot} upload in progress, keeping optimistic state`);
              next[f.slot] = prev[f.slot];
            } else {
              console.log(`[MigrationContext] slot=${f.slot} s3Key=${f.s3Key}`);
              next[f.slot] = {
                name: f.fileName,
                size: f.fileSize,
                loading: false,
                progress: 100,
                completed: true,
              };
            }
          }
        });

        // Also preserve any slot that is mid-upload but not yet in the DB
        // (the project record won't have it yet so the loop above skips it).
        (["source", "master", "logic"] as const).forEach((slot) => {
          if (prev[slot]?.loading && !next[slot]) {
            console.log(`[MigrationContext] slot=${slot} upload pending DB registration, keeping optimistic state`);
            next[slot] = prev[slot];
          }
        });

        return next;
      });
    } else {
      setUploadedFiles({ source: null, master: null, logic: null });
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

  // Refresh active project detail.
  // Uses a generation counter so that only the most-recently-initiated call
  // applies its response — older in-flight responses are silently discarded.
  const refreshCurrentProject = async () => {
    if (!currentProject) return;
    const gen = ++refreshGenRef.current;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`);
      const data = await res.json();
      if (gen !== refreshGenRef.current) return; // superseded by a newer call
      if (data.success) {
        console.log(`[refreshCurrentProject] gen=${gen} applying fresh project state`);
        setCurrentProject(data.project);
        localStorage.setItem("salesforce_migration_project", JSON.stringify(data.project));
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
  const logActivity = async (category: string, actor: string, description: string, status: string, details?: any) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, actor, description, status, details })
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
      const uploadedFile = resData.files.find((f: any) => f.slot === slot);
      console.log(`[uploadFileToServer] slot=${slot} uploaded s3Key=${uploadedFile?.s3Key ?? "(none)"}`);

      // Register S3 file details in database
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
        // Explicit slot chosen by the user (Replace / Browse button) — never reassign.
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

        // Only run fallback auto-assignment when no forced slot was given.
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

  const resetPipelineState = () => {
    setPipelineRunning(false);
    setStageStatus(IDLE_STAGE_STATUS);
    setSchemaResult(null);
    setCleaningResult(null);
    setDataValidationResult(null);
    setTransformResult(null);
    setTransformError(null);
  };

  const restorePipelineState = (saved: {
    stageStatus?: Record<PipelineStage, StageStatus>;
    schemaResult?: SchemaResult | null;
    cleaningResult?: CleaningResult | null;
    dataValidationResult?: DataValidationResult | null;
    transformResult?: TransformResult | null;
  }) => {
    if (saved.stageStatus) setStageStatus(saved.stageStatus);
    if (saved.schemaResult !== undefined) setSchemaResult(saved.schemaResult);
    if (saved.cleaningResult !== undefined) setCleaningResult(saved.cleaningResult);
    if (saved.dataValidationResult !== undefined) setDataValidationResult(saved.dataValidationResult);
    if (saved.transformResult !== undefined) setTransformResult(saved.transformResult);
  };

  const runPipeline = async () => {
    const cu = currentUser;
    if (!currentProject) return;

    // Clear stale results immediately — before any network calls — so the
    // workspace never briefly renders the previous run's output while waiting
    // for the project refresh fetch to complete.
    setPipelineRunning(true);
    setStageStatus(IDLE_STAGE_STATUS);
    setSchemaResult(null);
    setCleaningResult(null);
    setDataValidationResult(null);
    setTransformResult(null);
    setTransformError(null);

    // Fetch a fresh copy of the project before reading file keys.
    // React state may lag behind the DB when a file was just uploaded.
    // If the fetch fails we abort — proceeding with a stale cached project
    // risks using an S3 key from a previous upload that no longer exists.
    let cp: Project;
    try {
      const freshRes = await fetch(`/api/projects/${currentProject.id}`);
      const freshData = await freshRes.json();
      if (!freshData.success) {
        throw new Error(freshData.error || "Failed to fetch fresh project state");
      }
      cp = freshData.project;
      setCurrentProject(cp);
      localStorage.setItem("salesforce_migration_project", JSON.stringify(cp));
      console.log("[runPipeline] refreshed project state before pipeline start");
    } catch (e) {
      console.error("[runPipeline] could not fetch fresh project state — aborting to avoid stale S3 keys:", e);
      const errResult: SchemaResult = {
        schema_valid: false,
        source_field_count: 0,
        mapping_field_count: 0,
        matched_field_count: 0,
        missing_fields: [],
        additional_fields: [],
        error: "Could not refresh project data before running the pipeline. Please check your connection and try again.",
      };
      setSchemaResult(errResult);
      setStageStatus(s => ({ ...s, schema: "failed" }));
      setPipelineRunning(false);
      return;
    }

    sessionStorage.removeItem(`pipeline_state_${cp.id}`);

    // Files are returned newest-first (orderBy uploadedAt desc in the API).
    // find() therefore always picks the most-recently-uploaded active record.
    const activeFiles = cp.files || [];
    const sourceFile  = activeFiles.find((f: ProjectFile) => f.slot === "source" && f.isActive);
    const masterFile  = activeFiles.find((f: ProjectFile) => f.slot === "master" && f.isActive);
    const logicFile   = activeFiles.find((f: ProjectFile) => f.slot === "logic"  && f.isActive);
    const sourceKey   = sourceFile?.s3Key;
    const masterKey   = masterFile?.s3Key;
    const logicKey    = logicFile?.s3Key;

    console.log("[runPipeline] active file records selected:");
    console.log("  source →", sourceFile  ? `id=${sourceFile.id}  uploadedAt=${(sourceFile as any).uploadedAt}  s3Key=${sourceKey}` : "(none)");
    console.log("  master →", masterFile  ? `id=${masterFile.id}  uploadedAt=${(masterFile as any).uploadedAt}  s3Key=${masterKey}` : "(none)");
    console.log("  logic  →", logicFile   ? `id=${logicFile.id}   uploadedAt=${(logicFile as any).uploadedAt}  s3Key=${logicKey}`  : "(none)");
    console.log("[runPipeline] all active files in project (newest first):");
    activeFiles.filter((f: ProjectFile) => f.isActive).forEach((f: ProjectFile) => {
      console.log(`  slot=${f.slot}  id=${f.id}  s3Key=${f.s3Key}  uploadedAt=${(f as any).uploadedAt}`);
    });

    const persist = (
      status: Record<PipelineStage, StageStatus>,
      schema: SchemaResult | null,
      cleaning: CleaningResult | null,
      validation: DataValidationResult | null,
      transform: TransformResult | null,
    ) => {
      try {
        sessionStorage.setItem(`pipeline_state_${cp.id}`, JSON.stringify({
          stageStatus: status,
          schemaResult: schema,
          cleaningResult: cleaning,
          dataValidationResult: validation,
          transformResult: transform,
        }));
      } catch (_e) { /* sessionStorage quota exceeded — non-critical */ }
    };

    let _schema: SchemaResult | null = null;
    let _cleaning: CleaningResult | null = null;
    let _validation: DataValidationResult | null = null;

    if (!sourceKey || !logicKey) {
      const errResult: SchemaResult = {
        schema_valid: false,
        source_field_count: 0,
        mapping_field_count: 0,
        matched_field_count: 0,
        missing_fields: [],
        additional_fields: [],
        error: "Missing active source or mapping logic files in the project.",
      };
      setSchemaResult(errResult);
      setStageStatus(s => ({ ...s, schema: "failed" }));
      setPipelineRunning(false);
      return;
    }

    // ── Stage 1: Schema Validation ────────────────────────────────────────────
    setStageStatus(s => ({ ...s, schema: "running" }));
    let schemaPassed = false;
    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/validate-schema?source_key=${encodeURIComponent(sourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const resp = await fetch(url, { method: "POST", headers: { "x-project-id": cp.id } });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseErrorDetail(err.detail, "Schema validation failed"));
      }
      const data = await resp.json();
      _schema = data;
      setSchemaResult(_schema);
      schemaPassed = data.schema_valid === true && data.missing_fields?.length === 0 && data.additional_fields?.length === 0;
      await updateProjectStage("SCHEMA_VALIDATED", 35);
      await logActivity("Validation", cu?.name || "User", "Completed Schema Validation", "Success", data);
    } catch (error) {
      _schema = {
        schema_valid: false,
        source_field_count: 0,
        mapping_field_count: 0,
        matched_field_count: 0,
        missing_fields: [],
        additional_fields: [],
        error: String(error),
      };
      setSchemaResult(_schema);
      setStageStatus(s => ({ ...s, schema: "failed" }));
      persist({ schema: "failed", cleaning: "idle", validation: "idle", transformation: "idle" }, _schema, null, null, null);
      await logActivity("Validation", cu?.name || "User", `Schema validation failed: ${String(error)}`, "Failed", _schema);
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, schema: schemaPassed ? "passed" : "failed" }));
    if (!schemaPassed) {
      persist({ schema: "failed", cleaning: "idle", validation: "idle", transformation: "idle" }, _schema, null, null, null);
      setPipelineRunning(false);
      return;
    }

    // ── Stage 2: Data Cleaning ────────────────────────────────────────────────
    setStageStatus(s => ({ ...s, cleaning: "running" }));
    let cleanedKey: string | null = null;
    let cleaningPassed = false;
    try {
      const url = `${NEXT_PUBLIC_API_URL}/api/clean-data?source_key=${encodeURIComponent(sourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": cp.id },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseErrorDetail(err.detail, "Data cleaning failed"));
      }
      const data = await resp.json();
      _cleaning = data;
      setCleaningResult(_cleaning);
      cleanedKey = data.cleanedS3Key || null;
      cleaningPassed = data.success === true;
      console.log("[pipeline] cleaned source key:", cleanedKey);
      await updateProjectStage("DATA_CLEANED", 45);
      await logActivity(
        "Transformation",
        cu?.name || "User",
        `Data cleaning complete. ${data.total_changes} change${data.total_changes === 1 ? "" : "s"} applied.`,
        "Success",
        data
      );
    } catch (error) {
      _cleaning = {
        success: false,
        cleanedS3Key: null,
        summary: { total_rows_processed: 0, rows_removed: 0, values_trimmed: 0, extra_spaces_fixed: 0, email_corrections: 0, null_conversions: 0 },
        changes: [],
        total_changes: 0,
        error: String(error),
      };
      setCleaningResult(_cleaning);
      setStageStatus(s => ({ ...s, cleaning: "failed" }));
      persist({ schema: "passed", cleaning: "failed", validation: "idle", transformation: "idle" }, _schema, _cleaning, null, null);
      await logActivity("Transformation", cu?.name || "User", `Data cleaning failed: ${String(error)}`, "Failed", _cleaning);
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, cleaning: cleaningPassed ? "passed" : "failed" }));
    if (!cleaningPassed) {
      persist({ schema: "passed", cleaning: "failed", validation: "idle", transformation: "idle" }, _schema, _cleaning, null, null);
      setPipelineRunning(false);
      return;
    }

    // ── Stage 3: Data Validation ──────────────────────────────────────────────
    setStageStatus(s => ({ ...s, validation: "running" }));
    const effectiveSourceKey = cleanedKey || sourceKey;
    let validationPassed = false;
    let validationTotalRecords = 0;
    try {
      let url = `${NEXT_PUBLIC_API_URL}/api/validate-data?source_key=${encodeURIComponent(effectiveSourceKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      if (masterKey) url += `&master_key=${encodeURIComponent(masterKey)}`;
      console.log("[pipeline] validate-data effective source key:", effectiveSourceKey);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": cp.id },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(parseErrorDetail(err.detail, "Data validation failed"));
      }
      const data = await resp.json();
      _validation = data;
      setDataValidationResult(_validation);
      validationTotalRecords = data.total_records ?? 0;
      if (data.reportS3Key) {
        await fetch(`/api/projects/${cp.id}/outputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "data_validation_report.xlsx",
            fileType: "validation_report",
            s3Key: data.reportS3Key,
            recordsCount: data.total_issues,
          }),
        });
      }
      validationPassed = data.success === true && data.total_issues === 0;
      await updateProjectStage("DATA_VALIDATED", 55);
      await logActivity("Validation", cu?.name || "User", `Data validation complete. Issues: ${data.total_issues ?? 0}`, "Success", data);
    } catch (error) {
      _validation = { success: false, total_records: 0, total_issues: 0, issues: [], error: String(error) };
      setDataValidationResult(_validation);
      setStageStatus(s => ({ ...s, validation: "failed" }));
      persist({ schema: "passed", cleaning: "passed", validation: "failed", transformation: "idle" }, _schema, _cleaning, _validation, null);
      await logActivity("Validation", cu?.name || "User", `Data validation failed: ${String(error)}`, "Failed", _validation);
      setPipelineRunning(false);
      return;
    }

    setStageStatus(s => ({ ...s, validation: validationPassed ? "passed" : "failed" }));
    if (!validationPassed) {
      persist({ schema: "passed", cleaning: "passed", validation: "failed", transformation: "idle" }, _schema, _cleaning, _validation, null);
      setPipelineRunning(false);
      return;
    }

    // ── Stage 4: Transformation ────────────────────────────────────────────────
    setStageStatus(s => ({ ...s, transformation: "running" }));
    try {
      const effectiveSource = cleanedKey || sourceKey;
      if (!effectiveSource || !masterKey || !logicKey) {
        throw new Error("Missing required migration files for transformation.");
      }
      const url = `${NEXT_PUBLIC_API_URL}/api/transform-data?source_key=${encodeURIComponent(effectiveSource)}&master_key=${encodeURIComponent(masterKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      console.log("[pipeline] transform-data effective source key:", effectiveSource);
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": cp.id },
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(parseErrorDetail(errorBody?.detail, "Data transformation failed"));
      }
      const data = await response.json();
      const sheetOutputs: SheetOutput[] = (data.outputs ?? []).map((o: any) => ({
        sheetName: o.sheetName,
        fileName: o.fileName,
        transformedS3Key: o.transformedS3Key,
        totalRows: o.total_rows ?? 0,
        transformedColumns: o.transformed_columns ?? [],
        lookupStats: o.lookup_stats ?? [],
      }));

      for (const out of sheetOutputs) {
        await fetch(`/api/projects/${cp.id}/outputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: out.fileName,
            fileType: "transformed_data",
            s3Key: out.transformedS3Key,
            recordsCount: validationTotalRecords,
          }),
        });
      }

      // Auto-download: ZIP if multiple sheets, otherwise the single file
      if (data.zipS3Key) {
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(data.zipS3Key)}`;
        link.setAttribute("download", data.zipFileName || "transformed_data.zip");
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (sheetOutputs[0]?.transformedS3Key) {
        const out = sheetOutputs[0];
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(out.transformedS3Key)}`;
        link.setAttribute("download", out.fileName || "transformed_data.xlsx");
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      const finalTransformResult: TransformResult = {
        outputs: sheetOutputs,
        zipS3Key: data.zipS3Key ?? null,
        zipFileName: data.zipFileName ?? null,
        generatedAt: data.generatedAt || new Date().toISOString(),
        totalRecords: validationTotalRecords,
      };
      setTransformResult(finalTransformResult);
      persist(
        { schema: "passed", cleaning: "passed", validation: "passed", transformation: "passed" },
        _schema, _cleaning, _validation, finalTransformResult,
      );
      await updateProjectStage("TRANSFORMED", 100);
      await logActivity("Transformation", cu?.name || "User", "Completed Data Transformation", "Success", data);
      setStageStatus(s => ({ ...s, transformation: "passed" }));
    } catch (error) {
      setTransformError(error instanceof Error ? error.message : "Data transformation failed");
      setStageStatus(s => ({ ...s, transformation: "failed" }));
      persist({ schema: "passed", cleaning: "passed", validation: "passed", transformation: "failed" }, _schema, _cleaning, _validation, null);
      await logActivity("Transformation", cu?.name || "User", `Data transformation failed: ${error instanceof Error ? error.message : String(error)}`, "Failed", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setPipelineRunning(false);
    }
  };

  const proceedWithSkips = async (skippedFields: string[]) => {
    if (!currentProject) return;
    const cp = currentProject;
    const activeFiles = cp.files || [];
    const sourceFile = activeFiles.find((f: ProjectFile) => f.slot === "source" && f.isActive);
    const masterFile = activeFiles.find((f: ProjectFile) => f.slot === "master" && f.isActive);
    const logicFile  = activeFiles.find((f: ProjectFile) => f.slot === "logic"  && f.isActive);
    const sourceKey  = sourceFile?.s3Key;
    const masterKey  = masterFile?.s3Key;
    const logicKey   = logicFile?.s3Key;
    const effectiveSource = cleaningResult?.cleanedS3Key || sourceKey;
    if (!effectiveSource || !masterKey || !logicKey) return;

    setPipelineRunning(true);
    setStageStatus(s => ({ ...s, validation: "passed", transformation: "running" }));
    setTransformError(null);

    const validationTotalRecords = dataValidationResult?.total_records ?? 0;
    const _schema    = schemaResult;
    const _cleaning  = cleaningResult;
    const _validation = dataValidationResult;

    const persistState = (transformationStatus: StageStatus, transformResult: TransformResult | null) => {
      try {
        sessionStorage.setItem(`pipeline_state_${cp.id}`, JSON.stringify({
          stageStatus: { schema: "passed", cleaning: "passed", validation: "passed", transformation: transformationStatus },
          schemaResult: _schema,
          cleaningResult: _cleaning,
          dataValidationResult: _validation,
          transformResult,
        }));
      } catch (_e) {}
    };

    try {
      let url = `${NEXT_PUBLIC_API_URL}/api/transform-data?source_key=${encodeURIComponent(effectiveSource)}&master_key=${encodeURIComponent(masterKey)}&logic_key=${encodeURIComponent(logicKey)}`;
      for (const field of skippedFields) {
        url += `&skipped_fields=${encodeURIComponent(field)}`;
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-project-id": cp.id },
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(parseErrorDetail(errorBody?.detail, "Data transformation failed"));
      }
      const data = await response.json();
      const sheetOutputs: SheetOutput[] = (data.outputs ?? []).map((o: any) => ({
        sheetName: o.sheetName,
        fileName: o.fileName,
        transformedS3Key: o.transformedS3Key,
        totalRows: o.total_rows ?? 0,
        transformedColumns: o.transformed_columns ?? [],
        lookupStats: o.lookup_stats ?? [],
      }));

      for (const out of sheetOutputs) {
        await fetch(`/api/projects/${cp.id}/outputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: out.fileName,
            fileType: "transformed_data",
            s3Key: out.transformedS3Key,
            recordsCount: validationTotalRecords,
          }),
        });
      }

      if (data.zipS3Key) {
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(data.zipS3Key)}`;
        link.setAttribute("download", data.zipFileName || "transformed_data.zip");
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (sheetOutputs[0]?.transformedS3Key) {
        const out = sheetOutputs[0];
        const link = document.createElement("a");
        link.href = `${NEXT_PUBLIC_API_URL}/api/download-file?s3_key=${encodeURIComponent(out.transformedS3Key)}`;
        link.setAttribute("download", out.fileName || "transformed_data.xlsx");
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      const finalTransformResult: TransformResult = {
        outputs: sheetOutputs,
        zipS3Key: data.zipS3Key ?? null,
        zipFileName: data.zipFileName ?? null,
        generatedAt: data.generatedAt || new Date().toISOString(),
        totalRecords: validationTotalRecords,
      };
      setTransformResult(finalTransformResult);
      persistState("passed", finalTransformResult);
      await updateProjectStage("TRANSFORMED", 100);
      await logActivity("Transformation", currentUser?.name || "User", `Completed Data Transformation (skipped fields: ${skippedFields.join(", ")})`, "Success", data);
      setStageStatus(s => ({ ...s, transformation: "passed" }));
    } catch (error) {
      setTransformError(error instanceof Error ? error.message : "Data transformation failed");
      setStageStatus(s => ({ ...s, transformation: "failed" }));
      persistState("failed", null);
      await logActivity("Transformation", currentUser?.name || "User", `Data transformation failed: ${error instanceof Error ? error.message : String(error)}`, "Failed", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setPipelineRunning(false);
    }
  };

  // Base on DB-confirmed file state, not the fake progress animation,
  // so the Continue button only enables once files are truly registered in S3/DB.
  const isContinueEnabled = !!(
    currentProject?.files.some((f: ProjectFile) => f.slot === "source" && f.isActive) &&
    currentProject?.files.some((f: ProjectFile) => f.slot === "master" && f.isActive) &&
    currentProject?.files.some((f: ProjectFile) => f.slot === "logic" && f.isActive)
  );

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
        previewError,

        // Pipeline
        pipelineRunning,
        stageStatus,
        schemaResult,
        cleaningResult,
        dataValidationResult,
        transformResult,
        transformError,
        runPipeline,
        proceedWithSkips,
        resetPipelineState,
        restorePipelineState,
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
