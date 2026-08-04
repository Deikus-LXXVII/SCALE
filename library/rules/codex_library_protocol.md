---
description: "Protocol for retrieving, evolving, validating, and globally synchronizing S.C.A.L.E. knowledge in Codex."
tags: [codex, ai-agents, agent-design, verification, git]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# S.C.A.L.E. Knowledge Protocol

1. Resolve the active library: a connected project uses `.codex/scale-library/`; the canonical S.C.A.L.E. repository uses its local `library/` directory.
2. Refresh a connected clone with a fast-forward-only pull before retrieval. If it has local changes or refresh fails, keep working from the last valid snapshot and report the state.
3. Retrieve applicable knowledge only through `find-by-tag.sh <tag...>`. Do not scan the complete library.
4. Reuse canonical tags. Before creating a rule, book, or catalog entry, compare its concepts semantically with `tag-taxonomy.md`; register a genuinely new tag in the same change.
5. Store a new verified fact in the right layer: task-specific context in `docs.llm/`, durable domain guidance in `rules/`, source-backed research in `books/`, role designs in `agents/`, and role-local operational observations in `quirks/`.
6. Every durable entry must carry `status`, `provenance.source`, `provenance.evidence`, `provenance.compatibility`, `provenance.validated_on`, and `provenance.review_after`. Use `candidate` for shadow evaluation; use `curated` only after deterministic checks or human review. Declare `conflicts_with` and `supersedes` references when applicable. Never promote a one-off success as a global rule automatically.
7. Validate all changed agent profiles and library metadata independently before promotion. Run `scripts/validate-scale-knowledge.sh` to detect expired entries, duplicate descriptions, and broken conflict/supersession references.
8. Promote only focused changed files to the canonical Git repository. Pull first, use a specific commit, push without force, and on non-fast-forward perform one rebase-and-retry before reporting a conflict.
