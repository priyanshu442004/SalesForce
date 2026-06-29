import datetime as dt
import math
import os
import re
from typing import Any, Callable, Optional
from transformer import resolve_mapping_columns, sanitize_dataframe, normalize_datatype
import pandas as pd


EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")
PHONE_ALLOWED_RE = re.compile(r"^[+\d\-\s()]+$")
_PHONE_LENGTHS_RE = re.compile(r"^phone\((\d+(?:,\d+)*)\)$")
# Matches scientific notation strings produced by Excel when numeric cells are
# read back as text (e.g. "9.2006E+11").
_PHONE_SCI_RE = re.compile(r"^[+-]?\d+\.?\d*[Ee][+-]?\d+$")
# Matches Number(before) or Number(before, after) format strings.
_NUMBER_FORMAT_RE = re.compile(r"^number\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\)$", re.IGNORECASE)


# Reserved mapping keyword — represents an empty source cell in value mappings,
# never a literal source value.  Must match transformer._BLANK_KEYWORD.
_BLANK_KEYWORD = "blank"

ValidationIssue = dict[str, Any]


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    if pd.isna(value):
        return True
    if isinstance(value, str):
        stripped = value.strip()
        return stripped == "" or stripped.upper() == "NULL"
    return False


def validate_date(value: Any, _format: Any = None) -> bool:
    if isinstance(value, pd.Timestamp):
        return not pd.isna(value)
    if isinstance(value, (dt.datetime, dt.date)):
        return True
    return not pd.isna(pd.to_datetime(value, errors="coerce"))


def validate_datetime(value: Any, _format: Any = None) -> bool:
    if isinstance(value, pd.Timestamp):
        return not pd.isna(value)
    if isinstance(value, (dt.datetime, dt.date)):
        return True
    return not pd.isna(pd.to_datetime(value, errors="coerce"))


def _is_parseable_number(value: Any) -> bool:
    """Return True when value can be interpreted as a finite number (not a bool)."""
    if isinstance(value, bool):
        return False
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _parse_number_format(type_str: Any) -> tuple[Optional[int], Optional[int]]:
    """Parse Number(before) or Number(before,after) from a data-type string.

    Returns (max_before_decimal, max_after_decimal); None means unconstrained.
    """
    if is_blank(type_str):
        return None, None
    m = _NUMBER_FORMAT_RE.match(str(type_str).strip())
    if not m:
        return None, None
    max_before = int(m.group(1))
    max_after = int(m.group(2)) if m.group(2) is not None else None
    return max_before, max_after


def validate_number(value: Any, format_value: Any = None) -> bool:
    if isinstance(value, bool):
        return False
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    if not math.isfinite(number):
        return False

    max_before, max_after = _parse_number_format(format_value)
    if max_before is None:
        return True  # plain Number — no digit-count constraints

    # Build a plain decimal string for digit counting.
    # Use the original string when the value is already a string (preserves the
    # user-entered format); otherwise fall back to Python's str(float) which
    # avoids scientific notation for typical business-data magnitudes.
    raw = str(value).strip() if isinstance(value, str) else str(number)
    raw = raw.lstrip("-+")  # digit counts ignore the sign

    parts = raw.split(".")
    before_part = parts[0]
    # Trailing zeros after the decimal are insignificant (12345.120 == 12345.12).
    after_part = parts[1].rstrip("0") if len(parts) > 1 else ""

    if len(before_part) > max_before:
        return False
    if max_after is not None and len(after_part) > max_after:
        return False
    return True


def validate_email(value: Any, _format: Any = None) -> bool:
    if not isinstance(value, str):
        return False
    return EMAIL_RE.fullmatch(value.strip()) is not None


def _normalize_phone_str(value: Any) -> str:
    # pandas loads numeric Excel columns as Python floats, so a phone number
    # like 9878106871 arrives as 9878106871.0.  The spurious ".0" suffix must
    # be stripped before regex validation and before storing the value in issue
    # reports, so that callers always see the clean integer string form.
    if isinstance(value, float) and not math.isnan(value) and value == int(value):
        return str(int(value)).strip()
    s = str(value).strip()
    # Also normalise scientific-notation strings (e.g. "9.2006E+11") that arise
    # when Excel cells formatted as Text still show exponential notation.
    if _PHONE_SCI_RE.match(s):
        try:
            f = float(s)
            if not math.isnan(f) and f == int(f):
                return str(int(f))
        except (ValueError, OverflowError):
            pass
    return s


def _parse_phone_allowed_lengths(normalized_type: Any) -> Optional[list]:
    """Parse allowed digit counts from a normalized Phone type string.

    Returns a list of ints for Phone(10), Phone(10,11,12), etc.
    Returns None for bare "phone" (no length restriction).
    """
    if normalized_type is None:
        return None
    m = _PHONE_LENGTHS_RE.fullmatch(str(normalized_type).strip().lower())
    if not m:
        return None
    return [int(x) for x in m.group(1).split(",")]


def validate_phone(value: Any, normalized_type: Any = None) -> bool:
    s = _normalize_phone_str(value)
    # Reject any character that isn't a digit or standard phone formatting char.
    if not PHONE_ALLOWED_RE.fullmatch(s):
        return False
    # Strip all formatting characters; only digits count for length.
    digits = re.sub(r"\D", "", s)
    if not digits:
        return False
    allowed_lengths = _parse_phone_allowed_lengths(normalized_type)
    if allowed_lengths is None:
        # Bare Phone — any non-zero digit count is valid.
        return True
    return len(digits) in allowed_lengths

def validate_text(value: Any, format_value: Any = None) -> bool:
    if value is None:
        return True

    text_value = str(value)

    if format_value is None:
        return True

    match = re.match(r"text\((\d+)\)", str(format_value).strip().lower())

    if not match:
        return True

    max_length = int(match.group(1))

    return len(text_value) <= max_length


def validate_checkbox(value: Any, _format: Any = None) -> bool:
    options = parse_picklist_options(_format)
    if not options:
        return True

    if is_blank(value):
        return True

    normalized = str(value).strip().lower()

    allowed = set()

    for option in options:
        option = option.strip()

        if "=" in option:
            left, right = option.split("=", 1)
            key = left.strip().lower()
            if key != _BLANK_KEYWORD:   # "blank" is reserved; not a valid source value
                allowed.add(key)
        else:
            key = option.lower()
            if key != _BLANK_KEYWORD:
                allowed.add(key)

    return normalized in allowed


def parse_picklist_options(format_value: Any) -> list[str]:
    if is_blank(format_value):
        return []

    raw_value = str(format_value).strip()
    lowered = raw_value.lower()
    if lowered.startswith("default to "):
        raw_value = raw_value[11:].strip()

    delimiter = ";" if ";" in raw_value and "," not in raw_value else ","
    return [option.strip() for option in raw_value.split(delimiter) if option.strip()]


def validate_picklist(value: Any, format_value: Any = None) -> bool:
    options = parse_picklist_options(format_value)
    if not options:
        return True

    if is_blank(value):
        return True

    allowed = set()

    for option in options:
        option = option.strip()

        if "=" in option:
            source_val, target_val = option.split("=", 1)
            key = source_val.strip().lower()
            if key != _BLANK_KEYWORD:   # "blank" is reserved; not a valid source value
                allowed.add(key)
        else:
            key = option.lower()
            if key != _BLANK_KEYWORD:
                allowed.add(key)

    return str(value).strip().lower() in allowed


def validate_picklist_multiselect(value: Any, format_value: Any = None) -> bool:
    options = parse_picklist_options(format_value)
    if not options:
        return True

    if is_blank(value):
        return True

    import re

    selected_values = [
        item.strip().lower()
        for item in re.split(r"[,/;]", str(value))
        if item.strip()
    ]

    if not selected_values:
        return True

    allowed = set()

    for option in options:
        option = option.strip()

        if "=" in option:
            source_val, target_val = option.split("=", 1)
            key = source_val.strip().lower()
            if key != _BLANK_KEYWORD:   # "blank" is reserved; not a valid source value
                allowed.add(key)
        else:
            key = option.lower()
            if key != _BLANK_KEYWORD:
                allowed.add(key)

    return all(item in allowed for item in selected_values)

# Transformation types whose Transformation/Cleaning definition MUST be non-blank.
# Uses normalized (canonical) type names so all aliases are covered automatically.
_TYPES_REQUIRING_FORMAT: frozenset[str] = frozenset({
    "picklist",
    "picklist(multiselect)",  # covers Multipicklist, Picklist(Multiple), etc.
    "checkbox",
})

VALIDATORS: dict[str, tuple[Callable[[Any, Any], bool], str, str]] = {
    "date": (validate_date, "Invalid Date", "Valid date format"),
    "datetime": (validate_datetime, "Invalid DateTime", "Valid date and time format"),
    "number": (validate_number, "Invalid Number", "Numeric value"),
    "email": (validate_email, "Invalid Email", "Valid email address"),
    "phone": (validate_phone, "Invalid Phone", "Valid phone number format"),
    "checkbox": (validate_checkbox, "Invalid Checkbox", "One of the configured checkbox values"),
    "picklist": (validate_picklist, "Invalid Picklist", "One of the configured picklist values"),
    "picklist(multiselect)": (
        validate_picklist_multiselect,
        "Invalid Picklist(Multiselect)",
        "Comma-separated configured picklist values",
    ),
    "text": (
        validate_text,
        "Length Exceeded",
        "Valid text length",
    ),
}


def read_mapping_rules(logic_path: str) -> pd.DataFrame:
    """Aggregate mapping rules from ALL sheets in the logic workbook.

    Rules from all sheets are concatenated so validation covers every target
    dataset's constraints.  Exact duplicate rows (same source_field, data_type,
    format, mandatory_primary) are dropped to avoid redundant issue reports when
    the same field appears in multiple sheets with identical rules.
    """
    all_dfs: list[pd.DataFrame] = []

    with pd.ExcelFile(logic_path) as logic_excel:
        for sheet_name in logic_excel.sheet_names:
            logic_df = pd.read_excel(logic_excel, sheet_name=sheet_name)
            logic_df = sanitize_dataframe(logic_df)
            columns = resolve_mapping_columns(logic_df)

            rename_map = {
                columns["source_field"]: "source_field",
                columns["data_type"]: "data_type",
                columns["format"]: "format",
            }
            select_cols = ["source_field", "data_type", "format"]
            for extra_col in ("mandatory_primary", "master_sheet", "search_column", "copyable_column"):
                if extra_col in columns:
                    rename_map[columns[extra_col]] = extra_col
                    select_cols.append(extra_col)

            sheet_df = logic_df.rename(columns=rename_map)[select_cols].copy()

            for optional_col in ("mandatory_primary", "master_sheet", "search_column", "copyable_column"):
                if optional_col not in sheet_df.columns:
                    sheet_df[optional_col] = None

            all_dfs.append(sheet_df)

    combined = pd.concat(all_dfs, ignore_index=True)

    # Drop exact duplicate rules to avoid double-reporting the same issue.
    dedup_cols = ["source_field", "data_type", "format", "mandatory_primary"]
    combined = combined.drop_duplicates(subset=dedup_cols, keep="first")

    return combined


def expected_message(data_type: str, format_value: Any, fallback: str) -> str:
    if data_type in {"picklist", "picklist(multiselect)"}:
        options = parse_picklist_options(format_value)

        cleaned_options = []

        for option in options:
            if "=" in option:
                source_val, _ = option.split("=", 1)
                sv = source_val.strip()
                if sv.lower() != _BLANK_KEYWORD:   # "blank" is config-only, not a real source value
                    cleaned_options.append(sv)
            else:
                if option.strip().lower() != _BLANK_KEYWORD:
                    cleaned_options.append(option)

        if cleaned_options:
            return "One of: " + ", ".join(cleaned_options)

    if data_type.startswith("number"):
        max_before, max_after = _parse_number_format(data_type)
        if max_before is not None:
            if max_after is not None:
                return f"Up to {max_before} digits before decimal, up to {max_after} after"
            return f"Up to {max_before} digits before decimal"

    return fallback


def validate_lookup_field(
    source_series: pd.Series,
    field_name: str,
    master_sheet: str,
    search_column: str,
    copyable_column: str,
    master_sheets: dict,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    try:
        master_df = master_sheets.get(master_sheet.strip().lower())
        if master_df is None:
            return issues
        master_df = sanitize_dataframe(master_df)
    except Exception:
        return issues

    if search_column not in master_df.columns:
        return issues

    has_id_column = copyable_column and copyable_column in master_df.columns

    lookup_map: dict[str, Any] = {}
    for _, row in master_df.iterrows():
        raw = row.get(search_column)
        key = "" if is_blank(raw) else str(raw).strip()
        if not key:
            continue
        id_val = row.get(copyable_column) if has_id_column else None
        lookup_map[key] = id_val

    for row_index, value in source_series.items():
        if is_blank(value):
            continue

        source_val = str(value).strip()

        if source_val not in lookup_map:
            issues.append(
                {
                    "row": int(row_index) + 2,
                    "field": field_name,
                    "issue_type": "Lookup Record Not Found",
                    "value": source_val,
                    "expected": f"Value must exist in {master_sheet}",
                }
            )
        elif is_blank(lookup_map[source_val]):
            issues.append(
                {
                    "row": int(row_index) + 2,
                    "field": field_name,
                    "issue_type": "Lookup Value Missing",
                    "value": source_val,
                    "expected": f"Associated ID must exist in {master_sheet}",
                }
            )

    return issues


def validate_source_dataframe(source_df: pd.DataFrame, logic_path: str, master_path: Optional[str] = None) -> list[ValidationIssue]:
    """
    Validate source data values using mapping logic workbook columns:
    A = source field, C = data type, D = default + format.

    Blank/null values are ignored. Duplicate checks, length checks, and
    null-value validation are intentionally out of scope.
    """
    mapping_df = read_mapping_rules(logic_path)

    issues: list[ValidationIssue] = []

    # ── Mapping configuration validation ─────────────────────────────────────
    # Picklist, Picklist(Multiselect)/Multipicklist/Picklist(Multiple), and
    # Checkbox rows must have a non-blank Transformation/Cleaning definition.
    # These errors are emitted first so they appear at the top of the report
    # and naturally block transformation (total_issues > 0).
    for _, cfg_row in mapping_df.iterrows():
        cfg_source_field   = cfg_row["source_field"]
        cfg_data_type      = cfg_row["data_type"]
        cfg_format         = cfg_row["format"]
        cfg_mandatory      = cfg_row.get("mandatory_primary")

        if is_blank(cfg_source_field) or is_blank(cfg_data_type):
            continue

        # "Add New Field" rows define derived output columns, not source fields.
        # They have no value to validate and require no format check here.
        if not is_blank(cfg_mandatory) and str(cfg_mandatory).strip().lower() == "add new field":
            continue

        cfg_type = normalize_datatype(cfg_data_type)
        if cfg_type in _TYPES_REQUIRING_FORMAT and is_blank(cfg_format):
            issues.append({
                "row": 0,
                "field": str(cfg_source_field).strip(),
                "issue_type": "Missing Transformation Mapping",
                "value": "",
                "expected": "Transformation mapping required for Picklist/Multipicklist/Checkbox",
            })
    # ─────────────────────────────────────────────────────────────────────────

    # Track primary-key columns for duplicate detection after the main loop.
    primary_fields: list[str] = []

    for _, mapping_row in mapping_df.iterrows():
        source_field = mapping_row["source_field"]
        data_type = mapping_row["data_type"]
        format_value = mapping_row["format"]
        mandatory_primary = mapping_row.get("mandatory_primary")

        if is_blank(source_field) or is_blank(data_type):
            continue

        field_name = str(source_field).strip()
        normalized_type = normalize_datatype(data_type)

        mp_flag = "" if is_blank(mandatory_primary) else str(mandatory_primary).strip().lower()

        # "Add New Field" rows are derived output columns — they don't exist in
        # the source data and must not be subjected to any validation checks.
        if mp_flag == "add new field":
            continue

        is_mandatory = "mandatory" in mp_flag
        is_primary = "primary" in mp_flag

        # Mandatory check: flag every blank cell in this field.
        if is_mandatory and field_name in source_df.columns:
            for row_index, value in source_df[field_name].items():
                if is_blank(value):
                    issues.append(
                        {
                            "row": int(row_index) + 2,
                            "field": field_name,
                            "issue_type": "Mandatory Field Missing",
                            "value": "",
                            "expected": "Value required",
                        }
                    )

        # Collect primary fields; duplicate detection runs after the loop so
        # that mandatory issues are emitted first.
        if is_primary and field_name in source_df.columns:
            primary_fields.append(field_name)

        lookup_type = normalized_type

        if normalized_type.startswith("text"):
            lookup_type = "text"

        if normalized_type.startswith("number"):
            lookup_type = "number"

        if normalized_type.startswith("phone"):
            lookup_type = "phone"

        validator_config = VALIDATORS.get(lookup_type)

        if validator_config is None or field_name not in source_df.columns:
            continue

        validator, issue_type, fallback_expected = validator_config
        expected = expected_message(normalized_type, format_value, fallback_expected)

        for row_index, value in source_df[field_name].items():
            if is_blank(value):
                continue

            validation_config = format_value

            if lookup_type == "text":
                validation_config = data_type

            if lookup_type == "number":
                validation_config = normalized_type

            if lookup_type == "phone":
                validation_config = normalized_type

            if not validator(value, validation_config):
                if lookup_type == "text":
                    length_match = re.search(r"\((\d+)", str(data_type))
                    resolved_issue_type = (
                        f"Length should not be exceeded from {length_match.group(1)}"
                        if length_match
                        else issue_type
                    )
                elif lookup_type == "number":
                    length_match = re.search(r"\((\d+)", str(data_type))
                    # Only report a length violation when the value IS numeric;
                    # non-numeric values (e.g. "three") must report a type error.
                    if length_match and _is_parseable_number(value):
                        resolved_issue_type = f"Length should not be exceeded from {length_match.group(1)}"
                    else:
                        resolved_issue_type = issue_type
                else:
                    resolved_issue_type = issue_type
                issues.append(
                    {
                        "row": int(row_index) + 2,
                        "field": field_name,
                        "issue_type": resolved_issue_type,
                        "value": str(value),
                        "expected": expected,
                    }
                )

    # Primary-key duplicate detection (blank values excluded from participation).
    for field_name in primary_fields:
        col = source_df[field_name]
        non_blank_mask = col.apply(lambda v: not is_blank(v))
        non_blank_col = col[non_blank_mask]
        duplicate_mask = non_blank_col.duplicated(keep=False)
        for row_index, value in non_blank_col[duplicate_mask].items():
            issues.append(
                {
                    "row": int(row_index) + 2,
                    "field": field_name,
                    "issue_type": "Duplicate Primary Key",
                    "value": str(value),
                    "expected": "Unique value",
                }
            )

    # Lookup validation (only when a master workbook is available).
    if master_path:
        mst_ext = os.path.splitext(master_path)[1].lower()
        print(f"Loading file: {master_path}")
        print(f"Extension: {mst_ext}")
        if mst_ext == ".sql":
            print("Loader selected: SQL")
            from processor import _load_sql_as_sheets
            master_cache = _load_sql_as_sheets(master_path)
        elif mst_ext == ".csv":
            print("Loader selected: CSV")
            from processor import _load_csv_as_sheets
            master_cache = _load_csv_as_sheets(master_path)
        else:
            print("Loader selected: Excel")
            needed = {
                str(r.get("master_sheet", "")).strip().lower()
                for _, r in mapping_df.iterrows()
                if str(r.get("data_type", "")).strip().lower() == "lookup"
                and not is_blank(r.get("master_sheet"))
            }
            master_cache: dict = {}
            with pd.ExcelFile(master_path) as master_excel:
                for s in master_excel.sheet_names:
                    if s.strip().lower() in needed:
                        master_cache[s.strip().lower()] = pd.read_excel(master_excel, sheet_name=s)

        for _, mapping_row in mapping_df.iterrows():
            source_field = mapping_row["source_field"]
            data_type = mapping_row["data_type"]

            if is_blank(source_field) or is_blank(data_type):
                continue

            if str(data_type).strip().lower() != "lookup":
                continue

            field_name = str(source_field).strip()
            if field_name not in source_df.columns:
                continue

            master_sheet = "" if is_blank(mapping_row.get("master_sheet")) else str(mapping_row.get("master_sheet")).strip()
            search_column = "" if is_blank(mapping_row.get("search_column")) else str(mapping_row.get("search_column")).strip()
            copyable_column = "" if is_blank(mapping_row.get("copyable_column")) else str(mapping_row.get("copyable_column")).strip()

            if not master_sheet or not search_column:
                continue

            issues.extend(
                validate_lookup_field(
                    source_df[field_name],
                    field_name,
                    master_sheet,
                    search_column,
                    copyable_column,
                    master_cache,
                )
            )

                # Duplicate row validation
    duplicate_rows = source_df[source_df.duplicated(keep=False)]

    for row_index in duplicate_rows.index:
        issues.append(
            {
                "row": int(row_index) + 2,
                "field": "Entire Row",
                "issue_type": "Duplicate Row",
                "value": "Duplicate Record",
                "expected": "Unique row",
            }
        )

    # Remove exact duplicate issues that can arise when the same field appears
    # in multiple mapping sheets with identical (or very similar) rules.
    seen: set[tuple] = set()
    deduped: list[ValidationIssue] = []
    for issue in issues:
        key = (issue["row"], issue["field"], issue["issue_type"], issue["value"])
        if key not in seen:
            seen.add(key)
            deduped.append(issue)

    return deduped


def _load_source_df(source_path: str) -> pd.DataFrame:
    src_ext = os.path.splitext(source_path)[1].lower()
    print(f"Loading file: {source_path}")
    print(f"Extension: {src_ext}")
    if src_ext == ".sql":
        print("Loader selected: SQL")
        from processor import _load_sql_as_sheets
        return next(iter(_load_sql_as_sheets(source_path).values()))
    if src_ext == ".csv":
        print("Loader selected: CSV")
        return pd.read_csv(source_path, keep_default_na=False, na_values=[""])
    print("Loader selected: Excel")
    return pd.read_excel(source_path, keep_default_na=False, na_values=[""])


def validate_source_data(source_path: str, logic_path: str, master_path: Optional[str] = None) -> list[ValidationIssue]:
    source_df = sanitize_dataframe(_load_source_df(source_path))
    return validate_source_dataframe(source_df, logic_path, master_path=master_path)


def run_data_validation(source_path: str, logic_path: str, master_path: Optional[str] = None) -> dict[str, Any]:
    try:
        source_df = sanitize_dataframe(_load_source_df(source_path))
        issues = validate_source_dataframe(source_df, logic_path, master_path=master_path)
        return {
            "success": True,
            "total_records": len(source_df),
            "total_issues": len(issues),
            "issues": issues,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def write_validation_report(issues: list[ValidationIssue], output_path: str) -> None:
    # ── Sheet 1: Summary ─────────────────────────────────────────────────────
    # Aggregate by field: unique issue types (stable order) + total count.
    agg: dict[str, dict] = {}
    for issue in issues:
        field = issue.get("field", "")
        issue_type = issue.get("issue_type", "")
        if field not in agg:
            agg[field] = {"Field": field, "_seen_types": [], "Count": 0}
        if issue_type and issue_type not in agg[field]["_seen_types"]:
            agg[field]["_seen_types"].append(issue_type)
        agg[field]["Count"] += 1

    summary_rows = [
        {
            "Field": v["Field"],
            "Issue Types": ", ".join(v["_seen_types"]),
            "Count": v["Count"],
        }
        for v in agg.values()
    ]
    summary_df = pd.DataFrame(summary_rows, columns=["Field", "Issue Types", "Count"])

    # ── Sheet 2: Error Frequency Summary ─────────────────────────────────────
    # Group by (field, issue_type, actual_value) and count occurrences.
    freq: dict[tuple, int] = {}
    for issue in issues:
        field      = issue.get("field", "") or ""
        issue_type = issue.get("issue_type", "") or ""
        raw_value  = issue.get("value")
        value      = "Blank" if (raw_value is None or str(raw_value).strip() == "") else str(raw_value)
        key = (field, issue_type, value)
        freq[key] = freq.get(key, 0) + 1

    freq_rows = sorted(
        [
            {"Field": k[0], "Count of Errors": cnt, "Issue Type": k[1], "Values Found": k[2]}
            for k, cnt in freq.items()
        ],
        key=lambda r: (r["Field"], -r["Count of Errors"]),
    )

    # Write both sheets into a single workbook.
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        summary_df.to_excel(writer, index=False, sheet_name="Summary")

        ws = writer.book.create_sheet("Error Frequency")
        headers = ["Field", "Count of Errors", "Issue Type", "Values Found"]

        # Header row
        for col_idx, header in enumerate(headers, start=1):
            ws.cell(row=1, column=col_idx).value = header

        # Data rows
        for row_idx, row_data in enumerate(freq_rows, start=2):
            ws.cell(row=row_idx, column=1).value = row_data["Field"]
            ws.cell(row=row_idx, column=2).value = row_data["Count of Errors"]
            ws.cell(row=row_idx, column=3).value = row_data["Issue Type"]
            ws.cell(row=row_idx, column=4).value = row_data["Values Found"]

        # Auto-fit column widths based on max content length
        for col_idx, header in enumerate(headers, start=1):
            col_letter = ws.cell(row=1, column=col_idx).column_letter
            max_len = len(header)
            for row_idx in range(2, ws.max_row + 1):
                cell_val = ws.cell(row=row_idx, column=col_idx).value
                if cell_val is not None:
                    max_len = max(max_len, len(str(cell_val)))
            ws.column_dimensions[col_letter].width = min(max_len + 4, 60)
