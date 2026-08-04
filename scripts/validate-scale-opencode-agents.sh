#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agents_dir="$root/opencode/agents"
expected=(scale-go-explorer.md scale-go-orchestrator.md scale-go-simple-code.md scale-go-routine.md scale-go-code-standard.md scale-go-interface.md scale-go-architecture.md scale-go-prompt-qa.md scale-go-web-designer.md)

for profile in "${expected[@]}"; do
  [[ -f "$agents_dir/$profile" ]] || {
    printf 'Missing OpenCode Go agent: %s\n' "$agents_dir/$profile" >&2
    exit 1
  }
done

count=0
for profile in "$agents_dir"/scale-go-*.md; do
  [[ -f "$profile" ]] || continue
  count=$((count + 1))
  head -n 1 "$profile" | rg -qx -- '---' || {
    printf 'OpenCode Go agent has no frontmatter: %s\n' "$profile" >&2
    exit 1
  }
  rg -q '^model: opencode-go/' "$profile" || {
    printf 'OpenCode Go agent needs an explicit opencode-go model: %s\n' "$profile" >&2
    exit 1
  }
  if rg -q '^model: opencode-go/kimi-k2.7-code$' "$profile"; then
    ! rg -q '^reasoningEffort:' "$profile" || {
      printf 'Kimi K2.7 Code agent must not invent a reasoning variant: %s\n' "$profile" >&2
      exit 1
    }
  else
    rg -q '^reasoningEffort: high$' "$profile" || {
      printf 'OpenCode Go agent must use high reasoning: %s\n' "$profile" >&2
      exit 1
    }
  fi
  rg -q '^steps: [1-9][0-9]*$' "$profile" || {
    printf 'OpenCode Go agent needs a finite step budget: %s\n' "$profile" >&2
    exit 1
  }
done

[[ "$count" -ge 3 ]] || {
  printf 'Expected at least three OpenCode Go agents; found %s.\n' "$count" >&2
  exit 1
}

printf 'Validated %s S.C.A.L.E. OpenCode Go agents.\n' "$count"
