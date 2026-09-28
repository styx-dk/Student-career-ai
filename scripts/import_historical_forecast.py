"""Validate and import the reviewed historical experiment. Defaults to dry run."""
import argparse
import hashlib
import json
import math
import sys
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.core.database import SessionLocal
from app.models.entities import SkillDemandHistory, SkillForecast


def import_results(db, directory, apply=False):
    forecast_path = directory / "historical_forecasts.csv"
    history_path = directory / "skill_demand_monthly.csv"
    forecasts = pd.read_csv(forecast_path)
    history = pd.read_csv(history_path)
    evaluations = json.loads((directory / "evaluation.json").read_text(encoding="utf-8"))
    quality = json.loads((directory / "data_quality_report.json").read_text(encoding="utf-8"))
    if forecasts.empty or set(forecasts.scope) != {"historical_experiment"}:
        raise ValueError("Expected nonempty, reviewed historical forecasts")
    if quality.get("publishable_as_current_forecast") is not False:
        raise ValueError("Historical quality report is required")
    if forecasts.duplicated(["domain", "skill", "forecast_month"]).any():
        raise ValueError("Duplicate forecast keys")
    keys = set(zip(forecasts.domain, forecasts.skill))
    history = history[[key in keys for key in zip(history.domain, history.skill)]].copy()
    if history.duplicated(["domain", "skill", "month"]).any():
        raise ValueError("Duplicate monthly history keys")
    digest = hashlib.sha256(forecast_path.read_bytes() + history_path.read_bytes()).hexdigest()
    metrics = {(r["domain"], r["skill"]): r for r in evaluations}
    if db.bind.dialect.name == "postgresql":
        # Serializes this importer across workers without changing the schema.
        db.execute(text("SELECT pg_advisory_xact_lock(7319462024)"))
    summary = {"history_added": 0, "forecasts_added": 0, "history_existing": 0, "forecasts_existing": 0}
    for row in history.to_dict("records"):
        month = date.fromisoformat(row["month"])
        count, total, rate = int(row["job_count"]), int(row["total_jobs"]), float(row["demand_rate"])
        if not (total > 0 and 0 <= count <= total and math.isfinite(rate)
                and math.isclose(rate, count / total, abs_tol=1e-9)):
            raise ValueError("Invalid monthly counts or demand rate")
        existing = db.scalar(select(SkillDemandHistory).where(
            SkillDemandHistory.domain == row["domain"], SkillDemandHistory.skill == row["skill"],
            SkillDemandHistory.month == month))
        if existing:
            if existing.job_count != count or existing.total_jobs != total or not math.isclose(existing.demand_rate, rate, abs_tol=1e-9):
                raise ValueError("Existing history conflicts with this import; no records changed")
            summary["history_existing"] += 1
        else:
            db.add(SkillDemandHistory(domain=row["domain"], skill=row["skill"], month=month,
                job_count=count, total_jobs=total, demand_rate=rate))
            summary["history_added"] += 1
    for row in forecasts.to_dict("records"):
        month, start, end = [date.fromisoformat(row[k]) for k in ("forecast_month", "training_start", "training_end")]
        if not start <= end < month:
            raise ValueError("Forecast must be after its training window")
        predicted, lower, upper = [float(row[k]) for k in ("predicted_rate", "lower_bound", "upper_bound")]
        if not 0 <= lower <= predicted <= upper <= 1:
            raise ValueError("Invalid forecast rate or interval")
        source_history = history[(history.domain == row["domain"]) & (history.skill == row["skill"])].sort_values("month")
        if source_history.empty or source_history.month.min() != str(start) or source_history.month.max() != str(end):
            raise ValueError("Training history does not match forecast provenance")
        baseline = source_history.tail(3).demand_rate.mean()
        change = (predicted - baseline) / max(abs(baseline), 1e-9)
        trend = "Increasing" if change > .05 else "Decreasing" if change < -.05 else "Stable"
        existing = db.scalars(select(SkillForecast).where(
            SkillForecast.domain == row["domain"], SkillForecast.skill == row["skill"],
            SkillForecast.forecast_month == month)).all()
        if existing:
            if len(existing) != 1 or (existing[0].metrics or {}).get("import_digest") != digest:
                raise ValueError("Existing forecasts conflict with this import; no records changed")
            summary["forecasts_existing"] += 1
        else:
            db.add(SkillForecast(domain=row["domain"], skill=row["skill"], forecast_month=month,
                predicted_rate=predicted, lower_bound=lower, upper_bound=upper, trend=trend,
                model_name=row["model_name"], training_start=start, training_end=end,
                metrics={"scope": "historical_experiment", "import_digest": digest,
                    "source_dataset": "Data Analyst Skills Evolution (2022–2026)",
                    "cautions": quality["cautions"], "evaluation": metrics.get((row["domain"], row["skill"]), {})}))
            summary["forecasts_added"] += 1
    if apply:
        db.commit()
    else:
        db.rollback()
    return {**summary, "applied": apply, "skills": sorted(skill for _, skill in keys),
        "forecast_start": forecasts.forecast_month.min(), "forecast_end": forecasts.forecast_month.max()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        with SessionLocal() as session:
            print(json.dumps(import_results(session, args.directory, args.apply), indent=2))
    except (ValueError, SQLAlchemyError) as exc:
        # Database exception text can contain connection details or SQL parameters.
        print(str(exc) if isinstance(exc, ValueError) else f"Database operation failed ({type(exc).__name__}); transaction rolled back.")
        sys.exit(1)
