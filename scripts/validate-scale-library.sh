#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
taxonomy="$root/library/tag-taxonomy.md"
status=0

if ! node "$root/scripts/validate-scale-knowledge.mjs"; then
  status=1
fi

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

for profile in "$root"/opencode/agents/scale-go-*.md; do
  [[ -f "$profile" ]] || continue
  if ! rg -q '^model: opencode-go/' "$profile"; then
    printf 'Invalid OpenCode Go model policy: %s\n' "$profile" >&2
    status=1
  fi
  if rg -q '^model: opencode-go/kimi-k2.7-code$' "$profile"; then
    if rg -q '^reasoningEffort:' "$profile"; then
      printf 'Kimi K2.7 Code must use provider-default reasoning: %s\n' "$profile" >&2
      status=1
    fi
  elif ! rg -q '^reasoningEffort: high$' "$profile"; then
    printf 'Invalid OpenCode Go reasoning policy: %s\n' "$profile" >&2
    status=1
  fi
done

candidate_fixture="$(mktemp -d "${TMPDIR:-/tmp}/scale-candidate-fixture.XXXXXX")"
trap 'rm -rf "$candidate_fixture"' EXIT
mkdir -p "$candidate_fixture/library"/{rules,books,agents}
cp "$root/library/find-by-tag.sh" "$candidate_fixture/library/find-by-tag.sh"
printf '%s\n' '---' 'description: "candidate fixture"' 'tags: [fixture]' 'status: candidate' 'provenance:' '  source: "test"' '  evidence: "test"' '  compatibility: "test"' '  validated_on: "2026-08-04"' '  review_after: "2099-01-01"' '---' > "$candidate_fixture/library/agents/candidate.md"
if "$candidate_fixture/library/find-by-tag.sh" fixture | rg -q 'candidate.md'; then
  printf '%s\n' 'Candidate knowledge leaked into default retrieval.' >&2
  status=1
fi
if ! "$candidate_fixture/library/find-by-tag.sh" --include-candidates fixture | rg -q 'candidate.md'; then
  printf '%s\n' 'Candidate knowledge is unavailable to explicit shadow evaluation.' >&2
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  printf '%s\n' 'Validated S.C.A.L.E. library metadata, taxonomy, and persistent quirks.'
fi
exit "$status"
