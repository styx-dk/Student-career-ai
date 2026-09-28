"""Extract a controlled skill vocabulary from prepared job postings."""
import argparse
import json
from pathlib import Path

import pandas as pd

from pipeline_common import extract_known_skills, normalize


def extract(source: Path, output: Path) -> pd.DataFrame:
    frame = pd.read_csv(source)
    def row_skills(row):
        supplied = []
        raw = str(row.get("required_skills", ""))
        try:
            value = json.loads(raw)
            supplied = value if isinstance(value, list) else []
        except json.JSONDecodeError:
            supplied = raw.split(",")
        skills = {normalize(str(skill)) for skill in supplied if str(skill).strip()}
        skills.update(extract_known_skills(str(row.get("job_description", ""))))
        return json.dumps(sorted(skills))
    frame["normalized_skills"] = frame.apply(row_skills, axis=1)
    output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output, index=False)
    return frame


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/processed/job_postings_skills.csv"))
    args = parser.parse_args(); result = extract(args.source, args.output)
    print(f"Wrote normalized skills for {len(result)} postings to {args.output}")

