#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agents_dir="$root/.codex/agents"
minimum=16
actual=$(find "$agents_dir" -maxdepth 1 -name '*.toml' -type f | wc -l | tr -d ' ')

if [[ "$actual" -lt "$minimum" ]]; then
  echo "Expected at least $minimum custom-agent profiles; found $actual." >&2
  exit 1
fi

for profile in "$agents_dir"/*.toml; do
  for key in name description model model_reasoning_effort developer_instructions; do
    if ! rg -q "^${key} =" "$profile"; then
      echo "Missing $key in $profile" >&2
      exit 1
    fi
  done
done

deepseek_count=$(rg -l '^model = "deepseek-v4-flash"$' "$agents_dir" | wc -l | tr -d ' ')
if [[ "$deepseek_count" -lt 5 ]]; then
  echo "Expected at least five DeepSeek V4 Flash routine agents; found $deepseek_count." >&2
  exit 1
fi

while IFS= read -r profile; do
  if ! rg -q '^model_reasoning_effort = "medium"$' "$profile"; then
    echo "DeepSeek V4 Flash profile must use medium reasoning: $profile" >&2
    exit 1
  fi
done < <(rg -l '^model = "deepseek-v4-flash"$' "$agents_dir")

echo "Validated $actual Codex custom-agent profiles ($deepseek_count DeepSeek V4 Flash)."
