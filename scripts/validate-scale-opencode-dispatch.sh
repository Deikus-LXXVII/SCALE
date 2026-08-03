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
output="$(PATH="$fake_bin:$PATH" node "$root/scripts/scale-opencode-dispatch.mjs" --target "$target" --profile scale_docs --work-order "$workspace/work-order.md" 2>&1)"
status=$?
set -e

[[ "$status" -eq 75 ]]
[[ "$output" == *'"status":"fallback-required"'* ]]
[[ "$output" == *'"reason":"opencode-go-limit"'* ]]
[[ "$output" == *'"profile":"scale_docs"'* ]]
[[ "$output" == *'"model":"deepseek-v4-flash"'* ]]

printf '%s\n' 'Validated S.C.A.L.E. OpenCode Go quota fallback handoff.'
