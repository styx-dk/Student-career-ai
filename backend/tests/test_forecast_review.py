import pandas as pd
from scripts.forecast_processed_jobs import continuous_blocks, skills_for


def test_missing_and_low_sample_months_break_history():
    counts = pd.Series([20, 20, 20, 1, 20], index=pd.to_datetime([
        "2023-01-01", "2023-02-01", "2023-04-01", "2023-05-01", "2023-06-01"]))
    assert [len(b) for b in continuous_blocks(counts, 10)] == [2, 1, 1]


def test_empty_skill_fields_do_not_become_nan_skills():
    assert skills_for({"required_skills": float("nan"), "job_description": "Python and SQL"}) == ["python", "sql"]
    assert skills_for({"required_skills": "Python, Python, PowerBI", "job_description": ""}) == ["power bi", "python"]
