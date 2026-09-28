"""Validate and normalize a real historical job-posting CSV.

Required columns: posting_date, job_title, domain, job_description, required_skills.
No rows or values are synthesized.
"""
import argparse
from pathlib import Path

import pandas as pd


REQUIRED = {"posting_date", "job_title", "domain", "job_description", "required_skills"}
DOMAINS = {"Software Development", "Data Analytics", "Data Science"}


def prepare(source: Path, output: Path) -> pd.DataFrame:
    frame = pd.read_csv(source)
    missing = REQUIRED - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    frame = frame[list(REQUIRED)].copy()
    frame["posting_date"] = pd.to_datetime(frame["posting_date"], errors="coerce", utc=True)
    frame = frame.dropna(subset=["posting_date", "job_title", "domain", "job_description"])
    frame = frame[frame["domain"].isin(DOMAINS)]
    frame = frame.drop_duplicates(subset=["posting_date", "job_title", "domain", "job_description"])
    frame = frame.sort_values("posting_date")
    output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output, index=False)
    return frame


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/processed/job_postings_clean.csv"))
    args = parser.parse_args()
    result = prepare(args.source, args.output)
    print(f"Wrote {len(result)} verified source rows to {args.output}")

