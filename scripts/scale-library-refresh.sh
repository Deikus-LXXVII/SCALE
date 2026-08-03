#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
library_repo="$(cd "$script_dir/.." && pwd)"
session_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || pwd)"

if [[ "$library_repo" == "$session_root" ]]; then
  printf '%s\n' 'S.C.A.L.E.: canonical library checkout active; no automatic pull performed.'
  exit 0
fi

if [[ ! -d "$library_repo/.git" ]]; then
  printf '%s\n' 'S.C.A.L.E.: library clone is unavailable; use scale-library-install.sh to connect one.'
  exit 0
fi

if [[ -n "$(git -C "$library_repo" status --porcelain)" ]]; then
  printf '%s\n' 'S.C.A.L.E.: library clone has local changes; refresh skipped to preserve unpublished knowledge.'
  exit 0
fi

if ! git -C "$library_repo" remote get-url origin >/dev/null 2>&1; then
  printf '%s\n' 'S.C.A.L.E.: library clone has no origin; refresh skipped.'
  exit 0
fi

if ! git -C "$library_repo" fetch --quiet origin; then
  printf '%s\n' 'S.C.A.L.E.: refresh fetch failed; continuing with the last local knowledge snapshot.'
  exit 0
fi

current_revision="$(git -C "$library_repo" rev-parse HEAD)"
remote_revision="$(git -C "$library_repo" rev-parse '@{u}' 2>/dev/null || true)"
if [[ -z "$remote_revision" ]]; then
  printf '%s\n' 'S.C.A.L.E.: refresh has no upstream revision; continuing with the last local knowledge snapshot.'
  exit 0
fi
if [[ "$current_revision" == "$remote_revision" ]]; then
  bash "$library_repo/scripts/scale-library-materialize.sh" --target "$session_root"
  printf 'S.C.A.L.E.: global knowledge is current and materialized at %s.\n' "$(git -C "$library_repo" rev-parse --short HEAD)"
  exit 0
fi

model_paths_changed="$(git -C "$library_repo" diff --name-only "$current_revision" "$remote_revision" -- .codex/agents library/model-registry.json)"
if [[ -n "$model_paths_changed" ]]; then
  audit_root="$(mktemp -d "${TMPDIR:-/tmp}/scale-model-audit.XXXXXX")"
  cleanup_audit() { rm -rf "$audit_root"; }
  trap cleanup_audit EXIT
  if ! git -C "$library_repo" archive "$remote_revision" .codex/agents library/model-registry.json | tar -x -C "$audit_root"; then
    printf '%s\n' 'S.C.A.L.E.: could not prepare the incoming model policy for validation; keeping the current snapshot.'
    exit 0
  fi
  codex_home_dir="${CODEX_HOME:-$HOME/.codex}"
  if ! node "$library_repo/scripts/validate-scale-model-registry.mjs" \
    --registry "$audit_root/library/model-registry.json" \
    --agents-dir "$audit_root/.codex/agents" \
    --catalog "$codex_home_dir/models.json" \
    --config "$codex_home_dir/config.toml"; then
    printf '%s\n' 'S.C.A.L.E.: incoming model policy is unavailable locally; keeping the current snapshot.'
    exit 0
  fi
fi

if git -C "$library_repo" merge --ff-only --quiet "$remote_revision"; then
  bash "$library_repo/scripts/scale-library-materialize.sh" --target "$session_root"
  revision="$(git -C "$library_repo" rev-parse --short HEAD)"
  printf 'S.C.A.L.E.: global knowledge is current and materialized at %s.\n' "$revision"
else
  printf '%s\n' 'S.C.A.L.E.: refresh history diverged; continuing with the last local knowledge snapshot.'
fi
