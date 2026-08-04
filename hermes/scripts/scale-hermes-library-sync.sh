#!/usr/bin/env bash
set -euo pipefail

# S.C.A.L.E. Hermes library sync (pull-only).
#
# Updates the canonical SCALE checkout from its Git origin with a
# fast-forward-only pull. Never pushes, never rewrites history, and never
# touches a dirty working tree. Any failure (offline, diverged, no remote,
# local changes) preserves the local snapshot and exits 0 so session startup
# is never blocked.
#
# Invoked by the scale-hermes plugin on session start/reset, and safe to run
# manually at any time.

home_root="${HERMES_HOME:-$HOME/.hermes}"
scale_root="${SCALE_HERMES_CANONICAL:-}"
if [[ -z "$scale_root" ]]; then
  scale_root="$(cd "$home_root/scale" 2>/dev/null && pwd -P || true)"
fi

if [[ -z "$scale_root" || ! -d "$scale_root/.git" ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: canonical checkout unavailable; pull skipped.'
  exit 0
fi

branch="$(git -C "$scale_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
[[ -n "$branch" ]] || branch="main"

if ! git -C "$scale_root" remote get-url origin >/dev/null 2>&1; then
  printf '%s\n' 'S.C.A.L.E. Hermes: canonical checkout has no origin; pull skipped.'
  exit 0
fi

# Preserve unpublished local work: pull only a clean tree.
if [[ -n "$(git -C "$scale_root" status --porcelain)" ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: canonical checkout has local changes; pull skipped.'
  exit 0
fi

export GIT_TERMINAL_PROMPT=0
if ! git -C "$scale_root" pull --ff-only --quiet origin "$branch" 2>/dev/null; then
  printf '%s\n' 'S.C.A.L.E. Hermes: fast-forward pull failed (offline or diverged); local snapshot preserved.'
  exit 0
fi

printf 'S.C.A.L.E. Hermes: canonical library synced at %s.\n' \
  "$(git -C "$scale_root" rev-parse --short HEAD)"
