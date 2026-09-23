import os
import pytest
import pandas as pd
from app.engine import AnalysisEngine
from app.schemas import AnalysisRequest, FilterCondition, PreviewRequest


@pytest.fixture
def sample_csv(tmp_path):
    csv_file = tmp_path / "sales.csv"
    data = {
        "order_date": ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"],
        "product": ["Widget A", "Widget B", "Widget A", "Widget C", "Widget B"],
        "region": ["North", "South", "North", "East", "West"],
        "revenue": [1000.0, 1500.0, 1200.0, 800.0, 2000.0],
        "quantity": [10, 15, 12, 8, 20],
    }
    df = pd.DataFrame(data)
    df.to_csv(csv_file, index=False)
    return str(csv_file)


def test_metadata(sample_csv):
    meta = AnalysisEngine.get_metadata(sample_csv)
    assert meta.filename == "sales.csv"
    assert meta.rows == 5
    assert meta.columns == 5
    assert meta.numeric_columns_count == 2
    assert meta.date_columns_count == 1
    assert len(meta.columns_info) == 5


def test_preview(sample_csv):
    req = PreviewRequest(file_path=sample_csv, page=1, page_size=3)
    res = AnalysisEngine.get_preview(req)
    assert res.total_rows == 5
    assert len(res.rows) == 3


def test_analysis_group_and_sum(sample_csv):
    req = AnalysisRequest(
        file_path=sample_csv,
        operation="group_and_sum",
        group_by="product",
        value_column="revenue",
        sort="desc"
    )
    res = AnalysisEngine.execute_analysis(req)
    assert res.status == "success"
    assert res.data[0]["product"] == "Widget B"
    assert res.data[0]["revenue"] == 3500.0


def test_analysis_percentage(sample_csv):
    req = AnalysisRequest(
        file_path=sample_csv,
        operation="percentage",
        group_by="region",
        value_column="revenue"
    )
    res = AnalysisEngine.execute_analysis(req)
    assert res.status == "success"
    assert res.chart_type == "pie"
    assert "percentage_share" in res.columns


def test_analysis_date_grouping(sample_csv):
    req = AnalysisRequest(
        file_path=sample_csv,
        operation="date_grouping",
        date_column="order_date",
        value_column="revenue",
        date_period="month"
    )
    res = AnalysisEngine.execute_analysis(req)
    assert res.status == "success"
    assert res.chart_type == "line"
