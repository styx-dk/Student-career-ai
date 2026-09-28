# API

The OpenAPI explorer at `/docs` is the authoritative contract. All student routes require `Authorization: Bearer <Supabase access token>`.

Key groups:

- `/api/v1/profile` and `/profile/completeness`
- `/api/v1/records` and `/records/skills`
- `/api/v1/documents`, `/{id}/process`, `/{id}/review`, `/{id}/download`
- `/api/v1/job-descriptions`, `/{id}/analyze`, `/{id}/match`
- `/api/v1/forecasts` and `/forecasts/catalog`
- `/api/v1/career/actions`, `/simulate`, `/plans`
- `/api/v1/resumes` and `/{id}/pdf`
- `/api/v1/diagnostics`

Cross-owner identifiers return 404 to avoid disclosing existence. Validation errors are 422, unavailable external dependencies 503, and invalid tokens 401.

