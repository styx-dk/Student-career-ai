"""Train ARIMA per domain/skill using chronological data and publish forecast rows to CSV."""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA


def train(source: Path, output: Path, horizon: int = 6, min_months: int = 12) -> pd.DataFrame:
    if not 1 <= horizon <= 12: raise ValueError("horizon must be between 1 and 12")
    frame=pd.read_csv(source,parse_dates=["month"]); rows=[]
    for (domain,skill), group in frame.groupby(["domain","skill"]):
        series=group.set_index("month")["demand_rate"].sort_index().asfreq("MS",fill_value=0.0)
        if len(series)<min_months: continue
        fit=ARIMA(series,order=(1,1,1)).fit(); prediction=fit.get_forecast(steps=horizon)
        mean=np.clip(prediction.predicted_mean,0,1); ci=prediction.conf_int()
        baseline=float(series.tail(min(3,len(series))).mean()); final=float(mean.iloc[-1])
        change=(final-baseline)/max(abs(baseline),1e-9)
        trend="Increasing" if change>.05 else "Decreasing" if change<-.05 else "Stable"
        for month,value,lower,upper in zip(mean.index,mean,ci.iloc[:,0],ci.iloc[:,1]):
            rows.append({"domain":domain,"skill":skill,"forecast_month":month,"predicted_rate":float(value),"lower_bound":float(max(0,lower)),"upper_bound":float(min(1,upper)),"trend":trend,"model_name":"ARIMA","training_start":series.index.min(),"training_end":series.index.max()})
    result=pd.DataFrame(rows);output.parent.mkdir(parents=True,exist_ok=True);result.to_csv(output,index=False)
    return result


if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("source",type=Path);p.add_argument("--output",type=Path,default=Path("data/processed/skill_forecasts.csv"));p.add_argument("--horizon",type=int,default=6)
    a=p.parse_args();r=train(a.source,a.output,a.horizon);print(f"Wrote {len(r)} ARIMA forecast rows to {a.output}")

