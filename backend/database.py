import io
import math
import os
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus

import boto3
import pandas as pd
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/database", tags=["database"])

# Re-read env vars (load_dotenv() is already called in main.py before this module loads)
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


class DBConnectionRequest(BaseModel):
    dbType: str
    host: str = ""
    port: int = 0
    database: str = ""
    username: str = ""
    password: str = ""
    auth_database: str = "admin"      # MongoDB only; SQL drivers ignore this field
    sap_base_url: Optional[str] = None  # SAP OData only
    sap_entity: str = "A_BusinessPartner"  # SAP OData only


class DBFetchRequest(DBConnectionRequest):
    table: str


# ── SQL helpers (unchanged) ────────────────────────────────────────────────────

def _build_url(req: DBConnectionRequest) -> str:
    """Build a SQLAlchemy connection URL for SQL databases (PostgreSQL, MySQL, SQL Server)."""
    db = req.dbType.strip().lower()
    if db == "postgresql":
        driver = "postgresql+psycopg2"
    elif db == "mysql":
        driver = "mysql+pymysql"
    elif db in ("sql server", "sqlserver", "mssql"):
        driver = "mssql+pyodbc"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported database type: '{req.dbType}'. Only PostgreSQL is currently supported.",
        )
    user = quote_plus(req.username)
    pw = quote_plus(req.password)
    return f"{driver}://{user}:{pw}@{req.host}:{req.port}/{req.database}"


def _friendly_error(exc: Exception) -> str:
    """
    Map a raw SQLAlchemy/psycopg2 exception to a short, user-readable message.
    The full technical detail is always logged on the server and never sent to
    the frontend.
    """
    raw = str(exc).lower()
    if "password authentication failed" in raw or "authentication failed" in raw:
        return "Incorrect username or password. Please verify your database credentials."
    if any(p in raw for p in (
        "could not connect to server",
        "connection refused",
        "no route to host",
        "name or service not known",
        "nodename nor servname provided",
        "could not translate host name",
    )):
        return (
            "Unable to connect to the database server. "
            "Check the host and port, and ensure the database server is running."
        )
    if "database" in raw and "does not exist" in raw:
        return "The specified database could not be found."
    if ("relation" in raw or "table" in raw or "schema" in raw) and "does not exist" in raw:
        return "The specified table was not found."
    if "timeout" in raw or "timed out" in raw:
        return "Connection timed out. Check the host and port, and ensure the server is reachable."
    return "An unexpected database error occurred. Check your connection settings and try again."


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


def _fetch_sql_dataframe(req: DBFetchRequest) -> pd.DataFrame:
    """
    Fetch all rows from a SQL table (PostgreSQL or MySQL) and return a DataFrame.
    Logic extracted verbatim from the original fetch_data body so that the shared
    Excel/S3 export pipeline below can be reused for MongoDB without duplication.
    """
    from sqlalchemy import create_engine

    try:
        engine = create_engine(_build_url(req), connect_args={"connect_timeout": 10})
        safe = req.table.strip().replace('"', "")
        if "." in safe:
            schema, tbl = safe.split(".", 1)
            quoted = f'"{schema}"."{tbl}"'
        else:
            quoted = f'"{safe}"'
        df = pd.read_sql_query(f"SELECT * FROM {quoted}", con=engine)
        engine.dispose()
        return df
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[db/fetch] EXCEPTION (SQL): {exc}")
        raise HTTPException(status_code=400, detail=_friendly_error(exc))


# ── MongoDB helpers (new) ──────────────────────────────────────────────────────

def _build_mongo_uri(req: DBConnectionRequest) -> str:
    """
    Build a MongoDB connection URI.

    If credentials are supplied, authenticate against the same database the user
    specified (authSource=<database>).  If credentials are empty, connect without
    authentication so local dev instances without auth still work.
    """
    if req.username and req.password:
        user = quote_plus(req.username)
        pw = quote_plus(req.password)
        return (
            f"mongodb://{user}:{pw}@{req.host}:{req.port}"
            f"/{req.database}?authSource={quote_plus(req.auth_database)}"
        )
    return f"mongodb://{req.host}:{req.port}/"


def _friendly_mongo_error(exc: Exception) -> str:
    """
    Extend the shared SQL error mapper with MongoDB-specific error patterns.
    Delegates to _friendly_error for patterns that already overlap
    (authentication failure, generic timeout, etc.).
    """
    raw = str(exc).lower()
    # ServerSelectionTimeoutError — covers wrong host, unreachable port, or
    # a server that exists but rejects the connection before a TCP handshake.
    if "server selection" in raw or "serverselectiontimeout" in raw:
        return (
            "Unable to connect to the MongoDB server. "
            "Check the host and port, and ensure the database server is running."
        )
    # Delegate to the shared mapper for patterns that already match:
    # "authentication failed", "timeout", "timed out", etc.
    return _friendly_error(exc)


def _test_mongo_connection(req: DBConnectionRequest) -> dict:
    """
    Test a MongoDB connection by issuing a ping command against the admin database.
    Uses PyMongo directly — no SQLAlchemy involved.
    """
    try:
        from pymongo import MongoClient

        uri = _build_mongo_uri(req)
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        client.close()
        print("[db/test] MongoDB ping succeeded")
        return {"success": True, "message": "Connection successful"}
    except Exception as exc:
        print(f"[db/test] EXCEPTION (MongoDB): {exc}")
        raise HTTPException(status_code=400, detail=_friendly_mongo_error(exc))


def _fetch_mongo_dataframe(req: DBFetchRequest) -> pd.DataFrame:
    """
    Fetch all documents from a MongoDB collection and return a plain DataFrame.

    - The "table" field from the frontend is treated as the collection name.
    - The MongoDB _id field is always dropped before the DataFrame is returned
      so it does not appear in the exported Excel file.
    - If the collection is empty or does not exist, an empty DataFrame is returned
      (MongoDB does not raise an error for non-existent collections).
    - BSON ObjectId values in any column are converted to strings so that
      openpyxl can serialise them without raising TypeError.
    """
    try:
        from pymongo import MongoClient

        uri = _build_mongo_uri(req)
        client = MongoClient(uri, serverSelectionTimeoutMS=10000)
        db_obj = client[req.database]
        collection = db_obj[req.table]
        docs = list(collection.find({}))
        client.close()
    except Exception as exc:
        print(f"[db/fetch] EXCEPTION (MongoDB): {exc}")
        raise HTTPException(status_code=400, detail=_friendly_mongo_error(exc))

    # Empty or non-existent collection — return an empty DataFrame, not an error.
    if not docs:
        return pd.DataFrame()

    # Coerce BSON ObjectId (and any other non-serialisable BSON types) to strings
    # before building the DataFrame so the Excel writer never sees them.
    try:
        from bson import ObjectId as _ObjectId
        docs = [
            {k: (str(v) if isinstance(v, _ObjectId) else v) for k, v in doc.items()}
            for doc in docs
        ]
    except ImportError:
        pass  # bson always ships with pymongo; this is a defensive fallback only

    df = pd.DataFrame(docs)
    if "_id" in df.columns:
        df = df.drop(columns=["_id"])
    return df


# ── SAP OData helpers ─────────────────────────────────────────────────────────

def _friendly_sap_error(exc: Exception, status_code: Optional[int] = None) -> str:
    """Map SAP OData HTTP errors and network exceptions to user-readable messages."""
    if status_code == 401:
        return "Authentication failed. Please verify your SAP username and password."
    if status_code == 403:
        return "Access denied. The SAP user does not have permission to access this resource."
    if status_code == 404:
        return "The SAP entity endpoint was not found. Check the Base URL and Entity name."
    raw = str(exc).lower()
    if "connection" in raw or "refused" in raw or "name or service" in raw or "nodename" in raw:
        return (
            "Unable to connect to the SAP system. "
            "Check the Base URL and ensure the system is reachable."
        )
    if "timeout" in raw or "timed out" in raw:
        return "Connection to SAP timed out. Check the Base URL and network access."
    return "An unexpected SAP error occurred. Check your connection settings and try again."


def _test_sap_connection(req: DBConnectionRequest) -> dict:
    """Test a SAP OData connection by fetching a single record from the entity endpoint."""
    import requests as _requests
    base = (req.sap_base_url or "").rstrip("/")
    entity = req.sap_entity.strip("/")
    url = f"{base}/sap/opu/odata/sap/{entity}"
    try:
        resp = _requests.get(
            url,
            params={"$top": "1", "$format": "json"},
            auth=(req.username, req.password),
            headers={"Accept": "application/json"},
            timeout=10,
        )
        if resp.status_code == 200:
            print("[db/test] SAP OData ping succeeded")
            return {"success": True, "message": "Connection successful"}
        raise HTTPException(
            status_code=400,
            detail=_friendly_sap_error(Exception(resp.text), status_code=resp.status_code),
        )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[db/test] EXCEPTION (SAP OData): {exc}")
        raise HTTPException(status_code=400, detail=_friendly_sap_error(exc))


def _fetch_sap_dataframe(req: DBFetchRequest) -> pd.DataFrame:
    """Fetch all records from a SAP OData entity endpoint and return a DataFrame."""
    import requests as _requests
    base = (req.sap_base_url or "").rstrip("/")
    entity = (req.sap_entity or req.table or "A_BusinessPartner").strip("/")
    url = f"{base}/sap/opu/odata/sap/{entity}"
    try:
        resp = _requests.get(
            url,
            params={"$format": "json"},
            auth=(req.username, req.password),
            headers={"Accept": "application/json"},
            timeout=60,
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=_friendly_sap_error(Exception(resp.text), status_code=resp.status_code),
            )
        payload = resp.json()
        # OData V2: {"d": {"results": [...]}}
        if isinstance(payload.get("d"), dict) and "results" in payload["d"]:
            records = payload["d"]["results"]
        # OData V4: {"value": [...]}
        elif "value" in payload and isinstance(payload["value"], list):
            records = payload["value"]
        else:
            records = payload if isinstance(payload, list) else [payload]
        return pd.DataFrame(records) if records else pd.DataFrame()
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[db/fetch] EXCEPTION (SAP OData): {exc}")
        raise HTTPException(status_code=400, detail=_friendly_sap_error(exc))


# ── SQL Server helpers ────────────────────────────────────────────────────────

def _build_mssql_conn_str(req: DBConnectionRequest, timeout: int = 10) -> str:
    """Build a pyodbc connection string for SQL Server using ODBC Driver 18."""
    return (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={req.host},{req.port};"
        f"DATABASE={req.database};"
        f"UID={req.username};"
        f"PWD={req.password};"
        f"TrustServerCertificate=yes;"
        f"Encrypt=yes;"
        f"LoginTimeout={timeout};"
    )


def _friendly_mssql_error(exc: Exception) -> str:
    """Map pyodbc SQL Server exceptions to user-readable messages."""
    raw = str(exc).lower()
    if "login failed" in raw:
        return "Incorrect username or password. Please verify your SQL Server credentials."
    if "cannot open database" in raw:
        return "The specified database could not be found or is not accessible with these credentials."
    if "tcp provider" in raw or "could not open a connection" in raw or "named pipes provider" in raw:
        return (
            "Unable to connect to the SQL Server. "
            "Check the host and port, and ensure the server is running and reachable."
        )
    if "invalid object name" in raw:
        return "The specified table was not found in the database."
    if "timeout" in raw or "timed out" in raw:
        return "Connection timed out. Check the host and port."
    return _friendly_error(exc)


def _test_mssql_connection(req: DBConnectionRequest) -> dict:
    """Test a SQL Server connection using pyodbc directly."""
    try:
        import pyodbc
        conn = pyodbc.connect(_build_mssql_conn_str(req, timeout=10))
        conn.execute("SELECT 1")
        conn.close()
        print("[db/test] SQL Server ping succeeded")
        return {"success": True, "message": "Connection successful"}
    except Exception as exc:
        print(f"[db/test] EXCEPTION (SQL Server): {exc}")
        raise HTTPException(status_code=400, detail=_friendly_mssql_error(exc))


def _fetch_mssql_dataframe(req: DBFetchRequest) -> pd.DataFrame:
    """Fetch all rows from a SQL Server table using pyodbc."""
    try:
        import pyodbc
        conn = pyodbc.connect(_build_mssql_conn_str(req))
        safe = req.table.strip()
        df = pd.read_sql_query(f"SELECT * FROM {safe}", conn)
        conn.close()
        return df
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[db/fetch] EXCEPTION (SQL Server): {exc}")
        raise HTTPException(status_code=400, detail=_friendly_mssql_error(exc))


def _get_schema_from_mssql(req: DBFetchRequest) -> dict:
    """Fetch {column_name: data_type} from SQL Server's information_schema."""
    try:
        import pyodbc
        conn = pyodbc.connect(_build_mssql_conn_str(req))
        safe = req.table.strip()
        schema_name, table_name = safe.split(".", 1) if "." in safe else ("dbo", safe)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_schema = ? AND table_name = ? "
            "ORDER BY ordinal_position",
            schema_name,
            table_name,
        )
        rows = cursor.fetchall()
        conn.close()
        return {row[0]: row[1] for row in rows}
    except Exception:
        return {}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/test")
def test_connection(req: DBConnectionRequest):
    """Test a database connection. Returns 200 on success, 400 with the DB error on failure."""
    # Diagnostic log — verify the backend receives the correct credentials.
    # Password is never logged; only its length is printed.
    print(
        f"[db/test] type={req.dbType!r} host={req.host!r} port={req.port} "
        f"db={req.database!r} user={req.username!r} password_len={len(req.password)}"
    )

    # ── MongoDB branch ────────────────────────────────────────────────────────
    if req.dbType.strip().lower() == "mongodb":
        return _test_mongo_connection(req)

    # ── SAP OData branch ──────────────────────────────────────────────────────
    if req.dbType.strip().lower() in ("sap", "sap odata", "sap_odata"):
        return _test_sap_connection(req)

    # ── SQL Server branch ─────────────────────────────────────────────────────
    if req.dbType.strip().lower() in ("sql server", "sqlserver", "mssql"):
        return _test_mssql_connection(req)

    # ── SQL branch (PostgreSQL / MySQL) ───────────────────────────────────────
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool

        # NullPool disables connection pooling so every call opens (and
        # immediately closes) a fresh TCP connection.  This rules out a
        # previously-authenticated pooled connection causing a false positive.
        engine = create_engine(
            _build_url(req),
            connect_args={"connect_timeout": 10},
            poolclass=NullPool,
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        print(f"[db/test] primary connection succeeded")

        # ── Trust-authentication probe ────────────────────────────────────────
        # PostgreSQL pg_hba.conf may use "trust" for local/loopback connections,
        # which means the server accepts *any* password without verifying it.
        # We detect this by opening a second connection with a random sentinel
        # password.  If the sentinel also succeeds, the server never checked
        # our credentials and we must warn the user.
        sentinel_pw = f"__sentinel_{uuid.uuid4().hex}__"
        sentinel_req = req.model_copy(update={"password": sentinel_pw})
        try:
            sentinel_engine = create_engine(
                _build_url(sentinel_req),
                connect_args={"connect_timeout": 5},
                poolclass=NullPool,
            )
            with sentinel_engine.connect() as c:
                c.execute(text("SELECT 1"))
            sentinel_engine.dispose()
            # Sentinel succeeded → trust auth confirmed.
            print(
                f"[db/test] WARNING sentinel also succeeded — "
                "PostgreSQL is using trust authentication; password was not verified"
            )
            return {
                "success": True,
                "message": (
                    "Connected, but PostgreSQL trust authentication is active — "
                    "your password was not verified. "
                    "In pg_hba.conf, change 'trust' to 'scram-sha-256' (or 'md5') "
                    "for the relevant host/address entry, then reload PostgreSQL "
                    "with: pg_ctl reload  (or: SELECT pg_reload_conf();)"
                ),
                "trust_auth_detected": True,
            }
        except Exception:
            # Sentinel was rejected → PostgreSQL did check the password.
            print(f"[db/test] sentinel rejected — password authentication is working correctly")

        return {"success": True, "message": "Connection successful"}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[db/test] EXCEPTION: {exc}")
        raise HTTPException(status_code=400, detail=_friendly_error(exc))


def _get_schema_from_sql(engine, table_str: str, dialect: str) -> dict:
    """
    Fetch {column_name: data_type} from information_schema for a SQL table.
    Returns an empty dict on any error so callers can fall back gracefully.
    """
    from sqlalchemy import text as _text

    safe = table_str.strip().replace('"', "")
    if "." in safe:
        schema_name, table_name = safe.split(".", 1)
    else:
        schema_name = "public" if dialect == "postgresql" else None
        table_name = safe

    try:
        with engine.connect() as conn:
            if dialect == "mysql":
                rows = conn.execute(
                    _text(
                        "SELECT column_name, data_type "
                        "FROM information_schema.columns "
                        "WHERE table_name = :t AND table_schema = DATABASE() "
                        "ORDER BY ordinal_position"
                    ),
                    {"t": table_name},
                ).fetchall()
            else:
                params: dict = {"t": table_name}
                extra = ""
                if schema_name:
                    extra = " AND table_schema = :s"
                    params["s"] = schema_name
                rows = conn.execute(
                    _text(
                        f"SELECT column_name, data_type "
                        f"FROM information_schema.columns "
                        f"WHERE table_name = :t{extra} "
                        f"ORDER BY ordinal_position"
                    ),
                    params,
                ).fetchall()
        return {row[0]: row[1] for row in rows}
    except Exception:
        return {}


def _get_schema_from_mongo(docs: list) -> dict:
    """
    Infer {field_name: bson_type_string} from the first few MongoDB documents.
    Returns an empty dict when the collection is empty.
    """
    schema: dict = {}
    for doc in docs[:10]:
        for k, v in doc.items():
            if k == "_id" or k in schema:
                continue
            if isinstance(v, bool):
                schema[k] = "boolean"
            elif isinstance(v, int):
                schema[k] = "integer"
            elif isinstance(v, float):
                schema[k] = "double precision"
            elif hasattr(v, "year"):
                schema[k] = "timestamp"
            else:
                schema[k] = "text"
    return schema


@router.post("/fetch")
def fetch_data(
    req: DBFetchRequest,
    x_project_id: str = Header(None),
    x_client_id: str = Header(None),
):
    """
    Reads all rows/documents from the specified table or collection, converts them
    to an Excel workbook, uploads it to S3 using the same path structure as
    /api/upload-migration-files, and returns a response identical to what that
    endpoint returns for the source slot.

    Additionally returns `dbSchema` ({col: db_type}) for downstream type-detection
    (used by the Unique Identifier module's Priority 2 path).
    """
    project_id = x_project_id or str(uuid.uuid4())
    client_id = x_client_id
    dialect = req.dbType.strip().lower()

    # ── 1. Fetch from database ────────────────────────────────────────────────
    db_schema: dict = {}
    if dialect == "mongodb":
        from pymongo import MongoClient
        uri = _build_mongo_uri(req)
        try:
            mongo_client = MongoClient(uri, serverSelectionTimeoutMS=10000)
            docs_raw = list(mongo_client[req.database][req.table].find({}))
            mongo_client.close()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=_friendly_mongo_error(exc))
        db_schema = _get_schema_from_mongo(docs_raw)
        df = _fetch_mongo_dataframe(req)
    elif dialect in ("sap", "sap odata", "sap_odata"):
        df = _fetch_sap_dataframe(req)
        db_schema = {col: "text" for col in df.columns} if not df.empty else {}
    elif dialect in ("sql server", "sqlserver", "mssql"):
        db_schema = _get_schema_from_mssql(req)
        df = _fetch_mssql_dataframe(req)
    else:
        from sqlalchemy import create_engine
        engine = create_engine(_build_url(req), connect_args={"connect_timeout": 10})
        db_schema = _get_schema_from_sql(engine, req.table, dialect)
        engine.dispose()
        df = _fetch_sql_dataframe(req)

    # ── 2. Serialise to Excel in memory ───────────────────────────────────────
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")
    buf.seek(0)
    file_bytes = buf.getvalue()

    safe_name = req.table.strip().replace('"', "").replace(".", "_").replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"db_{safe_name}.xlsx"
    size_mb = f"{(len(file_bytes) / (1024 * 1024)):.2f} MB"

    # ── 3. Upload to S3 (same path logic as upload-migration-files) ───────────
    if client_id:
        s3_key = f"clients/{client_id}/projects/{project_id}/uploads/source/{timestamp}_{filename}"
    else:
        s3_key = f"projects/{project_id}/uploads/source/{timestamp}_{filename}"

    try:
        _s3.put_object(Bucket=_AWS_BUCKET_NAME, Key=s3_key, Body=file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {exc}")

    # ── 4. Return a preview (first 50 rows) ───────────────────────────────────
    preview = df.head(50)
    columns = [str(c) for c in df.columns.tolist()]
    rows = [[_safe(v) for v in row] for row in preview.values.tolist()]

    return {
        "success": True,
        "fileName": filename,
        "fileSize": size_mb,
        "s3Key": s3_key,
        "columns": columns,
        "rows": rows,
        "totalRows": len(df),
        "dbSchema": db_schema,
    }
