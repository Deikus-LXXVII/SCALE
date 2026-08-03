#!/usr/bin/env bash
set -euo pipefail

target_input=""

usage() {
  printf '%s\n' 'Usage: scale-library-materialize.sh [--target <project-dir>]'
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target) target_input="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

if [[ -n "$target_input" ]]; then
  if [[ ! -d "$target_input" ]]; then
    printf 'S.C.A.L.E.: target is not a directory: %s\n' "$target_input" >&2
    exit 2
  fi
  target_root="$(cd "$target_input" && pwd)"
else
  target_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

clone_root="$target_root/.codex/scale-library-src"
if [[ ! -d "$clone_root/.git" ]]; then
  printf '%s\n' 'S.C.A.L.E.: no connected library clone to materialize.'
  exit 0
fi

agents_root="$target_root/.codex/agents"
skills_root="$target_root/.agents/skills"
mkdir -p "$agents_root" "$skills_root"

is_scale_link() {
  local path="$1"
  [[ -L "$path" ]] || return 1
  local destination
  destination="$(readlink "$path")"
  [[ "$destination" == *"scale-library-src"* ]]
}

link_managed() {
  local source="$1"
  local destination="$2"
  local relative_target="$3"

  if [[ -e "$destination" || -L "$destination" ]]; then
    if [[ ! -L "$destination" ]]; then
      printf 'S.C.A.L.E.: preserved project-owned path: %s\n' "$destination" >&2
      return 1
    fi
    if ! is_scale_link "$destination"; then
      printf 'S.C.A.L.E.: preserved non-S.C.A.L.E. symlink: %s\n' "$destination" >&2
      return 1
    fi
  fi

  ln -sfn "$relative_target" "$destination"
  return 0
}

linked_agents=0
linked_skills=0
preserved=0

for profile in "$clone_root"/.codex/agents/scale_*.toml; do
  [[ -f "$profile" ]] || continue
  profile_name="$(basename "$profile")"
  if link_managed "$profile" "$agents_root/$profile_name" "../scale-library-src/.codex/agents/$profile_name"; then
    linked_agents=$((linked_agents + 1))
  else
    preserved=$((preserved + 1))
  fi
done

for skill in "$clone_root"/skills/*; do
  [[ -d "$skill" && -f "$skill/SKILL.md" ]] || continue
  skill_name="$(basename "$skill")"
  if link_managed "$skill" "$skills_root/$skill_name" "../../.codex/scale-library-src/skills/$skill_name"; then
    linked_skills=$((linked_skills + 1))
  else
    preserved=$((preserved + 1))
  fi
done

removed=0
for target in "$agents_root"/scale_*.toml; do
  [[ -L "$target" ]] || continue
  is_scale_link "$target" || continue
  profile_name="$(basename "$target")"
  if [[ ! -f "$clone_root/.codex/agents/$profile_name" ]]; then
    rm "$target"
    removed=$((removed + 1))
  fi
done

for target in "$skills_root"/scale-*; do
  [[ -L "$target" ]] || continue
  is_scale_link "$target" || continue
  skill_name="$(basename "$target")"
  if [[ ! -f "$clone_root/skills/$skill_name/SKILL.md" ]]; then
    rm "$target"
    removed=$((removed + 1))
  fi
done

library_link="$target_root/.codex/scale-library"
if [[ -e "$library_link" || -L "$library_link" ]]; then
  if [[ ! -L "$library_link" ]]; then
    printf 'S.C.A.L.E.: preserved project-owned library path: %s\n' "$library_link" >&2
    preserved=$((preserved + 1))
  elif is_scale_link "$library_link"; then
    ln -sfn 'scale-library-src/library' "$library_link"
  else
    printf 'S.C.A.L.E.: preserved non-S.C.A.L.E. library symlink: %s\n' "$library_link" >&2
    preserved=$((preserved + 1))
  fi
else
  ln -s 'scale-library-src/library' "$library_link"
fi

printf 'S.C.A.L.E.: materialized %s agent profiles and %s skills' "$linked_agents" "$linked_skills"
if [[ "$removed" -gt 0 ]]; then
  printf '; removed %s retired managed links' "$removed"
fi
if [[ "$preserved" -gt 0 ]]; then
  printf '; preserved %s project-owned paths' "$preserved"
fi
printf '.\n'
