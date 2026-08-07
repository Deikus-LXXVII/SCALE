#!/usr/bin/env bash
set -euo pipefail

target_input=""

portable_path() (
  cd "$1"
  if pwd -W >/dev/null 2>&1; then
    pwd -W
  else
    pwd
  fi
)

windows_links=false
case "${OSTYPE:-}" in
  msys*|mingw*|cygwin*) windows_links=true ;;
esac
case "${MSYSTEM:-}" in
  MSYS*|MINGW*|CYGWIN*) windows_links=true ;;
esac
case "$(uname -s 2>/dev/null || true)" in
  MSYS*|MINGW*|CYGWIN*) windows_links=true ;;
esac

require_windows_link_tools() {
  command -v cmd.exe >/dev/null 2>&1 || {
    printf '%s\n' 'S.C.A.L.E.: cmd.exe is required for native Windows links.' >&2
    return 1
  }
  command -v cygpath >/dev/null 2>&1 || {
    printf '%s\n' 'S.C.A.L.E.: cygpath is required for native Windows links.' >&2
    return 1
  }
}

windows_reparsepoint() {
  local path="$1"
  local fsutil_command
  fsutil_command="$(command -v fsutil.exe 2>/dev/null || command -v fsutil 2>/dev/null || true)"
  [[ -n "$fsutil_command" ]] || return 1
  local windows_path
  windows_path="$(cygpath -w "$path")" || return 1
  MSYS_NO_PATHCONV=1 "$fsutil_command" reparsepoint query "$windows_path" >/dev/null 2>&1
}

is_link() {
  local path="$1"
  [[ -L "$path" ]] && return 0
  [[ "$windows_links" == true ]] || return 1
  windows_reparsepoint "$path"
}

windows_link_listing() {
  local path="$1"
  require_windows_link_tools || return 1
  local parent_path
  parent_path="$(cygpath -w "$(dirname "$path")")" || return 1
  local name
  name="$(basename "$path")"
  MSYS_NO_PATHCONV=1 cmd.exe /c dir /AL "$parent_path" 2>/dev/null \
    | tr -d '\r' \
    | grep -F -- "$name" \
    || true
}

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
  target_root="$(portable_path "$target_input")"
else
  current_root="$(portable_path "$PWD")"
  git_root="$(git -C "$current_root" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$git_root" ]]; then
    target_root="$(portable_path "$git_root")"
  else
    target_root="$current_root"
  fi
fi

clone_root="$target_root/.codex/scale-library-src"
if [[ ! -d "$clone_root/.git" ]]; then
  printf '%s\n' 'S.C.A.L.E.: no connected library clone to materialize.'
  exit 0
fi

agents_root="$target_root/.codex/agents"
skills_root="$target_root/.agents/skills"
opencode_agents_root="$target_root/.opencode/agents"
mkdir -p "$agents_root" "$skills_root" "$opencode_agents_root"

is_scale_link() {
  local path="$1"
  is_link "$path" || return 1
  local destination
  destination="$(readlink "$path" 2>/dev/null || true)"
  if [[ "$destination" == *"scale-library-src"* ]]; then
    return 0
  fi
  [[ "$windows_links" == true ]] || return 1
  destination="$(windows_link_listing "$path")"
  [[ "$destination" == *"scale-library-src"* ]]
}

remove_link() {
  local path="$1"
  if [[ "$windows_links" != true ]]; then
    rm -f "$path"
    return
  fi

  rm -f "$path" 2>/dev/null || true
  if [[ ! -e "$path" && ! -L "$path" ]]; then
    return 0
  fi

  require_windows_link_tools || return 1
  local windows_path
  windows_path="$(cygpath -w "$path")"
  if [[ -d "$path" ]]; then
    MSYS_NO_PATHCONV=1 cmd.exe /c rmdir "$windows_path" >/dev/null
  else
    MSYS_NO_PATHCONV=1 cmd.exe /c del "$windows_path" >/dev/null
  fi
  [[ ! -e "$path" && ! -L "$path" ]]
}

verify_link() {
  local destination="$1"
  if is_scale_link "$destination"; then
    return 0
  fi
  printf 'S.C.A.L.E.: failed to create a managed link (copy or non-S.C.A.L.E. reparse point): %s\n' \
    "$destination" >&2
  return 1
}

create_link() {
  local source="$1"
  local destination="$2"
  local relative_target="$3"
  local link_kind="$4"

  if [[ "$windows_links" == true ]]; then
    require_windows_link_tools || return 1
    local source_windows destination_windows
    source_windows="$(cygpath -w "$source")"
    destination_windows="$(cygpath -w "$destination")"
    if [[ "$link_kind" == directory ]]; then
      MSYS_NO_PATHCONV=1 cmd.exe /c mklink /D "$destination_windows" "$source_windows" >/dev/null
    else
      MSYS_NO_PATHCONV=1 cmd.exe /c mklink "$destination_windows" "$source_windows" >/dev/null
    fi
  else
    ln -sfn "$relative_target" "$destination"
  fi
  verify_link "$destination"
}

link_managed() {
  local source="$1"
  local destination="$2"
  local relative_target="$3"
  local link_kind="$4"

  if [[ -e "$destination" || -L "$destination" ]]; then
    if ! is_link "$destination"; then
      printf 'S.C.A.L.E.: preserved project-owned path: %s\n' "$destination" >&2
      return 1
    fi
    if ! is_scale_link "$destination"; then
      printf 'S.C.A.L.E.: preserved non-S.C.A.L.E. symlink: %s\n' "$destination" >&2
      return 1
    fi
    if [[ "$windows_links" == true ]] && ! remove_link "$destination"; then
      printf 'S.C.A.L.E.: failed to replace managed link: %s\n' "$destination" >&2
      return 2
    fi
  fi

  if ! create_link "$source" "$destination" "$relative_target" "$link_kind"; then
    return 2
  fi
  return 0
}

linked_agents=0
linked_skills=0
linked_opencode_agents=0
preserved=0
removed=0

for profile in "$clone_root"/.codex/agents/scale_*.toml; do
  [[ -f "$profile" ]] || continue
  profile_name="$(basename "$profile")"
  if link_managed "$profile" "$agents_root/$profile_name" "../scale-library-src/.codex/agents/$profile_name" file; then
    linked_agents=$((linked_agents + 1))
  else
    link_status=$?
    if [[ "$link_status" -eq 1 ]]; then
      preserved=$((preserved + 1))
    else
      exit "$link_status"
    fi
  fi
done

for profile in "$clone_root"/opencode/agents/scale-go-*.md; do
  [[ -f "$profile" ]] || continue
  profile_name="$(basename "$profile")"
  if link_managed "$profile" "$opencode_agents_root/$profile_name" "../../.codex/scale-library-src/opencode/agents/$profile_name" file; then
    linked_opencode_agents=$((linked_opencode_agents + 1))
  else
    link_status=$?
    if [[ "$link_status" -eq 1 ]]; then
      preserved=$((preserved + 1))
    else
      exit "$link_status"
    fi
  fi
done

for skill in "$clone_root"/skills/*; do
  [[ -d "$skill" && -f "$skill/SKILL.md" ]] || continue
  skill_name="$(basename "$skill")"
  if link_managed "$skill" "$skills_root/$skill_name" "../../.codex/scale-library-src/skills/$skill_name" directory; then
    linked_skills=$((linked_skills + 1))
  else
    link_status=$?
    if [[ "$link_status" -eq 1 ]]; then
      preserved=$((preserved + 1))
    else
      exit "$link_status"
    fi
  fi
done

for target in "$opencode_agents_root"/scale-go-*.md; do
  is_link "$target" || continue
  is_scale_link "$target" || continue
  profile_name="$(basename "$target")"
  if [[ ! -f "$clone_root/opencode/agents/$profile_name" ]]; then
    remove_link "$target" || exit 2
    removed=$((removed + 1))
  fi
done

for target in "$agents_root"/scale_*.toml; do
  is_link "$target" || continue
  is_scale_link "$target" || continue
  profile_name="$(basename "$target")"
  if [[ ! -f "$clone_root/.codex/agents/$profile_name" ]]; then
    remove_link "$target" || exit 2
    removed=$((removed + 1))
  fi
done

for target in "$skills_root"/scale-*; do
  is_link "$target" || continue
  is_scale_link "$target" || continue
  skill_name="$(basename "$target")"
  if [[ ! -f "$clone_root/skills/$skill_name/SKILL.md" ]]; then
    remove_link "$target" || exit 2
    removed=$((removed + 1))
  fi
done

library_link="$target_root/.codex/scale-library"
if [[ -e "$library_link" || -L "$library_link" ]]; then
  if ! is_link "$library_link"; then
    printf 'S.C.A.L.E.: preserved project-owned library path: %s\n' "$library_link" >&2
    preserved=$((preserved + 1))
  elif is_scale_link "$library_link"; then
    if [[ "$windows_links" == true ]] && ! remove_link "$library_link"; then
      printf 'S.C.A.L.E.: failed to replace managed library link: %s\n' "$library_link" >&2
      exit 2
    fi
    if ! create_link "$clone_root/library" "$library_link" 'scale-library-src/library' directory; then
      exit 2
    fi
  else
    printf 'S.C.A.L.E.: preserved non-S.C.A.L.E. library symlink: %s\n' "$library_link" >&2
    preserved=$((preserved + 1))
  fi
else
  if ! create_link "$clone_root/library" "$library_link" 'scale-library-src/library' directory; then
    exit 2
  fi
fi

printf 'S.C.A.L.E.: materialized %s Codex profiles, %s skills, and %s OpenCode agents' "$linked_agents" "$linked_skills" "$linked_opencode_agents"
if [[ "$removed" -gt 0 ]]; then
  printf '; removed %s retired managed links' "$removed"
fi
if [[ "$preserved" -gt 0 ]]; then
  printf '; preserved %s project-owned paths' "$preserved"
fi
printf '.\n'
