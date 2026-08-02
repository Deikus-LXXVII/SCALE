#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
canonical_root="$(cd "$script_dir/.." && pwd)"
target_input=""
remote_url=""
branch="main"

usage() {
  printf '%s\n' 'Usage: cell-library-install.sh --target <project-dir> [--remote <git-url>] [--branch <branch>]'
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target) target_input="${2:-}"; shift 2 ;;
    --remote) remote_url="${2:-}"; shift 2 ;;
    --branch) branch="${2:-}"; shift 2 ;;
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
  printf '%s\n' 'No canonical Git remote is configured. Add origin to C.E.L.L.-Codex or pass --remote.' >&2
  exit 2
fi

target_codex="$target_root/.codex"
clone_root="$target_codex/cell-library-src"
agents_root="$target_codex/agents"
mkdir -p "$target_codex" "$agents_root"

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

library_link="$target_codex/cell-library"
if [[ -e "$library_link" && ! -L "$library_link" ]]; then
  printf 'Refusing to replace non-symlink path: %s\n' "$library_link" >&2
  exit 2
fi
ln -sfn 'cell-library-src/library' "$library_link"

conflicts=0
for profile in "$clone_root"/.codex/agents/cell_*.toml; do
  [[ -f "$profile" ]] || continue
  profile_name="$(basename "$profile")"
  target_profile="$agents_root/$profile_name"
  if [[ -e "$target_profile" && ! -L "$target_profile" ]]; then
    printf 'Preserved project-specific profile: %s\n' "$target_profile" >&2
    conflicts=1
    continue
  fi
  ln -sfn "../cell-library-src/.codex/agents/$profile_name" "$target_profile"
done

hooks_file="$target_codex/hooks.json"
if [[ ! -e "$hooks_file" ]]; then
  cp "$clone_root/scripts/templates/cell-library-hooks.json" "$hooks_file"
  printf 'Installed SessionStart refresh hook: %s\n' "$hooks_file"
else
  printf 'Existing hook configuration preserved: %s\n' "$hooks_file"
  printf 'Merge scripts/templates/cell-library-hooks.json to enable automatic refresh in this project.\n' >&2
fi

gitignore_file="$target_root/.gitignore"
for ignored_path in '.codex/cell-library-src/' '.codex/cell-library'; do
  if [[ -f "$gitignore_file" ]]; then
    rg -qxF "$ignored_path" "$gitignore_file" || printf '%s\n' "$ignored_path" >> "$gitignore_file"
  else
    printf '# C.E.L.L. live knowledge clone (never commit)\n%s\n' "$ignored_path" > "$gitignore_file"
  fi
done

printf 'Connected C.E.L.L. library at %s\n' "$clone_root"
if [[ "$conflicts" -ne 0 ]]; then
  printf '%s\n' 'Some existing agent profiles were preserved; rename or merge them before relying on the global versions.' >&2
fi
