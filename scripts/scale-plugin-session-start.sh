#!/usr/bin/env bash
set -euo pipefail

plugin_root="${PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
project_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$project_root" ]]; then
  printf '%s\n' 'S.C.A.L.E.: SessionStart is outside a Git project; global skills remain available but project materialization is skipped.'
  exit 0
fi

# Native OpenCode is a local optional runtime. Start it before refresh so a
# newly spawned native agent can use the provider during this same session.
ensure_script="$project_root/.codex/scale-library-src/scripts/scale-opencode-native-ensure.sh"
if [[ ! -x "$ensure_script" ]]; then
  ensure_script="$plugin_root/scripts/scale-opencode-native-ensure.sh"
fi
if [[ -x "$ensure_script" ]]; then
  bash "$ensure_script" "$project_root" || printf '%s\n' 'S.C.A.L.E.: native OpenCode autostart failed; continuing with library refresh.' >&2
fi

# The canonical SCALE checkout is itself a Git project. Do not ask the global
# plugin to clone SCALE into `.codex/scale-library-src` inside that checkout:
# development of SCALE happens from the canonical tree, while connected
# product projects receive a separate sparse clone.
scale_remote_url="${SCALE_REMOTE_URL:-https://github.com/Deikus-LXXVII/SCALE.git}"
origin_url="$(git -C "$project_root" remote get-url origin 2>/dev/null || true)"
if [[ -f "$project_root/.codex-plugin/plugin.json" ]] \
  && rg -q '"name"[[:space:]]*:[[:space:]]*"scale"' "$project_root/.codex-plugin/plugin.json" \
  && [[ "${origin_url%.git}" == "${scale_remote_url%.git}" ]]; then
  printf '%s\n' 'S.C.A.L.E.: canonical library checkout active; self-clone skipped.'
  exit 0
fi

refresh_script="$project_root/.codex/scale-library-src/scripts/scale-library-refresh.sh"
if [[ ! -x "$refresh_script" ]]; then
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
