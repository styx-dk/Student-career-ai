# Model Evaluation

No metrics are prefilled or fabricated.

- document extraction: label a held-out set and compute field-level exact/normalized accuracy
- JD extraction: label required/preferred skills and compute precision, recall and F1
- matching: compare Strong/Partial/Missing classes with manually reviewed pairs
- forecasting: chronological holdout MAE and RMSE from `evaluate_forecast.py`
- simulation: repeatability, no source-state mutation, score consistency
- planning: gap coverage, target achievement and rejection of zero-benefit actions
- resume: proportion of claims linked to confirmed evidence and unsupported-claim count (target zero)

Store dataset/version, model/provider, prompt/schema version, evaluation date and raw results. Do not report a number until its evaluation artifact exists.

