import io
import math
import os
import re
import uuid
from datetime import datetime
from typing import List, Optional

import boto3
import pandas as pd
from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(prefix="/api/sql-workspace", tags=["sql-workspace"])

_AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
_AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
_AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
_AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "s3-bucket-analytx4t")

_s3 = boto3.client(
    "s3",
    aws_access_key_id=_AWS_ACCESS_KEY_ID,
    aws_secret_access_key=_AWS_SECRET_ACCESS_KEY,
    region_name=_AWS_REGION,
)

# Blocklist for destructive SQL operations — checked before execution.
_DANGEROUS = re.compile(
    r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|REPLACE|EXEC(?:UTE)?|GRANT|REVOKE|ATTACH|DETACH|LOAD|COPY)\b",
    re.IGNORECASE,
)

# Table alias whitelist: only alphanumeric + underscore, must start with a letter/underscore.
_SAFE_ALIAS = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class SQLSource(BaseModel):
    source_type: str          # "file" | "database"
    table_name: str           # SQL alias used in the query

    # ── file sources ──────────────────────────────────────────────────────────
    s3_key: Optional[str] = None
    file_name: Optional[str] = None

    # ── database sources ──────────────────────────────────────────────────────
    dbType: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    auth_database: str = "admin"
    table: Optional[str] = None   # table or collection name inside the source DB


class SQLQueryRequest(BaseModel):
    sources: List[SQLSource]
    query: str


class SchemaRequest(BaseModel):
    sources: List[SQLSource]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe(v):
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


def _load_s3_bytes(s3_key: str) -> tuple[bytes, str]:
    """Return raw bytes and lowercase filename from S3."""
    obj = _s3.get_object(Bucket=_AWS_BUCKET_NAME, Key=s3_key)
    return obj["Body"].read(), s3_key.split("/")[-1].lower()


def _parse_bytes(body: bytes, name: str, nrows: Optional[int] = None) -> pd.DataFrame:
    """Parse raw bytes to DataFrame based on file extension."""
    kw = {"nrows": nrows} if nrows is not None else {}
    if name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(body), **kw)
    try:
        return pd.read_excel(io.BytesIO(body), **kw)
    except Exception:
        return pd.read_csv(io.BytesIO(body), **kw)


def _load_s3_to_df(s3_key: str) -> pd.DataFrame:
    body, name = _load_s3_bytes(s3_key)
    return _parse_bytes(body, name)


def _schema_from_s3(s3_key: str) -> list[str]:
    """Fetch only header row from S3 file — avoids downloading all data."""
    body, name = _load_s3_bytes(s3_key)
    df = _parse_bytes(body, name, nrows=1)
    return [str(c) for c in df.columns.tolist()]


def _schema_from_db(source: SQLSource) -> list[str]:
    """Fetch column names from a DB source using a LIMIT 1 query."""
    db = (source.dbType or "").strip().lower()
    if db == "mongodb":
        try:
            from pymongo import MongoClient
            from urllib.parse import quote_plus

            u = quote_plus(source.username or "")
            p = quote_plus(source.password or "")
            if u and p:
                uri = (
                    f"mongodb://{u}:{p}@{source.host}:{source.port}"
                    f"/{source.database}?authSource={quote_plus(source.auth_database)}"
                )
            else:
                uri = f"mongodb://{source.host}:{source.port}/"
            client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            doc = client[source.database or ""][source.table or ""].find_one({})
            client.close()
            if doc:
                return [k for k in doc.keys() if k != "_id"]
            return []
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Schema load failed: {exc}")
    elif db in ("sql server", "sqlserver", "mssql"):
        try:
            from database import DBFetchRequest, _get_schema_from_mssql
            req_obj = DBFetchRequest(
                dbType=source.dbType or "",
                host=source.host or "",
                port=source.port or 1433,
                database=source.database or "",
                username=source.username or "",
                password=source.password or "",
                auth_database=source.auth_database,
                table=source.table or "",
            )
            schema = _get_schema_from_mssql(req_obj)
            return list(schema.keys())
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Schema load failed: {exc}")
    else:
        try:
            from database import _build_url, DBConnectionRequest
            from sqlalchemy import create_engine, text
            from sqlalchemy.pool import NullPool

            req_obj = DBConnectionRequest(
                dbType=source.dbType or "",
                host=source.host or "",
                port=source.port or 5432,
                database=source.database or "",
                username=source.username or "",
                password=source.password or "",
                auth_database=source.auth_database,
            )
            engine = create_engine(
                _build_url(req_obj),
                connect_args={"connect_timeout": 10},
                poolclass=NullPool,
            )
            safe = (source.table or "").strip().replace('"', "")
            if "." in safe:
                schema, tbl = safe.split(".", 1)
                quoted = f'"{schema}"."{tbl}"'
            else:
                quoted = f'"{safe}"'
            df = pd.read_sql_query(f"SELECT * FROM {quoted} LIMIT 1", con=engine)
            engine.dispose()
            return [str(c) for c in df.columns.tolist()]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Schema load failed: {exc}")


def _load_db_to_df(source: SQLSource) -> pd.DataFrame:
    """Load full table / collection from an external database into a DataFrame."""
    from database import DBFetchRequest, _fetch_sql_dataframe, _fetch_mongo_dataframe, _fetch_mssql_dataframe

    req = DBFetchRequest(
        dbType=source.dbType or "",
        host=source.host or "",
        port=source.port or 5432,
        database=source.database or "",
        username=source.username or "",
        password=source.password or "",
        auth_database=source.auth_database,
        table=source.table or "",
    )
    if (source.dbType or "").strip().lower() == "mongodb":
        return _fetch_mongo_dataframe(req)
    if (source.dbType or "").strip().lower() in ("sql server", "sqlserver", "mssql"):
        return _fetch_mssql_dataframe(req)
    return _fetch_sql_dataframe(req)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/schema")
def get_schema(req: SchemaRequest, x_project_id: str = Header(None)):
    """
    Lightweight schema introspection — returns column names per source without
    loading all rows. Used by the frontend schema browser before the user runs
    a query.
    """
    schemas = []
    for source in req.sources:
        alias = source.table_name
        if not _SAFE_ALIAS.match(alias):
            continue
        entry: dict = {"table_name": alias, "source_type": source.source_type}
        try:
            if source.source_type == "file" and source.s3_key:
                entry["columns"] = _schema_from_s3(source.s3_key)
            elif source.source_type == "database":
                entry["columns"] = _schema_from_db(source)
            else:
                entry["columns"] = []
        except HTTPException as exc:
            entry["columns"] = []
            entry["error"] = exc.detail
        except Exception as exc:
            entry["columns"] = []
            entry["error"] = str(exc)
        schemas.append(entry)
    return {"schemas": schemas}


@router.post("/execute")
def execute_query(
    req: SQLQueryRequest,
    x_project_id: str = Header(None),
    x_client_id: str = Header(None),
):
    """
    Load all sources into an in-memory DuckDB instance, execute the SQL query,
    upload the full result to S3 as Excel, and return a 200-row preview.
    """
    import duckdb

    # Guard: block destructive operations before touching any data.
    if _DANGEROUS.search(req.query):
        raise HTTPException(
            status_code=400,
            detail=(
                "Destructive SQL operations (DROP, DELETE, UPDATE, INSERT, TRUNCATE, etc.) "
                "are not permitted in the SQL Workspace."
            ),
        )

    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id

    con = duckdb.connect(":memory:")
    try:
        # ── 1. Load every source into DuckDB ─────────────────────────────────
        for source in req.sources:
            alias = source.table_name
            if not _SAFE_ALIAS.match(alias):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Table alias '{alias}' is invalid. "
                        "Use only letters, digits, and underscores."
                    ),
                )

            if source.source_type == "file":
                if not source.s3_key:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File source '{alias}' is missing an s3_key.",
                    )
                try:
                    df = _load_s3_to_df(source.s3_key)
                except HTTPException:
                    raise
                except Exception as exc:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not load file '{alias}': {exc}",
                    )

            elif source.source_type == "database":
                try:
                    df = _load_db_to_df(source)
                except HTTPException:
                    raise
                except Exception as exc:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not load '{alias}' from database: {exc}",
                    )

            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown source_type '{source.source_type}'.",
                )

            # Register the DataFrame as a named in-memory table.
            con.register(alias, df)

        # ── 2. Execute SQL ────────────────────────────────────────────────────
        try:
            result_df = con.execute(req.query).df()
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"SQL execution error: {exc}",
            )

        # ── 3. Persist full result to S3 ──────────────────────────────────────
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            result_df.to_excel(writer, index=False)
        buf.seek(0)
        file_bytes = buf.getvalue()

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"sql_result_{timestamp}.xlsx"
        if client_id:
            s3_key = f"clients/{client_id}/projects/{project_id}/sql-workspace/{filename}"
        else:
            s3_key = f"projects/{project_id}/sql-workspace/{filename}"

        try:
            _s3.put_object(Bucket=_AWS_BUCKET_NAME, Key=s3_key, Body=file_bytes)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to save result to S3: {exc}")

        # ── 4. Build 200-row preview response ─────────────────────────────────
        preview = result_df.head(200)
        columns = [str(c) for c in result_df.columns.tolist()]
        rows = [[_safe(v) for v in row] for row in preview.values.tolist()]

        return {
            "success": True,
            "columns": columns,
            "rows": rows,
            "total_rows": len(result_df),
            "preview_rows": len(rows),
            "s3_key": s3_key,
            "file_name": filename,
            "file_size": f"{len(file_bytes) / (1024 * 1024):.2f} MB",
        }

    finally:
        con.close()


@router.post("/upload")
async def upload_file_for_workspace(
    file: UploadFile = File(...),
    x_project_id: str = Header(None),
    x_client_id: str = Header(None),
):
    """
    Upload a file directly from SQL Workspace to S3.
    Returns the S3 key, filename, and formatted file size.
    The caller is responsible for registering the file with the project.
    """
    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id

    file_bytes = await file.read()
    size_str = f"{len(file_bytes) / (1024 * 1024):.2f} MB"

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    original_name = file.filename or "upload.xlsx"

    if client_id:
        s3_key = f"clients/{client_id}/projects/{project_id}/sql-workspace/uploads/{timestamp}_{original_name}"
    else:
        s3_key = f"projects/{project_id}/sql-workspace/uploads/{timestamp}_{original_name}"

    try:
        _s3.put_object(Bucket=_AWS_BUCKET_NAME, Key=s3_key, Body=file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload file to S3: {exc}")

    return {
        "success": True,
        "s3Key": s3_key,
        "fileName": original_name,
        "fileSize": size_str,
    }
