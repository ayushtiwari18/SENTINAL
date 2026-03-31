# sentinel_v5.pkl — ML Model Placement Guide

This directory holds the trained XGBoost classifier used by the detection engine.

## Required file

```
services/detection-engine/models/sentinel_v5.pkl
```

The `.pkl` file is **not committed to git** (binary ML artifact — see root `.gitignore`).

---

## How to obtain the model

### Option A — From sentinel-ml repo (manual)

```bash
# Clone the sentinel-ml repo
git clone https://github.com/ayushtiwariii/sentinel-ml.git /tmp/sentinel-ml

# Copy the model into place
cp /tmp/sentinel-ml/models/sentinel_v5.pkl \
   services/detection-engine/models/sentinel_v5.pkl
```

### Option B — Automated setup script (recommended)

A helper script is provided at the repo root:

```bash
bash scripts/fetch_ml_model.sh
```

---

## Fallback behaviour

If `sentinel_v5.pkl` is **absent**, the detection engine starts normally and logs:

```
WARNING [CLASSIFIER] sentinel_v5.pkl not found — running in rule-only mode
```

All 11 regex rules (R001–R011) continue to operate. The `scored_by` field in
responses will show `"rule_engine"` instead of `"hybrid"` or `"ml_model"`.

---

## Feature vector contract

The model was trained on an **8-feature vector** in this exact order:

| # | Feature | Description |
|---|---------|-------------|
| 0 | `url_length` | Total character count |
| 1 | `special_char_count` | Non-alphanumeric characters |
| 2 | `digit_count` | Total digit characters |
| 3 | `entropy` | Shannon entropy of full URL |
| 4 | `percent_count` | `%` occurrences (URL encoding) |
| 5 | `ampersand_count` | `&` occurrences (param separators) |
| 6 | `slash_count` | `/` occurrences |
| 7 | `uppercase_ratio` | Uppercase / total alpha (0.0–1.0) |

⚠️ **Do not reorder these features.** Reordering silently corrupts all predictions.

If you retrain the model, update `_extract_ml_features()` in `app/classifier.py` to match.
