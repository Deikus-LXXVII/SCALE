#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hermes_root="$(cd "$script_dir/.." && pwd)"
scale_root="$(cd "$hermes_root/.." && pwd)"
home_root="${HERMES_HOME:-$HOME/.hermes}"
dry_run=false
enable_plugin=true

usage() {
  printf '%s\n' 'Usage: install-scale-hermes.sh [--dry-run] [--no-enable-plugin]'
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=true; shift ;;
    --no-enable-plugin) enable_plugin=false; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

link_managed() {
  local source="$1"
  local target="$2"
  if [[ -e "$target" || -L "$target" ]]; then
    if [[ ! -L "$target" ]]; then
      printf 'S.C.A.L.E. Hermes: refusing to replace user-owned path: %s\n' "$target" >&2
      return 1
    fi
    local current
    current="$(readlink "$target")"
    if [[ "$current" != "$scale_root"* && "$current" != "$hermes_root"* ]]; then
      printf 'S.C.A.L.E. Hermes: refusing to replace unrelated symlink: %s\n' "$target" >&2
      return 1
    fi
  fi
  printf 'link %s -> %s\n' "$target" "$source"
  if [[ "$dry_run" == false ]]; then
    mkdir -p "$(dirname "$target")"
    ln -sfn "$source" "$target"
  fi
}

link_managed "$scale_root" "$home_root/scale"
for skill_dir in "$hermes_root"/skills/*; do
  [[ -d "$skill_dir" ]] || continue
  skill_name="$(basename "$skill_dir")"
  link_managed "$skill_dir" "$home_root/skills/software-development/$skill_name"
done
plugin_dir="$hermes_root/plugin/scale-hermes"
if [[ -d "$plugin_dir" ]]; then
  link_managed "$plugin_dir" "$home_root/plugins/scale-hermes"
fi

if [[ "$dry_run" == true ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: dry run complete; no files changed.'
else
  if [[ "$enable_plugin" == true && -d "$plugin_dir" ]]; then
    if command -v hermes >/dev/null 2>&1; then
      if ! HERMES_HOME="$home_root" hermes plugins enable scale-hermes >/dev/null 2>&1; then
        printf '%s\n' 'S.C.A.L.E. Hermes: plugin linked but could not be enabled automatically.' >&2
        exit 1
      fi
    else
      printf '%s\n' 'S.C.A.L.E. Hermes: Hermes CLI not found; plugin remains linked but disabled.' >&2
    fi
  fi
  printf 'S.C.A.L.E. Hermes: installed global skills, project-sync plugin, and canonical link under %s.\n' "$home_root"
fi
