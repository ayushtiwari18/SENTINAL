"""
SENTINAL Detection Engine — Classifier

Upgraded from hand-written heuristic to a hybrid ML + rule scorer.

Integration source: github.com/ayushtiwariii/sentinel-ml
  - ML model:    models/sentinel_v5.pkl  (XGBoost/sklearn)
  - Feature fn:  8-vector matching sentinel_v5 training schema
  - Hybrid mode: ML probability (40%) blended with rule score (60%)
  - Fallback:    original heuristic if model file is missing

Callers: app/main.py → score_request(request_data, rule_match, url)
Signature change: added optional `url` parameter (backward-compatible).
"""

import os
import math
import logging
from pathlib import Path
from collections import Counter
from typing import Optional

logger = logging.getLogger("detection-engine")

# ── Model path ────────────────────────────────────────────────────────────────
# services/detection-engine/app/classifier.py  →  parents[1] = detection-engine/
_MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "sentinel_v5.pkl"
_model = None


def _load_model():
    """Attempt to load the sentinel_v5.pkl model once at startup."""
    global _model
    if not _MODEL_PATH.exists():
        logger.warning(
            f"[CLASSIFIER] sentinel_v5.pkl not found at {_MODEL_PATH}. "
            "Running in rule-only mode. "
            "Place the model file there to enable ML inference."
        )
        return
    try:
        import joblib
        _model = joblib.load(_MODEL_PATH)
        logger.info(f"[CLASSIFIER] ML model loaded successfully from {_MODEL_PATH}")
    except Exception as exc:
        logger.warning(
            f"[CLASSIFIER] Failed to load model: {exc} — "
            "falling back to rule-only heuristic."
        )


_load_model()


# ── Feature extraction ────────────────────────────────────────────────────────
def _shannon_entropy(s: str) -> float:
    """Shannon entropy of a string — matches sentinel_v5 training pipeline."""
    if not s:
        return 0.0
    probs = [v / len(s) for v in Counter(s).values()]
    return -sum(p * math.log2(p) for p in probs)


def _extract_ml_features(url: str) -> list:
    """
    Extract the 8-feature vector that sentinel_v5.pkl was trained on.

    Feature index mapping (must NOT be reordered — breaks model):
      0  url_length         total character count
      1  special_char_count non-alphanumeric character count
      2  digit_count        total digit characters
      3  entropy            Shannon entropy of the full URL
      4  percent_count      number of '%' (URL encoding indicator)
      5  ampersand_count    number of '&' (param separator)
      6  slash_count        number of '/'
      7  uppercase_ratio    uppercase / total alpha  (0.0 – 1.0)
    """
    url = url or ""
    alpha_count = sum(1 for c in url if c.isalpha()) or 1  # avoid div-by-zero
    return [
        len(url),
        sum(1 for c in url if not c.isalnum()),
        sum(1 for c in url if c.isdigit()),
        _shannon_entropy(url),
        url.count("%"),
        url.count("&"),
        url.count("/"),
        sum(1 for c in url if c.isupper()) / alpha_count,
    ]


# ── Scoring ───────────────────────────────────────────────────────────────────
def _severity_from_confidence(confidence: float) -> str:
    if confidence >= 0.9:
        return "critical"
    elif confidence >= 0.8:
        return "high"
    elif confidence >= 0.7:
        return "medium"
    else:
        return "low"


def score_request(
    request_data: dict,
    rule_match: Optional[dict],
    url: str = "",
) -> dict:
    """
    Score an HTTP request for maliciousness.

    Args:
        request_data: dict with keys 'method' and 'body' (from AnalyzeRequest)
        rule_match:   result of run_rules() — dict or None
        url:          raw URL string for ML feature extraction

    Returns:
        dict with keys: confidence (float), severity (str), scored_by (str)
            scored_by values:
                'ml_model'    — ML-only path (no rule match, ML above threshold)
                'hybrid'      — rule match AND ML model both contributed
                'rule_engine' — rule match only, no ML model available
    """

    # ── 1. ML inference ───────────────────────────────────────────────────────
    ml_prob: Optional[float] = None
    if _model is not None and url:
        try:
            features = _extract_ml_features(url)
            ml_prob = float(_model.predict_proba([features])[0][1])
            logger.debug(f"[CLASSIFIER] ML probability: {ml_prob:.4f} for url={url[:80]}")
        except Exception as exc:
            logger.warning(f"[CLASSIFIER] ML inference failed: {exc} — using rule score only")
            ml_prob = None

    # ── 2. Pure ML path (no rule match) ──────────────────────────────────────
    if rule_match is None:
        if ml_prob is not None and ml_prob > 0.3:
            # ML alone flagged this as suspicious
            severity = _severity_from_confidence(ml_prob)
            return {
                "confidence": round(ml_prob, 4),
                "severity":   severity,
                "scored_by":  "ml_model",
            }
        # Nothing detected
        return {
            "confidence": round(ml_prob or 0.0, 4),
            "severity":   "none",
            "scored_by":  "ml_model" if ml_prob is not None else "rule_engine",
        }

    # ── 3. Rule-based base score (original logic — preserved exactly) ─────────
    base_score = 0.7

    method = request_data.get("method", "").upper()
    if method in ["POST", "PUT", "DELETE", "PATCH"]:
        base_score += 0.1

    body = request_data.get("body", {})
    if body and len(str(body)) > 50:
        base_score += 0.05

    threat_type = rule_match.get("threat_type", "")
    if threat_type in ["SQL Injection", "Command Injection"]:
        base_score += 0.1
    elif threat_type in ["XSS", "Path Traversal"]:
        base_score += 0.05

    rule_score = min(base_score, 1.0)

    # ── 4. Hybrid blend ───────────────────────────────────────────────────────
    if ml_prob is not None:
        # Blend: rule score is primary anchor, ML refines it
        confidence = round(min((rule_score * 0.6) + (ml_prob * 0.4), 1.0), 4)
        scored_by = "hybrid"
    else:
        confidence = round(rule_score, 4)
        scored_by = "rule_engine"

    severity = _severity_from_confidence(confidence)

    return {
        "confidence": confidence,
        "severity":   severity,
        "scored_by":  scored_by,
    }
