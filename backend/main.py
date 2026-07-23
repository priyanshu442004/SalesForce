import os
import re
import json
import shutil
import tempfile
import uuid
import io
import zipfile
import sqlite3
from datetime import datetime
from difflib import SequenceMatcher
from typing import List, Optional
import math
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from data_validation import run_data_validation, write_validation_report
from data_cleaning import run_data_cleaning
from processor import process_preview
from comparison import compare_excel_files
from transformer import transform_source_data, inspect_mapping_requirements
import boto3
from dotenv import load_dotenv
from simple_salesforce import Salesforce
from simple_salesforce.exceptions import SalesforceAuthenticationFailed

# Load backend environment configurations
load_dotenv()
from pydantic import BaseModel

class SalesforceLoginRequest(BaseModel):
    username: str
    password: str
    security_token: str

def _aggregate_issues(issues: list) -> list:
    """Group raw validation issues by field, deduplicating issue types and summing counts."""
    agg: dict[str, dict] = {}
    for issue in issues:
        field = issue.get("field", "")
        issue_type = issue.get("issue_type", "")
        if field not in agg:
            agg[field] = {"field": field, "_seen_types": [], "count": 0}
        if issue_type and issue_type not in agg[field]["_seen_types"]:
            agg[field]["_seen_types"].append(issue_type)
        agg[field]["count"] += 1
    return [
        {
            "field": v["field"],
            "issue_types": ", ".join(v["_seen_types"]),
            "count": v["count"],
        }
        for v in agg.values()
    ]

app = FastAPI(
    title="Data Migration Tool API",
    description="S3-powered scalable API for calculations and Excel processing",
    version="1.1.0"
)

# Enable CORS for Next.js frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Salesforce OAuth routes
from salesforce import router as salesforce_router
app.include_router(salesforce_router)

# Import Jobs monitoring
from import_jobs import router as import_jobs_router
app.include_router(import_jobs_router)

# Database connection routes
from database import router as database_router
app.include_router(database_router)

# SQL Workspace routes
from sql_workspace import router as sql_workspace_router
app.include_router(sql_workspace_router)

# Initialize AWS S3 client
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "s3-bucket-analytx4t")

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

# Helper function to download file from S3 to a local temp file.
# NOTE: do NOT call head_object here. s3:HeadObject is a separate IAM action
# from s3:GetObject, and many bucket policies grant only GetObject. boto3's
# download_file uses a single GetObject for files < 8 MB (no HeadObject).
# Diagnostic detail is extracted from the ClientError raised by download_file.
def temp_download(s3_key: str) -> str:
    print(f"[temp_download] attempting s3://{AWS_BUCKET_NAME}/{s3_key}")
    suffix = os.path.splitext(s3_key)[1] or ".xlsx"
    temp_fd, temp_path = tempfile.mkstemp(suffix=suffix)
    os.close(temp_fd)
    try:
        s3_client.download_file(AWS_BUCKET_NAME, s3_key, temp_path)
        print(f"[temp_download] downloaded OK → {temp_path}")
        return temp_path
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        err_str = str(e)
        code = getattr(getattr(e, "response", None), "get", lambda *_: None)("Error", {}).get("Code", "")
        if "404" in err_str or "NoSuchKey" in err_str or code == "404":
            raise HTTPException(
                status_code=404,
                detail=f"S3 key does not exist: '{s3_key}'. Re-upload the file and try again.",
            )
        if "403" in err_str or "Forbidden" in err_str or code == "403":
            raise HTTPException(
                status_code=404,
                detail=(
                    f"S3 key not found or inaccessible: '{s3_key}'. "
                    "The file may have been uploaded under a different project or deleted. "
                    "Re-upload the file and try again."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Failed to download '{s3_key}' from S3: {err_str}")


# Helper to upload local file to S3
def upload_to_s3(local_path: str, s3_key: str):
    try:
        s3_client.upload_file(local_path, AWS_BUCKET_NAME, s3_key)
        print(f"[upload_to_s3] uploaded OK → s3://{AWS_BUCKET_NAME}/{s3_key}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload output to S3: {str(e)}")

@app.get("/")
def read_root():
    return {"message": "Welcome to the S3-Scalable Salesforce Migration Backend API!"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "data-migration-s3-api"}

@app.post("/api/upload-migration-files")
async def upload_migration_files(
    x_project_id: str = Header(None),
    x_client_id: str = Header(None),
    source: UploadFile = File(None),
    master: UploadFile = File(None),
    logic: UploadFile = File(None)
):
    """
    Uploads files to S3 inside a folder dedicated to the client and project IDs.
    Returns the uploaded file details for database recording.
    """
    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id
    saved_files = []
    
    files_to_upload = {
        "source": source,
        "master": master,
        "logic": logic
    }
    
    try:
        for slot, file_obj in files_to_upload.items():
            if file_obj:
                filename = file_obj.filename
                # Read bytes to calculate size
                file_bytes = await file_obj.read()
                size_mb = f"{(len(file_bytes) / (1024 * 1024)):.2f} MB"
                
                # S3 Key structure: clients/{client_id}/projects/{project_id}/uploads/{slot}/{timestamp}_{filename}
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                if client_id:
                    s3_key = f"clients/{client_id}/projects/{project_id}/uploads/{slot}/{timestamp}_{filename}"
                else:
                    s3_key = f"projects/{project_id}/uploads/{slot}/{timestamp}_{filename}"
                
                # Upload to S3
                s3_client.put_object(
                    Bucket=AWS_BUCKET_NAME,
                    Key=s3_key,
                    Body=file_bytes
                )
                
                saved_files.append({
                    "slot": slot,
                    "fileName": filename,
                    "fileSize": size_mb,
                    "s3Key": s3_key
                })
        
        return {
            "success": True,
            "message": "Successfully uploaded files to S3",
            "files": saved_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 File upload failed: {str(e)}")

@app.post("/api/upload-comparison-files")
async def upload_comparison_files(
    x_project_id: str = Header(None),
    x_client_id: str = Header(None),
    base_file: UploadFile = File(None),
    new_file: UploadFile = File(None)
):
    """
    Uploads comparison files to S3.
    """
    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id
    saved_files = []
    
    files_to_upload = {
        "base_file": base_file,
        "new_file": new_file
    }
    
    try:
        for slot, file_obj in files_to_upload.items():
            if file_obj:
                filename = file_obj.filename
                file_bytes = await file_obj.read()
                size_mb = f"{(len(file_bytes) / (1024 * 1024)):.2f} MB"
                
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                if client_id:
                    s3_key = f"clients/{client_id}/projects/{project_id}/comparison/{slot}/{timestamp}_{filename}"
                else:
                    s3_key = f"projects/{project_id}/comparison/{slot}/{timestamp}_{filename}"
                
                s3_client.put_object(
                    Bucket=AWS_BUCKET_NAME,
                    Key=s3_key,
                    Body=file_bytes
                )
                
                saved_files.append({
                    "slot": slot,
                    "fileName": filename,
                    "fileSize": size_mb,
                    "s3Key": s3_key
                })
                
        return {
            "success": True,
            "message": "Successfully uploaded comparison files to S3",
            "files": saved_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 Comparison upload failed: {str(e)}")

@app.post("/api/compare-files")
def compare_files(
    base_key: str = Query(...),
    new_key: str = Query(...),
    key_column: str = None
):
    """
    Compares two files stored in S3.
    """
    temp_base = None
    temp_new = None
    try:
        temp_base = temp_download(base_key)
        temp_new = temp_download(new_key)
        
        report = compare_excel_files(
            temp_base,
            temp_new,
            key_column=key_column
        )
        return report
    finally:
        # Cleanup
        if temp_base and os.path.exists(temp_base):
            os.remove(temp_base)
        if temp_new and os.path.exists(temp_new):
            os.remove(temp_new)

@app.post("/api/validate-schema")
def validate_schema(
    source_key: str = Query(...),
    logic_key: str = Query(...),
    x_project_id: str = Header(None)
):
    """
    Validates schema using source and mapping logic files stored in S3.
    """
    project_id = x_project_id or "(unknown)"
    print(f"[validate-schema] project_id: {project_id}")
    print(f"[validate-schema] source_key: {source_key}")
    print(f"[validate-schema] logic_key:  {logic_key}")

    temp_source = None
    temp_logic = None
    try:
        temp_source = temp_download(source_key)
        temp_logic = temp_download(logic_key)
        
        from processor import validate_schema as _validate
        out = _validate(temp_source, temp_logic)
        if not out.get("success"):
            raise HTTPException(status_code=500, detail=out.get("error", "Validation failed"))
            
        return out["result"]
    finally:
        if temp_source and os.path.exists(temp_source):
            os.remove(temp_source)
        if temp_logic and os.path.exists(temp_logic):
            os.remove(temp_logic)

@app.post("/api/clean-data")
def clean_data(
    source_key: str = Query(...),
    logic_key: str = Query(...),
    x_project_id: str = Header(None),
    x_client_id: str = Header(None)
):
    """
    Cleans source data and uploads the cleaned file to S3.
    Returns summary statistics and a detailed change log.
    """
    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id
    temp_source = None
    temp_logic = None
    temp_cleaned_path = None

    print(f"[clean-data] project_id: {project_id}")
    print(f"[clean-data] client_id:  {client_id}")
    print(f"[clean-data] source_key: {source_key}")
    print(f"[clean-data] logic_key:  {logic_key}")

    try:
        temp_source = temp_download(source_key)
        temp_logic = temp_download(logic_key)

        out = run_data_cleaning(temp_source, temp_logic)
        if not out.get("success"):
            raise HTTPException(status_code=500, detail=out.get("error", "Data cleaning failed"))

        # Save cleaned DataFrame to a temp Excel file and upload to S3
        temp_fd, temp_cleaned_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(temp_fd)

        cleaned_df = out["cleaned_df"]
        cleaned_df.to_excel(temp_cleaned_path, index=False)

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        if client_id:
            s3_cleaned_key = f"clients/{client_id}/projects/{project_id}/uploads/source_cleaned/{timestamp}_cleaned_source.xlsx"
        else:
            s3_cleaned_key = f"projects/{project_id}/uploads/source_cleaned/{timestamp}_cleaned_source.xlsx"
        upload_to_s3(temp_cleaned_path, s3_cleaned_key)
        print(f"[clean-data] cleaned S3 key: {s3_cleaned_key}")

        return {
            "success": True,
            "cleanedS3Key": s3_cleaned_key,
            "summary": out["summary"],
            "changes": out["changes"],
            "total_changes": out["total_changes"],
        }
    finally:
        if temp_source and os.path.exists(temp_source):
            os.remove(temp_source)
        if temp_logic and os.path.exists(temp_logic):
            os.remove(temp_logic)
        if temp_cleaned_path and os.path.exists(temp_cleaned_path):
            os.remove(temp_cleaned_path)


@app.post("/api/validate-data")
def validate_data(
    source_key: str = Query(...),
    logic_key: str = Query(...),
    master_key: str = Query(None),
    x_project_id: str = Header(None),
    x_client_id: str = Header(None)
):
    """
    Validates data and uploads the report to S3 if issues are found.
    """


    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id
    print(f"[validate-data] project_id:  {project_id}")
    print(f"[validate-data] client_id:   {client_id}")
    print(f"[validate-data] source_key:  {source_key}")
    print(f"[validate-data] logic_key:   {logic_key}")
    if master_key:
        print(f"[validate-data] master_key:  {master_key}")

    temp_source = None
    temp_logic = None
    temp_master = None
    temp_report_path = None

    try:
        temp_source = temp_download(source_key)
        
        temp_logic = temp_download(logic_key)
        if master_key:
            temp_master = temp_download(master_key)
        
        out = run_data_validation(temp_source, temp_logic, master_path=temp_master)
        if not out.get("success"):
            raise HTTPException(status_code=500, detail=out.get("error", "Data validation failed"))
            
        s3_report_key = None
        if out.get("total_issues", 0) > 0:
            # Create a local temp validation report file
            temp_fd, temp_report_path = tempfile.mkstemp(suffix=".xlsx")
            os.close(temp_fd)
            
            write_validation_report(out["issues"], temp_report_path)
            
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            if client_id:
                s3_report_key = f"clients/{client_id}/projects/{project_id}/outputs/validation_report/{timestamp}_data_validation_report.xlsx"
            else:
                s3_report_key = f"projects/{project_id}/outputs/validation_report/{timestamp}_data_validation_report.xlsx"
            
            # Upload the report to S3
            upload_to_s3(temp_report_path, s3_report_key)
            
        return {
            "success": True,
            "total_records": out.get("total_records", 0),
            "total_issues": out.get("total_issues", 0),
            "summary": out.get("summary", {}),
            "issues": _aggregate_issues(out.get("issues", [])),
            "reportS3Key": s3_report_key
        }
    finally:
        if temp_source and os.path.exists(temp_source):
            os.remove(temp_source)
        if temp_logic and os.path.exists(temp_logic):
            os.remove(temp_logic)
        if temp_master and os.path.exists(temp_master):
            os.remove(temp_master)
        if temp_report_path and os.path.exists(temp_report_path):
            os.remove(temp_report_path)

@app.post("/api/generate-preview")
def generate_preview(
    source_key: str = Query(...),
    master_key: str = Query(...),
    logic_key: str = Query(...),
    x_project_id: str = Header(None),
    x_client_id: str = Header(None)
):
    """
    Generates mapping preview and uploads generated Excel sheet to S3.
    """
    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id
    temp_source = None
    temp_master = None
    temp_logic = None
    temp_output_path = None
    try:
        temp_source = temp_download(source_key)
        temp_master = temp_download(master_key)
        temp_logic = temp_download(logic_key)
        
        temp_fd, temp_output_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(temp_fd)
        
        res = process_preview(
            source_path=temp_source,
            master_path=temp_master,
            logic_path=temp_logic,
            output_path=temp_output_path
        )
        
        if not res["success"]:
            raise HTTPException(status_code=500, detail=f"Data processing failed: {res.get('error')}")
            
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        if client_id:
            s3_preview_key = f"clients/{client_id}/projects/{project_id}/outputs/preview/{timestamp}_preview.xlsx"
        else:
            s3_preview_key = f"projects/{project_id}/outputs/preview/{timestamp}_preview.xlsx"
        
        upload_to_s3(temp_output_path, s3_preview_key)
        
        res["previewS3Key"] = s3_preview_key
        return res
    finally:
        if temp_source and os.path.exists(temp_source):
            os.remove(temp_source)
        if temp_master and os.path.exists(temp_master):
            os.remove(temp_master)
        if temp_logic and os.path.exists(temp_logic):
            os.remove(temp_logic)
        if temp_output_path and os.path.exists(temp_output_path):
            os.remove(temp_output_path)

@app.post("/api/transform-data")
def transform_data(
    source_key: str = Query(...),
    logic_key: str = Query(...),
    master_key: Optional[str] = Query(None),
    skipped_fields: List[str] = Query(default=[]),
    # Master Salesforce credentials — used exclusively for Lookup(S) SOQL queries.
    master_sf_access_token: Optional[str] = Query(None),
    master_sf_instance_url: Optional[str] = Query(None),
    # Deprecated aliases kept for backward compatibility (clients that still send
    # the old sf_access_token / sf_instance_url params continue to work).
    sf_access_token: Optional[str] = Query(None),
    sf_instance_url: Optional[str] = Query(None),
    x_project_id: str = Header(None),
    x_client_id: str = Header(None)
):
    """
    Transforms data for every mapping sheet independently.

    Each sheet in the logic workbook produces one .xlsx output file.
    When more than one sheet is present the outputs are also packaged
    into a single .zip file and uploaded to S3.
    """
    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id
    print(f"[transform-data] project_id:  {project_id}")
    print(f"[transform-data] client_id:   {client_id}")
    print(f"[transform-data] source_key:  {source_key}")
    print(f"[transform-data] master_key:  {master_key}")
    print(f"[transform-data] logic_key:   {logic_key}")

    temp_source = None
    temp_master = None
    temp_logic = None
    temp_output_dir = None
    try:
        temp_source = temp_download(source_key)
        temp_master = temp_download(master_key) if master_key else None
        temp_logic = temp_download(logic_key)

        temp_output_dir = tempfile.mkdtemp()

        # Prefer the explicit master_sf_* params; fall back to the legacy aliases.
        resolved_token = master_sf_access_token or sf_access_token
        resolved_url   = master_sf_instance_url or sf_instance_url
        sf_credentials = (
            {"access_token": resolved_token, "instance_url": resolved_url}
            if resolved_token and resolved_url
            else None
        )

        try:
            transform_result = transform_source_data(
                source_path=temp_source,
                logic_path=temp_logic,
                output_dir=temp_output_dir,
                master_path=temp_master,
                skipped_fields=skipped_fields,
                sf_credentials=sf_credentials,
            )
        except ValueError as ve:
            raise HTTPException(status_code=422, detail=str(ve))

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        sheet_outputs = transform_result.get("outputs", [])

        # Upload each per-sheet file to S3
        uploaded_outputs = []
        for sheet in sheet_outputs:
            sheet_name = sheet["sheet_name"]
            local_path = sheet["output_path"]
            safe_name = os.path.basename(local_path)
            if client_id:
                s3_key = f"clients/{client_id}/projects/{project_id}/outputs/transformed_data/{timestamp}_{safe_name}"
            else:
                s3_key = f"projects/{project_id}/outputs/transformed_data/{timestamp}_{safe_name}"
            upload_to_s3(local_path, s3_key)
            uploaded_outputs.append({
                "sheetName": sheet_name,
                "transformedS3Key": s3_key,
                "fileName": safe_name,
                "total_rows": sheet.get("total_rows", 0),
                "transformed_columns": sheet.get("transformed_columns", []),
                "lookup_stats": sheet.get("lookup_stats", []),
            })

        # If more than one sheet, also build and upload a ZIP
        zip_s3_key = None
        zip_file_name = None
        if len(sheet_outputs) > 1:
            zip_local_path = os.path.join(temp_output_dir, "transformed_data.zip")
            with zipfile.ZipFile(zip_local_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for sheet in sheet_outputs:
                    zf.write(sheet["output_path"], arcname=os.path.basename(sheet["output_path"]))
            zip_file_name = "transformed_data.zip"
            if client_id:
                zip_s3_key = f"clients/{client_id}/projects/{project_id}/outputs/transformed_data/{timestamp}_{zip_file_name}"
            else:
                zip_s3_key = f"projects/{project_id}/outputs/transformed_data/{timestamp}_{zip_file_name}"
            upload_to_s3(zip_local_path, zip_s3_key)

        return {
            "success": True,
            "outputs": uploaded_outputs,
            "zipS3Key": zip_s3_key,
            "zipFileName": zip_file_name,
            "generatedAt": datetime.now().isoformat(),
        }
    finally:
        if temp_source and os.path.exists(temp_source):
            os.remove(temp_source)
        if temp_master and os.path.exists(temp_master):
            os.remove(temp_master)
        if temp_logic and os.path.exists(temp_logic):
            os.remove(temp_logic)
        if temp_output_dir and os.path.exists(temp_output_dir):
            shutil.rmtree(temp_output_dir, ignore_errors=True)

@app.get("/api/preview-output")
def preview_output(
    s3_key: str = Query(...),
    limit: int = Query(100, ge=1, le=500),
    sheet_name: str = Query(None)
):
    """
    Reads a file (Excel or CSV) from S3 and returns the first `limit` rows as JSON,
    along with sheet names if the file is an Excel workbook.
    """
    import math
    import pandas as pd

    def safe_val(v):
        if v is None:
            return None
        if isinstance(v, float) and math.isnan(v):
            return None
        if hasattr(v, "isoformat"):
            try:
                return v.isoformat()
            except Exception:
                return str(v)
        return v

    temp_path = None
    try:
        temp_path = temp_download(s3_key)
        ext = os.path.splitext(s3_key)[1].lower()
        sheet_names = []
        selected_sheet = None

        if ext in [".xlsx", ".xls"]:
            with pd.ExcelFile(temp_path) as xl:
                sheet_names = xl.sheet_names
                if sheet_name and sheet_name in sheet_names:
                    selected_sheet = sheet_name
                else:
                    selected_sheet = sheet_names[0] if sheet_names else None
                df = pd.read_excel(xl, sheet_name=selected_sheet, nrows=limit)
        elif ext == ".sql":
            with open(temp_path, "r", encoding="utf-8", errors="replace") as f:
                sql_script = f.read()
            conn = sqlite3.connect(":memory:")
            conn.executescript(sql_script)
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            sheet_names = [row[0] for row in cursor.fetchall()]
            if sheet_name and sheet_name in sheet_names:
                selected_sheet = sheet_name
            else:
                selected_sheet = sheet_names[0] if sheet_names else None
            if selected_sheet:
                df = pd.read_sql_query(f'SELECT * FROM "{selected_sheet}" LIMIT {limit}', conn)
            else:
                df = pd.DataFrame()
            conn.close()
        else:
            df = pd.read_csv(temp_path, nrows=limit)
            sheet_names = ["CSV"]
            selected_sheet = "CSV"

        columns = [str(c) for c in df.columns.tolist()]
        rows = [[safe_val(v) for v in row] for row in df.values.tolist()]
        return {
            "success": True,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "sheet_names": sheet_names,
            "selected_sheet": selected_sheet
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview output: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/api/download-file")
def download_file(s3_key: str = Query(...)):
    """
    Downloads a file from S3 and streams it to the client.
    Supports .xlsx and .zip files; content-type is derived from the extension.
    """
    MIME_TYPES = {
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".zip":  "application/zip",
    }
    try:
        response = s3_client.get_object(Bucket=AWS_BUCKET_NAME, Key=s3_key)
        file_content = response["Body"].read()

        # Strip S3 folders and timestamp prefix to get a clean download filename
        filename = os.path.basename(s3_key)
        if "_" in filename:
            filename = filename.split("_", 1)[-1]

        ext = os.path.splitext(filename)[1].lower()
        media_type = MIME_TYPES.get(ext, "application/octet-stream")

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream download: {str(e)}")

@app.post("/api/log-change-s3")
def log_change_s3(
    project_id: str = Query(...),
    change_name: str = Query(...),
    timestamp: str = Query(None)
):
    """
    Appends a change name and timestamp to the project's activity log file in S3.
    """
    if not timestamp:
        timestamp = datetime.now().isoformat()
    
    s3_key = f"projects/{project_id}/activity_log.json"
    
    try:
        response = s3_client.get_object(Bucket=AWS_BUCKET_NAME, Key=s3_key)
        logs = json.loads(response['Body'].read().decode('utf-8'))
    except Exception:
        logs = []
        
    logs.append({
        "change_name": change_name,
        "timestamp": timestamp
    })
    
    try:
        s3_client.put_object(
            Bucket=AWS_BUCKET_NAME,
            Key=s3_key,
            Body=json.dumps(logs, indent=2).encode('utf-8'),
            ContentType="application/json"
        )
        return {"success": True, "message": "Logged change to S3 successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save change log to S3: {str(e)}")


# ---------------------------------------------------------------------------
# Unique Identifier Module
# ---------------------------------------------------------------------------

def _load_df_from_path(path: str):
    import pandas as pd
    ext = os.path.splitext(path)[1].lower()
    if ext == ".sql":
        from processor import _load_sql_as_sheets
        sheets = _load_sql_as_sheets(path)
        return next(iter(sheets.values()))
    if ext == ".csv":
        return pd.read_csv(path, keep_default_na=False, na_values=[""])
    return pd.read_excel(path, keep_default_na=False, na_values=[""])


_ENUMERATED_DT: set = {
    "picklist", "picklist(multiselect)", "picklist (multiselect)",
    "multi picklist", "multipicklist", "multi select picklist",
    "multi-select picklist", "multiselect picklist", "checkbox",
}


def _is_enumerated_type(data_type: str) -> bool:
    if not data_type:
        return False
    s = str(data_type).strip().lower()
    if s in _ENUMERATED_DT:
        return True
    # Normalise parens / hyphens then re-check
    s2 = s.replace("(", "").replace(")", "").replace("-", " ").replace("  ", " ").strip()
    if s2 in _ENUMERATED_DT:
        return True
    # Starts with "picklist" covers "Picklist", "Picklist(MultiSelect)", etc.
    if s2.startswith("picklist"):
        return True
    # "multiselect" / "multi select" anywhere in the type string
    if "multiselect" in s2.replace(" ", ""):
        return True
    if "multi" in s2 and ("picklist" in s2 or "select" in s2):
        return True
    return False


_NORM_COL_RE = re.compile(r"[^a-z0-9]")


def _normalize_col_for_match(s: str) -> str:
    """Lowercase, strip, keep alphanumeric only — covers space/underscore/hyphen differences."""
    return _NORM_COL_RE.sub("", s.lower().strip())


def _match_source_col_to_mapping(
    source_col: str,
    field_types: dict,
    fuzzy_threshold: float = 0.80,
) -> Optional[str]:
    """
    Match a source column name to a mapping entry.
    Tries strategies in order; returns the mapped data_type or None.

    Strategies:
    1. Exact string match
    2. Case-insensitive + trimmed match
    3. Normalized match (alphanumeric only, lowercase)
    4. Fuzzy match (SequenceMatcher on normalized names)
    """
    # 1. Exact
    if source_col in field_types:
        return field_types[source_col]

    # 2. Case-insensitive trimmed
    sc_ci = source_col.strip().lower()
    for k, v in field_types.items():
        if k.strip().lower() == sc_ci:
            return v

    # 3. Normalized (strips underscores, spaces, hyphens, etc.)
    sc_norm = _normalize_col_for_match(source_col)
    if sc_norm:
        for k, v in field_types.items():
            if _normalize_col_for_match(k) == sc_norm:
                return v

    # 4. Fuzzy on normalized names
    if sc_norm and fuzzy_threshold < 1.0:
        best_score = 0.0
        best_type: Optional[str] = None
        for k, v in field_types.items():
            k_norm = _normalize_col_for_match(k)
            if not k_norm:
                continue
            score = SequenceMatcher(None, sc_norm, k_norm).ratio()
            if score > best_score:
                best_score = score
                best_type = v
        if best_score >= fuzzy_threshold and best_type is not None:
            return best_type

    return None


def _is_eligible_for_unique_identifier(data_type: str) -> bool:
    """Returns True for Boolean, Checkbox, Picklist, and MultiPicklist types."""
    if not data_type:
        return False
    s = str(data_type).strip().lower()
    if s in ("boolean", "bool"):
        return True
    return _is_enumerated_type(s)


def _eligible_fields_from_logic(logic_path: str) -> Optional[set]:
    """Return the set of source field names that have an enumerated datatype.

    Returns None when the logic file cannot be read, so the caller can decide
    whether to skip filtering entirely.
    """
    try:
        from data_validation import read_mapping_rules
        mapping_df = read_mapping_rules(logic_path)
        return {
            str(row["source_field"]).strip()
            for _, row in mapping_df.iterrows()
            if _is_enumerated_type(str(row.get("data_type", "") or ""))
        }
    except Exception:
        return None


def _field_types_from_logic(logic_path: str) -> Optional[dict]:
    """Return {source_field: sf_data_type} for every field in the mapping.

    Returns None when the logic file cannot be read.
    """
    try:
        from data_validation import read_mapping_rules
        mapping_df = read_mapping_rules(logic_path)
        return {
            str(row["source_field"]).strip(): str(row.get("data_type", "") or "Text").strip()
            for _, row in mapping_df.iterrows()
        }
    except Exception:
        return None


# ── Auto data-profiling helpers ────────────────────────────────────────────────

_BOOL_VOCAB: frozenset = frozenset({"yes", "no", "true", "false", "0", "1", "y", "n", "on", "off"})
_BOOL_POS: frozenset = frozenset({"yes", "true", "1", "y", "on"})
_BOOL_NEG: frozenset = frozenset({"no", "false", "0", "n", "off"})
_BLANK_LOWER: frozenset = frozenset({"", "nan", "null", "none", "na", "n/a", "<na>"})


def _is_numeric_str(v: str) -> bool:
    try:
        float(v.replace(",", "").replace(" ", ""))
        return True
    except (ValueError, AttributeError):
        return False


def _auto_detect_type(series, sample_size: int = 1000) -> str:
    """
    Infer a Salesforce-friendly type label from a pandas Series.
    Priority: Boolean > Number > Date > Picklist > Text.
    Only inspects the first `sample_size` non-blank values.
    """
    import pandas as pd

    vals = []
    for v in series[:sample_size]:
        if v is None:
            continue
        if isinstance(v, float) and math.isnan(v):
            continue
        s = str(v).strip()
        if s.lower() in _BLANK_LOWER:
            continue
        vals.append(s)

    if not vals:
        return "Text"

    lower_vals = [v.lower() for v in vals]
    unique_lower = set(lower_vals)

    # Boolean: every unique value is in the boolean vocab AND both sides represented
    if unique_lower.issubset(_BOOL_VOCAB) and (unique_lower & _BOOL_POS) and (unique_lower & _BOOL_NEG):
        return "Boolean"

    # Numeric: > 95 % of values parse as float
    numeric_count = sum(1 for v in vals if _is_numeric_str(v))
    if numeric_count / len(vals) > 0.95:
        return "Number"

    # Date: > 90 % of a capped sample parse as datetime (date parsing is expensive)
    date_sample = vals[:200]
    date_count = 0
    for v in date_sample:
        try:
            pd.to_datetime(v)
            date_count += 1
        except Exception:
            pass
    if date_sample and date_count / len(date_sample) > 0.90:
        return "Date"

    # Picklist: few absolute unique values AND ratio is not too high.
    # cardinality <= 20 catches short field lists (e.g. status, country code).
    # The ratio guard < 0.6 prevents mislabelling tiny datasets with many IDs.
    cardinality = len(unique_lower)
    total = len(vals)
    if total >= 5 and cardinality <= 20 and cardinality / total < 0.60:
        return "Picklist"

    return "Text"


def _map_db_column_type(db_type: str) -> str:
    """Map a raw SQL / MongoDB type string to a Salesforce-friendly display type."""
    t = (db_type or "").lower().strip().split("(")[0].strip()

    _BOOL_TYPES = {"boolean", "bool", "bit"}
    _NUM_TYPES = {
        "int", "integer", "bigint", "smallint", "tinyint", "mediumint",
        "serial", "bigserial", "smallserial",
        "float", "double", "real", "decimal", "numeric", "money",
        "double precision",
    }
    _DATE_TYPES = {"date"}
    _DATETIME_TYPES = {
        "timestamp", "datetime", "timestamptz",
        "timestamp with time zone", "timestamp without time zone",
    }
    _PICKLIST_TYPES = {"enum", "set"}

    if t in _BOOL_TYPES or t == "tinyint":
        return "Boolean"
    if (t in _NUM_TYPES or t.startswith("int") or t.startswith("float")
            or t.startswith("double") or t.startswith("decimal")
            or t.startswith("numeric")):
        return "Number"
    if t in _DATE_TYPES:
        return "Date"
    if t in _DATETIME_TYPES or t.startswith("timestamp") or t.startswith("datetime"):
        return "DateTime"
    if t in _PICKLIST_TYPES:
        return "Picklist"
    return "Text"


def _compute_unique_stats(df) -> list:
    import re
    _BLANK = {"", "nan", "null", "none", "na", "n/a", "<na>"}
    _DELIM = re.compile(r"[;/,]")
    results = []
    for col in df.columns:
        seen: list = []
        seen_set: set = set()
        for v in df[col]:
            if v is None:
                continue
            if isinstance(v, float) and math.isnan(v):
                continue
            raw = str(v).strip()
            if raw.lower() in _BLANK:
                continue
            for token in _DELIM.split(raw):
                token = token.strip()
                if not token or token.lower() in _BLANK:
                    continue
                if token not in seen_set:
                    seen_set.add(token)
                    seen.append(token)
        results.append({
            "field": str(col),
            "unique_count": len(seen),
            "unique_values": seen,
        })
    return results


@app.post("/api/unique-identifier/upload")
async def unique_identifier_upload(
    file: UploadFile = File(...),
    x_project_id: str = Header(None),
):
    project_id = x_project_id or str(uuid.uuid4())
    file_bytes = await file.read()
    size_mb = f"{(len(file_bytes) / (1024 * 1024)):.2f} MB"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    s3_key = f"projects/{project_id}/unique-identifier/{timestamp}_{file.filename}"
    s3_client.put_object(Bucket=AWS_BUCKET_NAME, Key=s3_key, Body=file_bytes)
    return {"success": True, "s3Key": s3_key, "fileName": file.filename, "fileSize": size_mb}


@app.get("/api/unique-identifier/analyze")
def unique_identifier_analyze(
    source_key: str = Query(...),
    logic_key: Optional[str] = Query(None),
    db_schema: Optional[str] = Query(None),  # JSON-encoded {col_name: db_type}
):
    import json as _json
    temp_path = None
    logic_temp = None
    try:
        temp_path = temp_download(source_key)
        df = _load_df_from_path(temp_path)
        stats = _compute_unique_stats(df)

        # ── Priority 1: Salesforce Mapping file ───────────────────────────────────
        if logic_key:
            logic_temp = temp_download(logic_key)
            field_types = _field_types_from_logic(logic_temp)
            if field_types is not None:
                # Run ALL comparison strategies for every source column before deciding
                # what to show. Never stop after the first exact match pass.
                result_stats = []
                for s in stats:
                    col = s["field"]
                    matched_type = _match_source_col_to_mapping(col, field_types)
                    if matched_type is not None:
                        # Column found in mapping — show only if its type is eligible
                        if _is_eligible_for_unique_identifier(matched_type):
                            s["detected_type"] = matched_type
                            s["type_source"] = "mapping"
                            result_stats.append(s)
                    else:
                        # Column not in mapping — auto-detect; show only if eligible type
                        auto_type = _auto_detect_type(df[col]) if col in df.columns else "Text"
                        if _is_eligible_for_unique_identifier(auto_type):
                            s["detected_type"] = auto_type
                            s["type_source"] = "auto_detected"
                            result_stats.append(s)
                stats = result_stats
            else:
                # Logic file unreadable — fall back to auto-detect (should be rare)
                for s in stats:
                    col = s["field"]
                    s["detected_type"] = _auto_detect_type(df[col]) if col in df.columns else "Text"
                    s["type_source"] = "auto_detected"

        # ── Priority 2: Database schema metadata ──────────────────────────────
        elif db_schema:
            try:
                schema_dict: dict = _json.loads(db_schema)
            except Exception:
                schema_dict = {}
            for s in stats:
                col = s["field"]
                if col in schema_dict:
                    s["detected_type"] = _map_db_column_type(schema_dict[col])
                    s["type_source"] = "db_schema"
                else:
                    s["detected_type"] = _auto_detect_type(df[col]) if col in df.columns else "Text"
                    s["type_source"] = "auto_detected"

        # ── Priority 3: Automatic data profiling ──────────────────────────────
        else:
            for s in stats:
                col = s["field"]
                s["detected_type"] = _auto_detect_type(df[col]) if col in df.columns else "Text"
                s["type_source"] = "auto_detected"

        return {"success": True, "columns": stats}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in (temp_path, logic_temp):
            if p and os.path.exists(p):
                os.remove(p)



@app.get("/api/unique-identifier/download")
def unique_identifier_download(source_key: str = Query(...), logic_key: Optional[str] = Query(None)):
    import pandas as pd
    temp_path = None
    logic_temp = None
    try:
        temp_path = temp_download(source_key)
        df = _load_df_from_path(temp_path)
        stats = _compute_unique_stats(df)

        if logic_key:
            logic_temp = temp_download(logic_key)
            field_types = _field_types_from_logic(logic_temp)
            if field_types is not None:
                eligible_cols: set = set()
                for s in stats:
                    col = s["field"]
                    matched_type = _match_source_col_to_mapping(col, field_types)
                    if matched_type is not None:
                        if _is_eligible_for_unique_identifier(matched_type):
                            eligible_cols.add(col)
                    else:
                        auto_type = _auto_detect_type(df[col]) if col in df.columns else "Text"
                        if _is_eligible_for_unique_identifier(auto_type):
                            eligible_cols.add(col)
                stats = [s for s in stats if s["field"] in eligible_cols]

        max_len = max((len(s["unique_values"]) for s in stats), default=0)
        out_data = {
            s["field"]: s["unique_values"] + [""] * (max_len - len(s["unique_values"]))
            for s in stats
        }
        out_df = pd.DataFrame(out_data)

        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            out_df.to_excel(writer, index=False, sheet_name="Unique Values")
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=unique_identifier.xlsx"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in (temp_path, logic_temp):
            if p and os.path.exists(p):
                os.remove(p)
