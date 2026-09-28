# Career Compass

**AI-Powered Student Career Repository with Predictive Career Planning and Resume Assistance**

Career Compass is a production-style modular monolith for maintaining an evidence-backed student career record. Supabase Auth identifies the student, Supabase PostgreSQL stores structured data, Supabase Storage preserves original evidence, deterministic Python services match a profile to a job, ARIMA forecasts skill-demand rates, a temporary simulator evaluates hypothetical actions, and a greedy weighted-coverage planner recommends efficient next steps. The LLM extracts or phrases information; it does not calculate scores, forecasts, simulations, or plans.

## What is implemented

- Supabase registration, login, persistent sessions and password reset
- JWT validation and owner-filtered backend queries; RLS and Storage policy scripts
- Profiles, normalized skills and a multi-category career repository
- PDF, DOCX, PPTX and TXT extraction; legacy DOC/PPT accepted for safe server-side conversion only when configured; image routing to Gemini
- Original-file preservation in private Supabase Storage and version metadata
- Pydantic-validated AI extraction with explicit user accept/reject review
- Ollama text provider and optional Gemini structured/multimodal provider
- Deterministic JD matching and configurable readiness weights
- pgvector-backed embedding cache and evidence retrieval service
- Real-data job pipeline, monthly demand rates, ARIMA, chronological MAE/RMSE evaluation
- Non-mutating multi-action simulation and greedy effort-adjusted planning
- Evidence-only resume versions and PDF export
- Responsive React dashboard, transparent statuses, empty/loading/error states
- Cross-user security and algorithm tests

The application never labels readiness as a hiring probability. It never generates a forecast without a sufficient real historical series. Demo planning actions are application metadata and never student achievements.

## Repository map

```text
backend/       FastAPI, SQLAlchemy, Alembic, providers, algorithms
frontend/      React, TypeScript and Supabase Auth client
scripts/       historical-job pipeline and development seed tooling
supabase/      Storage RLS policies
data/          ignored raw/processed data directories
docs/          design notes and ADRs
```

Start with [SETUP.md](SETUP.md), then use `http://localhost:5173`. API docs are at `http://localhost:8000/docs`.

## Development commands

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Run verification with `pytest` in `backend/` and `npm run build` in `frontend/`.

