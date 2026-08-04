#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hermes_root="$(cd "$script_dir/.." && pwd)"
scale_root="$(cd "$hermes_root/.." && pwd)"
home_root="${HERMES_HOME:-$HOME/.hermes}"
project_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$project_root" ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: outside a Git project; project initialization skipped.'
  exit 0
fi

# The canonical checkout is the source of truth, not a project to initialize.
canonical_root="$(cd "$scale_root" && pwd)"
project_real="$(cd "$project_root" && pwd)"
if [[ "$project_real" == "$canonical_root" ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: canonical SCALE checkout; project sync skipped.'
  exit 0
fi

global_root="$home_root/scale"
if [[ ! -d "$global_root/library" ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: global library is unavailable; initialization skipped.' >&2
  exit 0
fi

hermes_dir="$project_root/.hermes"
if [[ -e "$hermes_dir" && ! -d "$hermes_dir" ]]; then
  printf 'S.C.A.L.E. Hermes: preserved project-owned non-directory: %s\n' "$hermes_dir" >&2
  exit 0
fi
mkdir -p "$hermes_dir"

library_link="$hermes_dir/scale-library"
if [[ -e "$library_link" || -L "$library_link" ]]; then
  if [[ ! -L "$library_link" ]]; then
    printf 'S.C.A.L.E. Hermes: preserved project-owned path: %s\n' "$library_link" >&2
  else
    current_target="$(readlink "$library_link")"
    if [[ "$current_target" != "$global_root/library" ]]; then
      printf 'S.C.A.L.E. Hermes: preserved non-SCALE symlink: %s\n' "$library_link" >&2
    fi
  fi
else
  ln -s "$global_root/library" "$library_link"
fi

managed_dir="$hermes_dir/scale"
mkdir -p "$managed_dir"
metadata="$managed_dir/project.json"
if [[ ! -e "$metadata" ]]; then
  printf '{"schema_version":1,"managed_by":"scale-hermes","library":"%s","sync":"global-symlink","initialized_at":"%s"}\n' \
    "$global_root/library" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$metadata"
fi

exclude_file="$(git -C "$project_root" rev-parse --path-format=absolute --git-path info/exclude 2>/dev/null || true)"
if [[ -n "$exclude_file" ]]; then
  mkdir -p "$(dirname "$exclude_file")"
  touch "$exclude_file"
  for ignored in '.hermes/scale/' '.hermes/scale-library'; do
    grep -qxF "$ignored" "$exclude_file" || printf '%s\n' "$ignored" >> "$exclude_file"
  done
fi

printf 'S.C.A.L.E. Hermes: initialized %s with global library sync.\n' "$project_root"
