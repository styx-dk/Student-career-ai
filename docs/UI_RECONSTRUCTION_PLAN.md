# Career Compass: product and UI reconstruction plan

Status: core UI reconstruction implemented and locally verified on 2026-09-28. See UI_RECONSTRUCTION_STATUS.md for delivered behavior, test results and remaining production work. The specifications below are the original proposal, not a claim that every stretch item is implemented.

## Objective

Build a student career workspace organized around documents, confirmed experience and useful next steps. A student must understand what was uploaded, what AI found, what needs review and what became part of their profile.

## Findings in the current application

- Profile renders every skill, every source and every career record in one view without pagination.
- Repository cards render every skill chip, making card heights unpredictable.
- The fallback profile summary concatenates all titles and skills into a growing paragraph.
- Skill source links lead to the document list rather than the specific source document.
- My achievements and My profile duplicate career records and use different evidence semantics.
- Navigation gives every advanced tool equal prominence before the student has built a profile.
- Long document review forms mix file management, AI drafts and confirmed data in a single modal.
- Multiple overlapping stylesheets repeatedly override each other. Several pages lack complete error/retry and loading flows.

## Proposed navigation

1. Overview: next useful action, review queue, recent documents and profile snapshot.
2. Documents: folders, uploads, search, filters and document details.
3. Career profile: Overview / Skills / Experience / Education / Timeline tabs.
4. Career planning: Target roles / Skill gaps / What-if / Action plan / Market trends tabs.
5. Resumes: optional output from confirmed profile data.

Settings lives in the account menu. Merge My achievements into profile Experience. Move standalone Skill trends and role-analysis pages into contextual planning tabs. Preserve stored data and redirect old routes.

## Core interaction specifications

### Documents and review

- Folder breadcrumbs and grid/list toggle; search by name, type and analysis status.
- Paginated document lists, 20 items per page; cards show at most three skill chips and a remaining count.
- Upload progress distinguishes uploading, analyzing, awaiting review, confirmed and failed.
- Selecting a document opens a dedicated detail route with tabs: Summary / Skills / Extracted details / Original.
- Desktop review uses original preview alongside editable analysis. Mobile switches between tabs.
- Brief summary first; full text expands on demand. DOCX/PPTX originals offer download when inline preview is unavailable.
- Skills show Accept / Edit / Exclude controls. Incidental topic mentions stay separate.
- Record uncertainty and conflicting details visibly, without guessing missing values.
- Confirming updates the profile once. Reanalysis presents a new draft while retaining confirmed history.
- File content hash detects exact duplicate uploads and offers the existing document; do not merge unrelated work just because titles match.

### Compact skills presentation

- Profile Overview shows at most eight skills with View all (N).
- Skills tab supports search, category filters and pagination, 12 skills per page.
- Normalize aliases and deduplicate across documents. Keep display names readable.
- Skill cards show a short name, evidence state and supporting-document count.
- Selecting a skill opens a side panel with paginated sources and direct document links.
- Category labels may be edited; unmapped skills remain Uncategorized. Never fabricate proficiency ratings or equate source count with expertise.

### Career profile

- Overview: short summary (approximately 80–120 words), representative skills and recent experience.
- Experience: projects, internships, certifications, workshops and achievements as filters under one tab; collapsed cards with detail views.
- Education: structured entries with source, dates and manual corrections.
- Timeline: dated events grouped by year; undated entries in a separate Needs dates section. Upload date must not impersonate an achievement date.
- Separate student-claimed details from confirmed document extraction. Confirmation is not external verification.
- Summary derives from confirmed records. Edits, corrections and deletions invalidate it and refresh the factual view.

### Career planning and resumes

- Start planning with a selected role; explain prerequisites and link to the missing step.
- Keep comparisons, hypothetical actions and saved plans attached to that role.
- Distinguish historical market observations from predictions in charts and legends.
- Show unavailable market data honestly with useful navigation, not dead controls or invented charts.
- Resume creation follows profile confirmation, with source review before export.

## Visual system

Replace layered theme overrides with one design-token system and reusable components. Use high-contrast text, 14–16px body text, consistent spacing, restrained colors and one primary action per screen. Reduce decorative banners, repeated instructions and motivational filler. Use numbers, chips, grouped cards and charts only when they improve understanding.

Shared components: page header, tabs, breadcrumbs, paginated list, skill chips with overflow, evidence panel, review controls, file preview, confirmation dialog, toast, skeleton and recoverable error state. Include keyboard focus, Escape handling, accessible names, reduced motion and mobile navigation.

## Implementation order and completion gates

1. Foundation: new navigation, route map, design tokens and shared components. Old links redirect; desktop/mobile navigation works.
2. Documents: bounded lists, dedicated detail/review routes, preview and upload feedback. Confirmed source opens directly and failed analysis preserves the original.
3. Profile: deduplicated compact skills, evidence panels, tabbed history and concise summary. A profile with 100 skills and 200 records remains usable without rendering everything at once.
4. Data consistency: pagination contracts, exact duplicate detection, extraction-to-record links, summary invalidation and owner checks. Retry, revise and delete cannot leave duplicate or stale evidence.
5. Planning and resumes: integrate existing tools into role-based flows, simplify language and expose actionable missing-prerequisite states.
6. Verification: production build, backend integration tests and visual checks at phone, laptop and desktop sizes. Validate zero-data, large-data, long filenames, long summaries, provider failure, cross-user access and document deletion. Test Gemini first; keep the text-provider contract compatible with Ollama.

UI fixture datasets used for large-list checks must remain clearly labeled test data and never be inserted into a real student account. Remote schema or storage changes will be described separately before execution when approval is required.

## Scope boundaries

Remove redundant screens and presentation clutter, not required project capabilities or student data. Do not add chat, social feeds, gamification, invented proficiency scores or unrelated administration features. Finish the document-to-profile workflow before extending advanced tools. Resume GitHub publication only after this reconstruction is reviewed and verified.
