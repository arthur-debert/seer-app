#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

WASM_DIR="wasm"
STAMP_FILE="$WASM_DIR/.version-stamp"

# --- Local override via SEER_WASM_PATH ---
if [[ -n "${SEER_WASM_PATH:-}" ]]; then
	viewer_src="$SEER_WASM_PATH/seer-viewer-wasm"
	editor_src="$SEER_WASM_PATH/seer-editor-wasm"

	if [[ ! -d "$viewer_src/pkg" || ! -d "$editor_src/pkg" ]]; then
		echo "ERROR: SEER_WASM_PATH=$SEER_WASM_PATH but pkg dirs not found." >&2
		echo "Run wasm-pack build in seer-core first." >&2
		exit 1
	fi

	rm -rf "$WASM_DIR"
	mkdir -p "$WASM_DIR"
	ln -sf "$(cd "$viewer_src" && pwd)" "$WASM_DIR/seer-viewer-wasm"
	ln -sf "$(cd "$editor_src" && pwd)" "$WASM_DIR/seer-editor-wasm"
	echo "local:$SEER_WASM_PATH" > "$STAMP_FILE"
	echo "WASM linked from $SEER_WASM_PATH"
	exit 0
fi

# --- Read config ---
REPO=$(python3 -c "import json,sys; print(json.load(open('wasm.config.json'))['repo'])")
VERSION=$(python3 -c "import json,sys; print(json.load(open('wasm.config.json'))['version'])")

# --- Skip if already fetched ---
if [[ -f "$STAMP_FILE" ]] && [[ "$(cat "$STAMP_FILE")" == "$VERSION" ]]; then
	echo "WASM $VERSION already present, skipping download."
	exit 0
fi

echo "Fetching WASM $VERSION from $REPO..."

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

gh release download "$VERSION" \
	--repo "$REPO" \
	--pattern "seer-wasm.tar.gz" \
	--dir "$TMPDIR"

rm -rf "$WASM_DIR"
mkdir -p "$WASM_DIR"
tar xzf "$TMPDIR/seer-wasm.tar.gz" -C "$WASM_DIR"

echo "$VERSION" > "$STAMP_FILE"
echo "WASM $VERSION installed to $WASM_DIR/"
