#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="$(mktemp -d "${TMPDIR:-/tmp}/scale-opencode-dispatch.XXXXXX")"
fake_bin="$workspace/bin"
target="$workspace/target"

cleanup() {
  rm -rf "$workspace"
}
trap cleanup EXIT

mkdir -p "$fake_bin" "$target/.opencode/agents"
ln -s "$root/opencode/agents/scale-go-routine.md" "$target/.opencode/agents/scale-go-routine.md"
printf '%s\n' 'Return a compact documentation handoff. Do not edit files.' > "$workspace/work-order.md"
printf '%s\n' 'Only this bounded context file is relevant.' > "$target/context.md"
awk 'BEGIN { for (i = 0; i < 32001; i++) printf "x" }' > "$workspace/oversized-work-order.md"

cat > "$fake_bin/opencode" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == "models" ]]; then
  printf '%s\n' 'opencode-go/deepseek-v4-flash'
  exit 0
fi
printf '%s\n' 'OpenCode Go usage limit reached' >&2
exit 1
EOF
chmod +x "$fake_bin/opencode"

set +e
output="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order "$workspace/work-order.md" --context-file context.md --task-id dispatch-fixture 2>&1)"
status=$?
set -e

[[ "$status" -eq 75 ]]
[[ "$output" == *'"status":"fallback-required"'* ]]
[[ "$output" == *'"reason":"opencode-go-limit"'* ]]
[[ "$output" == *'"profile":"scale_docs"'* ]]
[[ "$output" == *'"model":"gpt-5.6-luna"'* ]]

telemetry="$target/.codex/scale-telemetry.jsonl"
[[ -s "$telemetry" ]]
report="$(node "$root/scripts/scale-telemetry-report.mjs" --input "$telemetry" --json)"
[[ "$report" == *'"tasks": 1'* ]]
[[ "$report" == *'"fallback_rate": 1'* ]]

set +e
repeat="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order "$workspace/work-order.md" --task-id dispatch-fixture 2>&1)"
repeat_status=$?
set -e
[[ "$repeat_status" -eq 78 ]]
[[ "$repeat" == *'escalation-budget-exhausted'* ]]

set +e
oversized="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order "$workspace/oversized-work-order.md" --task-id oversized-fixture 2>&1)"
oversized_status=$?
set -e
[[ "$oversized_status" -eq 2 ]]
[[ "$oversized" == *'work-order-budget-exceeded'* ]]

printf '%s\n' 'Validated S.C.A.L.E. OpenCode Go quota fallback handoff.'
