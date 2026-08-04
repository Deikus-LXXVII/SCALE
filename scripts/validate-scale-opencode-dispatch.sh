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
ln -s "$root/opencode/agents/scale-go-code-standard.md" "$target/.opencode/agents/scale-go-code-standard.md"
ln -s "$root/opencode/agents/scale-go-monitor.md" "$target/.opencode/agents/scale-go-monitor.md"
printf '%s\n' 'Return a compact documentation handoff. Do not edit files.' > "$workspace/work-order.md"
printf '%s\n' 'Only this bounded context file is relevant.' > "$target/context.md"
awk 'BEGIN { for (i = 0; i < 32001; i++) printf "x" }' > "$workspace/oversized-work-order.md"
awk 'BEGIN { for (i = 0; i < 21001; i++) printf "x" }' > "$workspace/profile-budget-work-order.md"
printf '%s\n' '{"issuer":"scale_orchestrator","reason":"multi_step_plan","estimate":{"estimated_steps":20},"requested":{"max_dispatch_ms":1200000}}' > "$workspace/budget-adjust.json"
printf '%s\n' '{"issuer":"scale_orchestrator","reason":"long_monitoring","estimate":{"estimated_minutes":20,"estimated_steps":24},"requested":{"max_agent_steps":24}}' > "$workspace/monitor-budget-adjust.json"
printf '%s\n' '{"issuer":"scale_orchestrator","reason":"multi_step_plan","estimate":{"estimated_steps":20},"requested":{"max_dispatch_ms":1800000}}' > "$workspace/oversized-budget-adjust.json"

cat > "$fake_bin/opencode" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == "models" ]]; then
  printf '%s\n' 'opencode-go/deepseek-v4-flash' 'opencode-go/deepseek-v4-pro'
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

set +e
profile_budget="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order "$workspace/profile-budget-work-order.md" --task-id profile-budget-fixture 2>&1)"
profile_budget_status=$?
set -e
[[ "$profile_budget_status" -eq 2 ]]
[[ "$profile_budget" == *'"max_work_order_bytes":20000'* ]]

set +e
oversized_adjustment="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order "$workspace/work-order.md" --budget-adjust "$workspace/oversized-budget-adjust.json" --task-id oversized-adjustment-fixture 2>&1)"
oversized_adjustment_status=$?
set -e
[[ "$oversized_adjustment_status" -eq 2 ]]
[[ "$oversized_adjustment" == *'budget-adjustment-increase-too-large'* ]]

set +e
adjusted="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_code_standard --specialist go-standard-code --work-order "$workspace/work-order.md" --budget-adjust "$workspace/budget-adjust.json" --task-id adjusted-fixture 2>&1)"
adjusted_status=$?
set -e
[[ "$adjusted_status" -eq 75 ]]
[[ "$adjusted" == *'"status":"fallback-required"'* ]]
rg -q '"event":"budget_adjusted"' "$telemetry"
rg -q '"task_id":"adjusted-fixture"' "$telemetry"

set +e
monitor_adjusted="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_test_observer --work-order "$workspace/work-order.md" --budget-adjust "$workspace/monitor-budget-adjust.json" --task-id monitor-adjusted-fixture 2>&1)"
monitor_adjusted_status=$?
set -e
[[ "$monitor_adjusted_status" -eq 75 ]]
[[ "$monitor_adjusted" == *'"status":"fallback-required"'* ]]
rg -q '"task_id":"monitor-adjusted-fixture".*"max_agent_steps":24' "$telemetry"
report_after="$(node "$root/scripts/scale-telemetry-report.mjs" --input "$telemetry" --json)"
[[ "$report_after" == *'"budget_adjusted": 2'* ]]

printf '%s\n' 'Validated S.C.A.L.E. OpenCode Go quota fallback handoff.'
