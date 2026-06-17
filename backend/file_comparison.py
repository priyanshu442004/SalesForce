import json
import math
import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd
import numpy as np


class ExcelFileComparator:
    """
    Compares two Excel files and produces a structured comparison report.

    The comparator supports schema comparison, fuzzy column rename detection,
    and value comparison either by row index or by a provided unique key column.
    """

    def __init__(
        self,
        base_file_path: str,
        new_file_path: str,
        key_column: Optional[str] = None,
        similarity_threshold: float = 0.75,
    ):
        """
        Initialize with file paths and optional key column.

        Args:
            base_file_path: Reference/base Excel file path.
            new_file_path: Incoming/new Excel file path.
            key_column: Optional column name used to match records.
            similarity_threshold: Minimum fuzzy match score to suggest renamed columns.
        """
        self.base_file_path = base_file_path
        self.new_file_path = new_file_path
        self.key_column = key_column
        self.base_df: Optional[pd.DataFrame] = None
        self.new_df: Optional[pd.DataFrame] = None
        self.similarity_threshold = similarity_threshold

        # Column name synonyms for rename detection
        # Maps canonical normalized names to sets of normalized synonym variations
        self.column_synonyms: Dict[str, Set[str]] = {
            "gender": {"sex"},
            "customername": {"clientname", "custname"},
            "email": {"emailaddress", "emailid", "mail"},
            "phone": {"phonenumber", "mobile", "mobilenumber", "contactnumber", "contactno"},
            "address": {"addressline", "address1"},
            "dob": {"dateofbirth", "birthdate"},
            "id": {"customerid", "clientid", "recordid"},
        }
        # Reverse mapping: normalized_synonym -> canonical_name
        self._synonym_reverse: Dict[str, str] = {}
        for canonical, synonyms in self.column_synonyms.items():
            self._synonym_reverse[canonical] = canonical
            for syn in synonyms:
                self._synonym_reverse[syn] = canonical

    def load_files(self, sheet_name: int = 0) -> bool:
        """
        Load both Excel files into pandas DataFrames.

        Args:
            sheet_name: Sheet index to read (default: 0 for first sheet)

        Returns:
            True if both files loaded successfully, False otherwise.
        """
        try:
            self.base_df = pd.read_excel(self.base_file_path, sheet_name=sheet_name)
            self.new_df = pd.read_excel(self.new_file_path, sheet_name=sheet_name)
            return True
        except Exception as exc:
            print(f"Error loading files: {exc}")
            return False

    def _fuzzy_match_column_name(
        self, col_name: str, candidates: List[str]
    ) -> Tuple[Optional[str], float]:
        """
        Return the best fuzzy match for a column name from a list of candidates.

        Matching strategy:
        1. Exact normalized match (score 1.0)
        2. Synonym match (score 0.95)
        3. SequenceMatcher similarity (variable score)
        """
        best_match: Optional[str] = None
        best_score = 0.0

        normalized_col = self._normalize_column_name(col_name)

        for candidate in candidates:
            normalized_candidate = self._normalize_column_name(candidate)

            # Strategy 1: Exact normalized match
            if normalized_col == normalized_candidate:
                return candidate, 1.0

            # Strategy 2: Synonym match
            canonical_col = self._synonym_reverse.get(normalized_col)
            canonical_candidate = self._synonym_reverse.get(normalized_candidate)
            if canonical_col and canonical_candidate and canonical_col == canonical_candidate:
                if best_score < 0.95:
                    best_score = 0.95
                    best_match = candidate
                continue

            # Strategy 3: SequenceMatcher fallback
            score = SequenceMatcher(None, normalized_col, normalized_candidate).ratio()
            if score > best_score:
                best_score = score
                best_match = candidate

        return best_match, best_score

    def _normalize_column_name(self, col_name: str) -> str:
        """
        Normalize a column name for comparison.

        - Lowercase
        - Remove spaces, underscores, hyphens
        - Remove special characters (keep only alphanumeric)
        """
        normalized = col_name.lower().strip()
        # Keep only alphanumeric characters
        normalized = re.sub(r"[^a-z0-9]", "", normalized)
        return normalized

    def get_schema_differences(self) -> Tuple[List[str], List[str]]:
        """
        Compare file schemas and identify missing/additional columns.

        Returns:
            missing_columns: Columns present in base but missing in new.
            additional_columns: Columns present in new but missing in base.
        """
        assert self.base_df is not None and self.new_df is not None

        base_cols = set(self.base_df.columns)
        new_cols = set(self.new_df.columns)
        missing_columns = sorted(list(base_cols - new_cols))
        additional_columns = sorted(list(new_cols - base_cols))
        return missing_columns, additional_columns

    def get_renamed_columns(self) -> List[Dict[str, Any]]:
        """
        Detect possible renamed columns using fuzzy matching.
        """
        missing_columns, additional_columns = self.get_schema_differences()
        renamed_columns: List[Dict[str, Any]] = []

        if not missing_columns or not additional_columns:
            return renamed_columns

        for missing_col in missing_columns:
            best_match, score = self._fuzzy_match_column_name(
                missing_col, additional_columns
            )
            if best_match and score >= self.similarity_threshold:
                renamed_columns.append(
                    {
                        "base_column": missing_col,
                        "possible_new_column": best_match,
                        "similarity_score": round(score, 3),
                    }
                )

        return renamed_columns

    def _find_matching_column(self, key_column: str, columns: pd.Index) -> Optional[str]:
        """
        Match a key column against DataFrame columns case-insensitively.
        """
        lower_name = key_column.strip().lower()
        for candidate in columns:
            if candidate.strip().lower() == lower_name:
                return candidate
        return None

    def _normalize_value(self, value: Any) -> Any:
        """
        Normalize values for reliable comparison.

        - Trim whitespace from strings
        - Convert numeric-like strings to Python numbers
        - Treat 1001 and 1001.0 as equal
        - Compare strings case-insensitively
        """
        if pd.isna(value):
            return None

        if isinstance(value, str):
            normalized = value.strip()
            if normalized == "":
                return ""

            if re.fullmatch(r"[+-]?\d+", normalized):
                try:
                    return int(normalized)
                except ValueError:
                    pass

            if re.fullmatch(r"[+-]?\d*\.\d+", normalized):
                try:
                    normalized_number = float(normalized)
                    if normalized_number.is_integer():
                        return int(normalized_number)
                    return normalized_number
                except ValueError:
                    pass

            return normalized.lower()

        if isinstance(value, (int,)):
            return value

        if isinstance(value, float):
            if math.isfinite(value) and value.is_integer():
                return int(value)
            return value

        return value

    def _semantic_normalize_value(self, value: Any) -> Any:
        """
        Normalize values for semantic equivalence.

        This maps business representations such as gender and boolean values
        to canonical forms.
        """
        if value is None:
            return None

        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            trimmed = value.strip()
            lowered = trimmed.lower()

            if lowered in {"male", "m"}:
                return "Male"
            if lowered in {"female", "f"}:
                return "Female"
            if lowered in {"true", "yes", "y"}:
                return True
            if lowered in {"false", "no", "n"}:
                return False

            return trimmed

        if isinstance(value, int):
            if value == 1:
                return True
            if value == 0:
                return False
            return value

        if isinstance(value, float):
            if not math.isfinite(value):
                return value
            if value.is_integer():
                int_value = int(value)
                if int_value == 1:
                    return True
                if int_value == 0:
                    return False
                return int_value
            return value

        return value

    def _row_to_record(self, row: pd.Series) -> Dict[str, Any]:
        """
        Convert a DataFrame row into a plain Python dictionary.
        """
        record: Dict[str, Any] = {}
        for key, value in row.items():
            record[key] = self._to_serializable(value)
        return record

    def _to_serializable(self, value: Any) -> Any:
        """
        Convert pandas/numpy scalar types to plain Python types suitable for JSON.

        - pandas NaN -> None
        - numpy.int64 / numpy.integer -> int
        - numpy.float64 / numpy.floating -> float
        - numpy.bool_ -> bool
        - pandas.Timestamp -> str
        - Recursively convert lists and dicts
        """
        # Handle pandas NA / NaN equivalents
        if pd.isna(value):
            return None

        # Numpy scalar types
        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.floating,)):
            return float(value)
        if isinstance(value, (np.bool_,)):
            return bool(value)

        # pandas Timestamp -> ISO string
        try:
            if isinstance(value, pd.Timestamp):
                return str(value)
        except Exception:
            pass

        # Recursively handle containers
        if isinstance(value, dict):
            return {str(k): self._to_serializable(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [self._to_serializable(v) for v in value]

        # Native Python primitives
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value

        # Fallback for other numpy types (np.generic)
        try:
            if isinstance(value, np.generic):
                return value.item()
        except Exception:
            pass

        # As a last resort, convert to string
        return str(value)

    def _build_lookup_by_key(self, df: pd.DataFrame, key_column: str) -> Dict[Any, List[int]]:
        """
        Build a lookup index from key values to row positions.

        Key values are normalized for consistent matching:
        - Numeric strings and floats normalized to int/float
        - String values lowercased and trimmed
        - NaN -> None

        This ensures equivalent representations are treated as the same key:
        - 1001 and "1001" match
        - 1001 and 1001.0 match
        - ABC123 and abc123 match
        - " John " and "john" match
        """
        lookup: Dict[Any, List[int]] = {}
        for index, value in df[key_column].items():
            normalized_key = self._normalize_value(value)
            lookup.setdefault(normalized_key, []).append(index)
        return lookup

    def _compare_matching_rows(
        self,
        base_row: pd.Series,
        new_row: pd.Series,
        common_columns: List[str],
        record_key: Any,
        base_row_number: int,
        new_row_number: int,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Compare two matched rows and return a tuple of differences.

        The row numbers are returned in Excel-style format where the header row
        is row 1 and the first data row is row 2.
        """
        value_differences: List[Dict[str, Any]] = []
        representation_differences: List[Dict[str, Any]] = []

        for column in common_columns:
            raw_base_value = base_row[column]
            raw_new_value = new_row[column]
            base_value = self._normalize_value(raw_base_value)
            new_value = self._normalize_value(raw_new_value)
            base_is_none = base_value is None
            new_is_none = new_value is None

            if base_is_none != new_is_none or (
                not base_is_none and not new_is_none and base_value != new_value
            ):
                base_semantic = self._semantic_normalize_value(base_value)
                new_semantic = self._semantic_normalize_value(new_value)

                if base_semantic is not None and base_semantic == new_semantic:
                    representation_differences.append(
                        {
                            "record_key": self._to_serializable(record_key),
                            "column": column,
                            "base_row": self._to_serializable(base_row_number),
                            "new_row": self._to_serializable(new_row_number),
                            "base_value": self._to_serializable(raw_base_value),
                            "new_value": self._to_serializable(raw_new_value),
                            "normalized_value": self._to_serializable(base_semantic),
                        }
                    )
                else:
                    value_differences.append(
                        {
                            "record_key": self._to_serializable(record_key),
                            "column": column,
                            "base_row": self._to_serializable(base_row_number),
                            "new_row": self._to_serializable(new_row_number),
                            "base_value": self._to_serializable(raw_base_value),
                            "new_value": self._to_serializable(raw_new_value),
                        }
                    )

        return value_differences, representation_differences

    def _compare_rows_by_index(self, common_columns: List[str]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Compare rows by index when no key column is provided.

        Returns:
            Tuple of (value_differences, representation_differences, added_records, deleted_records)
        """
        assert self.base_df is not None and self.new_df is not None

        value_differences: List[Dict[str, Any]] = []
        representation_differences: List[Dict[str, Any]] = []
        added_records: List[Dict[str, Any]] = []
        deleted_records: List[Dict[str, Any]] = []

        min_rows = min(len(self.base_df), len(self.new_df))

        for row_index in range(min_rows):
            base_row = self.base_df.iloc[row_index]
            new_row = self.new_df.iloc[row_index]
            row_value_diffs, row_representation_diffs = self._compare_matching_rows(
                base_row,
                new_row,
                common_columns,
                record_key=row_index,
                base_row_number=row_index + 2,
                new_row_number=row_index + 2,
            )
            value_differences.extend(row_value_diffs)
            representation_differences.extend(row_representation_diffs)

        for row_index in range(min_rows, len(self.new_df)):
            added_records.append(
                {
                    "record_key": self._to_serializable(row_index),
                    "record": self._to_serializable(self._row_to_record(self.new_df.iloc[row_index])),
                }
            )

        for row_index in range(min_rows, len(self.base_df)):
            deleted_records.append(
                {
                    "record_key": self._to_serializable(row_index),
                    "record": self._to_serializable(self._row_to_record(self.base_df.iloc[row_index])),
                }
            )

        return value_differences, representation_differences, added_records, deleted_records

    def _compare_rows_by_key(self, key_column: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Compare rows by unique key column values.

        Returns:
            Tuple of (value_differences, representation_differences, added_records, deleted_records)
        """
        assert self.base_df is not None and self.new_df is not None

        if key_column not in self.base_df.columns or key_column not in self.new_df.columns:
            return self._compare_rows_by_index(list(set(self.base_df.columns) & set(self.new_df.columns)))

        base_lookup = self._build_lookup_by_key(self.base_df, key_column)
        new_lookup = self._build_lookup_by_key(self.new_df, key_column)

        base_keys = set(base_lookup.keys())
        new_keys = set(new_lookup.keys())
        common_keys = sorted(list(base_keys & new_keys), key=lambda x: str(x))
        added_keys = sorted(list(new_keys - base_keys), key=lambda x: str(x))
        deleted_keys = sorted(list(base_keys - new_keys), key=lambda x: str(x))

        common_columns = [
            col
            for col in self.base_df.columns
            if col in self.new_df.columns and col != key_column
        ]

        value_differences: List[Dict[str, Any]] = []
        representation_differences: List[Dict[str, Any]] = []
        added_records: List[Dict[str, Any]] = []
        deleted_records: List[Dict[str, Any]] = []

        for record_key in common_keys:
            base_row_indices = base_lookup[record_key]
            new_row_indices = new_lookup[record_key]
            row_pairs = zip(base_row_indices, new_row_indices)

            for base_index, new_index in row_pairs:
                base_row = self.base_df.iloc[base_index]
                new_row = self.new_df.iloc[new_index]
                row_value_diffs, row_representation_diffs = self._compare_matching_rows(
                    base_row,
                    new_row,
                    common_columns,
                    record_key=record_key,
                    base_row_number=base_index + 2,
                    new_row_number=new_index + 2,
                )
                value_differences.extend(row_value_diffs)
                representation_differences.extend(row_representation_diffs)

            if len(new_row_indices) > len(base_row_indices):
                for extra_index in new_row_indices[len(base_row_indices) :]:
                    added_records.append(
                        {
                            "record_key": self._to_serializable(record_key),
                            "record": self._to_serializable(self._row_to_record(self.new_df.iloc[extra_index])),
                        }
                    )

            if len(base_row_indices) > len(new_row_indices):
                for extra_index in base_row_indices[len(new_row_indices) :]:
                    deleted_records.append(
                        {
                            "record_key": self._to_serializable(record_key),
                            "record": self._to_serializable(self._row_to_record(self.base_df.iloc[extra_index])),
                        }
                    )

        for record_key in added_keys:
            for row_index in new_lookup[record_key]:
                added_records.append(
                    {
                        "record_key": self._to_serializable(record_key),
                        "record": self._to_serializable(self._row_to_record(self.new_df.iloc[row_index])),
                    }
                )

        for record_key in deleted_keys:
            for row_index in base_lookup[record_key]:
                deleted_records.append(
                    {
                        "record_key": self._to_serializable(record_key),
                        "record": self._to_serializable(self._row_to_record(self.base_df.iloc[row_index])),
                    }
                )

        return value_differences, representation_differences, added_records, deleted_records

    def _find_duplicate_keys(self, df: pd.DataFrame, key_column: str, file_label: str) -> List[Dict[str, Any]]:
        """
        Find duplicate key values in a DataFrame.
        """
        duplicates: List[Dict[str, Any]] = []
        lookup: Dict[Any, int] = {}

        for value in df[key_column].tolist():
            lookup[value] = lookup.get(value, 0) + 1

        for key, count in lookup.items():
            if count > 1:
                duplicates.append(
                    {
                        "file": file_label,
                        "key": self._to_serializable(key),
                        "count": self._to_serializable(count),
                    }
                )

        return duplicates

    def get_value_differences(
        self, key_column: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Compare values either by key or by row index.

        Returns:
            value_differences: List of changed field records.
            representation_differences: List of equivalent representation differences.
            added_records: Records present in new file only.
            deleted_records: Records present in base file only.
        """
        assert self.base_df is not None and self.new_df is not None

        key_column = key_column or self.key_column
        if key_column and key_column in self.base_df.columns and key_column in self.new_df.columns:
            return self._compare_rows_by_key(key_column)

        common_columns = list(set(self.base_df.columns) & set(self.new_df.columns))
        return self._compare_rows_by_index(common_columns)

    def _count_modified_records(
        self,
        value_differences: List[Dict[str, Any]],
        representation_differences: List[Dict[str, Any]],
    ) -> int:
        """
        Count distinct records that have at least one modified or representation-different value.
        """
        record_keys = {diff["record_key"] for diff in value_differences}
        record_keys.update({diff["record_key"] for diff in representation_differences})
        return len(record_keys)

    def _resolve_key_column(self, key_column: Optional[str]) -> Optional[str]:
        """
        Resolve a key column case-insensitively and normalize both DataFrames to use the same key name.
        """
        if not key_column:
            return None

        assert self.base_df is not None and self.new_df is not None

        base_key = self._find_matching_column(key_column, self.base_df.columns)
        new_key = self._find_matching_column(key_column, self.new_df.columns)

        if not base_key or not new_key:
            return None

        if base_key != new_key:
            self.new_df = self.new_df.rename(columns={new_key: base_key})

        return base_key

    def generate_comparison_report(
        self, key_column: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a full structured comparison report.
        """
        assert self.base_df is not None and self.new_df is not None

        effective_key_column = self._resolve_key_column(key_column or self.key_column)

        missing_columns, additional_columns = self.get_schema_differences()
        renamed_columns = self.get_renamed_columns()
        value_differences, representation_differences, added_records, deleted_records = self.get_value_differences(
            key_column=effective_key_column
        )

        duplicate_keys: List[Dict[str, Any]] = []
        if effective_key_column:
            duplicate_keys.extend(
                self._find_duplicate_keys(self.base_df, effective_key_column, "base")
            )
            duplicate_keys.extend(
                self._find_duplicate_keys(self.new_df, effective_key_column, "new")
            )

        report: Dict[str, Any] = {
            "missing_columns": missing_columns,
            "additional_columns": additional_columns,
            "possible_renamed_columns": renamed_columns,
            "value_differences": value_differences,
            "representation_differences": representation_differences,
            "added_records": added_records,
            "deleted_records": deleted_records,
            "duplicate_keys": duplicate_keys,
            "summary": {
                "base_file_rows": len(self.base_df),
                "new_file_rows": len(self.new_df),
                "base_file_columns": len(self.base_df.columns),
                "new_file_columns": len(self.new_df.columns),
                "total_schema_differences": len(missing_columns) + len(additional_columns),
                "added_record_count": len(added_records),
                "deleted_record_count": len(deleted_records),
                "modified_record_count": self._count_modified_records(
                    value_differences, representation_differences
                ),
                "representation_difference_count": len(representation_differences),
                "duplicate_key_count": len(duplicate_keys),
            },
        }

        return report

    def compare_files(
        self,
        sheet_name: int = 0,
        key_column: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compare the base and new Excel files and return the report.

        Args:
            sheet_name: Sheet index to read (default: 0).
            key_column: Optional key column name used to match records.

        Returns:
            Structured comparison report dictionary.
        """
        if not self.load_files(sheet_name=sheet_name):
            return {
                "error": "Failed to load files",
                "missing_columns": [],
                "additional_columns": [],
                "possible_renamed_columns": [],
                "value_differences": [],
                "representation_differences": [],
                "added_records": [],
                "deleted_records": [],
                "duplicate_keys": [],
                "summary": {},
            }

        return self.generate_comparison_report(key_column=key_column)

    def get_report_json(
        self,
        sheet_name: int = 0,
        key_column: Optional[str] = None,
    ) -> str:
        """
        Get the comparison report as a JSON string.
        """
        report = self.compare_files(sheet_name=sheet_name, key_column=key_column)
        return json.dumps(report, default=str, indent=2)


def compare_excel_files(
    base_file_path: str,
    new_file_path: str,
    sheet_name: int = 0,
    key_column: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Convenience helper to compare two Excel files.
    """
    comparator = ExcelFileComparator(
        base_file_path,
        new_file_path,
        key_column=key_column,
    )
    return comparator.compare_files(sheet_name=sheet_name, key_column=key_column)
