# Forecasting

Input schema: `posting_date, job_title, domain, job_description, required_skills`. Initial accepted domains are Software Development, Data Analytics and Data Science. The pipeline deliberately does not scrape live pages.

Run from the repository root:

```powershell
python scripts/prepare_job_dataset.py data/raw/jobs.csv
python scripts/extract_job_skills.py data/processed/job_postings_clean.csv
python scripts/aggregate_skill_demand.py data/processed/job_postings_skills.csv
python scripts/train_forecast.py data/processed/skill_demand_monthly.csv --horizon 6
python scripts/evaluate_forecast.py data/processed/skill_demand_monthly.csv --test-months 3
```

Monthly `demand_rate = job_count / total_jobs_in_month`. ARIMA(1,1,1) trains on chronologically ordered data, forecasts 1–12 months and clips rates to [0,1]. Series shorter than the minimum are skipped, not filled with invented history. Evaluation uses a chronological holdout and reports actual MAE/RMSE only. Load processed rows into their corresponding Supabase tables before the dashboard can show a forecast.

