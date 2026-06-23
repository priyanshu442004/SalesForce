from __future__ import annotations

import datetime as dt
import math
import os
import re
from typing import Any

import pandas as pd


def sanitize_value(val: Any) -> Any:
    """Convert float-integers (e.g. 10016901.0) back to int; strip string whitespace."""
    if pd.isna(val):
        return None
    if isinstance(val, float):
        if val.is_integer():
            return int(val)
    if isinstance(val, str):
        val_strip = val.strip()
        if re.match(r"^-?\d+\.0+$", val_strip):
            try:
                return int(float(val_strip))
            except ValueError:
                pass
    return val


def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Apply sanitize_value to every float64/object column in-place."""
    for col in df.columns:
        if df[col].dtype in ["float64", "object"]:
            df[col] = df[col].apply(sanitize_value)
    return df



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


def clean_cell(value: Any) -> str:
    if is_blank(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


_DATETIME_RE = re.compile(r"^date[\s\-/&]*time$")

_MULTISELECT_ALIASES: frozenset[str] = frozenset({
    "picklist(multiselect)",
    "picklist (multiselect)",
    "multipicklist",
    "picklist(multiple)",
    "picklist (multiple)",
    "picklistmultiselect",
    "picklist multiselect",
    "picklist multiple",
})


def normalize_datatype(value: Any) -> str:
    """Return the canonical lower-case datatype string for a mapping-logic value.

    Handles:
    - Case insensitivity  (EMAIL → email)
    - DateTime aliases    (Date/Time, date-time, date & time → datetime)
    - Multiselect aliases (Multipicklist, Picklist(Multiple) → picklist(multiselect))
    - Whitespace around parentheses/commas (text ( 50 ) → text(50))
    """
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    s = str(value).strip().lower()
    if not s:
        return ""

    # DateTime aliases — any "date<sep>time" pattern maps to "datetime"
    if _DATETIME_RE.fullmatch(s):
        return "datetime"

    # Multiselect picklist aliases → single canonical key
    if s in _MULTISELECT_ALIASES:
        return "picklist(multiselect)"

    # Normalise whitespace around parentheses and commas so that
    # "text ( 50 )" → "text(50)" and "number( 5 , 2 )" → "number(5,2)"
    s = re.sub(r"\s*\(\s*", "(", s)
    s = re.sub(r"\s*\)\s*", ")", s)
    s = re.sub(r"\s*,\s*", ",", s)

    return s


def normalize_type(value: Any) -> str:
    """Thin wrapper kept for backward-compat; prefer normalize_datatype directly."""
    return normalize_datatype(value)


def resolve_mapping_columns(logic_df: pd.DataFrame) -> dict[str, Any]:
    columns: dict[str, Any] = {}

    for column in logic_df.columns:
        normalized = str(column).strip().lower()

        if normalized in {"source fields", "source field"}:
            columns["source_field"] = column

        elif normalized in {
            "is mandatory / primary?",
            "mandatory / primary",
            "mandatory/primary"
        }:
            columns["mandatory_primary"] = column

        elif normalized in {"transformation type", "data type"}:
            columns["data_type"] = column

        elif normalized in {
            "transformation + cleaning",
            "default + format",
            "format"
        }:
            columns["format"] = column

        elif normalized in {
            "master sheet",
            "mastersheet",
            "sheet name",
        }:
            columns["master_sheet"] = column

        elif normalized in {
            "search column",
            "searchcolumn",
            "lookup column",
            "lookupcolumn",
        }:
            columns["search_column"] = column

        elif normalized in {"target fields", "target field", "netsuits"}:
            columns["target_field"] = column

        elif normalized in {
            "lookup value id",
            "copyable column",
            "copyablecolumn",
            "copy column",
            "copycolumn",
            "target column",
        }:
            columns["copyable_column"] = column

    if "source_field" not in columns and len(logic_df.columns) >= 1:
        columns["source_field"] = logic_df.columns[0]

    if "data_type" not in columns and len(logic_df.columns) >= 3:
        columns["data_type"] = logic_df.columns[2]

    if "format" not in columns and len(logic_df.columns) >= 4:
        columns["format"] = logic_df.columns[3]

    # Lookup fallbacks
    if "master_sheet" not in columns and len(logic_df.columns) >= 5:
        columns["master_sheet"] = logic_df.columns[4]

    if "search_column" not in columns and len(logic_df.columns) >= 6:
        columns["search_column"] = logic_df.columns[5]

    if "copyable_column" not in columns and len(logic_df.columns) >= 7:
        columns["copyable_column"] = logic_df.columns[6]

    missing = [name for name in ("source_field", "data_type", "format") if name not in columns]

    if missing:
        raise ValueError(
            f"Mapping Logic file is missing required columns: {', '.join(missing)}"
        )

    return columns


# Reserved mapping keyword: when a mapping entry has this key it applies to
# empty/blank source cells — NOT to the literal text "blank" in the data.
_BLANK_KEYWORD = "blank"


def parse_value_mapping(format_value: Any) -> dict[str, str]:
    raw_value = clean_cell(format_value)
    if "=" not in raw_value:
        return {}

    # Accept both ";" and "," as pair separators (same logic as parse_picklist_options).
    delimiter = ";" if ";" in raw_value and "," not in raw_value else ","

    mapping: dict[str, str] = {}
    for pair in raw_value.split(delimiter):
        if "=" not in pair:
            continue
        source, target = pair.split("=", 1)
        source = source.strip()
        target = target.strip()
        if source:
            mapping[source.lower()] = target
    return mapping


def excel_format_to_strftime(format_value: Any, default_format: str) -> str:
    raw_format = clean_cell(format_value)
    if not raw_format or "=" in raw_format:
        raw_format = default_format

    py_format = raw_format
    replacements = [
        ("YYYY", "%Y"),
        ("yyyy", "%Y"),
        ("YY", "%y"),
        ("yy", "%y"),
        ("DD", "%d"),
        ("dd", "%d"),
        ("HH", "%H"),
        ("hh", "%H"),
        ("SS", "%S"),
        ("ss", "%S"),
    ]
    for token, replacement in replacements:
        py_format = py_format.replace(token, replacement)

    if "MM" in py_format:
        py_format = py_format.replace("MM", "%m", 1)
        py_format = py_format.replace("MM", "%M")
    py_format = py_format.replace("mm", "%M")
    return py_format


def parse_datetime(value: Any) -> pd.Timestamp | None:
    if is_blank(value):
        return None
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value
    if isinstance(value, dt.datetime):
        return pd.Timestamp(value)
    if isinstance(value, dt.date):
        return pd.Timestamp(value)

    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return None
    return parsed


def transform_mapped_value(value: Any, value_mapping: dict[str, str], data_type: str) -> str:
    if is_blank(value):
        # "blank" is a reserved mapping keyword: its target is used for empty cells.
        if _BLANK_KEYWORD in value_mapping:
            return value_mapping[_BLANK_KEYWORD]
        return "False" if data_type == "checkbox" else ""

    normalized = clean_cell(value).lower()

    # The literal text "blank" in source data does NOT trigger the "blank" mapping
    # entry — that entry is reserved for genuinely empty cells only.
    if normalized == _BLANK_KEYWORD:
        return ""

    if data_type == "checkbox":
        if normalized in {"true", "false"}:
            return normalized.upper()

    # Multiselect Picklist
    if data_type == "picklist(multiselect)":
        import re

        selected_values = [
            item.strip()
            for item in re.split(r"[,/;]", str(value))
            if item.strip()
        ]

        transformed_values = []

        for item in selected_values:
            # "blank" as an individual item is reserved — skip the mapping entry.
            if item.lower() == _BLANK_KEYWORD:
                continue
            mapped = value_mapping.get(item.lower())
            if mapped:
                transformed_values.append(mapped)

        return ";".join(transformed_values)

    return value_mapping.get(normalized, "")


def transform_date_value(value: Any, format_value: Any) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        return ""
    return parsed.strftime(excel_format_to_strftime(format_value, "%Y-%m-%d"))


def transform_datetime_value(value: Any) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        return ""
    return parsed.strftime("%Y-%m-%dT%H:%M:%S.000Z")


# ---------------------------------------------------------------------------
# "Add New Field" — derived column expression evaluation
# ---------------------------------------------------------------------------

def _anf_tokenize_text(expression: str) -> list[tuple[str, str]]:
    """Tokenize a text ANF expression into (kind, value) pairs.

    Walks the expression character by character so that quoted literals are
    never split on '+' and field names are never confused with literals.

    kind == 'field'   → source column name (case-insensitive lookup)
    kind == 'literal' → verbatim string from single- or double-quoted segment
    """
    tokens: list[tuple[str, str]] = []
    i = 0
    pending: list[str] = []

    while i < len(expression):
        ch = expression[i]
        if ch in ('"', "'"):
            # Flush any accumulated field name before the quote
            field = "".join(pending).strip()
            if field:
                tokens.append(("field", field))
            pending = []
            # Capture everything up to the matching closing quote
            quote = ch
            i += 1
            literal: list[str] = []
            while i < len(expression) and expression[i] != quote:
                literal.append(expression[i])
                i += 1
            tokens.append(("literal", "".join(literal)))
            i += 1  # skip closing quote
        elif ch == "+":
            field = "".join(pending).strip()
            if field:
                tokens.append(("field", field))
            pending = []
            i += 1
        else:
            pending.append(ch)
            i += 1

    field = "".join(pending).strip()
    if field:
        tokens.append(("field", field))

    return tokens


def anf_parse_field_names(expression: str, data_type: str) -> list[str]:
    """Return the source field names referenced in an ANF expression.

    For text type, tokenizes properly so quoted literals are excluded.
    For number type, operands are separated by any of + - * /.
    """
    if data_type == "number":
        return [
            t.strip()
            for t in re.split(r"([+\-*/])", expression)
            if t.strip() and t.strip() not in ("+", "-", "*", "/")
        ]
    return [value for kind, value in _anf_tokenize_text(expression) if kind == "field"]


def _anf_col_map(source_df: pd.DataFrame) -> dict[str, str]:
    """Return a lowercase-key → actual-column-name map for case-insensitive lookup."""
    return {c.lower(): c for c in source_df.columns}


def _anf_text_series(expression: str, source_df: pd.DataFrame) -> pd.Series:
    """Evaluate a text-concatenation expression (operands joined by '+').

    Supports quoted string literals: NAME+"-"+CODE produces "John-2345".
    Field resolution is case-insensitive: 'name' matches the source column 'NAME'.
    All referenced fields must already have been validated as present.
    """
    col_map = _anf_col_map(source_df)
    tokens  = _anf_tokenize_text(expression)
    result  = pd.Series([""] * len(source_df), dtype=object)
    for kind, value in tokens:
        if kind == "literal":
            result = result + value
        else:
            actual = col_map.get(value.lower())
            if actual is not None:
                result = result + source_df[actual].apply(clean_cell)
    return result


def _anf_number_series(expression: str, source_df: pd.DataFrame) -> pd.Series:
    """Evaluate a numeric expression (left-to-right; operators: + - * /).

    Field resolution is case-insensitive: 'amount' matches the source column 'Amount'.
    All referenced fields must already have been validated as present.
    Division by zero produces an empty string for that row.
    """
    col_map = _anf_col_map(source_df)
    tokens  = [t.strip() for t in re.split(r"([+\-*/])", expression) if t.strip()]
    result: pd.Series | None = None
    op: str | None = None

    for token in tokens:
        if token in ("+", "-", "*", "/"):
            op = token
            continue
        actual = col_map.get(token.lower())
        if actual is not None:
            col = pd.to_numeric(source_df[actual], errors="coerce").fillna(0.0)
        else:
            col = pd.Series([0.0] * len(source_df))

        if result is None:
            result = col.copy()
        elif op == "+":
            result = result + col
        elif op == "-":
            result = result - col
        elif op == "*":
            result = result * col
        elif op == "/":
            safe_col = col.replace(0.0, float("nan"))
            result = result / safe_col

    if result is None:
        return pd.Series([""] * len(source_df), dtype=object)

    def _fmt(v: Any) -> str:
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return ""
        iv = int(v)
        return str(iv) if v == iv else str(v)

    return result.apply(_fmt)


def _load_rules_from_df(logic_df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Build a transform-rules dict from an already-loaded mapping DataFrame."""
    logic_df = sanitize_dataframe(logic_df)
    columns = resolve_mapping_columns(logic_df)
    rules: dict[str, dict[str, Any]] = {}

    for _, row in logic_df.iterrows():
        source_field = clean_cell(row.get(columns["source_field"]))
        data_type = normalize_type(row.get(columns["data_type"]))
        format_value = row.get(columns["format"])
        master_sheet = clean_cell(row.get(columns.get("master_sheet")))
        search_column = clean_cell(row.get(columns.get("search_column")))
        copyable_column = clean_cell(row.get(columns.get("copyable_column")))

        if not source_field or source_field.lower() == "add new field":
            continue

        value_mapping = parse_value_mapping(format_value)

        is_date = data_type == "date"
        is_datetime = data_type == "datetime"
        is_multiselect = data_type == "picklist(multiselect)"
        is_lookup = data_type == "lookup"

        if not value_mapping and not is_date and not is_datetime and not is_multiselect and not is_lookup:
            continue

        rules[source_field.strip().lower()] = {
            "source_field": source_field,
            "data_type": data_type,
            "format": format_value,
            "value_mapping": value_mapping,
            "master_sheet": master_sheet,
            "search_column": search_column,
            "copyable_column": copyable_column,
        }

    return rules


def load_transform_rules(logic_path: str) -> dict[str, dict[str, Any]]:
    """Load transform rules from the first sheet of a logic workbook (used externally)."""
    with pd.ExcelFile(logic_path) as logic_excel:
        logic_df = pd.read_excel(logic_excel, sheet_name=logic_excel.sheet_names[0])
    return _load_rules_from_df(logic_df)


def load_transform_rules_for_sheet(
    logic_excel: pd.ExcelFile,
    sheet_name: str,
) -> dict[str, dict[str, Any]]:
    """Load transform rules from a named sheet in an already-open logic workbook."""
    logic_df = pd.read_excel(logic_excel, sheet_name=sheet_name)
    return _load_rules_from_df(logic_df)


def _extract_anf_rules(logic_df: pd.DataFrame) -> list[dict[str, Any]]:
    """Return derived-column specs for rows where mandatory/primary = 'Add New Field'.

    Each returned dict has:
      new_column      – the output column name (Target Field, falling back to Source Field)
      data_type       – canonical type string ("text", "number", "lookup", …)
      expression      – raw expression string from the Transformation + Cleaning column
      master_sheet    – master sheet name (Lookup only; empty string otherwise)
      search_column   – column in master sheet to match against (Lookup only)
      copyable_column – column in master sheet to copy value from (Lookup only)
    """
    logic_df = sanitize_dataframe(logic_df)
    columns = resolve_mapping_columns(logic_df)
    mandatory_col = columns.get("mandatory_primary")
    target_col    = columns.get("target_field")
    anf_rules: list[dict[str, Any]] = []

    if not mandatory_col:
        return anf_rules

    for _, row in logic_df.iterrows():
        mp_raw = row.get(mandatory_col)
        if is_blank(mp_raw):
            continue
        if str(mp_raw).strip().lower() != "add new field":
            continue

        source_field    = clean_cell(row.get(columns["source_field"]))
        target_field    = clean_cell(row.get(target_col)) if target_col else ""
        new_column      = target_field or source_field
        data_type       = normalize_type(row.get(columns["data_type"]))
        expression      = clean_cell(row.get(columns["format"]))
        master_sheet    = clean_cell(row.get(columns.get("master_sheet")))
        search_column   = clean_cell(row.get(columns.get("search_column")))
        copyable_column = clean_cell(row.get(columns.get("copyable_column")))

        if new_column and expression:
            anf_rules.append({
                "new_column":      new_column,
                "data_type":       data_type,
                "expression":      expression,
                "master_sheet":    master_sheet,
                "search_column":   search_column,
                "copyable_column": copyable_column,
            })
            print(f"[ANF] loaded derived column '{new_column}' type={data_type!r} expr={expression!r}")

    return anf_rules


def load_anf_rules_for_sheet(
    logic_excel: pd.ExcelFile,
    sheet_name: str,
) -> list[dict[str, Any]]:
    """Load 'Add New Field' derived-column rules from a named sheet."""
    logic_df = pd.read_excel(logic_excel, sheet_name=sheet_name)
    return _extract_anf_rules(logic_df)


def load_sheet_source_fields(
    logic_excel: pd.ExcelFile,
    sheet_name: str,
) -> list[str]:
    """Return the ordered list of source field names declared in a mapping sheet.

    Includes every non-blank, non-header, non-"Add new Field" entry in the
    Source Fields column.  These are the fields that must appear in this
    sheet's output regardless of whether they have an active transformation
    rule (pass-through columns have no rule but still belong in the output).
    """
    logic_df = pd.read_excel(logic_excel, sheet_name=sheet_name)
    logic_df = sanitize_dataframe(logic_df)
    columns = resolve_mapping_columns(logic_df)
    source_field_col = columns["source_field"]
    mandatory_col    = columns.get("mandatory_primary")
    header_label = str(source_field_col).strip().lower()

    fields: list[str] = []
    seen: set[str] = set()
    for _, row in logic_df.iterrows():
        # Skip "Add New Field" rows — those produce derived output columns,
        # not source columns that are copied from the input dataframe.
        if mandatory_col:
            mp = row.get(mandatory_col)
            if not is_blank(mp) and str(mp).strip().lower() == "add new field":
                continue

        raw = row.get(source_field_col)
        vs = str(raw).strip() if raw is not None else ""
        if not vs:
            continue
        if vs.lower() == header_label:
            continue
        if vs.lower() == "add new field":
            continue
        if vs not in seen:
            seen.add(vs)
            fields.append(vs)
    return fields


def load_target_map_for_sheet(
    logic_excel: pd.ExcelFile,
    sheet_name: str,
) -> dict[str, str]:
    """Return {lowercase_source_field: target_field_name} for all non-ANF rows.

    Used to rename output headers from source field names to target field names.
    Falls back to an empty dict when no Target Field column exists in the sheet.
    """
    logic_df = pd.read_excel(logic_excel, sheet_name=sheet_name)
    logic_df = sanitize_dataframe(logic_df)
    columns = resolve_mapping_columns(logic_df)
    target_col = columns.get("target_field")
    if not target_col:
        return {}
    mandatory_col = columns.get("mandatory_primary")
    result: dict[str, str] = {}
    for _, row in logic_df.iterrows():
        if mandatory_col:
            mp = row.get(mandatory_col)
            if not is_blank(mp) and str(mp).strip().lower() == "add new field":
                continue
        source = clean_cell(row.get(columns["source_field"]))
        target = clean_cell(row.get(target_col))
        if source and target and source.lower() != "add new field":
            result[source.lower()] = target
    return result


def apply_transform_rule(series: pd.Series, rule: dict[str, Any]) -> list[str]:
    data_type = rule["data_type"]

    def _transform_one(value: Any) -> str:
        # Value-mapping takes priority over the blank short-circuit so that
        # a "blank=X" mapping entry is honoured for empty source cells.
        if rule["value_mapping"]:
            return transform_mapped_value(value, rule["value_mapping"], data_type)

        if is_blank(value):
            return ""

        if data_type == "date":
            return transform_date_value(value, rule["format"])

        if data_type == "datetime":
            return transform_datetime_value(value)

        return ""

    return [_transform_one(v) for v in series.tolist()]


def apply_lookup_rule(
    series: pd.Series,
    rule: dict[str, Any],
    master_sheets: dict[str, pd.DataFrame],
) -> tuple[list[str], int, int]:
    """Returns (results, matched_count, missed_count).

    matched_count = non-blank rows where the lookup produced a non-empty value.
    missed_count  = non-blank rows where the lookup produced an empty value.
    Blank / NULL-sentinel rows are not counted as lookup attempts.
    """
    master_sheet = rule["master_sheet"]
    search_column = rule["search_column"]
    copyable_column = rule["copyable_column"]

    if not master_sheet:
        return [""] * len(series), 0, 0

    master_df = master_sheets.get(master_sheet.strip().lower())
    if master_df is None:
        return [""] * len(series), 0, 0
    master_df = sanitize_dataframe(master_df)

    lookup_map = {}

    for _, row in master_df.iterrows():
        search_value = clean_cell(row.get(search_column))
        copy_value = clean_cell(row.get(copyable_column))

        if search_value:
            lookup_map[search_value] = copy_value

    results = []
    matched = 0
    missed = 0

    for value in series.tolist():
        source_value = clean_cell(value)
        if not source_value:
            results.append("")
            continue
        result = lookup_map.get(source_value, "")
        results.append(result)
        if result:
            matched += 1
        else:
            missed += 1

    return results, matched, missed


def _transform_one_sheet(
    source_df: pd.DataFrame,
    transform_rules: dict[str, dict[str, Any]],
    included_fields: set[str],
    master_sheets: dict[str, pd.DataFrame],
    output_path: str,
    sheet_name: str,
    anf_rules: list[dict[str, Any]] | None = None,
    target_map: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Apply this sheet's transform_rules to source_df and write to output_path.

    Only columns listed in included_fields are written to the output workbook.
    Columns absent from included_fields are completely excluded — this ensures
    each output file contains only the fields defined in its own mapping sheet.

    anf_rules contains "Add New Field" derived-column specs whose values are
    computed from expressions over other source columns and appended at the end.

    Returns per-sheet statistics.
    """
    output_columns: list[pd.Series] = []
    output_headers: list[str] = []
    transformed_columns: list[str] = []
    lookup_stats: list[dict[str, Any]] = []

    # Diagnostic logging -------------------------------------------------------
    print(f"\n[transform] ── Sheet: '{sheet_name}' ──────────────────────────────")
    print(f"[transform]   Mappings loaded (active rules): {len(transform_rules)}")
    print(f"[transform]   Source fields in this sheet ({len(included_fields)}): "
          f"{sorted(included_fields)}")
    # --------------------------------------------------------------------------

    for column in source_df.columns:
        source_column_name = str(column).strip()

        # ── KEY FIX ──────────────────────────────────────────────────────────
        # Only include columns explicitly listed in this sheet's source fields.
        # Columns from other mapping sheets are completely excluded here.
        if source_column_name not in included_fields:
            continue
        # ─────────────────────────────────────────────────────────────────────

        # Column belongs to this sheet — always include the original values first.
        target_name = (target_map or {}).get(source_column_name.lower(), source_column_name)
        output_columns.append(source_df[column])
        output_headers.append(target_name)

        rule = transform_rules.get(source_column_name.lower())
        if rule is None:
            # Pass-through: field is listed in the sheet but has no active
            # transformation rule (e.g. text, email, phone).  Include as-is.
            continue

        if rule["data_type"] == "lookup":
            transformed_values, lk_matched, lk_missed = apply_lookup_rule(source_df[column], rule, master_sheets)
            lookup_stats.append({
                "column": source_column_name,
                "matched": lk_matched,
                "missed": lk_missed,
                "total": lk_matched + lk_missed,
            })
        else:
            transformed_values = apply_transform_rule(source_df[column], rule)

        original_values = [
            "" if is_blank(v) else str(v).strip()
            for v in source_df[column].tolist()
        ]

        transformed_values_clean = [
            "" if is_blank(v) else str(v).strip()
            for v in transformed_values
        ]

        if original_values == transformed_values_clean:
            continue
        output_headers[-1] = f"__{target_name}"
        output_columns.append(pd.Series(transformed_values))
        output_headers.append(target_name)
        transformed_columns.append(target_name)

    # ── "Add New Field" derived columns ───────────────────────────────────────
    col_map = _anf_col_map(source_df)   # lowercase → actual column name

    for anf in (anf_rules or []):
        new_col = anf["new_column"]
        dtype   = anf["data_type"]
        expr    = anf["expression"]

        field_names = anf_parse_field_names(expr, dtype)

        # ── Fail fast: every referenced field must exist in the source ────────
        missing_fields_in_expr = [fn for fn in field_names if fn.lower() not in col_map]
        if missing_fields_in_expr:
            raise ValueError(
                f"Add New Field '{new_col}': expression {expr!r} references "
                f"source field(s) not found in source data: "
                + ", ".join(repr(m) for m in missing_fields_in_expr)
            )
        # ─────────────────────────────────────────────────────────────────────

        # Resolve each field name to the actual (potentially differently-cased)
        # column name in source_df.
        resolved = [col_map[fn.lower()] for fn in field_names]

        if dtype == "number":
            derived = _anf_number_series(expr, source_df)
        elif dtype == "lookup":
            # Step 1: evaluate the expression as text to produce the lookup keys.
            expr_series = _anf_text_series(expr, source_df)

            # Step 2: build a case-insensitive lookup map from the master sheet.
            master_sheet    = anf.get("master_sheet", "")
            search_column   = anf.get("search_column", "")
            copyable_column = anf.get("copyable_column", "")

            lookup_map: dict[str, str] = {}
            if master_sheet and search_column and copyable_column:
                master_df = master_sheets.get(master_sheet.strip().lower())
                if master_df is not None:
                    master_df = sanitize_dataframe(master_df)
                    for _, mrow in master_df.iterrows():
                        key = clean_cell(mrow.get(search_column))
                        val = clean_cell(mrow.get(copyable_column))
                        if key:
                            lookup_map[key.lower()] = val

            # Step 3: resolve each expression result through the lookup map.
            resolved_values: list[str] = []
            for expr_val in expr_series.tolist():
                key = clean_cell(expr_val)
                if not key:
                    resolved_values.append("")
                    continue
                result = lookup_map.get(key.lower(), "")
                if not result:
                    print(
                        f"[ANF][LOOKUP] miss — expr_result={key!r}  "
                        f"master_sheet={master_sheet!r}  "
                        f"search_column={search_column!r}  "
                        f"copyable_column={copyable_column!r}"
                    )
                resolved_values.append(result)

            derived = pd.Series(resolved_values, dtype=object)
        else:
            derived = _anf_text_series(expr, source_df)

        # ── Debug logging ─────────────────────────────────────────────────────
        print(f"\n[ANF] ── new column: '{new_col}' ─────────────────────────────")
        print(f"[ANF]   expression         : {expr!r}")
        print(f"[ANF]   transformation type: {dtype!r}")
        print(f"[ANF]   parsed field names : {field_names}")
        print(f"[ANF]   resolved columns   : {resolved}")
        for fn, actual in zip(field_names, resolved):
            sample = source_df[actual].head(5).tolist()
            label  = f"{fn!r} → {actual!r}" if fn != actual else repr(fn)
            print(f"[ANF]   source[{label}] (first 5): {sample}")
        print(f"[ANF]   generated values (first 5): {derived.head(5).tolist()}")
        # ─────────────────────────────────────────────────────────────────────

        output_columns.append(derived)
        output_headers.append(new_col)
        transformed_columns.append(new_col)
    # ──────────────────────────────────────────────────────────────────────────

    # Diagnostic logging -------------------------------------------------------
    print(f"[transform]   Target fields generated ({len(transformed_columns)}): "
          f"{transformed_columns}")
    print(f"[transform]   Total output columns: {len(output_headers)}")
    # --------------------------------------------------------------------------

    transformed_df = pd.concat(output_columns, axis=1) if output_columns else pd.DataFrame()
    transformed_df.columns = output_headers

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        transformed_df.to_excel(writer, index=False, sheet_name="Transformed Data")

    return {
        "sheet_name": sheet_name,
        "output_path": output_path,
        "total_rows": len(transformed_df),
        "total_columns": len(transformed_df.columns),
        "transformed_columns": transformed_columns,
        "lookup_stats": lookup_stats,
    }


def _safe_filename(sheet_name: str) -> str:
    """Convert a sheet name to a safe filename component."""
    return re.sub(r"[^\w\-]", "_", sheet_name).strip("_") or "sheet"


def transform_source_data(
    source_path: str,
    logic_path: str,
    master_path: str,
    output_dir: str,
    skipped_fields: list[str] | None = None,
) -> dict[str, Any]:
    """Process all mapping sheets independently and return per-sheet results.

    Each sheet in the logic workbook produces one transformed .xlsx file inside
    output_dir.  output_dir must already exist or be creatable.
    """
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source file not found at {source_path}")
    if not os.path.exists(logic_path):
        raise FileNotFoundError(f"Mapping Logic file not found at {logic_path}")
    if not os.path.exists(master_path):
        raise FileNotFoundError(f"Master file not found at {master_path}")

    os.makedirs(output_dir, exist_ok=True)

    src_ext = os.path.splitext(source_path)[1].lower()
    print(f"Transformation: loading source file: {source_path}")
    print(f"Transformation: detected extension: {src_ext}")
    if src_ext == ".sql":
        print("Transformation: using SQL loader")
        from processor import _load_sql_as_sheets
        source_df = next(iter(_load_sql_as_sheets(source_path).values()))
    elif src_ext == ".csv":
        print("Transformation: using CSV loader")
        source_df = pd.read_csv(source_path, keep_default_na=False, na_values=[""])
    else:
        print("Transformation: using Excel loader")
        source_df = pd.read_excel(source_path, keep_default_na=False, na_values=[""])
    source_df = sanitize_dataframe(source_df)

    with pd.ExcelFile(logic_path) as logic_excel:
        sheet_names = list(logic_excel.sheet_names)
        rules_per_sheet: dict[str, dict[str, Any]] = {}
        fields_per_sheet: dict[str, set[str]] = {}
        anf_per_sheet: dict[str, list[dict[str, Any]]] = {}
        target_map_per_sheet: dict[str, dict[str, str]] = {}
        for s in sheet_names:
            rules_per_sheet[s]      = load_transform_rules_for_sheet(logic_excel, s)
            fields_per_sheet[s]     = set(load_sheet_source_fields(logic_excel, s))
            anf_per_sheet[s]        = load_anf_rules_for_sheet(logic_excel, s)
            target_map_per_sheet[s] = load_target_map_for_sheet(logic_excel, s)

    print(f"\n[transform] Logic workbook has {len(sheet_names)} sheet(s): {sheet_names}")

    needed_master_sheets: set[str] = set()
    for s in sheet_names:
        for rule in rules_per_sheet[s].values():
            if rule.get("data_type") == "lookup" and rule.get("master_sheet"):
                needed_master_sheets.add(rule["master_sheet"].strip().lower())
        for anf in anf_per_sheet[s]:
            if anf.get("data_type") == "lookup" and anf.get("master_sheet"):
                needed_master_sheets.add(anf["master_sheet"].strip().lower())

    mst_ext = os.path.splitext(master_path)[1].lower()
    print(f"Transformation: loading master file: {master_path}")
    print(f"Transformation: detected extension: {mst_ext}")
    master_sheets: dict[str, pd.DataFrame] = {}
    if mst_ext == ".sql":
        print("Transformation: using SQL loader")
        from processor import _load_sql_as_sheets as _load_master_sql
        for tbl_name, tbl_df in _load_master_sql(master_path).items():
            master_sheets[tbl_name] = tbl_df
            print(f"Transformation: loaded master sheet {tbl_name}")
    elif mst_ext == ".csv":
        print("Transformation: using CSV loader")
        from processor import _load_csv_as_sheets
        for key, df in _load_csv_as_sheets(master_path).items():
            master_sheets[key] = df
            print(f"Transformation: loaded master sheet {key}")
    else:
        print("Transformation: using Excel loader")
        with pd.ExcelFile(master_path) as master_excel:
            for s in master_excel.sheet_names:
                key = s.strip().lower()
                if key in needed_master_sheets:
                    master_sheets[key] = pd.read_excel(master_excel, sheet_name=s)
                    print(f"Transformation: loaded master sheet {s}")

    outputs: list[dict[str, Any]] = []

    for sheet_name in sheet_names:
        safe_name = _safe_filename(sheet_name)
        output_path = os.path.join(output_dir, f"{safe_name}_transformed.xlsx")
        result = _transform_one_sheet(
            source_df=source_df,
            transform_rules=rules_per_sheet[sheet_name],
            included_fields=fields_per_sheet[sheet_name],
            master_sheets=master_sheets,
            output_path=output_path,
            sheet_name=sheet_name,
            anf_rules=anf_per_sheet[sheet_name],
            target_map=target_map_per_sheet[sheet_name],
        )
        outputs.append(result)

    return {
        "success": True,
        "outputs": outputs,
    }
