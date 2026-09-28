# Milestone 1: career drive

The first workflow is `/documents` → upload into a folder → structured analysis → review/correct → confirm → `/profile`.

The drive supports nested folders, multiple uploads, drag/drop, searching names and summaries, moving files, renaming, downloading originals and deleting evidence. Gemini is selected through `LLM_PROVIDER=gemini`; the same analysis schema works with Ollama for text. Images/scanned PDFs require a multimodal provider. The upload picker currently enables PDF, DOCX, PPTX, TXT and images; legacy DOC/PPT parsing remains unavailable.

Analysis produces a title, document summary, category, organization, dates, demonstrated skills, mentioned topics, accomplishments and uncertainties. Drafts never enter the confirmed profile. Reanalysis retains previous extraction rows; approval updates the existing document-backed career record, avoiding duplicates. Deletion rebuilds the factual summary and removes that document's career record. AI profile wording is refreshed after acceptance; a provider outage leaves the factual summary available.

## Database update

From `backend`, run `python -m alembic upgrade head` against the intended Supabase project. Migration `0002_folders` adds private student folders with RLS and document membership. No automatic remote migration occurs at server startup.

The private `career-documents` bucket must already exist. Storage calls support both the new secret keys and legacy service-role JWTs; neither key is exposed to the frontend.

## Verification

Run `python -m pytest` in backend and `npm.cmd run build` in frontend. `python smoke_drive.py` performs read-only schema/bucket checks and sends a clearly fictional example to Gemini for structured extraction; it writes no student records.

Automated workflow tests mock Storage and AI, and cover cross-user folder protection, confirmation idempotency, preservation of originals on failure, retained confirmed evidence after rejected reanalysis, and profile rebuilding after deletion.

## Current limits

Analysis is synchronous; files above 50,000 extractable characters are rejected for analysis with a clear split-file message. Content-based duplicate upload detection and cross-document conflict reconciliation are future work. AI can make attribution mistakes; users must review its draft. Profile summaries remain editable indirectly through their confirmed source records. The older dashboard and planning screens are retained for later milestones.
