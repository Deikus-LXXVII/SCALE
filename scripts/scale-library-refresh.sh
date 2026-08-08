#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
library_repo="$(cd "$script_dir/.." && pwd)"
session_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || pwd)"
attempted_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
health_path="$session_root/.codex/scale-library-health.json"
lock_dir="$library_repo/.git/scale-refresh.lock"
lock_owned=false

revision() {
  git -C "$library_repo" rev-parse --short HEAD 2>/dev/null || printf '%s' 'unavailable'
}

ensure_health_ignored() {
  local exclude_file
  exclude_file="$(git -C "$session_root" rev-parse --path-format=absolute --git-path info/exclude 2>/dev/null || true)"
  [[ -n "$exclude_file" ]] || return 0
  mkdir -p "$(dirname "$exclude_file")"
  touch "$exclude_file"
  rg -qxF '.codex/scale-library-health.json' "$exclude_file" || printf '%s\n' '.codex/scale-library-health.json' >> "$exclude_file"
}

write_health() {
  local result="$1"
  local reason="$2"
  local materialization="$3"
  local health_tmp
  mkdir -p "$(dirname "$health_path")"
  ensure_health_ignored
  health_tmp="$(mktemp "$(dirname "$health_path")/.scale-library-health.XXXXXX")"
  chmod 600 "$health_tmp"
  printf '{"schema_version":1,"revision":"%s","last_attempt":"%s","result":"%s","reason":"%s","materialization_status":"%s"}\n' \
    "$(revision)" "$attempted_at" "$result" "$reason" "$materialization" > "$health_tmp"
  mv "$health_tmp" "$health_path"
}

release_lock() {
  [[ "$lock_owned" == true ]] || return 0
  rm -f "$lock_dir/pid" "$lock_dir/started_epoch"
  rmdir "$lock_dir" 2>/dev/null || true
}
trap release_lock EXIT

if [[ "$library_repo" == "$session_root" ]]; then
  write_health 'skipped' 'canonical-library-active' 'not-requested'
  printf '%s\n' 'S.C.A.L.E.: canonical library checkout active; no automatic pull performed.'
  exit 0
fi

if [[ ! -d "$library_repo/.git" ]]; then
  write_health 'skipped' 'library-clone-unavailable' 'not-requested'
  printf '%s\n' 'S.C.A.L.E.: library clone is unavailable; use scale-library-install.sh to connect one.'
  exit 0
fi

acquire_lock() {
  if mkdir "$lock_dir" 2>/dev/null; then
    printf '%s\n' "$$" > "$lock_dir/pid"
    date '+%s' > "$lock_dir/started_epoch"
    lock_owned=true
    return 0
  fi

  local now started holder age
  now="$(date '+%s')"
  started="$(cat "$lock_dir/started_epoch" 2>/dev/null || true)"
  holder="$(cat "$lock_dir/pid" 2>/dev/null || true)"
  if [[ "$started" =~ ^[0-9]+$ ]]; then age=$((now - started)); else age=0; fi
  if [[ "$age" -gt 300 && "$holder" =~ ^[0-9]+$ ]] && ! kill -0 "$holder" 2>/dev/null; then
    # Recover only the two files this script owns; unexpected lock contents
    # make recovery fail closed rather than deleting an unknown directory.
    rm -f "$lock_dir/pid" "$lock_dir/started_epoch"
    if rmdir "$lock_dir" 2>/dev/null && mkdir "$lock_dir" 2>/dev/null; then
      printf '%s\n' "$$" > "$lock_dir/pid"
      date '+%s' > "$lock_dir/started_epoch"
      lock_owned=true
      return 0
    fi
  fi
  return 1
}

if ! acquire_lock; then
  write_health 'skipped' 'refresh-lock-active' 'preserved'
  printf '%s\n' 'S.C.A.L.E.: another refresh is active; continuing with the last local knowledge snapshot.'
  exit 0
fi

if [[ -n "$(git -C "$library_repo" status --porcelain)" ]]; then
  write_health 'skipped' 'dirty-library-clone' 'preserved'
  printf '%s\n' 'S.C.A.L.E.: library clone has local changes; refresh skipped to preserve unpublished knowledge.'
  exit 0
fi
if ! git -C "$library_repo" remote get-url origin >/dev/null 2>&1; then
  write_health 'skipped' 'origin-unavailable' 'preserved'
  printf '%s\n' 'S.C.A.L.E.: library clone has no origin; refresh skipped.'
  exit 0
fi

if [[ "$(git -C "$library_repo" config --bool core.sparseCheckout 2>/dev/null || true)" == "true" ]]; then
  sparse_paths="$(git -C "$library_repo" sparse-checkout list 2>/dev/null || true)"
  if ! printf '%s\n' "$sparse_paths" | rg -qxF -e 'opencode/' -e '/opencode/'; then
    if ! MSYS_NO_PATHCONV=1 git -C "$library_repo" sparse-checkout add 'opencode/'; then
      write_health 'failed' 'sparse-checkout-extension-failed' 'preserved'
      printf '%s\n' 'S.C.A.L.E.: could not extend sparse checkout for OpenCode agents; continuing with the current managed snapshot.'
      exit 0
    fi
  fi
  if ! printf '%s\n' "$sparse_paths" | rg -qxF -e 'integrations/' -e '/integrations/'; then
    if ! MSYS_NO_PATHCONV=1 git -C "$library_repo" sparse-checkout add 'integrations/'; then
      write_health 'failed' 'sparse-checkout-extension-failed' 'preserved'
      printf '%s\n' 'S.C.A.L.E.: could not extend sparse checkout for integrations; continuing with the current managed snapshot.'
      exit 0
    fi
  fi
fi

if ! git -C "$library_repo" fetch --quiet origin; then
  write_health 'failed' 'network-fetch-failed' 'preserved'
  printf '%s\n' 'S.C.A.L.E.: refresh fetch failed; continuing with the last local knowledge snapshot.'
  exit 0
fi

current_revision="$(git -C "$library_repo" rev-parse HEAD)"
remote_revision="$(git -C "$library_repo" rev-parse '@{u}' 2>/dev/null || true)"
if [[ -z "$remote_revision" ]]; then
  write_health 'failed' 'upstream-revision-unavailable' 'preserved'
  printf '%s\n' 'S.C.A.L.E.: refresh has no upstream revision; continuing with the last local knowledge snapshot.'
  exit 0
fi

validate_incoming() {
  local audit_root codex_home_dir
  # Validate the complete incoming revision with the validators shipped by that
  # revision. This prevents a refresh from accepting a new skill, hook, agent,
  # dispatcher, or plugin manifest merely because the older checkout did not
  # know how to validate it.
  audit_root="$(mktemp -d "${TMPDIR:-/tmp}/scale-incoming-audit.XXXXXX")"
  if ! git -C "$library_repo" archive "$remote_revision" | tar -x -C "$audit_root"; then
    rm -rf "$audit_root"
    return 10
  fi
  codex_home_dir="${CODEX_HOME:-$HOME/.codex}"
  if ! node "$audit_root/scripts/validate-scale-model-registry.mjs" \
    --registry "$audit_root/library/model-registry.json" \
    --agents-dir "$audit_root/.codex/agents" \
    --catalog "$codex_home_dir/models.json" \
    --config "$codex_home_dir/config.toml"; then
    rm -rf "$audit_root"
    return 11
  fi
  if ! node "$audit_root/scripts/validate-scale-release.mjs" --root "$audit_root"; then
    rm -rf "$audit_root"
    return 12
  fi
  if ! bash "$audit_root/scripts/validate-scale-agents.sh"; then
    rm -rf "$audit_root"
    return 13
  fi
  if ! bash "$audit_root/scripts/validate-scale-library.sh"; then
    rm -rf "$audit_root"
    return 14
  fi
  if [[ -f "$audit_root/scripts/test-scale-benchmark.mjs" ]] && ! node "$audit_root/scripts/test-scale-benchmark.mjs"; then
    rm -rf "$audit_root"
    return 15
  fi
  if [[ -f "$audit_root/scripts/test-scale-knowledge-shadow.mjs" ]] && ! node "$audit_root/scripts/test-scale-knowledge-shadow.mjs"; then
    rm -rf "$audit_root"
    return 16
  fi
  rm -rf "$audit_root"
}

if [[ "$current_revision" != "$remote_revision" ]]; then
  set +e
  validate_incoming
  validation_status=$?
  set -e
  case "$validation_status" in
    10) write_health 'failed' 'incoming-archive-failed' 'preserved'; printf '%s\n' 'S.C.A.L.E.: could not prepare the incoming revision for validation; keeping the current snapshot.'; exit 0 ;;
    11) write_health 'failed' 'incoming-model-policy-unavailable' 'preserved'; printf '%s\n' 'S.C.A.L.E.: incoming model policy is unavailable locally; keeping the current snapshot.'; exit 0 ;;
    12) write_health 'failed' 'incoming-release-validation-failed' 'preserved'; printf '%s\n' 'S.C.A.L.E.: incoming release metadata is invalid; keeping the current snapshot.'; exit 0 ;;
    13) write_health 'failed' 'incoming-agent-validation-failed' 'preserved'; printf '%s\n' 'S.C.A.L.E.: incoming agent validation failed; keeping the current snapshot.'; exit 0 ;;
    14) write_health 'failed' 'incoming-library-validation-failed' 'preserved'; printf '%s\n' 'S.C.A.L.E.: incoming library validation failed; keeping the current snapshot.'; exit 0 ;;
    15) write_health 'failed' 'incoming-benchmark-fixture-failed' 'preserved'; printf '%s\n' 'S.C.A.L.E.: incoming benchmark fixture failed; keeping the current snapshot.'; exit 0 ;;
    16) write_health 'failed' 'incoming-shadow-replay-failed' 'preserved'; printf '%s\n' 'S.C.A.L.E.: incoming knowledge shadow replay failed; keeping the current snapshot.'; exit 0 ;;
  esac
  if ! git -C "$library_repo" merge --ff-only --quiet "$remote_revision"; then
    write_health 'failed' 'history-diverged' 'preserved'
    printf '%s\n' 'S.C.A.L.E.: refresh history diverged; continuing with the last local knowledge snapshot.'
    exit 0
  fi
fi

if bash "$library_repo/scripts/scale-library-materialize.sh" --target "$session_root"; then
  write_health 'success' 'current-and-materialized' 'success'
  printf 'S.C.A.L.E.: global knowledge is current and materialized at %s.\n' "$(revision)"
else
  write_health 'failed' 'materialization-failed' 'failed'
  printf '%s\n' 'S.C.A.L.E.: materialization failed; the library revision is preserved.'
fi
