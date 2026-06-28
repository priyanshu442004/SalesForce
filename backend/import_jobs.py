"""
Import Jobs — persistent background job tracking for Salesforce imports.
Every import creates a job record in a local SQLite database.
The existing /salesforce/upload-records endpoint is NOT modified.
"""

import io
import json
import math
import os
import sqlite3
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional

import pandas as pd
import requests
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/import-jobs", tags=["Import Jobs"])

# ── Database ──────────────────────────────────────────────────────────────────

_DB_PATH  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "import_jobs.db")
_db_lock  = threading.Lock()
_cancel_events: dict[str, threading.Event] = {}


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(_DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def _init_db():
    with _db_lock:
        c = _conn()
        c.execute("""
            CREATE TABLE IF NOT EXISTS import_jobs (
                job_id                   TEXT PRIMARY KEY,
                project_name             TEXT DEFAULT '',
                sf_object                TEXT DEFAULT '',
                sf_account               TEXT DEFAULT '',
                import_mode              TEXT DEFAULT 'Insert',
                matching_field           TEXT,
                s3_key                   TEXT DEFAULT '',
                field_mappings           TEXT DEFAULT '{}',
                batch_size               INTEGER DEFAULT 200,
                threads                  INTEGER DEFAULT 1,
                continue_on_error        INTEGER DEFAULT 0,
                status                   TEXT DEFAULT 'queued',
                started_at               TEXT,
                completed_at             TEXT,
                duration_seconds         REAL,
                total_records            INTEGER DEFAULT 0,
                successful               INTEGER DEFAULT 0,
                failed                   INTEGER DEFAULT 0,
                skipped                  INTEGER DEFAULT 0,
                report_s3_key            TEXT,
                success_report_s3_key    TEXT,
                failed_report_s3_key     TEXT,
                validation_report_s3_key TEXT,
                failed_records           TEXT DEFAULT '[]',
                error_message            TEXT,
                current_batch            INTEGER DEFAULT 0,
                total_batches            INTEGER DEFAULT 1,
                progress_percent         REAL DEFAULT 0,
                batch_details            TEXT DEFAULT '[]',
                sf_bulk_job_id           TEXT,
                created_at               TEXT NOT NULL,
                updated_at               TEXT NOT NULL
            )
        """)
        # Migrations: add columns to existing tables that predate this schema
        for ddl in [
            "ALTER TABLE import_jobs ADD COLUMN matching_field TEXT",
            "ALTER TABLE import_jobs ADD COLUMN success_report_s3_key TEXT",
            "ALTER TABLE import_jobs ADD COLUMN failed_report_s3_key TEXT",
            "ALTER TABLE import_jobs ADD COLUMN continue_on_error INTEGER DEFAULT 0",
            "ALTER TABLE import_jobs ADD COLUMN threads INTEGER DEFAULT 1",
        ]:
            try:
                c.execute(ddl)
            except Exception:
                pass
        c.commit()
        c.close()


_init_db()


def _write(job_id: str, **kw):
    kw["updated_at"] = datetime.utcnow().isoformat()
    clause = ", ".join(f"{k} = ?" for k in kw)
    vals   = list(kw.values()) + [job_id]
    with _db_lock:
        c = _conn()
        c.execute(f"UPDATE import_jobs SET {clause} WHERE job_id = ?", vals)
        c.commit()
        c.close()


def _read(job_id: str) -> Optional[dict]:
    with _db_lock:
        c = _conn()
        row = c.execute("SELECT * FROM import_jobs WHERE job_id = ?", (job_id,)).fetchone()
        c.close()
    return dict(row) if row else None


def _sanitize(obj, _path: str = "") -> object:
    """
    Recursively replace float NaN / ±Infinity with None so FastAPI can serialize
    the response.  Prints a warning line for every offending value so the terminal
    shows exactly which key triggered the crash.
    """
    if isinstance(obj, dict):
        return {k: _sanitize(v, f"{_path}.{k}" if _path else k) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v, f"{_path}[{i}]") for i, v in enumerate(obj)]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        print(f"[import-jobs] WARNING: non-JSON float at '{_path}': {obj!r} → None", flush=True)
        return None
    return obj


def _expand(d: dict) -> dict:
    for key in ("failed_records", "batch_details"):
        try:
            d[key] = json.loads(d.get(key) or "[]")
        except Exception:
            d[key] = []
    try:
        d["field_mappings"] = json.loads(d.get("field_mappings") or "{}")
    except Exception:
        d["field_mappings"] = {}
    return _sanitize(d)


# ── Bulk API constants ────────────────────────────────────────────────────────

BULK_API_VER  = "v60.0"
POLL_INTERVAL = 5
POLL_TIMEOUT  = 1800


def _safe_val(val):
    if val is None or val is pd.NaT:
        return ""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return ""
    if isinstance(val, pd.Timestamp):
        return val.isoformat()
    return val


# ── Cancellation sentinel ─────────────────────────────────────────────────────

class _Cancelled(Exception):
    pass


# ── Single-batch Bulk API 2.0 helper ─────────────────────────────────────────

def _run_sf_batch(
    job_id:        str,
    base:          str,
    jh:            dict,
    access_token:  str,
    object_name:   str,
    operation:     str,
    chunk_df:      pd.DataFrame,
    ev:            threading.Event,
    batch_num:     int,
    total_batches: int,
    total_records: int,
    records_done:  int,
    all_polls:     list,
    polls_lock:    threading.Lock,
) -> dict:
    """
    Submit one DataFrame chunk as a Salesforce Bulk API 2.0 ingest job.
    Appends poll entries to all_polls (shared mutable list) and writes live
    progress to the DB on every poll tick.
    Returns {sf_job_id, successful, failed_rows, unprocessed}.
    Raises _Cancelled on cancel signal, RuntimeError on SF-level failure.
    """
    if ev.is_set():
        raise _Cancelled()

    label = f"Batch {batch_num}/{total_batches}"

    print(
        f"[import-jobs] {label}: CSV headers → {list(chunk_df.columns)}",
        flush=True,
    )
    buf = io.StringIO()
    chunk_df.to_csv(buf, index=False, lineterminator="\n")
    csv_bytes = buf.getvalue().encode("utf-8")

    jr = requests.post(
        f"{base}/jobs/ingest", headers=jh,
        json={"operation": operation, "object": object_name,
              "contentType": "CSV", "lineEnding": "LF"},
        timeout=30,
    )
    if not jr.ok:
        raise RuntimeError(f"{label}: SF job creation failed: {jr.status_code} {jr.text[:200]}")
    sf_job_id = jr.json()["id"]
    _write(job_id, sf_bulk_job_id=sf_job_id, current_batch=batch_num)

    br = requests.put(
        f"{base}/jobs/ingest/{sf_job_id}/batches",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "text/csv"},
        data=csv_bytes, timeout=300,
    )
    if not br.ok:
        raise RuntimeError(f"{label}: CSV upload failed: {br.status_code} {br.text[:200]}")

    cr = requests.patch(
        f"{base}/jobs/ingest/{sf_job_id}", headers=jh,
        json={"state": "UploadComplete"}, timeout=30,
    )
    if not cr.ok:
        raise RuntimeError(f"{label}: Job close failed: {cr.status_code} {cr.text[:200]}")

    terminal  = {"JobComplete", "Failed", "Aborted"}
    elapsed   = 0
    job_state = ""

    while elapsed < POLL_TIMEOUT:
        if ev.is_set():
            try:
                requests.patch(f"{base}/jobs/ingest/{sf_job_id}", headers=jh,
                               json={"state": "Aborted"}, timeout=30)
            except Exception:
                pass
            raise _Cancelled()

        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        try:
            sr = requests.get(f"{base}/jobs/ingest/{sf_job_id}", headers=jh, timeout=30)
            if not sr.ok:
                continue
        except Exception:
            continue

        sd        = sr.json()
        job_state = sd.get("state", "")
        processed = sd.get("numberRecordsProcessed", 0) or 0
        num_fail  = sd.get("numberRecordsFailed", 0) or 0
        progress  = (5 + (records_done + processed) / total_records * 90
                     if total_records > 0 else 5)

        if job_state in ("Failed", "Aborted"):
            sf_error_msg = (sd.get("errorMessage") or sd.get("errorCode") or "").strip()
            print(
                f"[import-jobs] SF job {sf_job_id} entered state={job_state}. Full response:\n"
                + json.dumps(sd, indent=2),
                flush=True,
            )
        else:
            sf_error_msg = ""

        with polls_lock:
            poll_entry: dict = {
                "poll":      len(all_polls) + 1,
                "state":     job_state,
                "processed": records_done + processed,
                "failed":    num_fail,
                "elapsed_s": elapsed,
                "timestamp": datetime.utcnow().isoformat(),
            }
            if sf_error_msg:
                poll_entry["sf_error"] = sf_error_msg
            all_polls.append(poll_entry)
            polls_snapshot = all_polls[-100:]

        _write(job_id,
               progress_percent=min(97, progress),
               batch_details=json.dumps(polls_snapshot))

        if job_state in terminal:
            break
    else:
        raise RuntimeError(f"{label}: Poll timeout after {POLL_TIMEOUT}s. SF Job: {sf_job_id}")

    if job_state in ("Failed", "Aborted"):
        sf_error_msg = (sd.get("errorMessage") or sd.get("errorCode") or "").strip()
        detail = f" — {sf_error_msg}" if sf_error_msg else ""
        raise RuntimeError(
            f"{label}: Salesforce bulk job {job_state}. SF Job: {sf_job_id}{detail}"
        )

    def _fetch(path: str) -> list[dict]:
        try:
            r = requests.get(
                f"{base}/jobs/ingest/{sf_job_id}/{path}",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "text/csv"},
                timeout=120,
            )
            if not r.ok or not r.text.strip():
                return []
            return list(pd.read_csv(io.StringIO(r.text.strip())).to_dict(orient="records"))
        except Exception:
            return []

    return {
        "sf_job_id":   sf_job_id,
        "successful":  _fetch("successfulResults"),
        "failed_rows": _fetch("failedResults"),
        "unprocessed": _fetch("unprocessedRecords"),
    }


# ── Background job runner ─────────────────────────────────────────────────────

def _run_job(
    job_id:            str,
    access_token:      str,
    instance_url:      str,
    object_name:       str,
    s3_key:            str,
    operation:         str,
    batch_size:        int,
    retry_rows:        Optional[list],
    continue_on_error: bool = False,
    threads:           int  = 1,
):
    """
    Splits the dataset into batch_size-row chunks and submits each as an
    independent Salesforce Bulk API 2.0 ingest job, accumulating results.
    Runs in a background daemon thread.
    """
    from main import temp_download, upload_to_s3   # lazy import avoids circular at load time

    ev         = _cancel_events.get(job_id, threading.Event())
    base       = f"{instance_url}/services/data/{BULK_API_VER}"
    jh         = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    t0         = time.time()
    all_polls: list[dict] = []

    try:
        _write(job_id, status="running", started_at=datetime.utcnow().isoformat(), progress_percent=2)

        # ── 1. Load data ──────────────────────────────────────────────────────
        if retry_rows is not None:
            df = pd.DataFrame(retry_rows)
        else:
            tmp = temp_download(s3_key)
            try:
                df = pd.read_excel(tmp)
            finally:
                if os.path.exists(tmp):
                    os.remove(tmp)
            df = df[[c for c in df.columns if not str(c).startswith("__")]]

        total = len(df)
        if total == 0:
            _write(job_id, status="completed",
                   completed_at=datetime.utcnow().isoformat(),
                   duration_seconds=round(time.time() - t0, 2),
                   total_records=0, successful=0, failed=0, progress_percent=100)
            return

        # ── 2. Sanitize ───────────────────────────────────────────────────────
        df2 = df.copy()
        for col in df2.columns:
            df2[col] = df2[col].apply(_safe_val)

        # ── 3. Apply field mappings (source col → SF API name) ────────────────
        raw_job   = _read(job_id) or {}
        try:
            mapping = json.loads(raw_job.get("field_mappings") or "{}")
        except Exception:
            mapping = {}

        if mapping:
            # Keep only mapped columns, renamed to their SF API names.
            # Unmapped / skipped source columns are excluded from the upload.
            mapped = {src: sf for src, sf in mapping.items() if src in df2.columns}
            df2 = df2[list(mapped.keys())].rename(columns=mapped)
            print(
                f"[import-jobs] Field mapping applied. "
                f"Upload headers: {list(df2.columns)}",
                flush=True,
            )
        else:
            print(
                f"[import-jobs] WARNING: no field_mappings found for job {job_id}. "
                f"Uploading with original headers: {list(df2.columns)}",
                flush=True,
            )

        # orig_cols reflects the column names that will actually be in the CSV
        # (SF API names after rename, or source names if no mapping was applied).
        orig_cols = list(df2.columns)

        # ── 4. Split into chunks ──────────────────────────────────────────────
        chunks    = [df2.iloc[i:i + batch_size] for i in range(0, total, batch_size)]
        n_batches = len(chunks)
        _write(job_id, total_records=total, total_batches=n_batches, progress_percent=5)

        # ── 3. Process batches (concurrent when threads > 1) ─────────────────
        all_successful:  list[dict] = []
        all_failed_rows: list[dict] = []
        all_unprocessed: list[dict] = []
        ok_count         = 0
        fail_count       = 0
        last_sf_job_id: Optional[str] = None
        records_done     = 0

        result_lock = threading.Lock()
        polls_lock  = threading.Lock()

        effective_threads = max(1, min(threads, n_batches))
        print(
            f"[import-jobs] Starting {n_batches} batch(es) with {effective_threads} thread(s).",
            flush=True,
        )

        def _run_one(batch_idx: int, chunk: pd.DataFrame) -> dict:
            chunk_size = len(chunk)
            batch_num  = batch_idx + 1
            tname      = threading.current_thread().name
            print(
                f"[import-jobs] {tname} → Batch {batch_num}/{n_batches} started "
                f"({chunk_size} records)",
                flush=True,
            )
            res = _run_sf_batch(
                job_id=job_id, base=base, jh=jh,
                access_token=access_token,
                object_name=object_name, operation=operation,
                chunk_df=chunk, ev=ev,
                batch_num=batch_num, total_batches=n_batches,
                total_records=total,
                records_done=batch_idx * batch_size,
                all_polls=all_polls, polls_lock=polls_lock,
            )
            print(
                f"[import-jobs] {tname} → Batch {batch_num}/{n_batches} completed "
                f"({len(res['successful'])} success, "
                f"{len(res['failed_rows']) + len(res['unprocessed'])} failed/unprocessed)",
                flush=True,
            )
            return {"batch_idx": batch_idx, "chunk_size": chunk_size, **res}

        cancelled = False
        with ThreadPoolExecutor(max_workers=effective_threads,
                                thread_name_prefix="sf-batch") as executor:
            futures = {
                executor.submit(_run_one, i, chunk): i
                for i, chunk in enumerate(chunks)
            }
            for future in as_completed(futures):
                batch_idx  = futures[future]
                batch_num  = batch_idx + 1
                chunk_size = len(chunks[batch_idx])
                try:
                    res = future.result()
                except _Cancelled:
                    cancelled = True
                    ev.set()
                    for f in futures:
                        f.cancel()
                    break
                except RuntimeError as exc:
                    if not continue_on_error:
                        ev.set()
                        for f in futures:
                            f.cancel()
                        raise
                    print(
                        f"[import-jobs] {exc} — continuing (continue_on_error=True)",
                        flush=True,
                    )
                    with result_lock:
                        fail_count   += chunk_size
                        records_done += chunk_size
                        with polls_lock:
                            polls_snap = all_polls[-100:]
                        _write(job_id,
                               current_batch=batch_num,
                               successful=ok_count, failed=fail_count,
                               progress_percent=min(97, 5 + batch_num / n_batches * 90),
                               batch_details=json.dumps(polls_snap))
                    continue

                with result_lock:
                    last_sf_job_id = res["sf_job_id"]
                    ok_count   += len(res["successful"])
                    fail_count += len(res["failed_rows"]) + len(res["unprocessed"])
                    all_successful.extend(res["successful"])
                    all_failed_rows.extend(res["failed_rows"])
                    all_unprocessed.extend(res["unprocessed"])
                    records_done += chunk_size
                    with polls_lock:
                        polls_snap = all_polls[-100:]
                    _write(job_id,
                           sf_bulk_job_id=last_sf_job_id,
                           current_batch=batch_num,
                           successful=ok_count, failed=fail_count,
                           progress_percent=min(97, 5 + batch_num / n_batches * 90),
                           batch_details=json.dumps(polls_snap))

        if cancelled:
            with polls_lock:
                polls_snap = all_polls[-100:]
            _write(job_id, status="cancelled",
                   completed_at=datetime.utcnow().isoformat(),
                   duration_seconds=round(time.time() - t0, 2),
                   batch_details=json.dumps(polls_snap))
            return

        # ── 4. Build failed_records_data for retry ────────────────────────────
        failed_records_data: list[dict] = []
        for row in all_failed_rows:
            rec = {c: row.get(c, "") for c in orig_cols if c in row}
            rec["_sf_error"] = str(row.get("sf__Error", ""))
            failed_records_data.append(rec)
        for row in all_unprocessed:
            rec = {c: row.get(c, "") for c in orig_cols if c in row}
            rec["_sf_error"] = "Unprocessed"
            failed_records_data.append(rec)

        # ── 5. Build and upload merged reports ───────────────────────────────
        ts          = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
        obj_safe    = object_name.replace(" ", "_")
        op_cap      = operation.capitalize()
        report_root = f"migration_reports/{last_sf_job_id or job_id}"

        success_rows_out: list[dict] = []
        for row in all_successful:
            r = {c: row.get(c, "") for c in orig_cols}
            r["Status"]        = "Success"
            r["Salesforce ID"] = row.get("sf__Id", "")
            r["Action"]        = op_cap
            success_rows_out.append(r)

        failed_rows_out: list[dict] = []
        for row in all_failed_rows:
            r = {c: row.get(c, "") for c in orig_cols}
            r["Status"] = "Failed"
            r["Action"] = op_cap
            r["Error"]  = str(row.get("sf__Error", "Unknown error"))
            failed_rows_out.append(r)
        for row in all_unprocessed:
            r = {c: row.get(c, "") for c in orig_cols}
            r["Status"] = "Unprocessed"
            r["Action"] = op_cap
            r["Error"]  = "Not processed"
            failed_rows_out.append(r)

        success_report_s3_key: Optional[str] = None
        failed_report_s3_key:  Optional[str] = None

        if success_rows_out:
            s_df = pd.DataFrame(success_rows_out,
                                columns=orig_cols + ["Status", "Salesforce ID", "Action"])
            fd, s_path = tempfile.mkstemp(suffix=".csv")
            os.close(fd)
            try:
                s_df.to_csv(s_path, index=False, lineterminator="\n", encoding="utf-8")
                key = f"{report_root}/{obj_safe}_Import_Success_{ts}.csv"
                upload_to_s3(s_path, key)
                success_report_s3_key = key
            except Exception as e:
                print(f"[import-jobs] success report upload failed (non-fatal): {e}", flush=True)
            finally:
                try: os.remove(s_path)
                except Exception: pass

        if failed_rows_out:
            f_df = pd.DataFrame(failed_rows_out,
                                columns=orig_cols + ["Status", "Action", "Error"])
            fd, f_path = tempfile.mkstemp(suffix=".csv")
            os.close(fd)
            try:
                f_df.to_csv(f_path, index=False, lineterminator="\n", encoding="utf-8")
                key = f"{report_root}/{obj_safe}_Import_Failed_{ts}.csv"
                upload_to_s3(f_path, key)
                failed_report_s3_key = key
            except Exception as e:
                print(f"[import-jobs] failed report upload failed (non-fatal): {e}", flush=True)
            finally:
                try: os.remove(f_path)
                except Exception: pass

        # ── 6. Finalise ───────────────────────────────────────────────────────
        final = ("completed" if fail_count == 0
                 else "completed_with_warnings" if ok_count > 0
                 else "failed")

        _write(job_id,
               status=final,
               completed_at=datetime.utcnow().isoformat(),
               duration_seconds=round(time.time() - t0, 2),
               total_records=total,
               successful=ok_count,
               failed=fail_count,
               success_report_s3_key=success_report_s3_key,
               failed_report_s3_key=failed_report_s3_key,
               failed_records=json.dumps(failed_records_data),
               batch_details=json.dumps(all_polls[-100:]),
               progress_percent=100,
               error_message=None)

    except Exception as exc:
        _write(job_id,
               status="failed",
               completed_at=datetime.utcnow().isoformat(),
               duration_seconds=round(time.time() - t0, 2),
               error_message=str(exc)[:1000],
               progress_percent=0)
    finally:
        _cancel_events.pop(job_id, None)


# ── Request models ────────────────────────────────────────────────────────────

class StartJobRequest(BaseModel):
    access_token:             str
    instance_url:             str
    sf_object:                str
    s3_key:                   str
    import_mode:              str = "Insert"
    matching_field:           Optional[str] = None
    batch_size:               int = 200
    threads:                  int = 1
    continue_on_error:        bool = False
    project_name:             str = ""
    sf_account:               str = ""
    field_mappings:           dict = {}
    validation_report_s3_key: Optional[str] = None


class RetryJobRequest(BaseModel):
    access_token: str
    instance_url: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/start")
def start_import_job(body: StartJobRequest):
    """Create a job record and start the Salesforce import in a background thread."""
    job_id = str(uuid.uuid4())
    now    = datetime.utcnow().isoformat()
    op     = body.import_mode.lower()
    if op not in ("insert", "update", "upsert", "delete"):
        op = "insert"

    # Operations other than Insert are accepted and stored but not yet executed.
    # The job is created as-is so it appears in the dashboard with a clear status.
    pending_backend = op != "insert"

    initial_status = "failed" if pending_backend else "queued"
    pending_msg    = (
        f"'{body.import_mode}' is selected correctly but backend implementation is pending. "
        "Only Insert is supported at this time."
    ) if pending_backend else None

    with _db_lock:
        c = _conn()
        c.execute("""
            INSERT INTO import_jobs
              (job_id, project_name, sf_object, sf_account, import_mode, matching_field,
               s3_key, field_mappings, batch_size, threads, continue_on_error, status,
               validation_report_s3_key, error_message, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (job_id, body.project_name, body.sf_object, body.sf_account,
              body.import_mode, body.matching_field, body.s3_key,
              json.dumps(body.field_mappings), body.batch_size,
              max(1, body.threads), int(body.continue_on_error), initial_status,
              body.validation_report_s3_key,
              pending_msg, now if pending_backend else None, now, now))
        c.commit()
        c.close()

    if pending_backend:
        return {"job_id": job_id, "status": "failed", "pending": True}

    ev = threading.Event()
    _cancel_events[job_id] = ev

    threading.Thread(
        target=_run_job,
        kwargs=dict(
            job_id=job_id, access_token=body.access_token,
            instance_url=body.instance_url, object_name=body.sf_object,
            s3_key=body.s3_key, operation=op, batch_size=body.batch_size,
            retry_rows=None, continue_on_error=body.continue_on_error,
            threads=max(1, body.threads),
        ),
        daemon=True,
    ).start()

    return {"job_id": job_id, "status": "queued"}


@router.get("/stats")
def get_stats():
    """Aggregate metrics for the dashboard header."""
    with _db_lock:
        c = _conn()
        row = c.execute("""
            SELECT
                COUNT(*)  AS total,
                SUM(status IN ('completed','completed_with_warnings')) AS completed,
                SUM(status = 'running')   AS running,
                SUM(status = 'failed')    AS failed,
                SUM(status = 'queued')    AS queued,
                SUM(status = 'cancelled') AS cancelled,
                COALESCE(SUM(successful), 0) AS records_imported,
                AVG(CASE WHEN status IN ('completed','completed_with_warnings')
                         THEN duration_seconds END) AS avg_duration
            FROM import_jobs
        """).fetchone()
        c.close()
    d = dict(row)
    d["avg_duration"] = round(d.get("avg_duration") or 0, 1)
    return d


@router.get("")
def list_jobs(
    status:     Optional[str] = Query(None),
    project:    Optional[str] = Query(None),
    sf_object:  Optional[str] = Query(None),
    sf_account: Optional[str] = Query(None),
    date_from:  Optional[str] = Query(None),
    date_to:    Optional[str] = Query(None),
    search:     Optional[str] = Query(None),
    limit:  int = Query(50, ge=1, le=200),
    offset: int = Query(0,  ge=0),
):
    where_parts, params = [], []

    if status:
        where_parts.append("status = ?");       params.append(status)
    if project:
        where_parts.append("project_name LIKE ?"); params.append(f"%{project}%")
    if sf_object:
        where_parts.append("sf_object LIKE ?");  params.append(f"%{sf_object}%")
    if sf_account:
        where_parts.append("sf_account LIKE ?"); params.append(f"%{sf_account}%")
    if date_from:
        where_parts.append("created_at >= ?");   params.append(date_from)
    if date_to:
        where_parts.append("created_at <= ?");   params.append(date_to + "T23:59:59")
    if search:
        where_parts.append("(job_id LIKE ? OR project_name LIKE ? OR sf_object LIKE ?)")
        params += [f"%{search}%"] * 3

    w = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    with _db_lock:
        c     = _conn()
        total = c.execute(f"SELECT COUNT(*) FROM import_jobs {w}", params).fetchone()[0]
        rows  = c.execute(
            f"""SELECT job_id, project_name, sf_object, sf_account, import_mode,
                       batch_size, status, started_at, completed_at, duration_seconds,
                       total_records, successful, failed, skipped,
                       report_s3_key, success_report_s3_key, failed_report_s3_key,
                       validation_report_s3_key, error_message, current_batch,
                       total_batches, progress_percent, sf_bulk_job_id, created_at, updated_at
                FROM import_jobs {w}
                ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            params + [limit, offset],
        ).fetchall()
        c.close()

    return _sanitize({"jobs": [dict(r) for r in rows], "total": total, "limit": limit, "offset": offset})


@router.get("/{job_id}")
def get_job(job_id: str):
    d = _read(job_id)
    if not d:
        raise HTTPException(404, f"Job {job_id!r} not found")
    return _expand(d)


@router.patch("/{job_id}/cancel")
def cancel_job(job_id: str):
    d = _read(job_id)
    if not d:
        raise HTTPException(404, f"Job {job_id!r} not found")
    if d["status"] not in ("queued", "running"):
        raise HTTPException(400, f"Cannot cancel a {d['status']!r} job")

    if d["status"] == "queued":
        _write(job_id, status="cancelled", completed_at=datetime.utcnow().isoformat())
    else:
        ev = _cancel_events.get(job_id)
        if ev:
            ev.set()
        else:
            _write(job_id, status="cancelled", completed_at=datetime.utcnow().isoformat())

    return {"job_id": job_id, "status": "cancelling"}


@router.post("/{job_id}/retry")
def retry_job(job_id: str, body: RetryJobRequest):
    orig = _read(job_id)
    if not orig:
        raise HTTPException(404, f"Job {job_id!r} not found")
    if orig["status"] not in ("completed_with_warnings", "failed"):
        raise HTTPException(400,
            f"Retry requires failed or completed-with-warnings status (got {orig['status']!r})")

    try:
        failed_recs = json.loads(orig.get("failed_records") or "[]")
    except Exception:
        failed_recs = []
    if not failed_recs:
        raise HTTPException(400, "No failed records stored for retry")

    retry_rows = [{k: v for k, v in row.items() if k != "_sf_error"} for row in failed_recs]

    new_id = str(uuid.uuid4())
    now    = datetime.utcnow().isoformat()
    op     = (orig.get("import_mode") or "Insert").lower()

    with _db_lock:
        c = _conn()
        c.execute("""
            INSERT INTO import_jobs
              (job_id, project_name, sf_object, sf_account, import_mode, matching_field,
               s3_key, field_mappings, batch_size, threads, continue_on_error, status,
               validation_report_s3_key, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)
        """, (new_id,
              f"↩ Retry: {orig.get('project_name', '')}",
              orig.get("sf_object", ""),
              orig.get("sf_account", ""),
              orig.get("import_mode", "Insert"),
              orig.get("matching_field"),
              orig.get("s3_key", ""),
              orig.get("field_mappings", "{}"),
              orig.get("batch_size", 200),
              max(1, int(orig.get("threads", 1))),
              orig.get("continue_on_error", 0),
              orig.get("validation_report_s3_key"),
              now, now))
        c.commit()
        c.close()

    ev = threading.Event()
    _cancel_events[new_id] = ev

    threading.Thread(
        target=_run_job,
        kwargs=dict(
            job_id=new_id, access_token=body.access_token,
            instance_url=body.instance_url,
            object_name=orig.get("sf_object", ""),
            s3_key=orig.get("s3_key", ""),
            operation=op,
            batch_size=int(orig.get("batch_size", 200)),
            retry_rows=retry_rows,
            continue_on_error=bool(orig.get("continue_on_error", False)),
            threads=max(1, int(orig.get("threads", 1))),
        ),
        daemon=True,
    ).start()

    return {"job_id": new_id, "status": "queued", "retry_count": len(retry_rows)}
