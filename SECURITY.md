# Security

- Supabase owns password handling and session issuance.
- The backend verifies a signed access JWT and derives `student_id` from `sub`.
- Every student query includes both entity ID and authenticated `student_id`; tests cover cross-user access.
- PostgreSQL RLS provides defense in depth for Supabase-accessible tables.
- Storage objects are private and user-prefixed. Downloads are short-lived signed URLs.
- The service-role key is backend-only; frontend variables contain only publishable values.
- Uploads are allowlisted, sized, MIME checked and path sanitized.
- Production errors hide internal exception details.
- `.env`, raw data, uploads, generated artifacts and model caches are ignored.

Before deployment, restrict CORS to the real frontend origin, rotate leaked credentials, require HTTPS, configure Supabase email redirects, run dependency scanning and apply migrations with a least-privileged operational process.

