from __future__ import annotations

import datetime as dt
import math
import os
from typing import Any

import pandas as pd


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    if pd.isna(value):
        return True
    return isinstance(value, str) and value.strip() == ""


def clean_cell(value: Any) -> str:
    if is_blank(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def normalize_type(value: Any) -> str:
    return clean_cell(value).lower().replace(" ", "")


def resolve_mapping_columns(logic_df: pd.DataFrame) -> dict[str, Any]:
    columns: dict[str, Any] = {}

    for column in logic_df.columns:
        normalized = str(column).strip().lower()

        if normalized in {"source fields", "source field"}:
            columns["source_field"] = column

        elif normalized == "data type":
            columns["data_type"] = column

        elif normalized in {"default + format", "format"}:
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

        elif normalized in {
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


def parse_value_mapping(format_value: Any) -> dict[str, str]:
    raw_value = clean_cell(format_value)
    if "=" not in raw_value:
        return {}

    mapping: dict[str, str] = {}
    for pair in raw_value.split(","):
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
        return "False" if data_type == "checkbox" else ""

    normalized = clean_cell(value).lower()

    if data_type == "checkbox":
        if normalized in {"true", "false"}:
            return normalized.upper()

    # Multiselect Picklist
    if data_type in {"picklist(multiselect)", "picklistmultiselect"}:
        import re

        selected_values = [
            item.strip()
            for item in re.split(r"[,/;]", str(value))
            if item.strip()
        ]

        transformed_values = []

        for item in selected_values:
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


def load_transform_rules(logic_path: str) -> dict[str, dict[str, Any]]:
    logic_excel = pd.ExcelFile(logic_path)
    logic_df = pd.read_excel(
        logic_path,
        sheet_name=logic_excel.sheet_names[0]
    )

    columns = resolve_mapping_columns(logic_df)

    rules: dict[str, dict[str, Any]] = {}

    for _, row in logic_df.iterrows():
        source_field = clean_cell(
            row.get(columns["source_field"])
        )

        data_type = normalize_type(
            row.get(columns["data_type"])
        )

        format_value = row.get(columns["format"])

        master_sheet = clean_cell(
            row.get(columns.get("master_sheet"))
        )

        search_column = clean_cell(
            row.get(columns.get("search_column"))
        )

        copyable_column = clean_cell(
            row.get(columns.get("copyable_column"))
        )

        if (
            not source_field
            or source_field.lower() == "add new field"
        ):
            continue

        value_mapping = parse_value_mapping(format_value)

        is_date = data_type == "date"
        is_datetime = data_type in {
            "datetime",
            "date&time"
        }

        is_multiselect = data_type in {
            "picklist(multiselect)",
            "picklistmultiselect"
        }

        is_lookup = data_type == "lookup"

        if (
            not value_mapping
            and not is_date
            and not is_datetime
            and not is_multiselect
            and not is_lookup
        ):
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


def apply_transform_rule(series: pd.Series, rule: dict[str, Any]) -> list[str]:
    data_type = rule["data_type"]

    if rule["value_mapping"]:
        return [
            transform_mapped_value(value, rule["value_mapping"], data_type)
            for value in series.tolist()
        ]

    if data_type == "lookup":
        return ["LOOKUP" for _ in series.tolist()]

    if data_type == "date":
        return [transform_date_value(value, rule["format"]) for value in series.tolist()]

    if data_type in {"datetime", "date&time"}:
        return [transform_datetime_value(value) for value in series.tolist()]

    return [""] * len(series)

def apply_lookup_rule(
    series: pd.Series,
    rule: dict[str, Any],
    master_excel: pd.ExcelFile,
) -> list[str]:

    master_sheet = rule["master_sheet"]
    search_column = rule["search_column"]
    copyable_column = rule["copyable_column"]

    if not master_sheet:
        return [""] * len(series)

    master_df = pd.read_excel(
        master_excel,
        sheet_name=master_sheet
    )

    lookup_map = {}

    for _, row in master_df.iterrows():
        search_value = clean_cell(row.get(search_column))
        copy_value = clean_cell(row.get(copyable_column))

        if search_value:
            lookup_map[search_value] = copy_value

    results = []

    for value in series.tolist():
        source_value = clean_cell(value)
        results.append(
            lookup_map.get(source_value, "")
        )

    return results

def transform_source_data(source_path: str, logic_path: str, master_path: str, output_path: str) -> dict[str, Any]:
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source file not found at {source_path}")
    if not os.path.exists(logic_path):
        raise FileNotFoundError(f"Mapping Logic file not found at {logic_path}")
    if not os.path.exists(master_path):
        raise FileNotFoundError(f"Master file not found at {master_path}")

    source_df = pd.read_excel(source_path)
    transform_rules = load_transform_rules(logic_path)
    master_excel = pd.ExcelFile(master_path)

    output_columns: list[pd.Series] = []
    output_headers: list[str] = []
    transformed_columns: list[str] = []

    for column in source_df.columns:
        source_column_name = str(column).strip()

        # Always include original column with __ prefix
        output_columns.append(source_df[column])
        output_headers.append(f"__{source_column_name}")

        rule = transform_rules.get(source_column_name.lower())
        if rule is None:
            continue

        if rule["data_type"] == "lookup":
            transformed_values = apply_lookup_rule(source_df[column], rule, master_excel)
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

        # Add transformed column only if at least one value changed
        if original_values == transformed_values_clean:
            continue

        output_columns.append(pd.Series(transformed_values))
        output_headers.append(source_column_name)
        transformed_columns.append(source_column_name)

    transformed_df = pd.concat(output_columns, axis=1) if output_columns else pd.DataFrame()
    transformed_df.columns = output_headers

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        transformed_df.to_excel(
            writer,
            index=False,
            sheet_name="Transformed Data"
        )

    return {
        "success": True,
        "total_rows": len(transformed_df),
        "total_columns": len(transformed_df.columns),
        "transformed_columns": transformed_columns,
        "output_path": output_path,
    }
