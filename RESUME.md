# Resume Assistance

Resume creation retrieves only `user_confirmed` career records. For a target JD it selects intersecting verified skills and records, creates structured content and saves claim-to-record source IDs in `claim_sources`. PDF generation uses that structured content.

No unverified extraction, simulated skill, forecast or model-generated metric is eligible. The user-facing PDF omits internal source IDs, while the saved version retains them for review. Each resume has version metadata and a private Storage export path.

