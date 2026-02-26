#!/bin/bash
# Runs cargo check after editing Rust files
FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [[ "$FILE" == *.rs ]]; then
  cd /Users/tmtlxantonio/Desktop/nettgefluester-app/src-tauri
  echo "[hook] cargo check on: $FILE"
  cargo check 2>&1 | head -30
fi
