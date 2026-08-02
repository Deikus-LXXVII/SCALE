---
description: "Protocol for retrieving, evolving, validating, and globally synchronizing C.E.L.L. knowledge in Codex."
tags: [codex, ai-agents, agent-design, verification, git]
---
# C.E.L.L. Knowledge Protocol

1. Resolve the active library: a connected project uses `.codex/cell-library/`; the canonical C.E.L.L. repository uses its local `library/` directory.
2. Refresh a connected clone with a fast-forward-only pull before retrieval. If it has local changes or refresh fails, keep working from the last valid snapshot and report the state.
3. Retrieve applicable knowledge only through `find-by-tag.sh <tag...>`. Do not scan the complete library.
4. Reuse canonical tags. Before creating a rule, book, or catalog entry, compare its concepts semantically with `tag-taxonomy.md`; register a genuinely new tag in the same change.
5. Store a new verified fact in the right layer: task-specific context in `docs.llm/`, durable domain guidance in `rules/`, source-backed research in `books/`, role designs in `agents/`, and role-local operational observations in `quirks/`.
6. Validate all changed agent profiles and library metadata independently before promotion.
7. Promote only focused changed files to the canonical Git repository. Pull first, use a specific commit, push without force, and on non-fast-forward perform one rebase-and-retry before reporting a conflict.
