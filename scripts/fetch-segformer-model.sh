#!/usr/bin/env bash
set -euo pipefail

# Download pre-exported SegFormer B0 (ADE20K) ONNX model from HuggingFace.
#
# Source: Xenova/segformer-b0-finetuned-ade-512-512 (optimized for browser/JS usage)
# Skips download if the model already exists (pass --force to re-download).
#
# Usage:
#   bash scripts/fetch-segformer-model.sh [--force]

cd "$(git rev-parse --show-toplevel)"

MODEL_DIR="static/models"
MODEL_PATH="$MODEL_DIR/segformer-b0-ade-512.onnx"
MODEL_URL="https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512/resolve/main/onnx/model.onnx"

if [[ -f "$MODEL_PATH" ]] && [[ "${1:-}" != "--force" ]]; then
  echo "Model already exists at $MODEL_PATH (use --force to re-download)"
  exit 0
fi

mkdir -p "$MODEL_DIR"

echo "=== Downloading SegFormer B0 ONNX model ==="
echo "    From: $MODEL_URL"
echo "    To:   $MODEL_PATH"

curl -L --fail --progress-bar -o "$MODEL_PATH" "$MODEL_URL"

SIZE=$(wc -c < "$MODEL_PATH" | tr -d ' ')
echo "=== Done ($(echo "scale=1; $SIZE / 1000000" | bc) MB) ==="
