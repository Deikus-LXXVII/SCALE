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

deepseek_count=$( (rg -l '^model = "deepseek-v4-flash"$' "$agents_dir" || true) | wc -l | tr -d ' ')
if [[ "$deepseek_count" -ne 0 ]]; then
  echo "DeepSeek API model must not appear in Codex profiles; found $deepseek_count." >&2
  exit 1
fi

if ! rg -q '^model = "gpt-5.6-luna"$' "$agents_dir/scale_orchestrator.toml" || ! rg -q '^model_reasoning_effort = "high"$' "$agents_dir/scale_orchestrator.toml"; then
  echo "scale_orchestrator Codex card must use its native Luna/high fallback." >&2
  exit 1
fi
if ! rg -q 'delegation-first execution firewall is mandatory' "$agents_dir/scale_orchestrator.toml"; then
  echo "scale_orchestrator must enforce the delegation-first execution firewall." >&2
  exit 1
fi
if ! rg -q '^model = "gpt-5.3-codex-spark"$' "$agents_dir/scale_code_simple.toml" || ! rg -q '^model_reasoning_effort = "medium"$' "$agents_dir/scale_code_simple.toml" || ! rg -q '^sandbox_mode = "workspace-write"$' "$agents_dir/scale_code_simple.toml"; then
  echo "scale_code_simple Codex card must use its native Spark/medium/workspace-write fallback." >&2
  exit 1
fi
if ! rg -q '^model = "gpt-5.3-codex-spark"$' "$agents_dir/scale_test_observer.toml" || ! rg -q '^model_reasoning_effort = "low"$' "$agents_dir/scale_test_observer.toml" || ! rg -q '^sandbox_mode = "read-only"$' "$agents_dir/scale_test_observer.toml"; then
  echo "scale_test_observer Codex card must use its native Spark/low/read-only fallback." >&2
  exit 1
fi

node "$root/scripts/validate-scale-model-registry.mjs"
bash "$root/scripts/validate-scale-opencode-agents.sh"

for profile in scale_cleaner scale_environment scale_indexer scale_library; do
  if ! rg -q '^sandbox_mode = "read-only"$' "$agents_dir/$profile.toml"; then
    echo "Evidence-only native fallback profile must be read-only: $agents_dir/$profile.toml" >&2
    exit 1
  fi
done

echo "Validated $actual Codex custom-agent profiles (no DeepSeek API models)."
