import json
import pandas as pd
import pytest
from sqlalchemy import func, select
from app.models.entities import SkillDemandHistory, SkillForecast
from scripts.import_historical_forecast import import_results


def sample_files(directory):
    pd.DataFrame([{"domain":"Data Analytics","skill":"sql","month":"2023-12-01",
        "job_count":5,"total_jobs":10,"demand_rate":.5}]).to_csv(directory/"skill_demand_monthly.csv", index=False)
    pd.DataFrame([{"domain":"Data Analytics","skill":"sql","forecast_month":"2024-01-01",
        "predicted_rate":.6,"lower_bound":.4,"upper_bound":.8,"model_name":"ARIMA(1,1,1)",
        "training_start":"2023-12-01","training_end":"2023-12-01","scope":"historical_experiment"}]).to_csv(directory/"historical_forecasts.csv", index=False)
    (directory/"evaluation.json").write_text("[]")
    (directory/"data_quality_report.json").write_text(json.dumps({
        "publishable_as_current_forecast":False,"cautions":["Test fixture"]}))


def test_import_dry_run_idempotence_and_historical_api(client, db, tmp_path):
    sample_files(tmp_path)
    assert import_results(db, tmp_path)["forecasts_added"] == 1
    assert db.scalar(select(func.count()).select_from(SkillForecast)) == 0
    assert import_results(db, tmp_path, True)["forecasts_added"] == 1
    assert import_results(db, tmp_path, True)["forecasts_existing"] == 1
    assert db.scalar(select(func.count()).select_from(SkillForecast)) == 1
    data = client.get("/api/v1/forecasts?domain=Data%20Analytics&skill=sql").json()
    assert data["available"] and data["scope"] == "historical_experiment"
    assert "not current" in data["notice"]
    assert client.get("/api/v1/forecasts/catalog").json() == {"Data Analytics":["sql"]}


def test_conflicting_import_does_not_overwrite(db, tmp_path):
    sample_files(tmp_path)
    import_results(db, tmp_path, True)
    history = pd.read_csv(tmp_path/"skill_demand_monthly.csv")
    history["job_count"], history["demand_rate"] = 7, .7
    history.to_csv(tmp_path/"skill_demand_monthly.csv",index=False)
    with pytest.raises(ValueError, match="conflicts"):
        import_results(db, tmp_path, True)
    db.rollback()
    assert db.scalar(select(SkillDemandHistory)).job_count == 5
