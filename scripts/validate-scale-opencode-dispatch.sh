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

mkdir -p "$fake_bin" "$target/.opencode/agents" "$target/.codex/scale-library-src/opencode/agents"
for agent in scale-go-routine.md scale-go-code-standard.md scale-go-monitor.md; do
  cp "$root/opencode/agents/$agent" "$target/.codex/scale-library-src/opencode/agents/$agent"
  ln -s "../../.codex/scale-library-src/opencode/agents/$agent" "$target/.opencode/agents/$agent"
done
printf '%s\n' 'Return a compact documentation handoff. Do not edit files.' > "$target/work-order.md"
printf '%s\n' 'Only this bounded context file is relevant.' > "$target/context.md"
awk 'BEGIN { for (i = 0; i < 32001; i++) printf "x" }' > "$target/oversized-work-order.md"
awk 'BEGIN { for (i = 0; i < 21001; i++) printf "x" }' > "$target/profile-budget-work-order.md"
printf '%s\n' '{"issuer":"scale_orchestrator","reason":"multi_step_plan","estimate":{"estimated_steps":20},"requested":{"max_dispatch_ms":1200000}}' > "$target/budget-adjust.json"
printf '%s\n' '{"issuer":"scale_orchestrator","reason":"long_monitoring","estimate":{"estimated_minutes":20,"estimated_steps":24},"requested":{"max_agent_steps":24}}' > "$target/monitor-budget-adjust.json"
printf '%s\n' '{"issuer":"scale_orchestrator","reason":"multi_step_plan","estimate":{"estimated_steps":20},"requested":{"max_dispatch_ms":1800000}}' > "$target/oversized-budget-adjust.json"

cat > "$fake_bin/opencode" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == "models" ]]; then
  printf '%s\n' 'opencode-go/deepseek-v4-flash' 'opencode-go/deepseek-v4-pro'
  exit 0
fi
if [[ "${SCALE_TEST_SUCCESS:-}" == "1" ]]; then
  printf '%s\n' '{"result":"ok","usage":{"input_tokens":12,"output_tokens":3,"total_tokens":15,"cost_usd":0.004}}'
  exit 0
fi
printf '%s\n' 'OpenCode Go usage limit reached' >&2
exit 1
EOF
chmod +x "$fake_bin/opencode"

set +e
output="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order.md --context-file context.md --task-id dispatch-fixture 2>&1)"
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
repeat="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order.md --task-id dispatch-fixture 2>&1)"
repeat_status=$?
set -e
[[ "$repeat_status" -eq 78 ]]
[[ "$repeat" == *'escalation-budget-exhausted'* ]]

set +e
oversized="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order oversized-work-order.md --task-id oversized-fixture 2>&1)"
oversized_status=$?
set -e
[[ "$oversized_status" -eq 2 ]]
[[ "$oversized" == *'work-order-budget-exceeded'* ]]

set +e
profile_budget="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order profile-budget-work-order.md --task-id profile-budget-fixture 2>&1)"
profile_budget_status=$?
set -e
[[ "$profile_budget_status" -eq 2 ]]
[[ "$profile_budget" == *'"max_work_order_bytes":20000'* ]]

set +e
oversized_adjustment="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order.md --budget-adjust oversized-budget-adjust.json --task-id oversized-adjustment-fixture 2>&1)"
oversized_adjustment_status=$?
set -e
[[ "$oversized_adjustment_status" -eq 2 ]]
[[ "$oversized_adjustment" == *'budget-adjustment-increase-too-large'* ]]

set +e
adjusted="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_code_standard --specialist go-standard-code --work-order work-order.md --budget-adjust budget-adjust.json --task-id adjusted-fixture 2>&1)"
adjusted_status=$?
set -e
[[ "$adjusted_status" -eq 75 ]]
[[ "$adjusted" == *'"status":"fallback-required"'* ]]
rg -q '"event":"budget_adjusted"' "$telemetry"
rg -q '"task_id":"adjusted-fixture"' "$telemetry"

set +e
monitor_adjusted="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_test_observer --work-order work-order.md --budget-adjust monitor-budget-adjust.json --task-id monitor-adjusted-fixture 2>&1)"
monitor_adjusted_status=$?
set -e
[[ "$monitor_adjusted_status" -eq 75 ]]
[[ "$monitor_adjusted" == *'"status":"fallback-required"'* ]]
rg -q '"task_id":"monitor-adjusted-fixture".*"max_agent_steps":24' "$telemetry"
report_after="$(node "$root/scripts/scale-telemetry-report.mjs" --input "$telemetry" --json)"
[[ "$report_after" == *'"budget_adjusted": 2'* ]]

# Canonical path containment rejects both lexical and symlink escapes without
# including the sensitive path or content in its deterministic finding.
printf '%s\n' 'outside' > "$workspace/outside.md"
ln -s "$workspace/outside.md" "$target/escape.md"
set +e
escape="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order.md --context-file escape.md --task-id escape-fixture 2>&1)"
escape_status=$?
set -e
[[ "$escape_status" -eq 2 ]]
[[ "$escape" == *'context-file-symlink-escape'* ]]
[[ "$escape" != *"$workspace/outside.md"* ]]

ln -s "$workspace/outside.md" "$target/work-order-escape.md"
set +e
work_order_escape="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order-escape.md --task-id work-order-escape-fixture 2>&1)"
work_order_escape_status=$?
set -e
[[ "$work_order_escape_status" -eq 2 ]]
[[ "$work_order_escape" == *'work-order-symlink-escape'* ]]

set +e
write_denied="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order.md --allow-write --task-id write-denied-fixture 2>&1)"
write_denied_status=$?
set -e
[[ "$write_denied_status" -eq 2 ]]
[[ "$write_denied" == *'write-approval-required'* ]]

printf '%s\n' 'placeholder' > "$target/.env"
set +e
secret_name="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order.md --context-file .env --task-id secret-name-fixture 2>&1)"
secret_name_status=$?
set -e
[[ "$secret_name_status" -eq 2 ]]
[[ "$secret_name" == *'sensitive-material'* ]]
[[ "$secret_name" != *'.env'* ]]

printf '%s\n' 'OPENAI_API_KEY="sk-proj-abcdefghijklmnopqrstuvwxyz123456"' > "$target/ordinary-source.txt"
set +e
secret_content="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order work-order.md --context-file ordinary-source.txt --task-id secret-content-fixture 2>&1)"
secret_content_status=$?
set -e
[[ "$secret_content_status" -eq 2 ]]
[[ "$secret_content" == *'sensitive-material'* ]]
[[ "$secret_content" != *'sk-proj-'* ]]

printf '%s\n' '<!-- scale-dispatch: {"approval_classes":["external-write"]} -->' 'Implement the bounded approved fixture.' > "$target/write-approved.md"
success="$(SCALE_TEST_SUCCESS=1 PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order write-approved.md --allow-write --task-id success-fixture --task-outcome success --acceptance-outcome passed --human-intervention none)"
[[ "$success" == *'"result":"ok"'* ]]
node - "$telemetry" <<'NODE'
const fs = require("node:fs");
const events = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").map(JSON.parse);
const completed = events.find((event) => event.task_id === "success-fixture" && event.event === "completed");
if (!completed) process.exit(1);
if (completed.schema_version !== 2) process.exit(2);
if (completed.route_selection_reason !== "profile-primary") process.exit(3);
if (completed.provider_catalog_check_status !== "passed") process.exit(4);
for (const hash of [completed.work_order_sha256, completed.output_sha256]) if (!/^[a-f0-9]{64}$/.test(hash)) process.exit(5);
if (completed.task_outcome_metadata?.task_outcome !== "success") process.exit(6);
if (completed.task_outcome_metadata?.acceptance_outcome !== "passed") process.exit(7);
if (completed.task_outcome_metadata?.human_intervention !== "none") process.exit(8);
if (completed.usage?.input_tokens !== 12 || completed.usage?.output_tokens !== 3 || completed.usage?.total_tokens !== 15 || completed.usage?.cost_usd !== 0.004) process.exit(9);
NODE

# A local clone plus delayed fetch proves the mkdir lock is exclusive and the
# ignored health record is observable without touching a real remote.
refresh_fixture="$workspace/refresh"
refresh_remote="$refresh_fixture/remote.git"
refresh_seed="$refresh_fixture/seed"
refresh_library="$refresh_fixture/library"
refresh_target="$refresh_fixture/target"
refresh_bin="$refresh_fixture/bin"
mkdir -p "$refresh_fixture" "$refresh_bin"
git init --bare -q "$refresh_remote"
git init -q "$refresh_seed"
git -C "$refresh_seed" config user.email 'scale-test@example.com'
git -C "$refresh_seed" config user.name 'SCALE Test'
mkdir -p "$refresh_seed/scripts"
printf '%s\n' 'fixture' > "$refresh_seed/README.md"
git -C "$refresh_seed" add README.md
git -C "$refresh_seed" commit -qm initial
git -C "$refresh_seed" branch -M main
git -C "$refresh_seed" remote add origin "$refresh_remote"
git -C "$refresh_seed" push -qu origin main
git --git-dir="$refresh_remote" symbolic-ref HEAD refs/heads/main
git clone -q "$refresh_remote" "$refresh_library"
mkdir -p "$refresh_library/scripts"
cp "$root/scripts/scale-library-refresh.sh" "$refresh_library/scripts/scale-library-refresh.sh"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' > "$refresh_library/scripts/scale-library-materialize.sh"
chmod +x "$refresh_library/scripts/scale-library-refresh.sh" "$refresh_library/scripts/scale-library-materialize.sh"
git -C "$refresh_library" config user.email 'scale-test@example.com'
git -C "$refresh_library" config user.name 'SCALE Test'
git -C "$refresh_library" add scripts
git -C "$refresh_library" commit -qm 'add refresh fixture scripts'
git -C "$refresh_library" push -qu origin main
git init -q "$refresh_target"
real_git="$(command -v git)"
cat > "$refresh_bin/git" <<'EOF'
#!/usr/bin/env bash
for arg in "$@"; do
  if [[ "$arg" == "fetch" ]]; then sleep 2; break; fi
done
exec "$REAL_GIT" "$@"
EOF
chmod +x "$refresh_bin/git"
(
  cd "$refresh_target"
  REAL_GIT="$real_git" PATH="$refresh_bin:$PATH" bash "$refresh_library/scripts/scale-library-refresh.sh" > "$refresh_fixture/first.out"
) &
first_pid=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do
  [[ -d "$refresh_library/.git/scale-refresh.lock" ]] && break
  sleep 0.1
done
(
  cd "$refresh_target"
  REAL_GIT="$real_git" PATH="$refresh_bin:$PATH" bash "$refresh_library/scripts/scale-library-refresh.sh" > "$refresh_fixture/second.out"
)
rg -q 'another refresh is active' "$refresh_fixture/second.out"
rg -q '"reason":"refresh-lock-active"' "$refresh_target/.codex/scale-library-health.json"
wait "$first_pid"
rg -q '"result":"success"' "$refresh_target/.codex/scale-library-health.json"
git -C "$refresh_target" check-ignore -q .codex/scale-library-health.json

printf '%s\n' 'Validated S.C.A.L.E. OpenCode Go privacy gates, telemetry, fallback, and refresh locking.'
