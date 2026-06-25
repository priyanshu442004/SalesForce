import os
import requests
import pandas as pd
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/salesforce", tags=["Salesforce"])

SALESFORCE_AUTH_BASE = "https://login.salesforce.com/services/oauth2/authorize"
SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token"


@router.get("/login")
def salesforce_login():
    params = {
        "response_type": "code",
        "client_id": os.environ["SALESFORCE_CLIENT_ID"],
        "redirect_uri": os.environ["SALESFORCE_REDIRECT_URI"],
    }
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
    print("[callback] id:", token_data.get("id"), flush=True)

    # Fetch user identity info (display_name, email, username) — optional, non-blocking
    user_info = None
    try:
        identity_url = token_data.get("id")
        if identity_url:
            id_resp = requests.get(
                identity_url,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
                timeout=10,
            )
            if id_resp.ok:
                id_data = id_resp.json()
                user_info = {
                    "display_name": id_data.get("display_name"),
                    "email": id_data.get("email"),
                    "username": id_data.get("username"),
                }
                print(f"[callback] identity: username={user_info['username']} email={user_info['email']}", flush=True)
    except Exception as e:
        print(f"[callback] identity fetch failed (non-fatal): {e}", flush=True)

    return {
        "access_token": token_data["access_token"],
        "instance_url": token_data["instance_url"],
        "refresh_token": token_data.get("refresh_token", ""),
        "user_info": user_info,
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


TEST_LIMIT = None  # set to an integer (e.g. 5) to limit rows during testing

@router.post("/upload-records")
def salesforce_upload_records(body: UploadRecordsRequest):
    import math
    import sys
    from main import temp_download

    print(f"[upload-records] ENTER — object={body.object_name!r} s3_key={body.s3_key!r}", flush=True)

    print(f"[upload-records] downloading from S3 …", flush=True)
    temp_path = temp_download(body.s3_key)
    print(f"[upload-records] S3 download complete — temp_path={temp_path!r}", flush=True)

    try:
        print(f"[upload-records] calling pd.read_excel …", flush=True)
        df = pd.read_excel(temp_path)
        print(f"[upload-records] pd.read_excel complete — shape={df.shape}", flush=True)
    except Exception as e:
        print(f"[upload-records] pd.read_excel FAILED: {e}", flush=True)
        raise HTTPException(status_code=422, detail=f"Failed to read Excel file: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    df = df[[col for col in df.columns if not str(col).startswith("__")]]
    print(f"[upload-records] after column filter — shape={df.shape} columns={list(df.columns)}", flush=True)

    url = f"{body.instance_url}/services/data/v60.0/sobjects/{body.object_name}/"
    headers = {
        "Authorization": f"Bearer {body.access_token}",
        "Content-Type": "application/json",
    }

    def _safe(val):
        if val is None:
            return None
        if val is pd.NaT:
            return None
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        if isinstance(val, pd.Timestamp):
            return val.isoformat()
        return val

    print(f"[upload-records] building records list …", flush=True)
    records = [
        {k: v for k, v in {col: _safe(val) for col, val in row.items()}.items() if v is not None}
        for _, row in df.iterrows()
    ]
    total = len(records)
    print(f"[upload-records] {total} records built", flush=True)

    if TEST_LIMIT is not None:
        records = records[:TEST_LIMIT]
        print(f"[upload-records] TEST_LIMIT={TEST_LIMIT} — uploading first {len(records)} of {total} records", flush=True)

    total = len(records)
    print(f"[upload-records] entering upload loop — target URL: {url}", flush=True)

    success_count = 0
    errors = []

    for i, record in enumerate(records):
        print(f"[upload-records] row {i + 1}/{total} — starting", flush=True)
        print(f"[upload-records] row {i + 1}/{total} — calling requests.post …", flush=True)

        try:
            response = requests.post(url, headers=headers, json=record, timeout=30)
        except requests.exceptions.Timeout:
            msg = f"Request timed out after 30s"
            print(f"[upload-records] row {i + 1}/{total} — TIMEOUT: {msg}", flush=True)
            errors.append({"row": i + 1, "message": msg})
            continue
        except requests.exceptions.RequestException as e:
            msg = f"{type(e).__name__}: {e}"
            print(f"[upload-records] row {i + 1}/{total} — REQUEST ERROR: {msg}", flush=True)
            errors.append({"row": i + 1, "message": msg})
            continue
        except Exception as e:
            msg = f"Unexpected error: {type(e).__name__}: {e}"
            print(f"[upload-records] row {i + 1}/{total} — UNEXPECTED ERROR: {msg}", flush=True)
            errors.append({"row": i + 1, "message": msg})
            continue

        print(f"[upload-records] row {i + 1}/{total} — response status={response.status_code}", flush=True)

        if i == 0:
            print(f"[upload-records] first response body (500 chars): {response.text[:500]}", flush=True)

        if response.status_code == 401:
            print(f"[upload-records] 401 received — aborting upload", flush=True)
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "invalid_token",
                    "message": "Access token is invalid or expired. Please login again."
                }
            )

        if response.status_code == 201:
            success_count += 1
        else:
            try:
                sf_errors = response.json()
                message = sf_errors[0].get("message", str(sf_errors)) if isinstance(sf_errors, list) else str(sf_errors)
            except Exception:
                message = response.text or "Unknown error"
            errors.append({"row": i + 1, "message": message})

        if (i + 1) % 100 == 0:
            print(f"[upload-records] progress {i + 1}/{total} — success={success_count} errors={len(errors)}", flush=True)

    print(f"[upload-records] loop complete — total={total} success={success_count} failed={len(errors)}", flush=True)
    print(f"[upload-records] returning response", flush=True)

    return {
        "total": total,
        "success": success_count,
        "failed": len(errors),
        "errors": errors,
    }
