import io
import math
import os
import tempfile
import time
import requests
import pandas as pd
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/salesforce", tags=["Salesforce"])

SALESFORCE_AUTH_BASE = "https://login.salesforce.com/services/oauth2/authorize"
SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token"

BULK_API_VERSION   = "v60.0"
BULK_POLL_INTERVAL = 5     # seconds between job status polls
BULK_POLL_TIMEOUT  = 1800  # 30 minutes maximum wait for job completion


def _safe_csv(val):
    """Normalise a DataFrame cell for Bulk API 2.0 CSV upload.
    Null-like values → empty string; Timestamps → ISO-8601 string."""
    if val is None or val is pd.NaT:
        return ""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return ""
    if isinstance(val, pd.Timestamp):
        return val.isoformat()
    return val


def _raise_if_401(response, context: str):
    """Raise a 401 HTTPException with a meaningful message if Salesforce rejects the token."""
    if response.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "invalid_token",
                "message": f"Salesforce access token is invalid or expired ({context}). Please login again.",
            },
        )


@router.get("/login")
def salesforce_login(force_login: bool = False):
    params = {
        "response_type": "code",
        "client_id": os.environ["SALESFORCE_CLIENT_ID"],
        "redirect_uri": os.environ["SALESFORCE_REDIRECT_URI"],
    }
    if force_login:
        # prompt=login forces Salesforce to show the credentials page even when
        # an active browser session exists, allowing the user to switch accounts.
        params["prompt"] = "login"
    auth_url = f"{SALESFORCE_AUTH_BASE}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/callback")
def salesforce_callback(code: str = Query(..., description="Authorization code returned by Salesforce")):
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": os.environ["SALESFORCE_CLIENT_ID"],
        "client_secret": os.environ["SALESFORCE_CLIENT_SECRET"],
        "redirect_uri": os.environ["SALESFORCE_REDIRECT_URI"],
    }

    response = requests.post(SALESFORCE_TOKEN_URL, data=payload)
    print(response.status_code)
    print(response.text)

    if not response.ok:
        detail = response.json() if response.content else {"error": "token_exchange_failed"}
        raise HTTPException(status_code=response.status_code, detail=detail)

    token_data = response.json()
    print("[callback] access_token first 20:", token_data["access_token"][:20], flush=True)
    print("[callback] instance_url:", token_data["instance_url"], flush=True)

    return {
        "access_token": token_data["access_token"],
        "instance_url": token_data["instance_url"],
        "refresh_token": token_data.get("refresh_token", ""),
    }


@router.get("/objects")
def salesforce_objects(
    access_token: str = Query(...),
    instance_url: str = Query(...),
):
    url = f"{instance_url}/services/data/v60.0/sobjects"
    headers = {"Authorization": f"Bearer {access_token}"}

    auth_header = headers["Authorization"]
    print(f"[salesforce/objects] URL: {url}", flush=True)
    print(f"[salesforce/objects] Authorization header starts with 'Bearer ': {auth_header.startswith('Bearer ')}", flush=True)
    print(f"[salesforce/objects] access_token first 20 chars: {access_token[:20]}{'*' * max(0, len(access_token) - 20)}", flush=True)

    print(f"[salesforce/objects] URL: {url}", flush=True)
    print(f"[salesforce/objects] Authorization header starts with 'Bearer ': {headers['Authorization'].startswith('Bearer ')}", flush=True)
    print(f"[salesforce/objects] access_token first 20 chars: {access_token[:20]}{'*' * max(0, len(access_token) - 20)}", flush=True)

    response = requests.get(url, headers=headers)
    print(f"[salesforce/objects] HTTP status: {response.status_code}", flush=True)
    print(f"[salesforce/objects] response body: {response.text}", flush=True)


    if response.status_code == 401:
        raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Access token is invalid or expired"})

    if not response.ok:
        detail = response.json() if response.content else {"error": "sobjects_fetch_failed"}
        raise HTTPException(status_code=response.status_code, detail=detail)

    sobjects = response.json().get("sobjects", [])

    return [
        {"label": obj["label"], "api_name": obj["name"]}
        for obj in sobjects
        if obj.get("createable") and obj.get("queryable")
    ]


@router.get("/object-fields")
def salesforce_object_fields(
    access_token: str = Query(...),
    instance_url: str = Query(...),
    object_name: str = Query(...),
):
    url = f"{instance_url}/services/data/v60.0/sobjects/{object_name}/describe"
    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(url, headers=headers)

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Access token is invalid or expired"})

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail={"error": "object_not_found", "message": f"Salesforce object '{object_name}' does not exist"})

    if not response.ok:
        detail = response.json() if response.content else {"error": "describe_failed"}
        raise HTTPException(status_code=response.status_code, detail=detail)

    fields = response.json().get("fields", [])

    return [
        {
            "label": field["label"],
            "api_name": field["name"],
            "type": field["type"],
            "createable": field["createable"],
            "nillable": field.get("nillable", True),
            "defaultedOnCreate": field.get("defaultedOnCreate", False),
            "externalId": field.get("externalId", False),
            "idLookup": field.get("idLookup", False),
            "unique": field.get("unique", False),
        }
        for field in fields
        if field.get("createable")
    ]


class PreviewPayloadRequest(BaseModel):
    s3_key: str
    object_name: str


@router.post("/preview-payload")
def salesforce_preview_payload(body: PreviewPayloadRequest):
    from main import temp_download

    temp_path = temp_download(body.s3_key)

    try:
        df = pd.read_excel(temp_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read Excel file: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # Drop internal columns
    df = df[[col for col in df.columns if not str(col).startswith("__")]]

    # Replace NaN, +inf, and -inf with None — all are non-JSON-serializable floats
    df = df.replace([float("inf"), float("-inf")], None)
    df = df.where(pd.notna(df), other=None)

    columns = list(df.columns)
    sample_records = (
    df.head(5)
      .astype(object)
      .where(pd.notna(df.head(5)), None)
      .to_dict(orient="records")
)
    import math
    for i, record in enumerate(sample_records):
        for col, val in record.items():
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                print(f"[preview-payload DEBUG] row={i} col={col!r} val={val!r}")
    import json
    json.dumps(sample_records, allow_nan=False)
    return {
        "total_rows": len(df),
        "columns": columns,
        "sample_records": sample_records,
    }


class ValidateMappingRequest(BaseModel):
    access_token: str
    instance_url: str
    object_name: str
    s3_key: str


@router.post("/validate-mapping")
def salesforce_validate_mapping(body: ValidateMappingRequest):
    # Lazy import to avoid circular dependency (main imports this router at startup)
    from main import temp_download

    # Download Excel from S3
    temp_path = temp_download(body.s3_key)

    try:
        df = pd.read_excel(temp_path, nrows=0)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read Excel file: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # Columns present in the transformed file, excluding internal __ columns
    excel_columns = {col for col in df.columns if not str(col).startswith("__")}

    # Fetch Salesforce field metadata for the target object
    describe_url = f"{body.instance_url}/services/data/v60.0/sobjects/{body.object_name}/describe"
    headers = {"Authorization": f"Bearer {body.access_token}"}
    sf_response = requests.get(describe_url, headers=headers)

    if sf_response.status_code == 401:
        raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Access token is invalid or expired"})

    if sf_response.status_code == 404:
        raise HTTPException(status_code=404, detail={"error": "object_not_found", "message": f"Salesforce object '{body.object_name}' does not exist"})

    if not sf_response.ok:
        detail = sf_response.json() if sf_response.content else {"error": "describe_failed"}
        raise HTTPException(status_code=sf_response.status_code, detail=detail)

    sf_fields = {
        field["name"]
        for field in sf_response.json().get("fields", [])
        if field.get("createable")
    }

    return sf_response.json()["fields"]


class UploadRecordsRequest(BaseModel):
    access_token: str
    instance_url: str
    object_name: str
    s3_key: str
    batch_size: int = 200
    action: str = "insert"


@router.post("/upload-records")
def salesforce_upload_records(body: UploadRecordsRequest):
    from main import temp_download

    t0 = time.time()
    base_url = f"{body.instance_url}/services/data/{BULK_API_VERSION}"
    json_headers = {"Authorization": f"Bearer {body.access_token}", "Content-Type": "application/json"}

    # ── Step 1: Download and read Excel ───────────────────────────────────────
    print(f"[bulk-upload] ENTER — object={body.object_name!r} s3_key={body.s3_key!r}", flush=True)
    print(f"[bulk-upload] downloading from S3 …", flush=True)
    temp_path = temp_download(body.s3_key)
    print(f"[bulk-upload] S3 download complete — temp_path={temp_path!r}", flush=True)

    try:
        print(f"[bulk-upload] reading Excel file …", flush=True)
        df = pd.read_excel(temp_path)
        print(f"[bulk-upload] Excel read complete — shape={df.shape}", flush=True)
    except Exception as e:
        print(f"[bulk-upload] Excel read FAILED: {e}", flush=True)
        raise HTTPException(status_code=422, detail=f"Failed to read Excel file: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    df = df[[col for col in df.columns if not str(col).startswith("__")]]
    total = len(df)
    print(f"[bulk-upload] after column filter — shape={df.shape} columns={list(df.columns)}", flush=True)

    if total == 0:
        print(f"[bulk-upload] no records to upload — returning early", flush=True)
        return {"total": 0, "success": 0, "failed": 0, "errors": []}

    # ── Step 2: Build in-memory CSV ───────────────────────────────────────────
    print(f"[bulk-upload] building in-memory CSV for {total:,} records …", flush=True)
    df_csv = df.copy()
    for col in df_csv.columns:
        df_csv[col] = df_csv[col].apply(_safe_csv)

    csv_buffer = io.StringIO()
    df_csv.to_csv(csv_buffer, index=False, lineterminator="\n")
    csv_bytes = csv_buffer.getvalue().encode("utf-8")
    print(f"[bulk-upload] CSV ready — {len(csv_bytes):,} bytes", flush=True)

    # ── Step 3: Create Bulk API 2.0 ingest job ────────────────────────────────
    print(f"[bulk-upload] creating Bulk API 2.0 ingest job …", flush=True)
    try:
        operation = body.action.lower() if body.action.lower() in ("insert", "update", "upsert", "delete") else "insert"
        print(f"[bulk-upload] operation={operation!r} batch_size={body.batch_size}", flush=True)
        job_resp = requests.post(
            f"{base_url}/jobs/ingest",
            headers=json_headers,
            json={"operation": operation, "object": body.object_name, "contentType": "CSV", "lineEnding": "LF"},
            timeout=30,
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail={"error": "job_creation_failed", "message": str(e)})

    _raise_if_401(job_resp, "create job")
    if not job_resp.ok:
        print(f"[bulk-upload] job creation FAILED: {job_resp.status_code} {job_resp.text[:300]}", flush=True)
        raise HTTPException(
            status_code=job_resp.status_code,
            detail=job_resp.json() if job_resp.content else {"error": "job_creation_failed"},
        )

    job_id = job_resp.json()["id"]
    print(f"[bulk-upload] job created — jobId={job_id!r}", flush=True)

    # ── Step 4: Upload CSV batch ───────────────────────────────────────────────
    print(f"[bulk-upload] uploading CSV batch ({len(csv_bytes):,} bytes) …", flush=True)
    try:
        batch_resp = requests.put(
            f"{base_url}/jobs/ingest/{job_id}/batches",
            headers={"Authorization": f"Bearer {body.access_token}", "Content-Type": "text/csv"},
            data=csv_bytes,
            timeout=300,
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail={"error": "csv_upload_failed", "message": str(e)})

    _raise_if_401(batch_resp, "upload batch")
    if not batch_resp.ok:
        print(f"[bulk-upload] CSV upload FAILED: {batch_resp.status_code} {batch_resp.text[:300]}", flush=True)
        raise HTTPException(
            status_code=batch_resp.status_code,
            detail={"error": "csv_upload_failed", "message": batch_resp.text[:500]},
        )
    print(f"[bulk-upload] CSV batch uploaded successfully", flush=True)

    # ── Step 5: Close job (mark upload complete) ──────────────────────────────
    print(f"[bulk-upload] closing job (UploadComplete) …", flush=True)
    try:
        close_resp = requests.patch(
            f"{base_url}/jobs/ingest/{job_id}",
            headers=json_headers,
            json={"state": "UploadComplete"},
            timeout=30,
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail={"error": "job_close_failed", "message": str(e)})

    _raise_if_401(close_resp, "close job")
    if not close_resp.ok:
        print(f"[bulk-upload] job close FAILED: {close_resp.status_code} {close_resp.text[:300]}", flush=True)
        raise HTTPException(
            status_code=close_resp.status_code,
            detail={"error": "job_close_failed", "message": close_resp.text[:500]},
        )
    print(f"[bulk-upload] job closed — Salesforce is now processing {total:,} records …", flush=True)

    # ── Step 6: Poll until job reaches a terminal state ───────────────────────
    terminal_states = {"JobComplete", "Failed", "Aborted"}
    elapsed = 0
    poll_count = 0
    job_state = ""

    while elapsed < BULK_POLL_TIMEOUT:
        time.sleep(BULK_POLL_INTERVAL)
        elapsed += BULK_POLL_INTERVAL
        poll_count += 1

        try:
            status_resp = requests.get(
                f"{base_url}/jobs/ingest/{job_id}",
                headers=json_headers,
                timeout=30,
            )
        except requests.exceptions.RequestException as e:
            print(f"[bulk-upload] poll #{poll_count} network error (will retry): {e}", flush=True)
            continue

        _raise_if_401(status_resp, "poll job")
        if not status_resp.ok:
            print(f"[bulk-upload] poll #{poll_count} non-OK response {status_resp.status_code} (will retry)", flush=True)
            continue

        status_data = status_resp.json()
        job_state = status_data.get("state", "")
        print(
            f"[bulk-upload] poll #{poll_count} (elapsed={elapsed}s) — state={job_state!r} "
            f"processed={status_data.get('numberRecordsProcessed', '?')} "
            f"failed={status_data.get('numberRecordsFailed', '?')}",
            flush=True,
        )

        if job_state in terminal_states:
            print(f"[bulk-upload] job reached terminal state: {job_state!r}", flush=True)
            break
    else:
        raise HTTPException(
            status_code=504,
            detail={
                "error": "bulk_poll_timeout",
                "message": f"Salesforce bulk job did not complete within {BULK_POLL_TIMEOUT}s. Job ID: {job_id}",
            },
        )

    if job_state in ("Failed", "Aborted"):
        raise HTTPException(
            status_code=502,
            detail={
                "error": "bulk_job_failed",
                "message": f"Salesforce bulk job {job_state.lower()}. Job ID: {job_id}",
            },
        )

    # ── Step 7: Retrieve results ───────────────────────────────────────────────
    def _fetch_result_csv(path: str) -> list:
        """Download a Bulk API result CSV and return it as a list of row dicts."""
        try:
            resp = requests.get(
                f"{base_url}/jobs/ingest/{job_id}/{path}",
                headers={"Authorization": f"Bearer {body.access_token}", "Accept": "text/csv"},
                timeout=120,
            )
        except requests.exceptions.RequestException as e:
            print(f"[bulk-upload] result fetch ({path}) network error: {e}", flush=True)
            return []

        if not resp.ok:
            print(f"[bulk-upload] result fetch ({path}) FAILED: {resp.status_code}", flush=True)
            return []

        text = resp.text.strip()
        if not text:
            return []

        try:
            return list(pd.read_csv(io.StringIO(text)).to_dict(orient="records"))
        except Exception as e:
            print(f"[bulk-upload] result CSV parse error ({path}): {e}", flush=True)
            return []

    print(f"[bulk-upload] fetching successful results …", flush=True)
    successful = _fetch_result_csv("successfulResults")
    print(f"[bulk-upload] fetching failed results …", flush=True)
    failed_rows = _fetch_result_csv("failedResults")
    print(f"[bulk-upload] fetching unprocessed records …", flush=True)
    unprocessed = _fetch_result_csv("unprocessedRecords")

    success_count = len(successful)
    failed_count  = len(failed_rows) + len(unprocessed)

    errors = []
    for i, row in enumerate(failed_rows):
        errors.append({"row": i + 1, "message": str(row.get("sf__Error", "Unknown Salesforce error"))})
    for i, row in enumerate(unprocessed):
        errors.append({"row": len(failed_rows) + i + 1, "message": "Record was not processed by Salesforce"})

    # ── Step 8: Build and upload migration report ─────────────────────────────
    original_cols = list(df.columns)

    def _report_rows(result_list, status, action, error_key, default_error):
        rows = []
        for row in result_list:
            rec = {col: row.get(col, "") for col in original_cols}
            rec["Status"] = status
            rec["Salesforce ID"] = row.get("sf__Id", "")
            rec["Action"] = action
            rec["Error"] = str(row.get(error_key, default_error)) if error_key else default_error
            rows.append(rec)
        return rows

    report_data = (
        _report_rows(successful,  "Success",     operation.capitalize(), None,       "")
        + _report_rows(failed_rows, "Failed",    "",         "sf__Error", "Unknown error")
        + _report_rows(unprocessed, "Unprocessed", "",       None,       "Record was not processed by Salesforce")
    )

    report_s3_key = None
    if report_data:
        report_cols = original_cols + ["Status", "Salesforce ID", "Action", "Error"]
        report_df = pd.DataFrame(report_data, columns=report_cols)
    else:
        report_df = df.copy()
        report_df["Status"] = ""
        report_df["Salesforce ID"] = ""
        report_df["Action"] = ""
        report_df["Error"] = ""

    try:
        report_fd, report_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(report_fd)
        report_df.to_excel(report_path, index=False, engine="openpyxl")
        from main import upload_to_s3
        report_s3_key = f"migration_reports/{job_id}/Migration_Report.xlsx"
        upload_to_s3(report_path, report_s3_key)
        print(f"[bulk-upload] migration report uploaded → {report_s3_key}", flush=True)
    except Exception as e:
        print(f"[bulk-upload] migration report upload FAILED (non-fatal): {e}", flush=True)
        report_s3_key = None
    finally:
        if "report_path" in dir() and os.path.exists(report_path):
            os.remove(report_path)

    elapsed_total = time.time() - t0
    print(
        f"[bulk-upload] COMPLETE — total={total:,} success={success_count:,} failed={failed_count:,} "
        f"elapsed={elapsed_total:.1f}s",
        flush=True,
    )

    return {
        "total": total,
        "success": success_count,
        "failed": failed_count,
        "errors": errors,
        "report_s3_key": report_s3_key,
    }


# ---------------------------------------------------------------------------
# Pre-Import Validation
# ---------------------------------------------------------------------------

class ValidateImportRequest(BaseModel):
    access_token: str
    instance_url: str
    object_name: str
    s3_key: str
    field_mappings: dict          # {source_col: sf_api_name | null}
    import_mode: str = "Insert"


@router.post("/validate-import")
def salesforce_validate_import(body: ValidateImportRequest):          # noqa: C901
    import re as _re
    from main import temp_download, upload_to_s3

    _EMAIL_RE = _re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    _EMPTY_STRS = {"", "nan", "none", "n/a", "null"}

    # ── 1. Download and read transformed Excel ────────────────────────────────
    temp_path = temp_download(body.s3_key)
    try:
        df = pd.read_excel(temp_path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to read Excel: {exc}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    df = df[[col for col in df.columns if not str(col).startswith("__")]]
    total_records = len(df)
    total_columns = len(df.columns)

    if total_records == 0:
        zero = {k: 0 for k in ["valid","invalid","with_warnings","duplicates",
                                "required_missing","invalid_picklist","invalid_email",
                                "invalid_phone","invalid_date","invalid_numeric"]}
        return {
            "summary": {"total_records": 0, "total_columns": total_columns,
                        "target_object": body.object_name, "mapped_fields": 0,
                        "import_mode": body.import_mode},
            "counts": zero, "errors": [], "total_errors": 0,
            "duplicates": [], "total_duplicates": 0,
            "can_import": True, "has_warnings": False, "report_s3_key": None,
        }

    # ── 2. Active mappings (source cols that exist in df and have an SF target) ──
    active_map = {
        src: sf
        for src, sf in body.field_mappings.items()
        if sf and str(sf).strip() and src in df.columns
    }
    sf_to_src = {sf: src for src, sf in active_map.items()}

    # ── 3. Fetch SF describe metadata (one call) ──────────────────────────────
    sf_meta: dict = {}
    picklist_map: dict = {}
    external_id_fields: set = set()

    try:
        resp = requests.get(
            f"{body.instance_url}/services/data/{BULK_API_VERSION}/sobjects/{body.object_name}/describe",
            headers={"Authorization": f"Bearer {body.access_token}"},
            timeout=30,
        )
        _raise_if_401(resp, "describe for validation")
        if resp.ok:
            for fld in resp.json().get("fields", []):
                nm = fld["name"]
                sf_meta[nm] = fld
                if fld.get("type") in ("picklist", "multipicklist"):
                    active_vals = {
                        v["value"] for v in fld.get("picklistValues", [])
                        if v.get("active", True)
                    }
                    if active_vals:
                        picklist_map[nm] = active_vals
                if fld.get("externalId"):
                    external_id_fields.add(nm)
    except HTTPException:
        raise
    except Exception as ex:
        print(f"[validate-import] describe failed (non-fatal): {ex}", flush=True)

    # ── 4. Classify SF field types ────────────────────────────────────────────
    req_sf: set = set()
    email_sf: set = set()
    phone_sf: set = set()
    date_sf: set = set()
    dt_sf: set = set()
    num_sf: set = set()
    pick_sf: set = set()

    for sf_nm in sf_to_src:
        m = sf_meta.get(sf_nm, {})
        t = m.get("type", "")
        if not m.get("nillable", True) and not m.get("defaultedOnCreate", False) and m.get("createable", False):
            req_sf.add(sf_nm)
        if t == "email":                                      email_sf.add(sf_nm)
        elif t == "phone":                                    phone_sf.add(sf_nm)
        elif t == "date":                                     date_sf.add(sf_nm)
        elif t == "datetime":                                 dt_sf.add(sf_nm)
        elif t in ("double", "currency", "percent", "int", "long"): num_sf.add(sf_nm)
        elif t in ("picklist", "multipicklist"):              pick_sf.add(sf_nm)

    # ── 5. Vectorised validation ──────────────────────────────────────────────
    all_issues: list = []
    crit_rows: set = set()
    warn_rows: set = set()

    for sf_nm, src_col in sf_to_src.items():
        label  = sf_meta.get(sf_nm, {}).get("label", sf_nm)
        series = df[src_col]
        str_v  = series.astype(str).str.strip()
        empty  = series.isna() | str_v.str.lower().isin(_EMPTY_STRS)
        filled = ~empty

        def _issue(idx, etype, sev, msg, sugg, val=""):
            rn = int(idx) + 2
            all_issues.append({
                "row": rn, "source_field": src_col, "sf_field": sf_nm, "sf_label": label,
                "value": str(val)[:120], "error_type": etype, "severity": sev,
                "message": msg, "suggestion": sugg,
            })
            (crit_rows if sev == "critical" else warn_rows).add(rn)

        # Required
        if sf_nm in req_sf:
            for idx in df.index[empty]:
                _issue(idx, "required_missing", "critical",
                       f"Required field '{label}' is empty",
                       f"Provide a value for {label}")

        # Email
        if sf_nm in email_sf:
            bad = df.index[filled & ~str_v.str.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', na=False)]
            for idx in bad:
                v = str_v.at[idx]
                _issue(idx, "invalid_email", "warning",
                       f"Invalid email: '{v}'",
                       "Use a valid email address (e.g., user@domain.com)", v)

        # Phone
        elif sf_nm in phone_sf:
            for idx in df.index[filled]:
                v = str_v.at[idx]
                if sum(c.isdigit() for c in v) < 7:
                    _issue(idx, "invalid_phone", "warning",
                           f"Possibly invalid phone: '{v}' (fewer than 7 digits)",
                           "Provide a phone number with at least 7 digits", v)

        # Numeric
        elif sf_nm in num_sf:
            def _ok_num(x):
                s = str(x).strip().replace(",", "").replace("$", "").replace("%", "")
                if not s or s.lower() in _EMPTY_STRS: return True
                try: float(s); return True
                except ValueError: return False
            for idx in df.index[filled & ~series.apply(_ok_num)]:
                v = str_v.at[idx]
                _issue(idx, "invalid_numeric", "critical",
                       f"Expected number for '{label}', got: '{v}'",
                       "Provide a numeric value (e.g., 12345.67)", v)

        # Date / Datetime
        elif sf_nm in date_sf or sf_nm in dt_sf:
            is_dt_field = sf_nm in dt_sf
            def _ok_date(x):
                s = str(x).strip()
                if not s or s.lower() in _EMPTY_STRS: return True
                try: pd.to_datetime(s); return True
                except: return False
            etype = "invalid_datetime" if is_dt_field else "invalid_date"
            fmt   = "YYYY-MM-DDTHH:MM:SS" if is_dt_field else "YYYY-MM-DD"
            kind  = "datetime" if is_dt_field else "date"
            for idx in df.index[filled & ~series.apply(_ok_date)]:
                v = str_v.at[idx]
                _issue(idx, etype, "critical",
                       f"Cannot parse {kind}: '{v}'",
                       f"Use ISO format: {fmt}", v)

        # Picklist
        elif sf_nm in pick_sf and sf_nm in picklist_map:
            allowed   = picklist_map[sf_nm]
            apreview  = ", ".join(sorted(allowed)[:6]) + ("…" if len(allowed) > 6 else "")
            for idx in df.index[filled & ~str_v.isin(allowed)]:
                v = str_v.at[idx]
                _issue(idx, "invalid_picklist", "critical",
                       f"Invalid picklist value for '{label}': '{v}'",
                       f"Expected one of: {apreview}", v)

    # ── 6. Duplicate detection ────────────────────────────────────────────────
    dup_groups: list = []

    def _dups(src_col, sf_nm, dup_type, limit=50):
        vals = df[src_col].astype(str).str.strip().str.lower()
        non_empty = vals[~vals.isin(_EMPTY_STRS)]
        for val in non_empty[non_empty.duplicated(keep=False)].unique()[:limit]:
            rows = (df.index[vals == val] + 2).tolist()
            orig = str(df.at[int(rows[0]) - 2, src_col]).strip() if rows else val
            dup_groups.append({
                "type": dup_type, "sf_field": sf_nm,
                "sf_label": sf_meta.get(sf_nm, {}).get("label", sf_nm),
                "value": orig, "rows": rows[:20], "total": len(rows),
            })

    for sf_nm, src_col in sf_to_src.items():
        if sf_nm in email_sf:            _dups(src_col, sf_nm, "Duplicate Email")
        elif sf_nm in external_id_fields: _dups(src_col, sf_nm, "Duplicate External ID")
        elif sf_nm.lower() == "name":    _dups(src_col, sf_nm, "Duplicate Name")

    # First + Last name combo
    fn_src = next((s for s, f in active_map.items() if f.lower() == "firstname"), None)
    ln_src = next((s for s, f in active_map.items() if f.lower() == "lastname"),  None)
    if fn_src and ln_src:
        fn_v = df[fn_src].astype(str).str.strip().str.lower()
        ln_v = df[ln_src].astype(str).str.strip().str.lower()
        full = fn_v + " " + ln_v
        valid = full[~fn_v.isin(_EMPTY_STRS) & ~ln_v.isin(_EMPTY_STRS)]
        for val in valid[valid.duplicated(keep=False)].unique()[:30]:
            rows = (df.index[full == val] + 2).tolist()
            fn_d = str(df.at[int(rows[0]) - 2, fn_src]).strip() if rows else ""
            ln_d = str(df.at[int(rows[0]) - 2, ln_src]).strip() if rows else ""
            dup_groups.append({
                "type": "Duplicate Full Name", "sf_field": "FirstName+LastName",
                "sf_label": "Full Name",
                "value": f"{fn_d} {ln_d}".strip(), "rows": rows[:20], "total": len(rows),
            })

    # ── 7. Summarise counts ───────────────────────────────────────────────────
    type_counts: dict = {}
    for iss in all_issues:
        type_counts[iss["error_type"]] = type_counts.get(iss["error_type"], 0) + 1

    issue_rows = crit_rows | warn_rows
    counts = {
        "valid":            total_records - len(issue_rows),
        "invalid":          len(crit_rows),
        "with_warnings":    len(warn_rows - crit_rows),
        "duplicates":       len(dup_groups),
        "required_missing": type_counts.get("required_missing", 0),
        "invalid_picklist": type_counts.get("invalid_picklist", 0),
        "invalid_email":    type_counts.get("invalid_email",    0),
        "invalid_phone":    type_counts.get("invalid_phone",    0),
        "invalid_date":     type_counts.get("invalid_date", 0) + type_counts.get("invalid_datetime", 0),
        "invalid_numeric":  type_counts.get("invalid_numeric",  0),
    }
    can_import  = len(crit_rows) == 0
    has_warnings = bool(all_issues) or bool(dup_groups)

    # ── 8. Generate Excel validation report ───────────────────────────────────
    report_s3_key = None
    report_path   = None
    try:
        cols_e = ["Row","Source Field","Salesforce Field","Current Value",
                  "Issue Type","Message","Suggested Fix","Severity"]
        if all_issues:
            err_df = pd.DataFrame([{
                "Row":             i["row"],
                "Source Field":    i["source_field"],
                "Salesforce Field":i["sf_label"],
                "Current Value":   i["value"],
                "Issue Type":      i["error_type"].replace("_"," ").title(),
                "Message":         i["message"],
                "Suggested Fix":   i["suggestion"],
                "Severity":        i["severity"].title(),
            } for i in all_issues[:10000]])
        else:
            err_df = pd.DataFrame(columns=cols_e)

        crit_df = err_df[err_df["Severity"] == "Critical"].copy() if not err_df.empty else err_df
        warn_df = err_df[err_df["Severity"] == "Warning"].copy()  if not err_df.empty else err_df

        dup_cols = ["Type","Salesforce Field","Duplicate Value","Affected Rows","Total Count"]
        dup_df = pd.DataFrame([{
            "Type":             d["type"],
            "Salesforce Field": d["sf_label"],
            "Duplicate Value":  d["value"],
            "Affected Rows":    ", ".join(str(r) for r in d["rows"][:10])
                                + ("…" if d["total"] > 10 else ""),
            "Total Count":      d["total"],
        } for d in dup_groups]) if dup_groups else pd.DataFrame(columns=dup_cols)

        summ_df = pd.DataFrame({
            "Metric": ["Total Records","Total Columns","Target Object","Import Mode",
                       "Mapped Fields","Valid Records","Invalid Records",
                       "Records with Warnings","Duplicate Groups","Can Import"],
            "Value":  [total_records, total_columns, body.object_name, body.import_mode,
                       len(active_map), counts["valid"], counts["invalid"],
                       counts["with_warnings"], len(dup_groups),
                       "Yes" if can_import else "No"],
        })

        rfd, report_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(rfd)
        with pd.ExcelWriter(report_path, engine="openpyxl") as writer:
            summ_df.to_excel(writer, sheet_name="Summary",         index=False)
            err_df .to_excel(writer, sheet_name="All Issues",       index=False)
            crit_df.to_excel(writer, sheet_name="Critical Errors",  index=False)
            warn_df.to_excel(writer, sheet_name="Warnings",         index=False)
            dup_df .to_excel(writer, sheet_name="Duplicates",       index=False)

        ts = int(time.time())
        report_s3_key = f"validation_reports/{ts}/Pre_Import_Validation.xlsx"
        upload_to_s3(report_path, report_s3_key)
        print(f"[validate-import] report → {report_s3_key}", flush=True)
    except Exception as ex:
        print(f"[validate-import] report generation failed (non-fatal): {ex}", flush=True)
    finally:
        if report_path and os.path.exists(report_path):
            os.remove(report_path)

    return {
        "summary": {
            "total_records":  total_records,
            "total_columns":  total_columns,
            "target_object":  body.object_name,
            "mapped_fields":  len(active_map),
            "import_mode":    body.import_mode,
        },
        "counts":         counts,
        "errors":         all_issues[:1000],
        "total_errors":   len(all_issues),
        "duplicates":     dup_groups[:100],
        "total_duplicates": len(dup_groups),
        "can_import":     can_import,
        "has_warnings":   has_warnings,
        "report_s3_key":  report_s3_key,
    }
