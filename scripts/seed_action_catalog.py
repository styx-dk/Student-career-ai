"""Idempotently seed a generic action catalog. These are planning options, not student claims."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.entities import ActionCatalog


ACTIONS = [
    ("Build a REST API project", "Project", ["REST API", "Python", "PostgreSQL"], "Software Development", 5, "Design, implement and document a deployable API."),
    ("Containerize a portfolio project", "Practical Experience", ["Docker"], "Software Development", 2, "Add a reproducible Docker workflow to an existing project."),
    ("Build an AWS deployment project", "Project", ["AWS", "Docker", "Cloud Deployment"], "Software Development", 6, "Deploy a containerized application and document the architecture."),
    ("Build a data dashboard", "Project", ["Power BI", "SQL", "Data Visualization"], "Data Analytics", 5, "Create a dashboard from a documented, reproducible dataset."),
    ("Complete an applied ML project", "Project", ["Machine Learning", "Python", "scikit-learn"], "Data Science", 7, "Train and evaluate a model with a reproducible pipeline."),
]


with SessionLocal() as db:
    for name, kind, skills, domain, effort, description in ACTIONS:
        if not db.scalar(select(ActionCatalog).where(ActionCatalog.action_name == name)):
            db.add(ActionCatalog(action_name=name, action_type=kind, skills_gained=skills, related_domain=domain, effort_cost=effort, description=description))
    db.commit()
print("Action catalog seed complete (planning metadata only).")
