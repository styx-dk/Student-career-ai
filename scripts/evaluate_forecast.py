"""Chronological ARIMA holdout evaluation. Never reports metrics for insufficient series."""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from statsmodels.tsa.arima.model import ARIMA


def evaluate(source: Path, output: Path, test_months: int = 3, min_months: int = 12) -> pd.DataFrame:
    frame=pd.read_csv(source,parse_dates=["month"]);rows=[]
    for (domain,skill),group in frame.groupby(["domain","skill"]):
        series=group.set_index("month")["demand_rate"].sort_index().asfreq("MS",fill_value=0.0)
        if len(series)<max(min_months,test_months+6):continue
        train,test=series.iloc[:-test_months],series.iloc[-test_months:]
        prediction=np.clip(ARIMA(train,order=(1,1,1)).fit().forecast(test_months),0,1)
        rows.append({"domain":domain,"skill":skill,"model":"ARIMA","mae":mean_absolute_error(test,prediction),"rmse":np.sqrt(mean_squared_error(test,prediction)),"training_start":train.index.min(),"training_end":train.index.max(),"test_start":test.index.min(),"test_end":test.index.max(),"actual_values":list(test.astype(float)),"predicted_values":list(prediction.astype(float))})
    result=pd.DataFrame(rows);output.parent.mkdir(parents=True,exist_ok=True);result.to_json(output,orient="records",date_format="iso",indent=2)
    return result


if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("source",type=Path);p.add_argument("--output",type=Path,default=Path("data/processed/forecast_evaluation.json"));p.add_argument("--test-months",type=int,default=3)
    a=p.parse_args();r=evaluate(a.source,a.output,a.test_months);print(f"Evaluated {len(r)} sufficiently long real series; wrote {a.output}")

