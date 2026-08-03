#!/usr/bin/env bash
set -euo pipefail

plugin_root="${PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
project_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$project_root" ]]; then
  printf '%s\n' 'S.C.A.L.E.: SessionStart is outside a Git project; global skills remain available but project materialization is skipped.'
  exit 0
fi

refresh_script="$project_root/.codex/scale-library-src/scripts/scale-library-refresh.sh"
if [[ ! -x "$refresh_script" ]]; then
  scale_remote_url="${SCALE_REMOTE_URL:-https://github.com/Deikus-LXXVII/SCALE.git}"
  scale_branch="${SCALE_BRANCH:-main}"
  printf 'S.C.A.L.E.: connecting this Git project to %s.\n' "$scale_remote_url"
  if ! bash "$plugin_root/scripts/scale-library-install.sh" \
    --target "$project_root" \
    --remote "$scale_remote_url" \
    --branch "$scale_branch" \
    --no-hook \
    --local-ignore; then
    printf '%s\n' 'S.C.A.L.E.: automatic project connection failed; no existing project configuration was replaced.'
    exit 0
  fi
  refresh_script="$project_root/.codex/scale-library-src/scripts/scale-library-refresh.sh"
fi

exec bash "$refresh_script" --hook
