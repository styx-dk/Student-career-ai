from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.entities import ActionCatalog, CareerPlan, JobDescription, SimulationResult, SkillForecast
from app.schemas.contracts import PlanRequest, SimulationRequest
from app.services.planning import CandidateAction, greedy_plan, simulate
from app.services.profile_state import load_profile_state


router = APIRouter()


def _candidate(row: ActionCatalog) -> CandidateAction:
    return CandidateAction(
        id=str(row.id),
        name=row.action_name,
        skills=tuple(row.skills_gained),
        effort=row.effort_cost,
        action_type=row.action_type,
        description=row.description,
    )


def _owned_jd(db: Session, student_id: UUID, jd_id: UUID) -> JobDescription:
    jd = db.scalar(
        select(JobDescription).where(JobDescription.id == jd_id, JobDescription.student_id == student_id)
    )
    if not jd:
        raise HTTPException(404, "Job description not found")
    if not jd.requirements:
        raise HTTPException(409, "Analyze the job description first")
    return jd


@router.get("/actions")
def list_actions(domain: str | None = None, db: Session = Depends(get_db)):
    query = select(ActionCatalog).where(ActionCatalog.is_active.is_(True))
    if domain:
        query = query.where(ActionCatalog.related_domain == domain)
    rows = db.scalars(query.order_by(ActionCatalog.effort_cost, ActionCatalog.action_name)).all()
    return [
        {
            "id": row.id,
            "action_name": row.action_name,
            "action_type": row.action_type,
            "skills_gained": row.skills_gained,
            "related_domain": row.related_domain,
            "effort_cost": row.effort_cost,
            "description": row.description,
        }
        for row in rows
    ]


@router.post("/simulate")
def run_simulation(
    payload: SimulationRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jd = _owned_jd(db, user.id, payload.job_description_id)
    rows = db.scalars(
        select(ActionCatalog).where(ActionCatalog.id.in_(payload.action_ids), ActionCatalog.is_active.is_(True))
    ).all()
    if len(rows) != len(set(payload.action_ids)):
        raise HTTPException(422, "One or more actions are unavailable")
    skills, evidence, _ = load_profile_state(db, user.id)
    baseline, result = simulate(jd.requirements, skills, evidence, [_candidate(row) for row in rows])
    response = {
        "current_readiness": baseline.score,
        "simulated_readiness": result.score,
        "improvement": round(result.score - baseline.score, 1),
        "newly_covered": [
            after.skill
            for before, after in zip(baseline.requirements, result.requirements)
            if before.classification == "Missing" and after.classification != "Missing"
        ],
        "remaining_gaps": [item.skill for item in result.requirements if item.classification == "Missing"],
        "temporary": True,
    }
    db.add(
        SimulationResult(
            student_id=user.id,
            job_description_id=jd.id,
            action_ids=[str(row.id) for row in rows],
            baseline_score=baseline.score,
            simulated_score=result.score,
            result=response,
        )
    )
    db.commit()
    return response


@router.post("/plans", status_code=201)
def create_plan(
    payload: PlanRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jd = _owned_jd(db, user.id, payload.job_description_id)
    query = select(ActionCatalog).where(ActionCatalog.is_active.is_(True))
    if jd.domain:
        query = query.where(
            (ActionCatalog.related_domain == jd.domain) | (ActionCatalog.related_domain.is_(None))
        )
    actions = [_candidate(row) for row in db.scalars(query).all()]
    skills, evidence, _ = load_profile_state(db, user.id)
    forecasts = db.scalars(
        select(SkillForecast).where(SkillForecast.domain == jd.domain,
            SkillForecast.forecast_month >= date.today().replace(day=1)).order_by(SkillForecast.forecast_month.desc())
    ).all() if jd.domain else []
    signals = {}
    for row in forecasts:
        if (row.metrics or {}).get("scope") != "historical_experiment":
            signals.setdefault(row.skill, max((row.predicted_rate or 0) * 100, 0))
    result = greedy_plan(
        jd.requirements, skills, evidence, actions, payload.target_readiness, payload.max_actions, signals
    )
    plan = CareerPlan(
        student_id=user.id,
        job_description_id=jd.id,
        target_role=jd.job_title or jd.name,
        current_readiness=result["current_readiness"],
        target_readiness=payload.target_readiness,
        selected_actions=result["actions"],
        remaining_gaps=result["remaining_gaps"],
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"id": plan.id, **result, "created_at": plan.created_at}


@router.get("/plans")
def list_plans(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(CareerPlan).where(CareerPlan.student_id == user.id).order_by(CareerPlan.created_at.desc())
    ).all()
    return [
        {
            "id": row.id,
            "target_role": row.target_role,
            "job_description_id": row.job_description_id,
            "current_readiness": row.current_readiness,
            "target_readiness": row.target_readiness,
            "actions": row.selected_actions,
            "remaining_gaps": row.remaining_gaps,
            "created_at": row.created_at,
        }
        for row in rows
    ]
