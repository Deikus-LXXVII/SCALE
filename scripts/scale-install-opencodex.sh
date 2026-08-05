#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
apply=false
[[ "${1:-}" == "--apply" ]] && apply=true

command -v ocx >/dev/null 2>&1 || { printf '%s\n' 'OpenCodex 2.10+ (ocx) is required.' >&2; exit 1; }
version="$(ocx --version | awk '{print $2}')"
if [[ "$version" != 2.10.* && "$version" != 2.1[1-9].* && "$version" != 2.[2-9][0-9].* && "$version" != [3-9].* ]]; then
  printf 'OpenCodex 2.10+ is required; found %s.\n' "$version" >&2
  exit 1
fi

if [[ "$apply" != true ]]; then
  node "$root/scripts/scale-configure-opencodex.mjs" --dry-run
  printf '%s\n' 'Dry run only. Re-run with --apply to write ~/.opencodex and install the runner-only gateway service; native Codex routing stays unchanged.'
  exit 0
fi

node "$root/scripts/scale-configure-opencodex.mjs"
ocx config validate
ocx service install
ocx ensure
ocx sync
healthy=false
for _ in 1 2 3 4 5; do
  if ocx health --json; then healthy=true; break; fi
  sleep 1
done
if [[ "$healthy" != true ]]; then
  printf '%s\n' 'OpenCodex did not become healthy; restoring native Codex transport.' >&2
  "$root/scripts/scale-codex-recover.sh" restore
  exit 1
fi
printf '%s\n' 'OpenCodex gateway installed and healthy. Keep it running while OpenCode models are selected; use the plaintext runner for external subwork.'
