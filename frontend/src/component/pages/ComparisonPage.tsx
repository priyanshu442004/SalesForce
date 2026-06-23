"use client";

import React, { useState, useRef, useEffect } from "react";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

// Document SVG icon (reused from UploadFilesPage)
function DocumentSvg({ className = "", size = 48 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.2)}
      viewBox="0 0 24 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" strokeWidth="2.2" />
      <line x1="8" y1="18" x2="14" y2="18" strokeWidth="2.2" />
    </svg>
  );
}

interface FileUploadState {
  file?: File;
  name?: string;
  size?: string;
  progress: number;
  loading: boolean;
  error?: string;
}

interface ComparisonReport {
  missing_columns?: string[];
  additional_columns?: string[];
  possible_renamed_columns?: Array<{
    base_column: string;
    possible_new_column: string;
    similarity_score: number;
  }>;
  value_differences?: Array<{
    record_key: number;
    column: string;
    base_row: number;
    new_row: number;
    base_value: any;
    new_value: any;
  }>;
  representation_differences?: Array<{
    record_key: number;
    column: string;
    base_row: number;
    new_row: number;
    base_value: any;
    new_value: any;
    normalized_value: any;
  }>;
  added_records?: Array<{
    record_key: number;
    record: Record<string, any>;
  }>;
  deleted_records?: Array<{
    record_key: number;
    record: Record<string, any>;
  }>;
  duplicate_keys?: Record<string, any>;
  summary?: {
    base_file_rows: number;
    new_file_rows: number;
    added_record_count: number;
    deleted_record_count: number;
    modified_record_count: number;
  };
}

export default function ComparisonPage() {
  const baseInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const [baseFile, setBaseFile] = useState<FileUploadState>({ progress: 0, loading: false });
  const [newFile, setNewFile] = useState<FileUploadState>({ progress: 0, loading: false });
  const [keyColumn, setKeyColumn] = useState<string>("");
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonReport | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Animation trigger
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleFileSelect = (files: FileList | null, isBase: boolean) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (!validTypes.includes(file.type)) {
      const msg = "Please upload a valid Excel file (.xlsx or .xls)";
      setError(msg);
      setTimeout(() => setError(""), 3000);
      return;
    }

    const setterState = isBase ? setBaseFile : setNewFile;
    const setterFile = isBase ? setBaseFile : setNewFile;

    setterFile({
      progress: 100,
      loading: false,
      file,
      name: file.name,
      size: formatFileSize(file.size),
    });

    setError("");
  };

  const clearFile = (isBase: boolean) => {
    if (isBase) {
      setBaseFile({ progress: 0, loading: false });
      if (baseInputRef.current) baseInputRef.current.value = "";
    } else {
      setNewFile({ progress: 0, loading: false });
      if (newInputRef.current) newInputRef.current.value = "";
    }
  };

  const handleCompare = async () => {
    if (!baseFile.file || !newFile.file) {
      setError("Please upload both base file and new file");
      return;
    }

    setIsComparing(true);
    setError("");
    setComparisonResult(null);

    try {
      // Step 1: Upload files
      const formData = new FormData();
      formData.append("base_file", baseFile.file);
      formData.append("new_file", newFile.file);

      const uploadResponse = await fetch(`${NEXT_PUBLIC_API_URL}/api/upload-comparison-files`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload files");
      }

      // Step 2: Compare files
      const queryParam = keyColumn ? `?key_column=${encodeURIComponent(keyColumn)}` : "";
      const compareResponse = await fetch(
        `${NEXT_PUBLIC_API_URL}/api/compare-files${queryParam}`,
        {
          method: "POST",
        }
      );

      if (!compareResponse.ok) {
        throw new Error("Failed to compare files");
      }

      const result: ComparisonReport = await compareResponse.json();
      setComparisonResult(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred during comparison";
      setError(errorMsg);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="p-5 sm:p-7 lg:p-9 pb-12 space-y-5 lg:space-y-6 flex-1 flex flex-col min-h-0 overflow-y-auto select-none bg-white">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={baseInputRef}
        onChange={(e) => handleFileSelect(e.target.files, true)}
        accept=".xlsx, .xls"
        className="hidden"
      />
      <input
        type="file"
        ref={newInputRef}
        onChange={(e) => handleFileSelect(e.target.files, false)}
        accept=".xlsx, .xls"
        className="hidden"
      />

      {/* Title Block */}
      <div className="flex-none space-y-0.5">
        <h2 className="text-[23px] lg:text-[25px] font-semibold text-slate-900 tracking-tight">
          Compare Excel Files
        </h2>
        <p className="text-[13.5px] lg:text-[14.5px] text-slate-400 font-medium">
          Upload a Base File and New File to generate a comparison report.
        </p>
      </div>

      {/* Upload Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 flex-none">
        {/* Base File Card */}
        <div className="bg-white border border-slate-200/60 p-6 rounded-xl relative shadow-[0_2px_12px_rgba(148,163,184,0.02)] flex flex-col justify-between min-h-[235px] lg:min-h-[250px] transition-all duration-300 ease-out">
          <div className="space-y-4.5">
            {/* Badge and Heading */}
            <div className="flex items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 font-semibold text-[17px] flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-slate-900 leading-tight">Base File</h3>
                <p className="text-[13px] text-slate-400 font-medium leading-tight mt-0.5">
                  Upload the original file to compare against.
                </p>
              </div>
            </div>

            {/* Document Icon */}
            <div className="flex items-center justify-center h-20 py-1 select-none">
              {baseFile.loading ? (
                <div className="w-full space-y-2.5 px-3.5">
                  <div className="flex justify-between text-[12px] font-semibold text-slate-500">
                    <span className="truncate max-w-[170px]">{baseFile.name}</span>
                    <span>{baseFile.progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-100"
                      style={{ width: `${baseFile.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => baseInputRef.current?.click()}
                  className="relative hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                  <div className="w-15 h-19 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-md border border-blue-200/30">
                    <DocumentSvg size={38} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action */}
          <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between min-h-[42px]">
            {baseFile.file && !baseFile.loading ? (
              <div className="flex items-center justify-between w-full bg-slate-50 border border-slate-150 p-3 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <DocumentSvg size={15} />
                  </span>
                  <span className="text-[13px] font-semibold text-slate-900 truncate flex-1 min-w-0">
                    {baseFile.name}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                    ({baseFile.size})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-5.5 h-5.5 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold text-[11px] shadow-sm shrink-0">
                    ✓
                  </span>
                  <button
                    onClick={() => clearFile(true)}
                    className="text-[11px] text-rose-500 font-semibold hover:underline select-none cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => baseInputRef.current?.click()}
                className="w-full py-2.5 border border-blue-600/10 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-[13px] font-semibold transition-all text-center select-none cursor-pointer"
              >
                Upload Base File
              </button>
            )}
          </div>
        </div>

        {/* New File Card */}
        <div className="bg-white border border-slate-200/60 p-6 rounded-xl relative shadow-[0_2px_12px_rgba(148,163,184,0.02)] flex flex-col justify-between min-h-[235px] lg:min-h-[250px] transition-all duration-300 ease-out">
          <div className="space-y-4.5">
            {/* Badge and Heading */}
            <div className="flex items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-purple-50 text-purple-600 font-semibold text-[17px] flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-slate-900 leading-tight">New File</h3>
                <p className="text-[13px] text-slate-400 font-medium leading-tight mt-0.5">
                  Upload the updated file to compare with.
                </p>
              </div>
            </div>

            {/* Document Icon */}
            <div className="flex items-center justify-center h-20 py-1 select-none">
              {newFile.loading ? (
                <div className="w-full space-y-2.5 px-3.5">
                  <div className="flex justify-between text-[12px] font-semibold text-slate-500">
                    <span className="truncate max-w-[170px]">{newFile.name}</span>
                    <span>{newFile.progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-purple-500 transition-all duration-100"
                      style={{ width: `${newFile.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => newInputRef.current?.click()}
                  className="relative hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                  <div className="w-15 h-19 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shadow-md border border-purple-200/30">
                    <DocumentSvg size={38} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action */}
          <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between min-h-[42px]">
            {newFile.file && !newFile.loading ? (
              <div className="flex items-center justify-between w-full bg-slate-50 border border-slate-150 p-3 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <DocumentSvg size={15} />
                  </span>
                  <span className="text-[13px] font-semibold text-slate-900 truncate flex-1 min-w-0">
                    {newFile.name}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                    ({newFile.size})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-5.5 h-5.5 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold text-[11px] shadow-sm shrink-0">
                    ✓
                  </span>
                  <button
                    onClick={() => clearFile(false)}
                    className="text-[11px] text-rose-500 font-semibold hover:underline select-none cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => newInputRef.current?.click()}
                className="w-full py-2.5 border border-blue-600/10 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-[13px] font-semibold transition-all text-center select-none cursor-pointer"
              >
                Upload New File
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Key Column Input */}
      <div className="flex-none">
        <label className="block text-[13px] font-semibold text-slate-900 mb-2.5">
          Key Column <span className="text-slate-400 font-medium">(Optional)</span>
        </label>
        <input
          type="text"
          value={keyColumn}
          onChange={(e) => setKeyColumn(e.target.value)}
          placeholder="Example: ID"
          className="w-full px-4 py-3 border border-slate-200/60 rounded-xl bg-white text-[13px] font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <p className="text-[12px] text-slate-400 font-medium mt-2">
          Enter a column name to match records by key value. Leaves blank to match by row position.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex-none p-4 bg-rose-50 border border-rose-200/60 rounded-xl">
          <p className="text-[13px] font-medium text-rose-700">{error}</p>
        </div>
      )}

      {/* Compare Button */}
      <div className="flex-none">
        <button
          onClick={handleCompare}
          disabled={!baseFile.file || !newFile.file || isComparing}
          className={`w-full py-4 px-6 rounded-xl text-[15px] font-semibold tracking-wide flex items-center justify-center gap-2.5 shadow-sm transition-all duration-300 ${baseFile.file && newFile.file && !isComparing
              ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-[0.98] shadow-md shadow-blue-500/10"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
        >
          {isComparing ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Comparing Files...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="12 3 20 9 12 15"></polyline>
                <polyline points="12 3 4 9 12 15"></polyline>
              </svg>
              <span>Compare Files</span>
            </>
          )}
        </button>
      </div>

      {/* Results Section */}
      {comparisonResult && (
        <div className="flex-1 space-y-5">
          {/* Summary Section */}
          {comparisonResult.summary && (
            <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
              <h3 className="text-[18px] font-semibold text-slate-900 mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-bold uppercase">Base Rows</p>
                  <p className="text-[20px] font-semibold text-blue-600">{comparisonResult.summary.base_file_rows}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-bold uppercase">New Rows</p>
                  <p className="text-[20px] font-semibold text-purple-600">{comparisonResult.summary.new_file_rows}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-bold uppercase">Added</p>
                  <p className="text-[20px] font-semibold text-emerald-600">
                    {comparisonResult.summary.added_record_count}
                  </p>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-bold uppercase">Deleted</p>
                  <p className="text-[20px] font-semibold text-rose-600">
                    {comparisonResult.summary.deleted_record_count}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-bold uppercase">Modified</p>
                  <p className="text-[20px] font-semibold text-amber-600">
                    {comparisonResult.summary.modified_record_count}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Missing Columns */}
          {comparisonResult.missing_columns && comparisonResult.missing_columns.length > 0 && (
            <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
              <h3 className="text-[18px] font-semibold text-slate-900 mb-4">Missing Columns</h3>
              <div className="space-y-2">
                {comparisonResult.missing_columns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                      -
                    </span>
                    <span className="text-[13px] font-bold text-slate-700">{col}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Columns */}
          {comparisonResult.additional_columns && comparisonResult.additional_columns.length > 0 && (
            <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
              <h3 className="text-[18px] font-semibold text-slate-900 mb-4">Additional Columns</h3>
              <div className="space-y-2">
                {comparisonResult.additional_columns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className="w-6 h-6 rounded-full bg-emerald-200 flex items-center justify-center text-[11px] font-semibold text-emerald-600">
                      +
                    </span>
                    <span className="text-[13px] font-bold text-slate-700">{col}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Possible Renamed Columns */}
          {comparisonResult.possible_renamed_columns &&
            comparisonResult.possible_renamed_columns.length > 0 && (
              <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
                <h3 className="text-[18px] font-semibold text-slate-900 mb-4">Possible Renamed Columns</h3>
                <div className="space-y-2">
                  {comparisonResult.possible_renamed_columns.map((rename, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-[13px] font-bold text-slate-700">{rename.base_column}</span>
                        <span className="text-[11px] text-slate-400">→</span>
                        <span className="text-[13px] font-bold text-slate-700">{rename.possible_new_column}</span>
                      </div>
                      <span className="text-[12px] font-semibold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg">
                        {(rename.similarity_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Value Differences */}
          {comparisonResult.value_differences && comparisonResult.value_differences.length > 0 && (
            <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
              <h3 className="text-[18px] font-semibold text-slate-900 mb-4">
                Value Differences ({comparisonResult.value_differences.length})
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {comparisonResult.value_differences.slice(0, 50).map((diff, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-150">
                    <p className="text-[12px] font-semibold text-slate-600 mb-2">
                      {diff.column} - Record {diff.record_key}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold">Base (Row {diff.base_row})</p>
                        <p className="text-[12px] font-bold text-rose-600">{String(diff.base_value)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold">New (Row {diff.new_row})</p>
                        <p className="text-[12px] font-bold text-emerald-600">{String(diff.new_value)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Representation Differences */}
          {comparisonResult.representation_differences &&
            comparisonResult.representation_differences.length > 0 && (
              <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
                <h3 className="text-[18px] font-semibold text-slate-900 mb-4">
                  Representation Differences ({comparisonResult.representation_differences.length})
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {comparisonResult.representation_differences.slice(0, 50).map((diff, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-150">
                      <p className="text-[12px] font-semibold text-slate-600 mb-2">
                        {diff.column} - Record {diff.record_key}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold">Base (Row {diff.base_row})</p>
                          <p className="text-[12px] font-bold text-blue-600">{String(diff.base_value)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold">New (Row {diff.new_row})</p>
                          <p className="text-[12px] font-bold text-blue-600">{String(diff.new_value)}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-2">Normalized: {String(diff.normalized_value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Added Records */}
          {comparisonResult.added_records && comparisonResult.added_records.length > 0 && (
            <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
              <h3 className="text-[18px] font-semibold text-slate-900 mb-4">
                Added Records ({comparisonResult.added_records.length})
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {comparisonResult.added_records.slice(0, 50).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                    <span className="w-6 h-6 rounded-full bg-emerald-200 flex items-center justify-center text-[11px] font-semibold text-emerald-600 shrink-0">
                      +
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-emerald-700">Key: {item.record_key}</p>
                      <p className="text-[11px] text-slate-600 font-bold truncate">
                        {JSON.stringify(item.record).substring(0, 100)}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted Records */}
          {comparisonResult.deleted_records && comparisonResult.deleted_records.length > 0 && (
            <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
              <h3 className="text-[18px] font-semibold text-slate-900 mb-4">
                Deleted Records ({comparisonResult.deleted_records.length})
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {comparisonResult.deleted_records.slice(0, 50).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-rose-50 rounded-lg">
                    <span className="w-6 h-6 rounded-full bg-rose-200 flex items-center justify-center text-[11px] font-semibold text-rose-600 shrink-0">
                      −
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-rose-700">Key: {item.record_key}</p>
                      <p className="text-[11px] text-slate-600 font-bold truncate">
                        {JSON.stringify(item.record).substring(0, 100)}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate Keys */}
          {comparisonResult.duplicate_keys &&
            Object.keys(comparisonResult.duplicate_keys).length > 0 && (
              <div className="bg-white border border-slate-200/60 p-6 rounded-xl shadow-[0_2px_12px_rgba(148,163,184,0.02)]">
                <h3 className="text-[18px] font-semibold text-slate-900 mb-4">Duplicate Keys</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {Object.entries(comparisonResult.duplicate_keys).map(([key, counts], idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-[13px] font-bold text-slate-700">{key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-blue-600">Base: {counts.base}</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-[12px] font-bold text-purple-600">New: {counts.new}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Loading Dialog */}
      {isComparing && (
        <div className="fixed inset-0 bg-[#000839]/60 backdrop-blur-md flex items-center justify-center z-50 transition-all duration-300">
          <div className="bg-white p-8 rounded-xl max-w-md w-full shadow-2xl border border-slate-100 scale-100 flex flex-col space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-[#002BFF] animate-spin" />
              <h3 className="text-[20px] font-semibold text-slate-900">Comparing Files...</h3>
              <p className="text-[13.5px] text-slate-400 font-semibold leading-relaxed">
                Analyzing schema changes, value differences, and record modifications.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
