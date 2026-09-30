"""Audit a prepared CSV and run an explicitly historical forecast experiment.

No database writes. Months without observations are never imputed as zero demand.
"""
import argparse
import json
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

try:
    from .pipeline_common import SKILLS, extract_known_skills, normalize
except ImportError:
    from pipeline_common import SKILLS, extract_known_skills, normalize


def continuous_blocks(counts, minimum):
    """Break at every missing or undersampled month."""
    calendar = pd.date_range(counts.index.min(), counts.index.max(), freq="MS")
    blocks, current = [], []
    for month in calendar:
        if counts.get(month, 0) >= minimum:
            current.append(month)
        elif current:
            blocks.append(current)
            current = []
    if current:
        blocks.append(current)
    return blocks


def skills_for(row):
    raw = row.get("required_skills")
    supplied = []
    if pd.notna(raw):
        try:
            parsed = json.loads(str(raw))
            supplied = parsed if isinstance(parsed, list) else str(raw).split(",")
        except (ValueError, TypeError):
            supplied = str(raw).split(",")
    # Limit this small experiment to the application's controlled vocabulary.
    return sorted(({normalize(str(s)) for s in supplied if str(s).strip()}
                   | set(extract_known_skills(str(row["job_description"])))) & SKILLS)


def model_forecast(series, horizon):
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        fit = ARIMA(series, order=(1, 1, 1)).fit()
        result = fit.get_forecast(steps=horizon)
    if not fit.mle_retvals.get("converged", True):
        raise ValueError("ARIMA optimizer did not converge")
    return result, sorted({str(w.message) for w in caught})


@dataclass
class SimpleForecast:
    predicted_mean: pd.Series
    lower: np.ndarray
    upper: np.ndarray

    def conf_int(self):
        return pd.DataFrame({"lower": self.lower, "upper": self.upper}, index=self.predicted_mean.index)


def linear_forecast(series, horizon):
    """Small-sample exploratory fallback with residual-based prediction bounds."""
    values = np.asarray(series, dtype=float)
    x = np.arange(len(values), dtype=float)
    slope, intercept = np.polyfit(x, values, 1)
    fitted = intercept + slope * x
    residual = float(np.std(values - fitted, ddof=2)) if len(values) > 2 else 0.0
    future_x = np.arange(len(values), len(values) + horizon, dtype=float)
    predicted = intercept + slope * future_x
    # Widen bounds with horizon; these are exploratory intervals, not calibrated probabilities.
    spread = 1.96 * residual * np.sqrt(1 + np.arange(1, horizon + 1) / max(len(values), 1))
    index = pd.date_range(series.index[-1] + pd.offsets.MonthBegin(), periods=horizon, freq="MS")
    return SimpleForecast(pd.Series(predicted, index=index), predicted - spread, predicted + spread), []


def last_value_forecast(series, horizon):
    values = np.asarray(series, dtype=float)
    predicted = np.repeat(values[-1], horizon)
    residual = float(np.std(np.diff(values), ddof=1)) if len(values) > 2 else 0.0
    spread = 1.96 * residual * np.sqrt(np.arange(1, horizon + 1))
    index = pd.date_range(series.index[-1] + pd.offsets.MonthBegin(), periods=horizon, freq="MS")
    return SimpleForecast(pd.Series(predicted, index=index), predicted - spread, predicted + spread), []


def evaluated_forecast(series, horizon):
    """Choose ARIMA, linear trend, or a conservative baseline on a holdout."""
    train, actual = series.iloc[:-3], series.iloc[-3:].to_numpy()
    candidates = []
    try:
        result, warnings_found = model_forecast(train, 3)
        candidates.append((float(np.abs(actual - np.asarray(result.predicted_mean)).mean()), "ARIMA(1,1,1)", warnings_found, result))
    except (ValueError, np.linalg.LinAlgError) as exc:
        candidates.append((float("inf"), "ARIMA(1,1,1)", [str(exc)], None))
    linear, linear_warnings = linear_forecast(train, 3)
    candidates.append((float(np.abs(actual - np.asarray(linear.predicted_mean)).mean()), "LinearTrend", linear_warnings, linear))
    baseline, baseline_warnings = last_value_forecast(train, 3)
    candidates.append((float(np.abs(actual - np.asarray(baseline.predicted_mean)).mean()), "LastValueBaseline", baseline_warnings, baseline))
    mae, model_name, evaluation_warnings, heldout = min(candidates, key=lambda item: item[0])
    if model_name == "ARIMA(1,1,1)":
        try:
            future, final_warnings = model_forecast(series, horizon)
        except (ValueError, np.linalg.LinAlgError) as exc:
            model_name = "LinearTrend"
            future, final_warnings = linear_forecast(series, horizon)
            evaluation_warnings.append(f"Full-series ARIMA failed; used linear fallback: {exc}")
    else:
        future, final_warnings = (linear_forecast(series, horizon) if model_name == "LinearTrend" else last_value_forecast(series, horizon))
    predicted = np.clip(np.asarray(heldout.predicted_mean), 0, 1)
    return future, model_name, actual, predicted, sorted(set(evaluation_warnings + final_warnings))


def run(source, output, minimum=10, horizon=6, only_skills=None):
    output.mkdir(parents=True, exist_ok=False)
    frame = pd.read_csv(source)
    required = {"posting_date", "job_title", "job_description", "domain", "required_skills"}
    if not required.issubset(frame.columns):
        raise ValueError(f"Missing columns: {sorted(required - set(frame.columns))}")
    dates = pd.to_datetime(frame["posting_date"], errors="coerce", utc=True)
    if dates.isna().any():
        raise ValueError("Invalid posting dates must be corrected before forecasting")
    frame["month"] = dates.dt.tz_convert(None).dt.to_period("M").dt.to_timestamp()
    frame["skills"] = frame.apply(skills_for, axis=1)
    report = {
        "source": str(source.resolve()), "rows": len(frame),
        "domain_counts": frame["domain"].value_counts().to_dict(),
        "missing_skill_fields": int(frame.required_skills.isna().sum()),
        "scope": "historical_experiment", "publishable_as_current_forecast": False,
        "monthly_sample_threshold": minimum, "holdout_months": 3,
        "cautions": [
            "Posting-date provenance needs verification; descriptions may contain older closing dates.",
            "Dataset sampling is uneven and cannot be assumed representative of the whole job market.",
            "Predictions start after the selected historical block, not after today's date.",
            "Ten postings per month is an exploratory screening threshold, not a reliability guarantee.",
            "ARIMA and linear trend are compared on one three-month holdout; model selection may overfit that short period.",
        ],
        "domains": [], "skipped": [],
    }
    forecast_rows, evaluation_rows, monthly_rows = [], [], []
    for domain, group in frame.groupby("domain"):
        counts = group.groupby("month").size().sort_index()
        calendar = pd.date_range(counts.index.min(), counts.index.max(), freq="MS")
        blocks = continuous_blocks(counts, minimum)
        block = max(blocks, key=lambda b: (len(b), b[-1]), default=[])
        report["domains"].append({
            "domain": domain,
            "monthly_counts": {m.strftime("%Y-%m"): int(counts.get(m, 0)) for m in calendar},
            "missing_months": [m.strftime("%Y-%m") for m in calendar if m not in counts.index],
            "selected_start": str(block[0].date()) if block else None,
            "selected_end": str(block[-1].date()) if block else None,
            "selected_months": len(block),
        })
        # Twelve training observations plus three holdout observations.
        if len(block) < 15:
            report["skipped"].append({"domain": domain, "reason": "Fewer than 15 consecutive adequately sampled months"})
            continue
        selected = group[group.month.isin(block)]
        training = selected[selected.month < block[-3]]
        mentions = training.explode("skills").dropna(subset=["skills"]).groupby("skills").size()
        names = mentions[mentions >= 10].sort_values(ascending=False).head(12).index
        if only_skills:
            names = [name for name in names if name in only_skills]
        denominator = counts.reindex(block)
        for skill in names:
            hits = selected[selected.skills.map(lambda s: skill in s)].groupby("month").size().reindex(block, fill_value=0)
            series = (hits / denominator).asfreq("MS")
            for month in block:
                monthly_rows.append({"domain": domain, "skill": skill, "month": month,
                    "job_count": int(hits.loc[month]), "total_jobs": int(denominator.loc[month]),
                    "demand_rate": float(series.loc[month])})
            try:
                future, model_name, actual, predicted, model_warnings = evaluated_forecast(series, horizon)
                naive = np.repeat(series.iloc[-4], 3)
                mae = float(np.abs(actual - predicted).mean())
                naive_mae = float(np.abs(actual - naive).mean())
                evaluation_rows.append({"domain": domain, "skill": skill, "mae": mae,
                    "rmse": float(np.sqrt(np.mean((actual - predicted) ** 2))),
                    "naive_mae": naive_mae, "beats_naive": mae < naive_mae,
                    "selected_model": model_name, "selection_method": "lowest MAE on one three-month holdout, including last-value baseline",
                    "test_start": str(block[-3].date()), "test_end": str(block[-1].date()),
                    "actual": actual.tolist(), "predicted": predicted.tolist(),
                    "warnings": model_warnings})
                confidence = future.conf_int().to_numpy()
                for i, (month, value) in enumerate(future.predicted_mean.items()):
                    forecast_rows.append({"domain": domain, "skill": skill, "forecast_month": month,
                        "predicted_rate": float(np.clip(value, 0, 1)),
                        "lower_bound": float(np.clip(confidence[i, 0], 0, 1)),
                        "upper_bound": float(np.clip(confidence[i, 1], 0, 1)),
                        "model_name": model_name, "training_start": block[0],
                        "training_end": block[-1], "scope": "historical_experiment",
                        "beats_naive_holdout": mae < naive_mae})
            except (ValueError, np.linalg.LinAlgError) as exc:
                report["skipped"].append({"domain": domain, "skill": skill, "reason": str(exc)})
    pd.DataFrame(monthly_rows, columns=["domain", "skill", "month", "job_count", "total_jobs", "demand_rate"]).to_csv(output / "skill_demand_monthly.csv", index=False)
    pd.DataFrame(forecast_rows, columns=["domain", "skill", "forecast_month", "predicted_rate", "lower_bound", "upper_bound", "model_name", "training_start", "training_end", "scope", "beats_naive_holdout"]).to_csv(output / "historical_forecasts.csv", index=False)
    (output / "evaluation.json").write_text(json.dumps(evaluation_rows, indent=2), encoding="utf-8")
    report["forecast_rows"] = len(forecast_rows)
    report["evaluated_skills"] = len(evaluation_rows)
    report["skills_beating_naive"] = sum(r["beats_naive"] for r in evaluation_rows)
    (output / "data_quality_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("rows", "forecast_rows", "evaluated_skills", "skills_beating_naive")}))
    print("Output:", output.resolve())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True, help="New directory; existing output is never overwritten")
    parser.add_argument("--min-postings", type=int, default=10)
    parser.add_argument("--horizon", type=int, default=6)
    parser.add_argument("--skills", nargs="*", help="Optional normalized skills to include from the audited top-skill set")
    args = parser.parse_args()
    if args.min_postings < 1 or not 1 <= args.horizon <= 12:
        parser.error("min-postings must be positive; horizon must be 1–12")
    run(args.source, args.output_dir, args.min_postings, args.horizon, set(args.skills or []))
