# Setup

## 1. Supabase

1. Create a Supabase project. No local PostgreSQL installation is needed.
2. In **Authentication → Providers**, enable email/password. Configure the site URL as `http://localhost:5173` and add the password-reset redirect URL.
3. Copy the project URL and publishable/anon key. Keep the service-role key server-side only.
4. Copy the direct or pooler PostgreSQL URI and change its driver prefix to `postgresql+psycopg://`.
5. In Storage, create two **private** buckets: `career-documents` and `generated-resumes`.
6. Run [supabase/storage-policies.sql](supabase/storage-policies.sql) in the SQL editor. The database migration enables `pgvector` and table RLS.

## 2. Environment

Copy `.env.example` to `.env`. Fill `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Never place the service key in a `VITE_` variable.

Create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

## 3. Backend

From the repository root:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
cd backend
alembic upgrade head
python ..\scripts\seed_action_catalog.py
uvicorn app.main:app --reload --port 8000
```

The default SQLite URL exists only to make isolated development/tests easy. Set the Supabase PostgreSQL URL for the real application.

## 4. AI providers

Install Ollama, start it, and run `ollama pull qwen2.5:3b`. Keep `LLM_PROVIDER=ollama`. Text documents, JD analysis and language generation then work locally.

For image certificates or photographed letters, set `GEMINI_API_KEY` and a Gemini model that supports structured multimodal input. Gemini is optional; without it the UI clearly reports that image analysis needs a multimodal provider.

Legacy `.doc` and `.ppt` require a server-side LibreOffice conversion deployment. The files are accepted and preserved, but extraction fails visibly until that converter is configured.

## 5. Frontend

```powershell
cd frontend
npm install
npm run dev
```

## 6. Market data

Bring a legitimately sourced CSV with the schema described in [FORECASTING.md](FORECASTING.md). Run the five scripts in order. Do not use invented rows in a real forecast demonstration.

## 7. Diagnostics

Open **Settings → Application diagnostics** or `GET /api/v1/diagnostics`. It reports connectivity without exposing credentials.

