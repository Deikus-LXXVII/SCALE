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

# Older managed clones predate the OpenCode adapter and omit this path from
# sparse checkout. Add it without replacing any existing sparse patterns.
if [[ "$(git -C "$library_repo" config --bool core.sparseCheckout 2>/dev/null || true)" == "true" ]]; then
  sparse_paths="$(git -C "$library_repo" sparse-checkout list 2>/dev/null || true)"
  if ! printf '%s\n' "$sparse_paths" | rg -qxF '/opencode/'; then
    if ! git -C "$library_repo" sparse-checkout add '/opencode/'; then
      printf '%s\n' 'S.C.A.L.E.: could not extend sparse checkout for OpenCode agents; continuing with the current managed snapshot.'
      exit 0
    fi
  fi
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

model_paths_changed="$(git -C "$library_repo" diff --name-only "$current_revision" "$remote_revision" -- .codex/agents opencode/agents library/model-registry.json scripts/validate-scale-model-registry.mjs)"
if [[ -n "$model_paths_changed" ]]; then
  audit_root="$(mktemp -d "${TMPDIR:-/tmp}/scale-model-audit.XXXXXX")"
  cleanup_audit() { rm -rf "$audit_root"; }
  trap cleanup_audit EXIT
  # Validate the complete incoming policy with its matching validator.  The
  # current checkout may predate a new registry schema, so using its validator
  # here would make a compatible schema migration impossible to install.
  if ! git -C "$library_repo" archive "$remote_revision" .codex/agents opencode/agents library/model-registry.json scripts/validate-scale-model-registry.mjs | tar -x -C "$audit_root"; then
    printf '%s\n' 'S.C.A.L.E.: could not prepare the incoming model policy for validation; keeping the current snapshot.'
    exit 0
  fi
  codex_home_dir="${CODEX_HOME:-$HOME/.codex}"
  if ! node "$audit_root/scripts/validate-scale-model-registry.mjs" \
    --registry "$audit_root/library/model-registry.json" \
    --agents-dir "$audit_root/.codex/agents" \
    --opencode-agents-dir "$audit_root/opencode/agents" \
    --catalog "$codex_home_dir/models.json" \
    --config "$codex_home_dir/config.toml"; then
    printf '%s\n' 'S.C.A.L.E.: incoming model policy is unavailable locally; keeping the current snapshot.'
    exit 0
  fi
fi

knowledge_paths_changed="$(git -C "$library_repo" diff --name-only "$current_revision" "$remote_revision" -- library/rules library/books library/agents)"
if [[ -n "$knowledge_paths_changed" ]]; then
  knowledge_audit_root="$(mktemp -d "${TMPDIR:-/tmp}/scale-knowledge-audit.XXXXXX")"
  if ! git -C "$library_repo" archive "$remote_revision" library/rules library/books library/agents | tar -x -C "$knowledge_audit_root"; then
    rm -rf "$knowledge_audit_root"
    printf '%s\n' 'S.C.A.L.E.: could not prepare incoming knowledge for validation; keeping the current snapshot.'
    exit 0
  fi
  if ! node "$library_repo/scripts/validate-scale-knowledge.mjs" --library-root "$knowledge_audit_root/library"; then
    rm -rf "$knowledge_audit_root"
    printf '%s\n' 'S.C.A.L.E.: incoming knowledge governance failed; keeping the current snapshot.'
    exit 0
  fi
  rm -rf "$knowledge_audit_root"
fi

if git -C "$library_repo" merge --ff-only --quiet "$remote_revision"; then
  bash "$library_repo/scripts/scale-library-materialize.sh" --target "$session_root"
  revision="$(git -C "$library_repo" rev-parse --short HEAD)"
  printf 'S.C.A.L.E.: global knowledge is current and materialized at %s.\n' "$revision"
else
  printf '%s\n' 'S.C.A.L.E.: refresh history diverged; continuing with the last local knowledge snapshot.'
fi
