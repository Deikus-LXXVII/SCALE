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
  for key in name description model model_reasoning_effort sandbox_mode developer_instructions; do
    if ! rg -q "^${key} =" "$profile"; then
      echo "Missing $key in $profile" >&2
      exit 1
    fi
  done
done

deepseek_count=$(rg -l '^model = "deepseek-v4-flash"$' "$agents_dir" | wc -l | tr -d ' ')
if [[ "$deepseek_count" -lt 6 ]]; then
  echo "Expected at least six DeepSeek V4 Flash agents including the simple-code lane; found $deepseek_count." >&2
  exit 1
fi

while IFS= read -r profile; do
  profile_name="$(basename "$profile" .toml)"
  if [[ "$profile_name" == "scale_test_observer" ]]; then
    if ! rg -q '^model_reasoning_effort = "medium"$' "$profile" || ! rg -q '^sandbox_mode = "read-only"$' "$profile"; then
      echo "scale_test_observer must use DeepSeek V4 Flash/medium/read-only: $profile" >&2
      exit 1
    fi
  elif ! rg -q '^model_reasoning_effort = "high"$' "$profile"; then
    echo "DeepSeek V4 Flash profile must use high reasoning: $profile" >&2
    exit 1
  fi
done < <(rg -l '^model = "deepseek-v4-flash"$' "$agents_dir")

node "$root/scripts/validate-scale-model-registry.mjs"

for profile in scale_cleaner scale_environment scale_indexer scale_library; do
  if ! rg -q '^sandbox_mode = "read-only"$' "$agents_dir/$profile.toml"; then
    echo "Evidence-only DeepSeek profile must be read-only: $agents_dir/$profile.toml" >&2
    exit 1
  fi
done

echo "Validated $actual Codex custom-agent profiles ($deepseek_count DeepSeek V4 Flash)."
