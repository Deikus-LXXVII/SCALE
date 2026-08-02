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

if git -C "$library_repo" pull --ff-only --quiet; then
  revision="$(git -C "$library_repo" rev-parse --short HEAD)"
  printf 'S.C.A.L.E.: global knowledge is current at %s.\n' "$revision"
else
  printf '%s\n' 'S.C.A.L.E.: refresh failed or history diverged; continuing with the last local knowledge snapshot.'
fi
