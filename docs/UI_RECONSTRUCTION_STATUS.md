# Student workspace reconstruction

## Delivered

- Five primary sections: Overview, Documents, Career profile, Career planning and Resumes. Settings is in the account area. Legacy routes redirect.
- One responsive stylesheet and shared page headers, notices, native accessible dialogs, expandable summaries, compact skill chips and pagination controls. Obsolete theme layers and the duplicate Repository screen are removed; experience management now lives in the profile.
- Documents: nested folder breadcrumbs, search, status filters, 20 files per page, batch upload/analysis feedback, rename/move, dedicated source URLs, PDF/image preview and download links. Summary, Skills, Details and Original have separate tabs.
- Review: editable skill rows, search and 10 skills per page; exclude incorrect skills, add missing skills, and keep incidental mentions out of the confirmed profile. Reanalysis preserves previous confirmed evidence until the new draft is accepted. Unsaved review changes warn on normal link navigation and refresh.
- Profile: Overview / Skills / Experience / Education / Timeline. Eight overview skills, twelve skills per page, eight experience entries per page, six evidence sources per dialog. Search and evidence-count filters. Manual entry creation, editing and deletion remain separate from document-confirmed records.
- Timelines use actual record dates and label undated records as needing dates. No invented proficiency or external-verification claims.
- Planning: shared target-role selection, requirement search/pagination, skill comparisons, hypothetical activities and saved plans per role. Market charts distinguish observed data from estimates and explicitly show unavailable datasets.
- Resumes: confirmed-evidence prerequisite, confirmed-only skills, education/certification/other-experience sections, bounded resume list and explicit PDF download links.
- Error and busy states in the rebuilt pages; no endless loading state on initial request failure. Account preferences no longer imply that selecting a dropdown changes the server's active AI provider.
- Backend fixes: source aliases deduplicated, bounded factual summaries, concise AI summary prompt, summary refresh on record changes, owner-checked single-document endpoint, removal of document-list N+1 queries, owner-scoped hash matching for new uploads, and resume claim filtering.

## Verification

- Frontend production build passes; chart code is lazy-loaded and bundles are split.
- Backend: 18 tests pass against local SQLite with mocked AI and Storage.
- Browser: seven Playwright tests pass using an isolated local server and intercepted API requests. Includes 100 skills, 200 records, long filenames, exclusion/confirmation, source links, legacy routes, empty states, failed requests and 390px/1366px layouts.
- Desktop/mobile screenshots were inspected for Overview, Documents, document review and Skills. Screenshots and traces are ignored test artifacts, not real student data.
- No remote schema change, account mutation, real file upload or live Gemini inference was performed for this reconstruction.

## Run and verify

From frontend:

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run test:e2e
```

The browser test configuration uses locally installed Chrome, port 5181, fake authentication and mocked API data. It does not need live credentials.

From backend:

```powershell
python -m uvicorn app.main:app --reload
python -m pytest -q
```

Open http://localhost:5173/dashboard. Existing provider settings are preserved; Gemini remains selected through server configuration.

## Remaining production work / deliberate limits

- Pagination currently bounds rendering in the browser; collection APIs still return complete arrays. True server-side pagination and background analysis jobs are needed for very large accounts.
- Duplicate detection covers new uploads whose paths contain a digest. It does not backfill legacy files and is not an atomic concurrent-upload deduplication guarantee.
- Skill categories are not inferred or editable yet; current filters are search and supporting-record count. No unsupported taxonomy is fabricated.
- Original preview is a separate tab, not a synchronized side-by-side document annotator. Office files use download/open links.
- Market datasets and the learning activity catalog must actually be populated before forecasts and suggested activities are available. No fake content is seeded.
- Real authenticated Supabase upload → Gemini analysis → confirmation → PDF export still needs a user acceptance pass with the configured remote services. Existing dependency deprecation warnings remain.
- This is a completed core UI/workflow reconstruction, not certification that every earlier project capability is production-ready. GitHub publication is a separate step.
