import os
import json
import shutil
import tempfile
import uuid
import io
import zipfile
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from data_validation import run_data_validation, write_validation_report
from data_cleaning import run_data_cleaning
from processor import process_preview
from comparison import compare_excel_files
from transformer import transform_source_data
import boto3
from dotenv import load_dotenv

# Load backend environment configurations
load_dotenv()


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
    source: UploadFile = File(None),
    master: UploadFile = File(None),
    logic: UploadFile = File(None)
):
    """
    Uploads files to S3 inside a folder dedicated to the project ID.
    Returns the uploaded file details for database recording.
    """
    project_id = x_project_id or str(uuid.uuid4())
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
                
                # S3 Key structure: projects/{project_id}/uploads/{slot}/{timestamp}_{filename}
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
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
    base_file: UploadFile = File(None),
    new_file: UploadFile = File(None)
):
    """
    Uploads comparison files to S3.
    """
    project_id = x_project_id or str(uuid.uuid4())
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
    x_project_id: str = Header(None)
):
    """
    Cleans source data and uploads the cleaned file to S3.
    Returns summary statistics and a detailed change log.
    """
    project_id = x_project_id or str(uuid.uuid4())
    temp_source = None
    temp_logic = None
    temp_cleaned_path = None

    print(f"[clean-data] project_id: {project_id}")
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
    x_project_id: str = Header(None)
):
    """
    Validates data and uploads the report to S3 if issues are found.
    """


    project_id = x_project_id or str(uuid.uuid4())
    print(f"[validate-data] project_id:  {project_id}")
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
    x_project_id: str = Header(None)
):
    """
    Generates mapping preview and uploads generated Excel sheet to S3.
    """
    project_id = x_project_id or str(uuid.uuid4())
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
    master_key: str = Query(...),
    x_project_id: str = Header(None)
):
    """
    Transforms data for every mapping sheet independently.

    Each sheet in the logic workbook produces one .xlsx output file.
    When more than one sheet is present the outputs are also packaged
    into a single .zip file and uploaded to S3.
    """
    project_id = x_project_id or str(uuid.uuid4())
    print(f"[transform-data] project_id:  {project_id}")
    print(f"[transform-data] source_key:  {source_key}")
    print(f"[transform-data] master_key:  {master_key}")
    print(f"[transform-data] logic_key:   {logic_key}")

    temp_source = None
    temp_master = None
    temp_logic = None
    temp_output_dir = None
    try:
        temp_source = temp_download(source_key)
        temp_master = temp_download(master_key)
        temp_logic = temp_download(logic_key)

        temp_output_dir = tempfile.mkdtemp()

        transform_result = transform_source_data(
            source_path=temp_source,
            logic_path=temp_logic,
            master_path=temp_master,
            output_dir=temp_output_dir,
        )

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        sheet_outputs = transform_result.get("outputs", [])

        # Upload each per-sheet file to S3
        uploaded_outputs = []
        for sheet in sheet_outputs:
            sheet_name = sheet["sheet_name"]
            local_path = sheet["output_path"]
            safe_name = os.path.basename(local_path)
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
