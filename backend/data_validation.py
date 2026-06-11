import datetime as dt
import math
import re
from typing import Any, Callable

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


def validate_checkbox(value: Any, _format: Any = None) -> bool:
    options = parse_picklist_options(_format)
    if not options:
        return True

    # Mentor rule: blank = False
    if value is None or str(value).strip() == "":
        return True

    normalized = str(value).strip().lower()

    if normalized == "yes":
        normalized = "true"
    elif normalized == "no":
        normalized = "false"

    allowed = set()

    for option in options:
        option = option.strip()

        if "=" in option:
            left, right = option.split("=", 1)
            allowed.add(right.strip().lower())
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

    return any(item in allowed for item in selected_values)

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
}


def read_mapping_rules(logic_path: str) -> pd.DataFrame:
    logic_excel = pd.ExcelFile(logic_path)
    logic_df = pd.read_excel(logic_path, sheet_name=logic_excel.sheet_names[0])

    if len(logic_df.columns) < 4:
        raise ValueError("Mapping Logic Excel file must include at least columns A through D.")

    return logic_df.iloc[:, [0, 2, 3]].rename(
        columns={
            logic_df.columns[0]: "source_field",
            logic_df.columns[2]: "data_type",
            logic_df.columns[3]: "format",
        }
    )


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


def validate_source_dataframe(source_df: pd.DataFrame, logic_path: str) -> list[ValidationIssue]:
    """
    Validate source data values using mapping logic workbook columns:
    A = source field, C = data type, D = default + format.

    Blank/null values are ignored. Duplicate checks, length checks, and
    null-value validation are intentionally out of scope.
    """
    mapping_df = read_mapping_rules(logic_path)

    issues: list[ValidationIssue] = []

    for _, mapping_row in mapping_df.iterrows():
        source_field = mapping_row["source_field"]
        data_type = mapping_row["data_type"]
        format_value = mapping_row["format"]

        if is_blank(source_field) or is_blank(data_type):
            continue

        field_name = str(source_field).strip()
        normalized_type = str(data_type).strip().lower()
        validator_config = VALIDATORS.get(normalized_type)

        if validator_config is None or field_name not in source_df.columns:
            continue

        validator, issue_type, fallback_expected = validator_config
        expected = expected_message(normalized_type, format_value, fallback_expected)

        for row_index, value in source_df[field_name].items():
            if is_blank(value):
                continue

            if not validator(value, format_value):
                issues.append(
                    {
                        "row": int(row_index) + 2,
                        "field": field_name,
                        "issue_type": issue_type,
                        "value": str(value),
                        "expected": expected,
                    }
                )

    return issues


def validate_source_data(source_path: str, logic_path: str) -> list[ValidationIssue]:
    source_df = pd.read_excel(source_path)
    return validate_source_dataframe(source_df, logic_path)


def run_data_validation(source_path: str, logic_path: str) -> dict[str, Any]:
    try:
        source_df = pd.read_excel(source_path)
        issues = validate_source_dataframe(source_df, logic_path)
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
