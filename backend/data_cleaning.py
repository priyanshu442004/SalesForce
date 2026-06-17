import math
import re
import os
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COMMON_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "icloud.com", "protonmail.com", "live.com", "msn.com",
    "aol.com", "mail.com", "zoho.com",
]

# (domain_without_dot, domain_with_dot) — known providers only
MISSING_DOT_DOMAINS = [(d.replace(".", ""), d) for d in COMMON_DOMAINS]

EMAIL_RE = re.compile(
    r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+$"
)

MULTI_SPACE_RE = re.compile(r" {2,}")

# Generic TLDs tried when the known-provider list doesn't match.
# Ordered by frequency; shorter entries last to avoid false prefix matches.
GENERIC_TLDS = ["com", "net", "org", "edu", "gov", "io", "me", "us", "co"]


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _is_truly_null(value: Any) -> bool:
    """True only for Python None and float NaN — NOT empty strings."""
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    try:
        return bool(pd.isna(value)) and not isinstance(value, str)
    except (TypeError, ValueError):
        return False


def _is_blank(value: Any) -> bool:
    """True for None, NaN, empty string, or whitespace-only string."""
    if _is_truly_null(value):
        return True
    return isinstance(value, str) and value.strip() == ""


# ---------------------------------------------------------------------------
# Email correction
# ---------------------------------------------------------------------------

def _correct_email(raw: str) -> tuple[str, bool]:
    """
    High-confidence email corrections only.  Returns (corrected, was_changed).

    Every issue detected is printed to stdout so callers can verify the branch
    is actually being entered.

    Correction order:
      A. Whitespace stripping + internal space removal  → validate
      B. Has @, domain missing dot
         B1. Known provider list  (e.g. gmailcom → gmail.com)
         B2. Generic TLD suffix   (e.g. examplecom → example.com)
      C. No @ at all
         C1. Known full-domain suffix  (e.g. usergmail.com → user@gmail.com)
         C2. Digit→letter transition   (e.g. user1example.com → user1@example.com)
         C3. Known provider, missing both @ and dot  (e.g. usergmailcom)
         C4. Generic TLD + digit→letter (e.g. user1examplecom)
    """
    # ---- Step 0: strip surrounding whitespace and collapse internal spaces --
    step1 = raw.strip()
    step2 = step1.replace(" ", "")

    if EMAIL_RE.fullmatch(step2):
        changed = step2 != raw
        if changed:
            print(f"  [EMAIL] Whitespace fixed: {repr(raw)} → {repr(step2)}")
        return step2, changed

    # ---- Case B: has @ ---------------------------------------------------------
    if "@" in step2:
        local, domain_part = step2.rsplit("@", 1)

        if "." not in domain_part:
            print(f"  [EMAIL] Issue detected — missing dot in domain: {repr(raw)}")
            print(f"          local={repr(local)}  domain_part={repr(domain_part)}")

            # B1: known provider (e.g. "gmailcom")
            for bad, good in MISSING_DOT_DOMAINS:
                if domain_part.lower() == bad:
                    corrected = f"{local}@{good}"
                    if EMAIL_RE.fullmatch(corrected):
                        print(f"  [EMAIL] Fixed (known provider dot insert): {repr(raw)} → {repr(corrected)}")
                        return corrected, True

            # B2: generic — strip a known TLD from the right, insert dot before it
            #     e.g. "examplecom" → strip "com" → "example" → "example.com"
            for tld in GENERIC_TLDS:
                if domain_part.lower().endswith(tld) and len(domain_part) > len(tld):
                    domain_name = domain_part[: -len(tld)]
                    if domain_name and re.match(r"^[A-Za-z]", domain_name):
                        corrected = f"{local}@{domain_name}.{tld}"
                        if EMAIL_RE.fullmatch(corrected):
                            print(f"  [EMAIL] Fixed (generic dot insert): {repr(raw)} → {repr(corrected)}")
                            return corrected, True

            print(f"  [EMAIL] Could not fix domain of: {repr(raw)}")

        # Spaces-only was the problem but email is now valid
        if step2 != raw and EMAIL_RE.fullmatch(step2):
            print(f"  [EMAIL] Fixed (space removal only): {repr(raw)} → {repr(step2)}")
            return step2, True

        return raw, False

    # ---- Case C: no @ at all ---------------------------------------------------
    print(f"  [EMAIL] Issue detected — missing @: {repr(raw)}")
    lower = step2.lower()

    # C1: known full domain suffix (e.g. "usergmail.com" → "user@gmail.com")
    for domain in COMMON_DOMAINS:
        if lower.endswith(domain):
            local = step2[: -len(domain)]
            if local.endswith("."):
                local = local[:-1]
            if local and re.match(r"^[A-Za-z0-9._%+\-]+$", local):
                corrected = f"{local}@{domain}"
                if EMAIL_RE.fullmatch(corrected):
                    print(f"  [EMAIL] Fixed (known domain, @ inserted): {repr(raw)} → {repr(corrected)}")
                    return corrected, True

    # C2: generic — find TLD, then find digit→letter boundary and insert @
    #     Rationale: domain names cannot start with a digit, so the first
    #     digit→letter transition marks where the domain name begins.
    #     e.g. "user1example.com" — '1'→'e' is the boundary → "user1@example.com"
    for tld in GENERIC_TLDS:
        suffix = f".{tld}"
        if lower.endswith(suffix):
            pre = step2[: -len(suffix)]   # e.g. "user1example"
            for i in range(1, len(pre)):
                if pre[i - 1].isdigit() and pre[i].isalpha():
                    local = pre[:i]
                    domain_name = pre[i:]
                    if local and domain_name and re.match(r"^[A-Za-z0-9._%+\-]+$", local):
                        corrected = f"{local}@{domain_name}.{tld}"
                        if EMAIL_RE.fullmatch(corrected):
                            print(f"  [EMAIL] Fixed (digit→letter split, @ inserted): {repr(raw)} → {repr(corrected)}")
                            return corrected, True

    # C3: known provider, missing both @ and dot (e.g. "usergmailcom")
    for bad, good in MISSING_DOT_DOMAINS:
        if lower.endswith(bad):
            local = step2[: -len(bad)]
            if local and re.match(r"^[A-Za-z0-9._%+\-]+$", local):
                corrected = f"{local}@{good}"
                if EMAIL_RE.fullmatch(corrected):
                    print(f"  [EMAIL] Fixed (known provider, both @ and dot inserted): {repr(raw)} → {repr(corrected)}")
                    return corrected, True

    # C4: generic — missing @ AND missing dot, digit→letter split
    #     e.g. "user1examplecom" → pre="user1example", tld="com"
    for tld in GENERIC_TLDS:
        if lower.endswith(tld) and len(step2) > len(tld):
            pre = step2[: -len(tld)]
            for i in range(1, len(pre)):
                if pre[i - 1].isdigit() and pre[i].isalpha():
                    local = pre[:i]
                    domain_name = pre[i:]
                    if local and domain_name and re.match(r"^[A-Za-z0-9._%+\-]+$", local):
                        corrected = f"{local}@{domain_name}.{tld}"
                        if EMAIL_RE.fullmatch(corrected):
                            print(f"  [EMAIL] Fixed (digit→letter, both @ and dot inserted): {repr(raw)} → {repr(corrected)}")
                            return corrected, True

    print(f"  [EMAIL] No correction possible for: {repr(raw)}")
    return raw, False


# ---------------------------------------------------------------------------
# Mandatory field detection
# ---------------------------------------------------------------------------

def _get_mandatory_fields(logic_path: str) -> set[str]:
    """Return source-field names flagged as mandatory in the logic file."""
    try:
        from transformer import resolve_mapping_columns
        with pd.ExcelFile(logic_path) as xl:
            logic_df = pd.read_excel(xl, sheet_name=xl.sheet_names[0])

        columns = resolve_mapping_columns(logic_df)
        source_col = columns.get("source_field", logic_df.columns[0])
        mandatory_col = columns.get("mandatory_primary")

        if mandatory_col is None:
            return set()

        mandatory: set[str] = set()
        for _, row in logic_df.iterrows():
            field = row.get(source_col)
            flag = row.get(mandatory_col)
            if _is_blank(field) or _is_blank(flag):
                continue
            if "mandatory" in str(flag).strip().lower():
                mandatory.add(str(field).strip())
        return mandatory
    except Exception as exc:
        print(f"  [MANDATORY] Could not parse mandatory fields: {exc}")
        return set()


# ---------------------------------------------------------------------------
# Main cleaning function
# ---------------------------------------------------------------------------

CleaningChange = dict[str, Any]


def run_data_cleaning(source_path: str, logic_path: str) -> dict[str, Any]:
    """
    Apply all cleaning rules to the source Excel file.

    Prints diagnostic information to stdout so every branch can be verified.

    Returns:
      success         bool
      cleaned_df      pd.DataFrame   (only when success=True)
      summary         dict
      changes         list[CleaningChange]
      total_changes   int
      error           str            (only when success=False)
    """
    try:
        source_df = pd.read_excel(source_path)
        mandatory_fields = _get_mandatory_fields(logic_path)

        # ---- Diagnostic header ------------------------------------------------
        print(f"\n{'='*60}")
        print(f"[CLEAN] Source file: {os.path.basename(source_path)}")
        print(f"[CLEAN] Rows: {len(source_df)}  Columns: {len(source_df.columns)}")
        print(f"[CLEAN] Mandatory fields ({len(mandatory_fields)}): {sorted(mandatory_fields) or 'none detected'}")

        email_cols: set[str] = {
            col for col in source_df.columns
            if "email" in str(col).lower()
        }
        print(f"[CLEAN] Email columns ({len(email_cols)}): {sorted(email_cols) or 'none detected'}")

        # Report column dtypes and null counts before cleaning
        print(f"\n[CLEAN] Column value-type breakdown:")
        optional_cols = [c for c in source_df.columns if c not in mandatory_fields]
        for col in source_df.columns:
            total = len(source_df[col])
            n_null = source_df[col].apply(_is_truly_null).sum()
            n_blank_str = source_df[col].apply(
                lambda v: isinstance(v, str) and v.strip() == ""
            ).sum()
            n_str = source_df[col].apply(lambda v: isinstance(v, str)).sum()
            tag = "MANDATORY" if col in mandatory_fields else "optional"
            print(
                f"  {tag:10s} | {repr(col):40s} | "
                f"total={total}  null/NaN={n_null}  blank_str={n_blank_str}  strings={n_str}"
            )

        print(f"\n[CLEAN] NOTE: pandas reads empty Excel cells as NaN.")
        print(f"[CLEAN] All empty forms (NaN, None, '', whitespace) in optional cols → NULL.\n")

        changes: list[CleaningChange] = []
        total_rows_original = len(source_df)

        # Counters
        rows_removed = 0
        values_trimmed = 0
        extra_spaces_fixed = 0
        email_corrections = 0
        null_conversions = 0

        # ------------------------------------------------------------------
        # RULE 3 – Remove completely blank rows
        # ------------------------------------------------------------------
        blank_row_mask = source_df.apply(
            lambda row: all(_is_blank(v) for v in row), axis=1
        )
        n_blank_rows = blank_row_mask.sum()
        if n_blank_rows:
            print(f"[RULE 3] Removing {n_blank_rows} completely blank row(s).")
        for idx in source_df.index[blank_row_mask]:
            changes.append({
                "row": int(idx) + 2,
                "column": "Entire Row",
                "original_value": "Blank Row",
                "cleaned_value": "Removed",
                "rule": "Blank Row Removal",
            })
            rows_removed += 1
        source_df = source_df[~blank_row_mask].reset_index(drop=True)

        # ------------------------------------------------------------------
        # Per-cell rules (1, 2, 4, 5)
        # ------------------------------------------------------------------
        print(f"\n[CLEAN] Applying per-cell rules across {len(source_df)} rows × {len(source_df.columns)} columns...")

        for col in source_df.columns:
            is_mandatory = col in mandatory_fields
            is_email_col = col in email_cols

            for i in range(len(source_df)):
                raw = source_df.at[i, col]
                row_num = i + 2  # +1 for 0-index, +1 for Excel header row

                # ----------------------------------------------------------
                # Detect emptiness in all its forms:
                #   • NaN / None  (pandas reads blank Excel cells as NaN)
                #   • pd.NA
                #   • ""          (explicit empty string)
                #   • "   "       (whitespace-only string)
                # ----------------------------------------------------------
                is_null_type = _is_truly_null(raw)
                is_blank_str = isinstance(raw, str) and raw.strip() == ""
                is_empty = is_null_type or is_blank_str

                print(
                    f"  [CELL] Row {row_num}, col={repr(col)}, "
                    f"mandatory={is_mandatory}, "
                    f"value={repr(raw)!s:30s}, "
                    f"empty={is_empty}, "
                    f"will_convert_to_null={is_empty and not is_mandatory}"
                )

                # RULE 4 – Any empty value in an optional column → NULL
                if is_empty:
                    if not is_mandatory:
                        # Whitespace strings may have had a trim step
                        applied_rules: list[str] = []
                        if is_blank_str and raw != raw.strip():
                            applied_rules.append("Trim")
                            values_trimmed += 1
                        applied_rules.append("Empty→Null")
                        rule_label = " + ".join(applied_rules)

                        original_repr = "NaN" if is_null_type else repr(raw)
                        source_df.at[i, col] = "NULL"

                        print(
                            f"  [NULL] Row {row_num}, col={repr(col)}: "
                            f"{original_repr} → NULL  (rule: {rule_label})"
                        )
                        changes.append({
                            "row": row_num,
                            "column": col,
                            "original_value": original_repr,
                            "cleaned_value": "NULL",
                            "rule": rule_label,
                        })
                        null_conversions += 1
                    else:
                        print(
                            f"  [BLANK-KEEP] Row {row_num}, col={repr(col)}: "
                            f"value is empty but field is mandatory — not converted"
                        )
                    continue  # nothing more to do for empty cells

                # Non-strings (numbers, dates, booleans) have no further rules
                if not isinstance(raw, str):
                    continue

                current: str = raw
                applied_rules = []

                # RULE 1 – Trim leading/trailing spaces
                trimmed = current.strip()
                if trimmed != current:
                    applied_rules.append("Trim")
                    values_trimmed += 1
                    current = trimmed

                # RULE 2 – Collapse multiple internal spaces
                collapsed = MULTI_SPACE_RE.sub(" ", current)
                if collapsed != current:
                    applied_rules.append("Space Cleanup")
                    extra_spaces_fixed += 1
                    current = collapsed

                # RULE 5 – Email auto-correction
                if is_email_col:
                    corrected, changed = _correct_email(current)
                    if changed:
                        applied_rules.append("Email Correction")
                        email_corrections += 1
                        current = corrected

                # Persist if anything changed
                if current != raw:
                    source_df.at[i, col] = current
                    changes.append({
                        "row": i + 2,
                        "column": col,
                        "original_value": str(raw),
                        "cleaned_value": str(current),
                        "rule": " + ".join(applied_rules),
                    })

        summary = {
            "total_rows_processed": total_rows_original,
            "rows_removed": rows_removed,
            "values_trimmed": values_trimmed,
            "extra_spaces_fixed": extra_spaces_fixed,
            "email_corrections": email_corrections,
            "null_conversions": null_conversions,
        }

        print(f"\n[CLEAN] Summary: {summary}")
        print(f"[CLEAN] Total changes logged: {len(changes)}")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "cleaned_df": source_df,
            "summary": summary,
            "changes": changes,
            "total_changes": len(changes),
        }

    except Exception as exc:
        import traceback
        print(f"[CLEAN] EXCEPTION: {exc}")
        traceback.print_exc()
        return {"success": False, "error": str(exc)}
