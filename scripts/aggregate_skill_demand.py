"""Aggregate monthly job counts and demand rates without fabricating missing postings."""
import argparse
import json
from pathlib import Path

import pandas as pd


def aggregate(source: Path, output: Path) -> pd.DataFrame:
    frame = pd.read_csv(source, parse_dates=["posting_date"])
    frame["month"] = frame["posting_date"].dt.to_period("M").dt.to_timestamp()
    total = frame.groupby(["month", "domain"]).size().rename("total_jobs")
    exploded = frame.assign(skill=frame["normalized_skills"].map(json.loads)).explode("skill")
    counts = exploded.dropna(subset=["skill"]).groupby(["month", "domain", "skill"]).size().rename("job_count")
    result = counts.to_frame().join(total).reset_index()
    result["demand_rate"] = result["job_count"] / result["total_jobs"]
    result = result.sort_values(["domain", "skill", "month"])
    output.parent.mkdir(parents=True, exist_ok=True); result.to_csv(output, index=False)
    return result


if __name__ == "__main__":
    parser=argparse.ArgumentParser();parser.add_argument("source",type=Path)
    parser.add_argument("--output",type=Path,default=Path("data/processed/skill_demand_monthly.csv"))
    args=parser.parse_args();result=aggregate(args.source,args.output)
    print(f"Wrote {len(result)} observed month/domain/skill rows to {args.output}")

