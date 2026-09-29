# Student evidence and progress

Upload resumes and supporting work in Documents. After analysis, review Summary,
then Details. A resume has separate education, project, internship and credential
entries. Edit or exclude incorrect entries before confirming. Only entry-level
skills become profile evidence; a generic skills list is not proof of experience.

Existing resumes need to be reanalyzed to use this structure. No original uploads
are changed automatically. Reanalysis creates a draft; previous confirmed evidence
remains until the new draft is accepted. Accepting a revision replaces that
document's entries. Rejecting it keeps the previous profile evidence.

The profile uses reviewed information and a factual summary even when AI is
unavailable. Refresh summary requests new AI wording using the active provider.
Resume statements remain self-reported, not independently verified.

Overview shows a seven-day review activity indicator and suggested next steps.
Only accepted document reviews record activity; repeated confirmation of the same
revision does not create additional events. Dates use the browser's current UTC
offset. Past activity before this feature is not inferred. Resume check-in flags
missing information; it is not an ATS or employability score.

These changes use existing JSON fields and the existing activity_log table, so
no new migration is required. Restart the backend if it is not running with reload.

## Connected career cockpit

Overview maps the selected role's normalized requirements to reviewed records and
their source documents. The role selection is shared with planning and resume
creation in the current browser session. Coverage counts requirements with evidence;
it is not a hiring probability or independently verified proficiency. Missing
evidence opens a suggested mini-project, not an automatically completed achievement.

Resume freshness compares snapshot sources with current records and flags new,
changed or deleted entries and profile changes. These are prompts to review, not
automatic edits. Preview links open the exact saved snapshot in Resumes.

The top-bar theme button switches light/dark mode and remembers the choice locally.
The initial theme follows the operating system when no preference has been saved.

## PDF export

The authenticated `GET /api/v1/resumes/{id}/pdf` endpoint now returns PDF bytes,
not a signed-URL JSON object. The browser fetches it with the session token and
offers a local download. It no longer requires the generated-resumes storage bucket.
Restart an older running backend before testing. Upload storage is still needed
for original student documents. A backend connectivity/CORS problem can still
prevent downloads; the app now explains this rather than only showing Failed to fetch.
