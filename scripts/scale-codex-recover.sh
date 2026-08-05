#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
action="${1:-restore}"

case "$action" in
  status)
    if command -v ocx >/dev/null 2>&1; then ocx health --json || true; fi
    if rg -n '^\s*openai_base_url\s*=' "${CODEX_HOME:-$HOME/.codex}/config.toml"; then
      printf '%s\n' 'Codex transport override is active.'
    else
      printf '%s\n' 'Codex is on its native transport.'
    fi
    ;;
  restore)
    if command -v ocx >/dev/null 2>&1 && ocx health --json >/dev/null 2>&1; then
      printf '%s\n' 'OpenCodex is healthy; no recovery mutation was made.'
      exit 0
    fi
    printf '%s\n' 'Gateway is not healthy. Use runner-start to repair it; this command never stops the active proxy or removes the model catalog.' >&2
    exit 1
    ;;
  native-restore)
    if command -v ocx >/dev/null 2>&1; then ocx restore || true; fi
    node "$root/scripts/scale-codex-recover.mjs" --codex-home "${CODEX_HOME:-$HOME/.codex}"
    printf '%s\n' 'Native Codex transport restored. Restart Codex Desktop; OpenCode model entries are intentionally removed.'
    ;;
  reconnect|runner-start)
    # Compatibility alias: reconnect starts/repairs the gateway and keeps the
    # current Codex model catalog. It never stops the active proxy.
    command -v ocx >/dev/null 2>&1 || { printf '%s\n' 'OpenCodex (ocx) is not installed.' >&2; exit 1; }
    if ocx health --json >/dev/null 2>&1; then
      printf '%s\n' 'OpenCodex gateway is already healthy; no restart or catalog mutation performed.'
      exit 0
    fi
    ocx service start || true
    if ocx health --json; then
      printf '%s\n' 'OpenCodex gateway is healthy; Codex model routing remains unchanged.'
      exit 0
    fi
    printf '%s\n' 'OpenCodex did not become healthy. Do not run ocx stop from an active Codex session; inspect ocx service status and start it manually when safe.' >&2
    exit 1
    ;;
  *)
    printf '%s\n' 'Usage: scale-codex-recover.sh [status|restore|runner-start|reconnect|native-restore]' >&2
    exit 2
    ;;
esac
