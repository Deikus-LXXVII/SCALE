#!/usr/bin/env bash
set -euo pipefail

agent_name=""
target_input=""
library_input=""

usage() {
  printf '%s\n' 'Usage: scale-agent-activate.sh --agent <name> --target <project-dir> [--library <library-dir>]'
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --agent) agent_name="${2:-}"; shift 2 ;;
    --target) target_input="${2:-}"; shift 2 ;;
    --library) library_input="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

if [[ -z "$agent_name" || -z "$target_input" || ! -d "$target_input" ]]; then
  usage
  exit 2
fi

target_root="$(cd "$target_input" && pwd)"
library_root="${library_input:-$target_root/.codex/scale-library}"
catalog_profile="$library_root/agents/$agent_name.toml"
active_profile="$target_root/.codex/scale-library-src/.codex/agents/$agent_name.toml"
profile_kind="catalog"
profile="$catalog_profile"
if [[ ! -f "$profile" && -f "$active_profile" ]]; then
  profile_kind="active"
  profile="$active_profile"
fi
if [[ ! -f "$profile" ]]; then
  printf 'S.C.A.L.E. profile not found in catalog or active library: %s\n' "$agent_name" >&2
  exit 2
fi

agents_root="$target_root/.codex/agents"
target_profile="$agents_root/$agent_name.toml"
mkdir -p "$agents_root"
if [[ -e "$target_profile" && ! -L "$target_profile" ]]; then
  printf 'Refusing to overwrite project-owned profile: %s\n' "$target_profile" >&2
  exit 2
fi

if [[ "$profile_kind" == "active" ]]; then
  link_target="../scale-library-src/.codex/agents/$agent_name.toml"
elif [[ "$library_root" == "$target_root/.codex/scale-library" ]]; then
  link_target="../scale-library/agents/$agent_name.toml"
else
  link_target="$profile"
fi
ln -sfn "$link_target" "$target_profile"
printf 'Activated %s in %s\n' "$agent_name" "$target_profile"
