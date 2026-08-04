#!/usr/bin/env bash
set -euo pipefail

# S.C.A.L.E. Hermes artifact promotion.
#
# Copies project artifacts (agents, skills, rules, books, quirks, docs, ...)
# into the canonical SCALE checkout at explicit relative destinations, then
# optionally validates, commits, and pushes them. Works for any artifact type:
# the destination path decides where it lands (e.g. .codex/agents/foo.toml,
# hermes/skills/foo/SKILL.md, library/rules/foo.md, docs/foo.md).
#
# Safety contract:
#   - destinations must stay inside the canonical checkout (no ../ escapes);
#   - nothing is committed without --commit, nothing is pushed without --push;
#   - push is a plain fast-forward push (git rejects non-fast-forward);
#   - only the promoted paths are staged, other local changes are preserved.
#
# Usage:
#   scale-hermes-promote.sh <source> <canonical-rel> [<source> <canonical-rel> ...] \
#       [--validate] [--commit "<message>"] [--push] [--dry-run] [--scale-root <path>]

usage() {
  cat <<'EOF'
Usage:
  scale-hermes-promote.sh <source> <canonical-rel> [<source> <canonical-rel> ...] \
      [--validate] [--commit "<message>"] [--push] [--dry-run] [--scale-root <path>]

  <source>        file or directory in the current project
  <canonical-rel> destination relative to the canonical checkout
  --validate      run focused S.C.A.L.E. validators after copying
  --commit MSG    create a commit staging only the promoted paths
  --push          push to origin after commit (requires --commit)
  --dry-run       print the plan without changing anything
  --scale-root    canonical checkout path (default: $HERMES_HOME/scale)
EOF
}

home_root="${HERMES_HOME:-$HOME/.hermes}"
scale_root=""
validate=0
commit_msg=""
push=0
dry=0
pairs=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --validate) validate=1; shift ;;
    --commit) commit_msg="${2:-}"; shift 2 ;;
    --push) push=1; shift ;;
    --dry-run) dry=1; shift ;;
    --scale-root) scale_root="${2:-}"; shift 2 ;;
    -*) usage; exit 2 ;;
    *) pairs+=("$1"); shift ;;
  esac
done

if [[ -z "$scale_root" ]]; then
  scale_root="$(cd "$home_root/scale" 2>/dev/null && pwd -P || true)"
fi
if [[ -z "$scale_root" || ! -d "$scale_root/.git" ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: canonical checkout unavailable.' >&2
  exit 2
fi
if [[ $(( ${#pairs[@]} % 2 )) -ne 0 || ${#pairs[@]} -eq 0 ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: expected at least one <source> <canonical-rel> pair.' >&2
  usage
  exit 2
fi
if [[ "$push" -eq 1 && -z "$commit_msg" ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: --push requires --commit.' >&2
  exit 2
fi

project_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Validate destinations and resolve sources up front (fail before mutating).
declare -a sources dests
i=0
while [[ $i -lt ${#pairs[@]} ]]; do
  src="${pairs[$i]}"
  rel="${pairs[$((i + 1))]}"
  if [[ "$rel" == /* || "$rel" == *"/../"* || "$rel" == ../* || "$rel" == *".." ]]; then
    printf 'S.C.A.L.E. Hermes: destination escapes canonical checkout: %s\n' "$rel" >&2
    exit 2
  fi
  if [[ -z "$src" || -z "$rel" ]]; then
    printf '%s\n' 'S.C.A.L.E. Hermes: empty source or destination.' >&2
    exit 2
  fi
  src_abs="$(cd "$(dirname "$src")" 2>/dev/null && pwd)/$(basename "$src")"
  [[ -e "$src_abs" ]] || { printf 'S.C.A.L.E. Hermes: source not found: %s\n' "$src" >&2; exit 2; }
  case "$src_abs" in
    "$project_root/.git"/*|"$project_root/.git") printf '%s\n' 'S.C.A.L.E. Hermes: refusing to promote .git.' >&2; exit 2 ;;
  esac
  dest_abs="$scale_root/$rel"
  case "$dest_abs" in
    "$scale_root"/*) ;;
    *) printf 'S.C.A.L.E. Hermes: destination escapes canonical checkout: %s\n' "$rel" >&2; exit 2 ;;
  esac
  sources+=("$src_abs")
  dests+=("$rel")
  printf 'S.C.A.L.E. Hermes: promote %s -> %s\n' "$src_abs" "$rel"
  i=$((i + 2))
done

if [[ "$dry" -eq 1 ]]; then
  printf '%s\n' 'S.C.A.L.E. Hermes: dry run; nothing was copied or committed.'
  exit 0
fi

# Copy artifacts into the canonical checkout.
i=0
while [[ $i -lt ${#sources[@]} ]]; do
  dest_abs="$scale_root/${dests[$i]}"
  mkdir -p "$(dirname "$dest_abs")"
  if [[ -d "${sources[$i]}" ]]; then
    cp -R "${sources[$i]}" "$dest_abs"
  else
    cp "${sources[$i]}" "$dest_abs"
  fi
  i=$((i + 1))
done

if [[ "$validate" -eq 1 ]]; then
  ( cd "$scale_root" \
      && node scripts/validate-scale-model-registry.mjs \
      && bash scripts/validate-scale-agents.sh \
      && bash scripts/validate-scale-library.sh \
      && bash hermes/scripts/validate-scale-hermes-install.sh ) \
    || { printf '%s\n' 'S.C.A.L.E. Hermes: validation failed; nothing was committed.' >&2; exit 1; }
fi

if [[ -n "$commit_msg" ]]; then
  git -C "$scale_root" add -- "${dests[@]}"
  git -C "$scale_root" commit -q -m "$commit_msg"
  printf 'S.C.A.L.E. Hermes: committed %s\n' "$(git -C "$scale_root" rev-parse --short HEAD)"
fi

if [[ "$push" -eq 1 ]]; then
  branch="$(git -C "$scale_root" rev-parse --abbrev-ref HEAD)"
  export GIT_TERMINAL_PROMPT=0
  git -C "$scale_root" push origin "HEAD:$branch"
  printf 'S.C.A.L.E. Hermes: pushed %s to origin/%s\n' \
    "$(git -C "$scale_root" rev-parse --short HEAD)" "$branch"
fi

printf '%s\n' 'S.C.A.L.E. Hermes: promotion complete.'
