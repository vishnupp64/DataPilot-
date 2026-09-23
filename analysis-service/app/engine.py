import os
import math
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Tuple
from app.schemas import (
    AnalysisRequest, AnalysisResponse, ColumnInfo, FilterCondition,
    InsightItem, MetadataResponse, PreviewRequest, PreviewResponse
)


def clean_val(v: Any) -> Any:
    """Helper function to clean float NaN, Inf, and non-serializable types."""
    if pd.isna(v) or v is None:
        return None
    if isinstance(v, (float, np.floating)):
        if math.isnan(v) or math.isinf(v):
            return None
        return float(v)
    if isinstance(v, (int, np.integer)):
        return int(v)
    if isinstance(v, (pd.Timestamp, np.datetime64)):
        return str(v)
    return v


def clean_dataframe_rows(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Converts DataFrame to a list of dicts with NaN/Inf sanitization."""
    records = df.to_dict(orient="records")
    cleaned = []
    for row in records:
        cleaned_row = {k: clean_val(v) for k, v in row.items()}
        cleaned.append(cleaned_row)
    return cleaned


class AnalysisEngine:

    @staticmethod
    def load_dataset(file_path: str) -> pd.DataFrame:
        clean_path = os.path.abspath(file_path.replace("\\", "/"))
        if not os.path.exists(clean_path):
            alt_path = os.path.abspath(os.path.join(os.getcwd(), "..", "backend", file_path))
            if os.path.exists(alt_path):
                clean_path = alt_path
            else:
                raise FileNotFoundError(f"File not found at path: {clean_path}")
        
        ext = os.path.splitext(clean_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(clean_path)
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(clean_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
        
        return df

    @staticmethod
    def get_metadata(file_path: str) -> MetadataResponse:
        df = AnalysisEngine.load_dataset(file_path)
        filename = os.path.basename(file_path)
        
        row_count = len(df)
        column_count = len(df.columns)
        columns = list(df.columns)
        
        dtypes = {}
        missing_counts = {}
        columns_info = []
        numeric_count = 0
        date_count = 0
        
        for col in columns:
            missing_val = int(df[col].isna().sum())
            unique_val = int(df[col].nunique(dropna=True))
            dt = str(df[col].dtype)
            
            # Check if text column can be parsed as date
            is_date_col = "date" in dt or "time" in dt or "date" in col.lower() or "year" in col.lower()
            if not is_date_col and ("object" in dt or "string" in dt) and len(df) > 0:
                sample_str = str(df[col].dropna().iloc[0]) if len(df[col].dropna()) > 0 else ""
                if any(char in sample_str for char in ["-", "/"]) and any(char.isdigit() for char in sample_str):
                    try:
                        pd.to_datetime(df[col].dropna().head(10))
                        is_date_col = True
                    except Exception:
                        pass

            if "int" in dt or "float" in dt:
                col_type = "number"
                numeric_count += 1
            elif is_date_col:
                col_type = "datetime"
                date_count += 1
            elif "bool" in dt:
                col_type = "boolean"
            else:
                col_type = "text"

            dtypes[col] = col_type
            missing_counts[col] = missing_val
            columns_info.append(ColumnInfo(
                name=col,
                type=col_type,
                missing_values=missing_val,
                unique_values=unique_val
            ))

        sample = clean_dataframe_rows(df.head(5))
        
        return MetadataResponse(
            filename=filename,
            rows=row_count,
            columns=column_count,
            row_count=row_count,
            column_count=column_count,
            numeric_columns_count=numeric_count,
            date_columns_count=date_count,
            columns_info=columns_info,
            column_names=columns,
            dtypes=dtypes,
            missing_counts=missing_counts,
            sample_rows=sample
        )

    @staticmethod
    def apply_filters(df: pd.DataFrame, filters: List[FilterCondition]) -> pd.DataFrame:
        filtered = df.copy()
        for f in filters:
            col = f.column
            if col not in filtered.columns:
                continue
            op = f.operator.lower()
            val = f.value
            
            if op == "eq":
                filtered = filtered[filtered[col] == val]
            elif op == "neq":
                filtered = filtered[filtered[col] != val]
            elif op == "gt":
                filtered = filtered[filtered[col] > float(val)]
            elif op == "gte":
                filtered = filtered[filtered[col] >= float(val)]
            elif op == "lt":
                filtered = filtered[filtered[col] < float(val)]
            elif op == "lte":
                filtered = filtered[filtered[col] <= float(val)]
            elif op == "contains":
                filtered = filtered[filtered[col].astype(str).str.contains(str(val), case=False, na=False)]
            elif op == "in" and isinstance(val, list):
                filtered = filtered[filtered[col].isin(val)]
        return filtered

    @staticmethod
    def get_preview(req: PreviewRequest) -> PreviewResponse:
        df = AnalysisEngine.load_dataset(req.file_path)
        
        if req.filters:
            df = AnalysisEngine.apply_filters(df, req.filters)
            
        if req.sort_by and req.sort_by in df.columns:
            ascending = (req.sort_order.lower() == "asc")
            df = df.sort_values(by=req.sort_by, ascending=ascending)

        total_rows = len(df)
        total_pages = math.ceil(total_rows / req.page_size) if total_rows > 0 else 1
        
        start_idx = (req.page - 1) * req.page_size
        end_idx = start_idx + req.page_size
        
        paged_df = df.iloc[start_idx:end_idx]
        rows = clean_dataframe_rows(paged_df)
        
        return PreviewResponse(
            total_rows=total_rows,
            page=req.page,
            page_size=req.page_size,
            total_pages=total_pages,
            columns=list(df.columns),
            rows=rows
        )

    @staticmethod
    def execute_analysis(req: AnalysisRequest) -> AnalysisResponse:
        df = AnalysisEngine.load_dataset(req.file_path)
        
        filters = req.filters or []
        if req.filter_column and req.filter_value is not None:
            filters.append(FilterCondition(
                column=req.filter_column,
                operator=req.filter_operator or "eq",
                value=req.filter_value
            ))
        if filters:
            df = AnalysisEngine.apply_filters(df, filters)
            
        op = req.operation.lower()
        val_col = req.value_column or req.target_column
        group_cols = req.group_by
        if isinstance(group_cols, str):
            group_cols = [group_cols]
            
        chart_type = "table"
        summary = ""
        result_df = pd.DataFrame()

        if op == "sum":
            if not val_col or val_col not in df.columns:
                val_col = df.select_dtypes(include=[np.number]).columns[0]
            val = float(df[val_col].sum())
            summary = f"Total sum of '{val_col}' is {val:,.2f}"
            result_df = pd.DataFrame([{"metric": f"Sum of {val_col}", "value": val}])
            chart_type = "kpi"

        elif op == "average":
            if not val_col or val_col not in df.columns:
                val_col = df.select_dtypes(include=[np.number]).columns[0]
            val = float(df[val_col].mean())
            summary = f"Average of '{val_col}' is {val:,.2f}"
            result_df = pd.DataFrame([{"metric": f"Average of {val_col}", "value": val}])
            chart_type = "kpi"

        elif op == "count":
            count_val = len(df)
            summary = f"Total count of records is {count_val:,}"
            result_df = pd.DataFrame([{"metric": "Total Count", "value": count_val}])
            chart_type = "kpi"

        elif op in ["minimum", "min"]:
            if not val_col or val_col not in df.columns:
                val_col = df.select_dtypes(include=[np.number]).columns[0]
            val = float(df[val_col].min())
            summary = f"Minimum of '{val_col}' is {val:,.2f}"
            result_df = pd.DataFrame([{"metric": f"Minimum of {val_col}", "value": val}])
            chart_type = "kpi"

        elif op in ["maximum", "max"]:
            if not val_col or val_col not in df.columns:
                val_col = df.select_dtypes(include=[np.number]).columns[0]
            val = float(df[val_col].max())
            summary = f"Maximum of '{val_col}' is {val:,.2f}"
            result_df = pd.DataFrame([{"metric": f"Maximum of {val_col}", "value": val}])
            chart_type = "kpi"

        elif op in ["group_and_sum", "group_by_sum"]:
            if not group_cols:
                raise ValueError("group_by column is required for group_and_sum")
            if not val_col or val_col not in df.columns:
                num_cols = df.select_dtypes(include=[np.number]).columns
                if len(num_cols) == 0:
                    raise ValueError("No numeric column found to calculate sum")
                val_col = num_cols[0]

            grouped = df.groupby(group_cols, as_index=False)[val_col].sum()
            ascending = (req.sort == "asc")
            grouped = grouped.sort_values(by=val_col, ascending=ascending)
            if req.limit:
                grouped = grouped.head(req.limit)
            result_df = grouped
            summary = f"Sum of '{val_col}' grouped by {', '.join(group_cols)}"
            chart_type = "bar" if len(result_df) <= 15 else "horizontal_bar"

        elif op in ["group_and_average", "group_by_average"]:
            if not group_cols:
                raise ValueError("group_by column is required for group_and_average")
            if not val_col or val_col not in df.columns:
                num_cols = df.select_dtypes(include=[np.number]).columns
                if len(num_cols) == 0:
                    raise ValueError("No numeric column found to calculate average")
                val_col = num_cols[0]

            grouped = df.groupby(group_cols, as_index=False)[val_col].mean()
            ascending = (req.sort == "asc")
            grouped = grouped.sort_values(by=val_col, ascending=ascending)
            if req.limit:
                grouped = grouped.head(req.limit)
            result_df = grouped
            summary = f"Average of '{val_col}' grouped by {', '.join(group_cols)}"
            chart_type = "bar" if len(result_df) <= 15 else "horizontal_bar"

        elif op in ["percentage", "share"]:
            if not group_cols:
                raise ValueError("group_by column is required for percentage calculation")
            if not val_col or val_col not in df.columns:
                val_col = df.select_dtypes(include=[np.number]).columns[0]
            
            grouped = df.groupby(group_cols, as_index=False)[val_col].sum()
            total = grouped[val_col].sum()
            pct_col = f"percentage_share"
            grouped[pct_col] = (grouped[val_col] / total * 100).round(2)
            grouped = grouped.sort_values(by=val_col, ascending=False)
            if req.limit:
                grouped = grouped.head(req.limit)
            result_df = grouped
            summary = f"Percentage share of '{val_col}' by {', '.join(group_cols)}"
            chart_type = "pie"

        elif op in ["date_grouping", "time_series"]:
            date_col = req.date_column
            if not date_col or date_col not in df.columns:
                # Find date column
                date_candidates = [c for c in df.columns if "date" in c.lower() or "time" in c.lower() or "year" in c.lower()]
                date_col = date_candidates[0] if date_candidates else df.columns[0]
            
            if not val_col or val_col not in df.columns:
                val_col = df.select_dtypes(include=[np.number]).columns[0]
            
            temp_df = df.copy()
            temp_df["parsed_date"] = pd.to_datetime(temp_df[date_col], errors="coerce")
            
            period = (req.date_period or "month").lower()
            if period == "year":
                temp_df["date_period"] = temp_df["parsed_date"].dt.to_period("Y").astype(str)
            elif period == "day":
                temp_df["date_period"] = temp_df["parsed_date"].dt.to_period("D").astype(str)
            else:
                temp_df["date_period"] = temp_df["parsed_date"].dt.to_period("M").astype(str)
                
            grouped = temp_df.groupby("date_period", as_index=False)[val_col].sum()
            grouped = grouped.rename(columns={"date_period": date_col})
            grouped = grouped.sort_values(by=date_col, ascending=True)
            result_df = grouped
            summary = f"Trend of '{val_col}' grouped by {period} over '{date_col}'"
            chart_type = "line"

        elif op in ["comparison", "compare"]:
            if not group_cols:
                raise ValueError("group_by column is required for comparison")
            if not val_col or val_col not in df.columns:
                val_col = df.select_dtypes(include=[np.number]).columns[0]
                
            grouped = df.groupby(group_cols, as_index=False)[val_col].sum()
            if req.compare_values and len(req.compare_values) > 0:
                grouped = grouped[grouped[group_cols[0]].isin(req.compare_values)]
            
            grouped = grouped.sort_values(by=val_col, ascending=False)
            result_df = grouped
            summary = f"Comparison of '{val_col}' across {', '.join(group_cols)}"
            chart_type = "bar"

        elif op == "top_n":
            limit = req.limit or 10
            sort_col = val_col or df.select_dtypes(include=[np.number]).columns[0]
            sorted_df = df.sort_values(by=sort_col, ascending=False).head(limit)
            if group_cols and len(group_cols) > 0:
                result_cols = group_cols + [sort_col] if sort_col not in group_cols else group_cols
                result_df = sorted_df[result_cols]
            else:
                result_df = sorted_df
            summary = f"Top {limit} records by '{sort_col}'"
            chart_type = "horizontal_bar"

        elif op == "bottom_n":
            limit = req.limit or 10
            sort_col = val_col or df.select_dtypes(include=[np.number]).columns[0]
            sorted_df = df.sort_values(by=sort_col, ascending=True).head(limit)
            if group_cols and len(group_cols) > 0:
                result_cols = group_cols + [sort_col] if sort_col not in group_cols else group_cols
                result_df = sorted_df[result_cols]
            else:
                result_df = sorted_df
            summary = f"Bottom {limit} records by '{sort_col}'"
            chart_type = "horizontal_bar"

        elif op == "sort":
            sort_col = val_col or df.columns[0]
            ascending = (req.sort == "asc")
            sorted_df = df.sort_values(by=sort_col, ascending=ascending)
            if req.limit:
                sorted_df = sorted_df.head(req.limit)
            result_df = sorted_df
            summary = f"Sorted records by '{sort_col}' ({req.sort or 'desc'})"
            chart_type = "table"

        elif op == "filter":
            result_df = df.head(req.limit or 50)
            summary = f"Filtered {len(df)} records"
            chart_type = "table"

        else:
            raise ValueError(f"Unsupported operation: '{op}'")

        cleaned_rows = clean_dataframe_rows(result_df)
        cols = list(result_df.columns)

        # Compute additional calculated insights
        additional_insights = AnalysisEngine.calculate_additional_insights(df, result_df, op, cols, val_col, group_cols)

        return AnalysisResponse(
            status="success",
            operation=op,
            summary=summary,
            columns=cols,
            data=cleaned_rows,
            total_count=len(cleaned_rows),
            chart_type=chart_type,
            additional_insights=additional_insights
        )

    @staticmethod
    def calculate_additional_insights(
        full_df: pd.DataFrame,
        result_df: pd.DataFrame,
        op: str,
        cols: List[str],
        val_col: Optional[str],
        group_cols: Optional[List[str]]
    ) -> List[InsightItem]:
        insights = []
        total_rows = len(full_df)

        insights.append(InsightItem(
            title="Total Records Analyzed",
            value=f"{total_rows:,}",
            detail="Analyzed across entire dataset"
        ))

        if len(result_df) > 0 and len(cols) >= 2 and val_col in cols:
            numeric_vals = pd.to_numeric(result_df[val_col], errors="coerce").dropna()
            if len(numeric_vals) > 0:
                top_idx = numeric_vals.idxmax()
                top_row = result_df.loc[top_idx]
                top_name = str(top_row[cols[0]])
                top_val = float(top_row[val_col])
                
                total_sum = numeric_vals.sum()
                pct_share = (top_val / total_sum * 100) if total_sum > 0 else 0
                
                insights.append(InsightItem(
                    title="Top Performer",
                    value=f"{top_name}",
                    detail=f"Led with {val_col} of {top_val:,.2f} ({pct_share:.1f}% share)"
                ))

                if len(numeric_vals) > 1:
                    low_idx = numeric_vals.idxmin()
                    low_row = result_df.loc[low_idx]
                    low_name = str(low_row[cols[0]])
                    low_val = float(low_row[val_col])
                    
                    insights.append(InsightItem(
                        title="Lowest Category",
                        value=f"{low_name}",
                        detail=f"{val_col} of {low_val:,.2f}"
                    ))

        return insights
