#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
taxonomy="$root/library/tag-taxonomy.md"
status=0

for entry in "$root"/library/rules/*.md "$root"/library/books/*.md; do
  [[ -f "$entry" ]] || continue
  [[ "$(basename "$entry")" == "README.md" ]] && continue
  if ! awk 'NR == 1 { in_frontmatter = ($0 == "---") } in_frontmatter && /^description:/ { description = 1 } in_frontmatter && /^tags: \[/ { tags = $0 } NR > 1 && $0 == "---" { exit !(description && tags) }' "$entry"; then
    printf 'Invalid library frontmatter: %s\n' "$entry" >&2
    status=1
    continue
  fi
  tag_line="$(awk '/^tags: \[/ { print; exit }' "$entry")"
  tag_values="${tag_line#tags: [}"
  tag_values="${tag_values%]}"
  IFS=',' read -r -a tag_list <<< "$tag_values"
  for tag in "${tag_list[@]}"; do
    tag="$(printf '%s' "$tag" | tr -d ' \t\"')"
    if [[ -n "$tag" ]] && ! rg -q -- "^- \`$tag\` —" "$taxonomy"; then
      printf 'Unregistered tag %s in %s\n' "$tag" "$entry" >&2
      status=1
    fi
  done
done

for profile in "$root"/.codex/agents/scale_*.toml; do
  agent_name="$(basename "$profile" .toml)"
  quirk_file="$root/library/quirks/$agent_name.md"
  if [[ ! -f "$quirk_file" ]]; then
    printf 'Missing persistent quirks file: %s\n' "$quirk_file" >&2
    status=1
  fi
done

if [[ "$status" -eq 0 ]]; then
  printf '%s\n' 'Validated S.C.A.L.E. library metadata, taxonomy, and persistent quirks.'
fi
exit "$status"
