#!/bin/bash
# Runs npx tsc --noEmit after editing TypeScript files
FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  cd /Users/tmtlxantonio/Desktop/nettgefluester-app
  echo "[hook] TypeScript check on: $FILE"
  npx tsc --noEmit 2>&1 | head -30
fi
