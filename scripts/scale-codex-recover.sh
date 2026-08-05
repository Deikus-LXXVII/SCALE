#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
action="${1:-restore}"

case "$action" in
  status)
    if command -v ocx >/dev/null 2>&1; then ocx status || true; fi
    if rg -n '^\s*openai_base_url\s*=' "${CODEX_HOME:-$HOME/.codex}/config.toml"; then
      printf '%s\n' 'Codex transport override is active.'
    else
      printf '%s\n' 'Codex is on its native transport.'
    fi
    ;;
  restore)
    if command -v ocx >/dev/null 2>&1; then ocx restore || true; fi
    node "$root/scripts/scale-codex-recover.mjs" --codex-home "${CODEX_HOME:-$HOME/.codex}"
    printf '%s\n' 'Native Codex transport restored. Restart Codex Desktop if the current task still reconnects.'
    ;;
  reconnect)
    command -v ocx >/dev/null 2>&1 || { printf '%s\n' 'OpenCodex (ocx) is not installed.' >&2; exit 1; }
    ocx ensure
    ocx sync
    # `ocx sync` preserves an explicit native-restore state. Apply the routing
    # switch last, then prove Codex actually points at the healthy service.
    ocx restore back
    if ! rg -q '^\s*openai_base_url\s*=\s*"http://127\.0\.0\.1:[0-9]+/v1"\s*$' "${CODEX_HOME:-$HOME/.codex}/config.toml"; then
      printf '%s\n' 'OpenCodex is healthy but Codex routing was not restored; native Codex remains active.' >&2
      exit 1
    fi
    printf '%s\n' 'OpenCode Go transport restored. Restart Codex Desktop to refresh the model picker.'
    ;;
  *)
    printf '%s\n' 'Usage: scale-codex-recover.sh [status|restore|reconnect]' >&2
    exit 2
    ;;
esac
