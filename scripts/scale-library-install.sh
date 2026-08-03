#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
canonical_root="$(cd "$script_dir/.." && pwd)"
target_input=""
remote_url=""
branch="main"
install_hook=true
local_ignore=false

usage() {
  printf '%s\n' 'Usage: scale-library-install.sh --target <project-dir> [--remote <git-url>] [--branch <branch>] [--no-hook] [--local-ignore]'
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target) target_input="${2:-}"; shift 2 ;;
    --remote) remote_url="${2:-}"; shift 2 ;;
    --branch) branch="${2:-}"; shift 2 ;;
    --no-hook) install_hook=false; shift ;;
    --local-ignore) local_ignore=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

if [[ -z "$target_input" || ! -d "$target_input" ]]; then
  usage
  exit 2
fi

target_root="$(cd "$target_input" && pwd)"
if [[ "$target_root" == "$canonical_root" ]]; then
  printf '%s\n' 'Refusing to install the canonical library into itself.' >&2
  exit 2
fi
if ! git -C "$target_root" rev-parse --show-toplevel >/dev/null 2>&1; then
  printf 'Target must be a Git repository so the SessionStart hook can resolve its root: %s\n' "$target_root" >&2
  exit 2
fi

if [[ -z "$remote_url" ]]; then
  remote_url="$(git -C "$canonical_root" remote get-url origin 2>/dev/null || true)"
fi
if [[ -z "$remote_url" ]]; then
  printf '%s\n' 'No canonical Git remote is configured. Add origin to SCALE or pass --remote.' >&2
  exit 2
fi

target_codex="$target_root/.codex"
clone_root="$target_codex/scale-library-src"
mkdir -p "$target_codex"

if [[ -e "$clone_root" && ! -d "$clone_root/.git" ]]; then
  printf 'Refusing to replace non-Git path: %s\n' "$clone_root" >&2
  exit 2
fi

if [[ ! -d "$clone_root/.git" ]]; then
  git clone --depth 1 --filter=blob:none --sparse --branch "$branch" "$remote_url" "$clone_root"
  git -C "$clone_root" sparse-checkout set --no-cone '/.codex/agents/' '/library/' '/skills/' '/scripts/' '/AGENTS.md'
else
  git -C "$clone_root" pull --ff-only
fi

bash "$clone_root/scripts/scale-library-materialize.sh" --target "$target_root"

if [[ "$install_hook" == true ]]; then
  hooks_file="$target_codex/hooks.json"
  if [[ ! -e "$hooks_file" ]]; then
    cp "$clone_root/scripts/templates/scale-library-hooks.json" "$hooks_file"
    printf 'Installed SessionStart refresh hook: %s\n' "$hooks_file"
  else
    printf 'Existing hook configuration preserved: %s\n' "$hooks_file"
    printf 'Merge scripts/templates/scale-library-hooks.json to enable automatic refresh in this project.\n' >&2
  fi
fi

if [[ "$local_ignore" == true ]]; then
  gitignore_file="$(git -C "$target_root" rev-parse --path-format=absolute --git-path info/exclude)"
else
  gitignore_file="$target_root/.gitignore"
fi
for ignored_path in '.codex/scale-library-src/' '.codex/scale-library' '.agents/skills/scale-*'; do
  if [[ -f "$gitignore_file" ]]; then
    rg -qxF "$ignored_path" "$gitignore_file" || printf '%s\n' "$ignored_path" >> "$gitignore_file"
  else
    printf '# S.C.A.L.E. live knowledge clone (never commit)\n%s\n' "$ignored_path" > "$gitignore_file"
  fi
done

printf 'Connected S.C.A.L.E. library at %s\n' "$clone_root"
