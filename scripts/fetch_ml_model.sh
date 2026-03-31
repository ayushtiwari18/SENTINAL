#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────
# fetch_ml_model.sh
# Copies sentinel_v5.pkl from the sentinel-ml repo into the
# detection-engine models/ directory.
#
# Usage:
#   bash scripts/fetch_ml_model.sh
#
# Requirements:
#   - git
#   - write access to services/detection-engine/models/
# ───────────────────────────────────────────────────────────────────────
set -euo pipefail

SENTINEL_ML_REPO="https://github.com/ayushtiwariii/sentinel-ml.git"
MODEL_FILE="models/sentinel_v5.pkl"
DEST="services/detection-engine/models/sentinel_v5.pkl"
TMPDIR="$(mktemp -d)"

echo "[fetch_ml_model] Cloning sentinel-ml (sparse, models/ only)..."
git clone \
  --depth 1 \
  --filter=blob:none \
  --sparse \
  "$SENTINEL_ML_REPO" \
  "$TMPDIR/sentinel-ml"

cd "$TMPDIR/sentinel-ml"
git sparse-checkout set models
cd - > /dev/null

if [ ! -f "$TMPDIR/sentinel-ml/$MODEL_FILE" ]; then
  echo "[fetch_ml_model] ERROR: $MODEL_FILE not found in sentinel-ml repo."
  echo "  The model file may need to be added to the sentinel-ml repo first."
  echo "  Detection engine will run in rule-only fallback mode until the model is placed."
  rm -rf "$TMPDIR"
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp "$TMPDIR/sentinel-ml/$MODEL_FILE" "$DEST"
rm -rf "$TMPDIR"

echo "[fetch_ml_model] sentinel_v5.pkl placed at: $DEST"
echo "[fetch_ml_model] Done. Restart detection-engine to load the model."
