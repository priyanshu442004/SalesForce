import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from data_validation import run_data_validation, write_validation_report
from processor import process_preview
from transformer import transform_source_data

app = FastAPI(
    title="Data Migration Tool API",
    description="Python API for calculations and Excel processing for the Data Migration Tool",
    version="1.0.0"
)

# Enable CORS for Next.js frontend calls (allow localhost:3000 and standard development ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for seamless developer pairing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure folders exist
UPLOAD_DIR = "uploads"
PROCESSED_DIR = os.path.join(UPLOAD_DIR, "processed")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Helper filenames
FILE_PATHS = {
    "source": os.path.join(UPLOAD_DIR, "source_data.xlsx"),
    "master": os.path.join(UPLOAD_DIR, "salesforce_master.xlsx"),
    "logic": os.path.join(UPLOAD_DIR, "mapping_logic.xlsx"),
    "preview": os.path.join(PROCESSED_DIR, "preview.xlsx")
}
DATA_VALIDATION_REPORT_PATH = os.path.join(PROCESSED_DIR, "data_validation_report.xlsx")
TRANSFORMED_DATA_PATH = os.path.join(PROCESSED_DIR, "transformed_data.xlsx")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Data Migration Tool Backend API!"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "data-migration-api"}


# /api/autofill-mock-files removed



@app.get("/api/check-files")
def check_files():
    """
    Checks which files are already uploaded to the server.
    """
    return {
        "source": os.path.exists(FILE_PATHS["source"]),
        "master": os.path.exists(FILE_PATHS["master"]),
        "logic": os.path.exists(FILE_PATHS["logic"]),
        "preview": os.path.exists(FILE_PATHS["preview"])
    }

@app.post("/api/clear-all-files")
def clear_all_files():
    """
    Deletes all uploaded files and the processed preview from the server.
    """
    deleted = []
    for slot, path in FILE_PATHS.items():
        if os.path.exists(path):
            try:
                os.remove(path)
                deleted.append(slot)
            except Exception as e:
                print(f"Failed to delete {path}: {e}")
    if os.path.exists(DATA_VALIDATION_REPORT_PATH):
        try:
            os.remove(DATA_VALIDATION_REPORT_PATH)
            deleted.append("data_validation_report")
        except Exception as e:
            print(f"Failed to delete {DATA_VALIDATION_REPORT_PATH}: {e}")
    if os.path.exists(TRANSFORMED_DATA_PATH):
        try:
            os.remove(TRANSFORMED_DATA_PATH)
            deleted.append("transformed_data")
        except Exception as e:
            print(f"Failed to delete {TRANSFORMED_DATA_PATH}: {e}")
    return {"success": True, "deleted": deleted}

@app.delete("/api/clear-file/{slot}")
def clear_file_endpoint(slot: str):
    """
    Deletes a specific uploaded file on the server.
    """
    if slot in FILE_PATHS:
        path = FILE_PATHS[slot]
        deleted = []
        if os.path.exists(path):
            try:
                os.remove(path)
                deleted.append(slot)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to delete {slot} file: {str(e)}")
        
        # Also clean up preview if any core file is deleted
        if os.path.exists(FILE_PATHS["preview"]):
            try:
                os.remove(FILE_PATHS["preview"])
                deleted.append("preview")
            except Exception as e:
                print(f"Failed to delete preview file: {e}")
        if os.path.exists(DATA_VALIDATION_REPORT_PATH):
            try:
                os.remove(DATA_VALIDATION_REPORT_PATH)
                deleted.append("data_validation_report")
            except Exception as e:
                print(f"Failed to delete data validation report: {e}")
        if os.path.exists(TRANSFORMED_DATA_PATH):
            try:
                os.remove(TRANSFORMED_DATA_PATH)
                deleted.append("transformed_data")
            except Exception as e:
                print(f"Failed to delete transformed data file: {e}")
                
        return {"success": True, "deleted": deleted}
    
    raise HTTPException(status_code=400, detail="Invalid slot name.")

@app.post("/api/upload-migration-files")
async def upload_migration_files(
    source: UploadFile = File(None),
    master: UploadFile = File(None),
    logic: UploadFile = File(None)
):
    """
    Accepts individual or multiple file uploads, routing them into appropriate slots.
    """
    saved_files = []
    
    try:
        if source:
            with open(FILE_PATHS["source"], "wb") as buffer:
                shutil.copyfileobj(source.file, buffer)
            saved_files.append("source")
            
        if master:
            with open(FILE_PATHS["master"], "wb") as buffer:
                shutil.copyfileobj(master.file, buffer)
            saved_files.append("master")
            
        if logic:
            with open(FILE_PATHS["logic"], "wb") as buffer:
                shutil.copyfileobj(logic.file, buffer)
            saved_files.append("logic")
            
        return {
            "success": True,
            "message": f"Successfully uploaded and saved: {', '.join(saved_files)}",
            "files": saved_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@app.post("/api/generate-preview")
def generate_preview():
    """
    Triggers the pandas processing logic to clean source data, perform Salesforce lookups,
    and generate the preview Excel sheet.
    """
    # Check if all files exist
    missing = [slot for slot, path in FILE_PATHS.items() if slot != "preview" and not os.path.exists(path)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot generate preview. Missing uploaded files on server: {', '.join(missing)}"
        )
        
    res = process_preview(
        source_path=FILE_PATHS["source"],
        master_path=FILE_PATHS["master"],
        logic_path=FILE_PATHS["logic"],
        output_path=FILE_PATHS["preview"]
    )
    
    if not res["success"]:
        raise HTTPException(status_code=500, detail=f"Data processing failed: {res.get('error')}")
        
    return res


@app.post("/api/validate-schema")
def validate_schema():
    """
    Validates schema between uploaded source and mapping logic files.
    Uses processor.validate_schema and returns the result payload.
    """
    # Ensure source and logic files exist
    missing = []
    for slot in ["source", "logic"]:
        if not os.path.exists(FILE_PATHS[slot]):
            missing.append(slot)
    if missing:
        raise HTTPException(status_code=400, detail=f"Cannot validate schema. Missing uploaded files: {', '.join(missing)}")

    res = validate_schema_result = None
    try:
        res = process_preview  # unused placeholder to ensure import
    except Exception:
        pass

    # Call the new validate function in processor
    from processor import validate_schema as _validate
    out = _validate(FILE_PATHS["source"], FILE_PATHS["logic"])
    if not out.get("success"):
        raise HTTPException(status_code=500, detail=out.get("error", "Validation failed"))

    return out["result"]

@app.post("/api/validate-data")
def validate_data():
    """
    Validates source data values using uploaded mapping logic data type rules.
    Generates data_validation_report.xlsx when issues are found.
    """
    missing = []
    for slot in ["source", "logic"]:
        if not os.path.exists(FILE_PATHS[slot]):
            missing.append(slot)
    if missing:
        raise HTTPException(status_code=400, detail=f"Cannot validate data. Missing uploaded files: {', '.join(missing)}")

    if os.path.exists(DATA_VALIDATION_REPORT_PATH):
        try:
            os.remove(DATA_VALIDATION_REPORT_PATH)
        except Exception as e:
            print(f"Failed to delete previous data validation report: {e}")

    master_path = FILE_PATHS["master"] if os.path.exists(FILE_PATHS["master"]) else None
    out = run_data_validation(FILE_PATHS["source"], FILE_PATHS["logic"], master_path=master_path)
    if not out.get("success"):
        raise HTTPException(status_code=500, detail=out.get("error", "Data validation failed"))

    if out.get("total_issues", 0) > 0:
        write_validation_report(out["issues"], DATA_VALIDATION_REPORT_PATH)

    return out


@app.post("/api/transform-data")
def transform_data():
    """
    Transforms source values using uploaded mapping logic rules and returns
    an Excel file with original and transformed columns side by side.
    """
    missing = []
    for slot in ["source", "logic", "master"]:
        if not os.path.exists(FILE_PATHS[slot]):
            missing.append(slot)
    if missing:
        raise HTTPException(status_code=400, detail=f"Cannot transform data. Missing uploaded files: {', '.join(missing)}")

    try:
        transform_source_data(
            source_path=FILE_PATHS["source"],
            logic_path=FILE_PATHS["logic"],
            master_path=FILE_PATHS["master"],
            output_path=TRANSFORMED_DATA_PATH,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Data transformation failed: {str(exc)}")

    return FileResponse(
        path=TRANSFORMED_DATA_PATH,
        filename="transformed_data.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/api/download-data-validation-report")
def download_data_validation_report():
    """
    Downloads the generated data validation report.
    """
    if not os.path.exists(DATA_VALIDATION_REPORT_PATH):
        raise HTTPException(
            status_code=404,
            detail="Data validation report not found. Please run data validation first."
        )

    return FileResponse(
        path=DATA_VALIDATION_REPORT_PATH,
        filename="data_validation_report.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@app.get("/api/download-preview")
def download_preview():
    """
    Downloads the processed preview.xlsx sheet.
    """
    path = FILE_PATHS["preview"]
    if not os.path.exists(path):
        raise HTTPException(
            status_code=404, 
            detail="Processed preview file not found. Please upload files and generate a preview first."
        )
        
    return FileResponse(
        path=path,
        filename="preview.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
