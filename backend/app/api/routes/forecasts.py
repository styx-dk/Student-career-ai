from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import date

from app.core.database import get_db
from app.models.entities import SkillDemandHistory, SkillForecast


router = APIRouter()


@router.get("")
def get_forecast(
    domain: str = Query(min_length=2, max_length=120),
    skill: str = Query(min_length=1, max_length=120),
    db: Session = Depends(get_db),
):
    history = db.scalars(
        select(SkillDemandHistory)
        .where(SkillDemandHistory.domain == domain, SkillDemandHistory.skill == skill.lower())
        .order_by(SkillDemandHistory.month)
    ).all()
    forecasts = db.scalars(
        select(SkillForecast)
        .where(SkillForecast.domain == domain, SkillForecast.skill == skill.lower())
        .order_by(SkillForecast.forecast_month)
    ).all()
    is_experiment = any((row.metrics or {}).get("scope") == "historical_experiment" for row in forecasts)
    is_past = bool(forecasts) and max(row.forecast_month for row in forecasts) < date.today().replace(day=1)
    notice = "Predicted trend based on historical job-posting data; it is not a guarantee."
    if is_experiment:
        notice = (
            f"Historical experiment: predictions for {min(r.forecast_month for r in forecasts):%b %Y}–"
            f"{max(r.forecast_month for r in forecasts):%b %Y}. These are not current market predictions. "
            "The source has uneven monthly sampling and posting dates that need verification."
        )
    elif is_past:
        notice = "This forecast covers a past period. It is not a current market outlook."
    return {
        "domain": domain,
        "skill": skill.lower(),
        "historical": [
            {"month": row.month, "demand_rate": row.demand_rate, "job_count": row.job_count, "total_jobs": row.total_jobs}
            for row in history
        ],
        "forecast": [
            {
                "month": row.forecast_month,
                "predicted_rate": row.predicted_rate,
                "lower_bound": row.lower_bound,
                "upper_bound": row.upper_bound,
                "trend": row.trend,
                "model": row.model_name,
            }
            for row in forecasts
        ],
        "notice": notice,
        "scope": "historical_experiment" if is_experiment else "past_forecast" if is_past else "forecast",
        "available": bool(history and forecasts),
    }


@router.get("/catalog")
def forecast_catalog(db: Session = Depends(get_db)):
    rows = db.execute(
        select(SkillDemandHistory.domain, SkillDemandHistory.skill).distinct().order_by(SkillDemandHistory.domain, SkillDemandHistory.skill)
    ).all()
    grouped: dict[str, list[str]] = {}
    for domain, skill in rows:
        grouped.setdefault(domain, []).append(skill)
    return grouped
