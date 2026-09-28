from pathlib import Path

import pandas as pd

from scripts.aggregate_skill_demand import aggregate
from scripts.train_forecast import train


def test_aggregation_uses_monthly_denominator(tmp_path: Path):
    source = tmp_path / "skills.csv"; output = tmp_path / "demand.csv"
    pd.DataFrame([
        {"posting_date":"2025-01-01","domain":"Software Development","normalized_skills":"[\"python\"]"},
        {"posting_date":"2025-01-02","domain":"Software Development","normalized_skills":"[\"java\"]"},
    ]).to_csv(source,index=False)
    result=aggregate(source,output)
    assert result.loc[result.skill=="python","demand_rate"].iloc[0] == .5


def test_short_series_is_not_fabricated(tmp_path: Path):
    source=tmp_path/"demand.csv";output=tmp_path/"forecast.csv"
    pd.DataFrame([{"month":"2025-01-01","domain":"Data Science","skill":"python","job_count":1,"total_jobs":1,"demand_rate":1.0}]).to_csv(source,index=False)
    result=train(source,output,min_months=12)
    assert result.empty

