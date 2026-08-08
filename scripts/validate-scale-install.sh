#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="$(mktemp -d "${TMPDIR:-/tmp}/scale-install.XXXXXX")"
source_repo="$workspace/source"
target_repo="$workspace/target"

cleanup() {
  rm -rf "$workspace"
}
trap cleanup EXIT

mkdir -p "$source_repo" "$target_repo"
tar -C "$root" --exclude='.git' -cf - . | tar -C "$source_repo" -xf -
git -C "$source_repo" init --quiet
git -C "$source_repo" config user.email 'scale-test@example.invalid'
git -C "$source_repo" config user.name 'SCALE install test'
git -C "$source_repo" add .
git -C "$source_repo" commit --quiet -m 'fixture: SCALE library'
git -C "$source_repo" branch -M main
git -C "$source_repo" remote add origin "$source_repo"

git -C "$target_repo" init --quiet
git -C "$target_repo" config user.email 'scale-test@example.invalid'
git -C "$target_repo" config user.name 'SCALE install test'
touch "$target_repo/.keep"
git -C "$target_repo" add .keep
git -C "$target_repo" commit --quiet -m 'fixture: target project'

mkdir -p "$target_repo/.codex/agents"
printf '%s\n' 'name = "scale_docs"' > "$target_repo/.codex/agents/scale_docs.toml"
printf '%s\n' '{"description":"project-owned hooks","hooks":{}}' > "$target_repo/.codex/hooks.json"

bash "$root/scripts/scale-library-install.sh" --target "$target_repo" --remote "$source_repo" >/dev/null

rg -qF 'if pwd -W >/dev/null 2>&1; then' "$root/scripts/scale-library-install.sh"
rg -qF 'target_root="$(portable_path "$target_input")"' "$root/scripts/scale-library-install.sh"
rg -qF 'if pwd -W >/dev/null 2>&1; then' "$root/scripts/scale-library-materialize.sh"
rg -qF 'target_root="$(portable_path "$target_input")"' "$root/scripts/scale-library-materialize.sh"
rg -qF 'source_windows="$(cygpath -w "$source")"' "$root/scripts/scale-library-materialize.sh"
rg -qF 'MSYS_NO_PATHCONV=1 cmd.exe /c mklink /D' "$root/scripts/scale-library-materialize.sh"
rg -qF 'MSYS_NO_PATHCONV=1 cmd.exe /c mklink "$destination_windows" "$source_windows"' "$root/scripts/scale-library-materialize.sh"
rg -qF 'ln -sfn "$relative_target" "$destination"' "$root/scripts/scale-library-materialize.sh"
rg -qF 'verify_link "$destination"' "$root/scripts/scale-library-materialize.sh"
[[ -L "$target_repo/.codex/agents/scale_architect.toml" ]]
[[ ! -L "$target_repo/.codex/agents/scale_docs.toml" ]]
[[ -L "$target_repo/.agents/skills/scale-orchestrator" ]]
[[ -f "$target_repo/.agents/skills/scale-orchestrator/SKILL.md" ]]
[[ -L "$target_repo/.opencode/agents/scale-go-explorer.md" ]]
[[ -L "$target_repo/.opencode/agents/scale-go-monitor.md" ]]
rg -q 'project-owned hooks' "$target_repo/.codex/hooks.json"

MSYS_NO_PATHCONV=1 git -C "$target_repo/.codex/scale-library-src" sparse-checkout set --no-cone '/.codex/agents/' '/library/' '/skills/' '/scripts/' '/AGENTS.md'
rg -q 'MSYS_NO_PATHCONV=1 git -C "\$clone_root" sparse-checkout set.*integrations/' "$root/scripts/scale-library-install.sh"
rm "$target_repo/.opencode/agents/scale-go-explorer.md"
(cd "$target_repo" && bash "$target_repo/.codex/scale-library-src/scripts/scale-library-refresh.sh" --hook >/dev/null)
[[ -L "$target_repo/.opencode/agents/scale-go-explorer.md" ]]

mkdir -p "$source_repo/skills/scale-fixture"
cat > "$source_repo/skills/scale-fixture/SKILL.md" <<'EOF'
---
name: scale-fixture
description: Install-test fixture skill.
---

# Fixture
EOF
git -C "$source_repo" add skills/scale-fixture/SKILL.md
git -C "$source_repo" commit --quiet -m 'fixture: add dynamic SCALE skill'

(cd "$target_repo" && bash "$target_repo/.codex/scale-library-src/scripts/scale-library-refresh.sh" --hook >/dev/null)
[[ -f "$target_repo/.agents/skills/scale-fixture/SKILL.md" ]]
rg -q '"result":"success"' "$target_repo/.codex/scale-library-health.json"

cat > "$source_repo/opencode/agents/scale-go-fixture.md" <<'EOF'
---
description: Install-test OpenCode fixture.
mode: primary
model: opencode-go/deepseek-v4-flash
reasoningEffort: high
steps: 1
permission:
  edit: deny
---
Fixture.
EOF
git -C "$source_repo" add opencode/agents/scale-go-fixture.md
git -C "$source_repo" commit --quiet -m 'fixture: add managed OpenCode agent'
(cd "$target_repo" && bash "$target_repo/.codex/scale-library-src/scripts/scale-library-refresh.sh" --hook >/dev/null)
[[ -L "$target_repo/.opencode/agents/scale-go-fixture.md" ]]

rm "$source_repo/opencode/agents/scale-go-fixture.md"
git -C "$source_repo" add -u opencode/agents/scale-go-fixture.md
git -C "$source_repo" commit --quiet -m 'fixture: retire managed OpenCode agent'
(cd "$target_repo" && bash "$target_repo/.codex/scale-library-src/scripts/scale-library-refresh.sh" --hook >/dev/null)
[[ ! -e "$target_repo/.opencode/agents/scale-go-fixture.md" ]]

cat > "$source_repo/.codex/agents/scale_unavailable_fixture.toml" <<'EOF'
name = "scale_unavailable_fixture"
description = "Install-test incompatible model fixture."
model = "unavailable-test-model"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = "Return a fixture result."
EOF
git -C "$source_repo" add .codex/agents/scale_unavailable_fixture.toml
git -C "$source_repo" commit --quiet -m 'fixture: add incompatible model profile'

refresh_output="$(cd "$target_repo" && bash "$target_repo/.codex/scale-library-src/scripts/scale-library-refresh.sh" --hook 2>&1)"
[[ "$refresh_output" == *"incoming model policy is unavailable locally"* ]]
[[ ! -e "$target_repo/.codex/agents/scale_unavailable_fixture.toml" ]]
[[ "$(git -C "$target_repo/.codex/scale-library-src" rev-parse HEAD)" != "$(git -C "$source_repo" rev-parse HEAD)" ]]

global_target="$workspace/global-target"
mkdir -p "$global_target"
git -C "$global_target" init --quiet
git -C "$global_target" config user.email 'scale-test@example.invalid'
git -C "$global_target" config user.name 'SCALE install test'
touch "$global_target/.keep"
git -C "$global_target" add .keep
git -C "$global_target" commit --quiet -m 'fixture: global target'

(cd "$global_target" && \
  PLUGIN_ROOT="$source_repo" \
  SCALE_REMOTE_URL="$source_repo" \
  SCALE_BRANCH=main \
  bash "$source_repo/scripts/scale-plugin-session-start.sh" >/dev/null)
[[ -d "$global_target/.codex/scale-library-src/.git" ]]
[[ -L "$global_target/.codex/agents/scale_architect.toml" ]]
[[ ! -e "$global_target/.codex/hooks.json" ]]
[[ ! -e "$global_target/.gitignore" ]]
rg -qxF '.codex/scale-library-src/' "$global_target/.git/info/exclude"
rg -qxF '.codex/scale-telemetry.jsonl' "$global_target/.git/info/exclude"
rg -qxF '.opencode/agents/scale-go-*' "$global_target/.git/info/exclude"

canonical_output="$(cd "$source_repo" && SCALE_REMOTE_URL="$source_repo" bash "$source_repo/scripts/scale-plugin-session-start.sh")"
[[ "$canonical_output" == *'canonical library checkout active; self-clone skipped.'* ]]
[[ ! -e "$source_repo/.codex/scale-library-src" ]]

printf '%s\n' 'Validated S.C.A.L.E. install, local-path preservation, hooks preservation, and dynamic profile/skill materialization.'
