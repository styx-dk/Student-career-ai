# Architecture

Career Compass is a modular monolith: one React client, one FastAPI service, one Supabase project, and offline data-preparation scripts.

```text
React + Supabase Auth
        │ Bearer JWT
        ▼
FastAPI ─ ownership filters ─ SQLAlchemy ─ Supabase PostgreSQL + pgvector
   │                                      └─ application-level forecasts
   ├─ Supabase private Storage
   ├─ document parsers → provider router → Pydantic review record
   ├─ deterministic matcher / simulator / planner
   └─ ARIMA forecast reads and evidence-only PDF renderer
```

Trust categories remain separate: stored evidence, AI extraction, user-confirmed information, current deterministic analysis, forecast output, simulation state, algorithmic plans and LLM wording. The simulator copies skills/evidence in memory and cannot write them into `student_skills`.

Service boundaries live in `backend/app/services`; HTTP concerns live in `backend/app/api/routes`. This keeps provider implementations out of matching and planning logic.

