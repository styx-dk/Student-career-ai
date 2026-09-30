import pandas as pd
from scripts.forecast_processed_jobs import continuous_blocks, skills_for, evaluated_forecast


def test_missing_and_low_sample_months_break_history():
    counts = pd.Series([20, 20, 20, 1, 20], index=pd.to_datetime([
        "2023-01-01", "2023-02-01", "2023-04-01", "2023-05-01", "2023-06-01"]))
    assert [len(b) for b in continuous_blocks(counts, 10)] == [2, 1, 1]


def test_empty_skill_fields_do_not_become_nan_skills():
    assert skills_for({"required_skills": float("nan"), "job_description": "Python and SQL"}) == ["python", "sql"]
    assert skills_for({"required_skills": "Python, Python, PowerBI", "job_description": ""}) == ["power bi", "python"]


def test_evaluated_forecast_has_bounded_shape_and_named_model():
    index = pd.date_range("2022-01-01", periods=15, freq="MS")
    series = pd.Series([.1, .12, .11, .13, .15, .14, .16, .18, .17, .19, .20, .22, .21, .23, .24], index=index)
    result, model, actual, predicted, warnings = evaluated_forecast(series, 6)
    assert model in {"ARIMA(1,1,1)", "LinearTrend"}
    assert len(result.predicted_mean) == 6 and len(result.conf_int()) == 6
    assert len(actual) == len(predicted) == 3
    assert isinstance(warnings, list)
