from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class MetadataRequest(BaseModel):
    file_path: str


class ColumnInfo(BaseModel):
    name: str
    type: str
    missing_values: int
    unique_values: int


class MetadataResponse(BaseModel):
    filename: str
    rows: int
    columns: int
    row_count: int
    column_count: int
    numeric_columns_count: int = 0
    date_columns_count: int = 0
    columns_info: List[ColumnInfo]
    column_names: List[str] = Field(default_factory=list)
    dtypes: Dict[str, str] = Field(default_factory=dict)
    missing_counts: Dict[str, int] = Field(default_factory=dict)
    sample_rows: List[Dict[str, Any]] = Field(default_factory=list)


class FilterCondition(BaseModel):
    column: str
    operator: str  # eq, neq, gt, gte, lt, lte, contains, in
    value: Union[str, int, float, List[Union[str, int, float]]]


class PreviewRequest(BaseModel):
    file_path: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=500)
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "asc"  # asc or desc
    filters: Optional[List[FilterCondition]] = None


class PreviewResponse(BaseModel):
    total_rows: int
    page: int
    page_size: int
    total_pages: int
    columns: List[str]
    rows: List[Dict[str, Any]]


class AnalysisRequest(BaseModel):
    file_path: str
    operation: str  # sum, average, count, minimum, maximum, group_and_sum, group_and_average, filter, sort, top_n, bottom_n, percentage, date_grouping, comparison
    group_by: Optional[Union[str, List[str]]] = None
    value_column: Optional[str] = None
    target_column: Optional[str] = None
    date_column: Optional[str] = None
    date_period: Optional[str] = "month"  # month, year, day, dayofweek
    compare_values: Optional[List[str]] = None
    filter_column: Optional[str] = None
    filter_operator: Optional[str] = "eq"
    filter_value: Optional[Union[str, int, float, List[Union[str, int, float]]]] = None
    filters: Optional[List[FilterCondition]] = None
    sort: Optional[str] = "desc"  # asc or desc
    limit: Optional[int] = 10


class InsightItem(BaseModel):
    title: str
    value: str
    detail: str


class AnalysisResponse(BaseModel):
    status: str
    operation: str
    summary: str
    columns: List[str]
    data: List[Dict[str, Any]]
    total_count: int
    chart_type: str  # bar, line, pie, horizontal_bar, kpi, table
    additional_insights: List[InsightItem] = Field(default_factory=list)
