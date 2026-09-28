# Database

All IDs are UUIDs. Every student-owned table contains `student_id`, indexed and sourced from the validated JWT—not a request field. `student_profiles.student_id` is unique. Tables use foreign keys, unique constraints, created/updated timestamps and compound indexes where lookups require them.

Core groups:

- identity/profile: `student_profiles`, `education`, `skills`, `student_skills`
- repository: `career_records`, `documents`, `document_versions`, `document_extractions`, `content_embeddings`
- analysis: `job_descriptions`, `simulation_results`, `career_plans`
- market: `job_posting_history`, `skill_demand_history`, `skill_forecasts`
- output: `resumes`, `resume_versions`, `activity_log`
- application catalog: `action_catalog`

`career_records.record_type` represents projects, internships, certifications, workshops and achievements while retaining consistent source/evidence semantics. Original binaries are never stored in PostgreSQL. Embeddings use `vector(384)` for `all-MiniLM-L6-v2`.

Run schema changes only through Alembic. The initial migration enables `vector`, creates schema, enables RLS, and applies `auth.uid() = student_id` policies.

