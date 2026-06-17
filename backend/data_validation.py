import datetime as dt
import math
import re
from typing import Any, Callable, Optional
from transformer import resolve_mapping_columns
import pandas as pd


EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")
PHONE_ALLOWED_RE = re.compile(r"^[+\d\-\s]+$")


ValidationIssue = dict[str, Any]


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    if pd.isna(value):
        return True
    return isinstance(value, str) and value.strip() == ""


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


def validate_number(value: Any, _format: Any = None) -> bool:
    if isinstance(value, bool):
        return False
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number)


def validate_email(value: Any, _format: Any = None) -> bool:
    if not isinstance(value, str):
        return False
    return EMAIL_RE.fullmatch(value.strip()) is not None


def validate_phone(value: Any, _format: Any = None) -> bool:
    phone = str(value).strip()
    return PHONE_ALLOWED_RE.fullmatch(phone) is not None

import re

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

    # Mentor rule: blank = False
    if value is None or str(value).strip() == "":
        return True

    normalized = str(value).strip().lower()


    allowed = set()

    for option in options:
        option = option.strip()

        if "=" in option:
            left, right = option.split("=", 1)
            allowed.add(left.strip().lower())
        else:
            allowed.add(option.lower())
    
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
    allowed = set()

    for option in options:
        option = option.strip()

        if "=" in option:
            source_val, target_val = option.split("=", 1)

        # During validation we validate SOURCE values
            allowed.add(source_val.strip().lower())
        else:
            allowed.add(option.lower())
    if "HOUL=HOUL" in str(format_value):
        print("PICKLIST FORMAT =", format_value)
        print("PICKLIST OPTIONS =", options)
        print("VALUE =", value)
    return str(value).strip().lower() in allowed


def validate_picklist_multiselect(value: Any, format_value: Any = None) -> bool:
    options = parse_picklist_options(format_value)
    if not options:
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
            allowed.add(source_val.strip().lower())
        else:
            allowed.add(option.lower())

    return all(item in allowed for item in selected_values)

VALIDATORS: dict[str, tuple[Callable[[Any, Any], bool], str, str]] = {
    "date": (validate_date, "Invalid Date", "Valid date format"),
    "datetime": (validate_datetime, "Invalid DateTime", "Valid date and time format"),
    "date&time": (validate_datetime, "Invalid DateTime", "Valid date and time format"),
    "date & time": (validate_datetime, "Invalid DateTime", "Valid date and time format"),
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
    "picklist (multiselect)": (
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
    with pd.ExcelFile(logic_path) as logic_excel:
        logic_df = pd.read_excel(logic_excel, sheet_name=logic_excel.sheet_names[0])


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

    df = logic_df.rename(columns=rename_map)[select_cols]

    for optional_col in ("mandatory_primary", "master_sheet", "search_column", "copyable_column"):
        if optional_col not in df.columns:
            df[optional_col] = None

    return df


def expected_message(data_type: str, format_value: Any, fallback: str) -> str:
    if data_type in {"picklist", "picklist(multiselect)", "picklist (multiselect)"}:
        options = parse_picklist_options(format_value)

        cleaned_options = []

        for option in options:
            if "=" in option:
                source_val, _ = option.split("=", 1)
                cleaned_options.append(source_val.strip())
            else:
                cleaned_options.append(option)

        if cleaned_options:
            return "One of: " + ", ".join(cleaned_options)

    return fallback


def validate_lookup_field(
    source_series: pd.Series,
    field_name: str,
    master_sheet: str,
    search_column: str,
    copyable_column: str,
    master_excel: "pd.ExcelFile",
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    try:
        master_df = pd.read_excel(master_excel, sheet_name=master_sheet)
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
        normalized_type = str(data_type).strip().lower() 

        mp_flag = "" if is_blank(mandatory_primary) else str(mandatory_primary).strip().lower()
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

            if not validator(value, validation_config):
                issues.append(
                    {
                        "row": int(row_index) + 2,
                        "field": field_name,
                        "issue_type": issue_type,
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
        master_excel = pd.ExcelFile(master_path)
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
                    master_excel,
                )
            )

                    # Duplicate email validation
    email_columns = [
        col
        for col in source_df.columns
        if "email" in col.lower()
    ]

    for email_column in email_columns:
        duplicate_emails = source_df[
            source_df[email_column].notna()
            & source_df[email_column].duplicated(keep=False)
        ]

        for row_index, value in duplicate_emails[email_column].items():
            issues.append(
                {
                    "row": int(row_index) + 2,
                    "field": email_column,
                    "issue_type": "Duplicate Email",
                    "value": str(value),
                    "expected": "Unique email address",
                }
            )

                # Duplicate phone validation
    phone_columns = [
        col
        for col in source_df.columns
        if any(
            keyword in col.lower()
            for keyword in [
                "phone",
                "mobile",
                "phone_number",
                "mobile_number",
                "contact_number",
            ]
        )
    ]

    for phone_column in phone_columns:
        duplicate_phones = source_df[
            source_df[phone_column].notna()
            & source_df[phone_column].duplicated(keep=False)
        ]

        for row_index, value in duplicate_phones[phone_column].items():
            issues.append(
                {
                    "row": int(row_index) + 2,
                    "field": phone_column,
                    "issue_type": "Duplicate Phone",
                    "value": str(value),
                    "expected": "Unique phone number",
                }
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


    return issues


def validate_source_data(source_path: str, logic_path: str, master_path: Optional[str] = None) -> list[ValidationIssue]:
    source_df = pd.read_excel(source_path)
    return validate_source_dataframe(source_df, logic_path, master_path=master_path)


def run_data_validation(source_path: str, logic_path: str, master_path: Optional[str] = None) -> dict[str, Any]:
    try:
        source_df = pd.read_excel(source_path)
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
    report_df = pd.DataFrame(
        [
            {
                "Row": issue.get("row"),
                "Field": issue.get("field"),
                "Issue Type": issue.get("issue_type"),
                "Actual Value": issue.get("value"),
                "Expected": issue.get("expected"),
            }
            for issue in issues
        ],
        columns=["Row", "Field", "Issue Type", "Actual Value", "Expected"],
    )
    report_df.to_excel(output_path, index=False)
