---
name: scale
description: Use S.C.A.L.E. in Hermes for token-efficient project work and governed knowledge retrieval.
---

# S.C.A.L.E. for Hermes

S.C.A.L.E. is a lightweight workflow for selecting the smallest useful amount
of analysis, implementation, delegation, and validation.

## Default: direct and bounded

For one atomic, low-risk action with a clear acceptance check:

1. Inspect only the relevant files.
2. Implement directly in the current Hermes session.
3. Run the smallest meaningful check once.
4. Stop when the acceptance check passes.

Do **not** spawn a child, write a long plan, scan the whole repository, or load
the whole SCALE library for this path.

## When to use orchestration

Load `scale-orchestrator` only when the task is compound, high-impact,
ambiguous, explicitly requests SCALE routing, or has genuinely independent
subtasks. Delegation is optional, not mandatory: use it only when the expected
benefit exceeds the extra prompt and tool-call cost. Default to at most two
leaf children and never create nested delegation for routine work.

## Knowledge retrieval

SCALE knowledge is stored at `${HERMES_HOME:-$HOME/.hermes}/scale/library`
when installed. Use only the matching entries:

```bash
${HERMES_HOME:-$HOME/.hermes}/scale/library/find-by-tag.sh <tag>
```

If that helper is unavailable, use file search on that directory. Read the
returned files, not the entire library. Prefer `curated` entries; treat
candidate or deprecated entries as non-authoritative. Project-specific facts
belong in the project's `AGENTS.md` or `docs.llm/`, not in the global library.

## Routing contracts

These are prompt contracts, not 32 permanently loaded agents:

| Need | Smallest useful route |
| --- | --- |
| One isolated change | direct current session |
| Architecture/scope | `scale-orchestrator` reasoning pass |
| Implementation | current session; delegate only if independent |
| Security or public-contract risk | read-only audit before mutation |
| Research | source-backed, narrow lookup |
| QA | one independent final check |
| Project initialization | `scale-genesis` |
| SCALE/library validation | `scale-validate` |

Use the current Hermes-configured model by default. Do not change providers,
credentials, global `base_url`, or model aliases as an implicit part of SCALE.
OpenCode Go is a native Hermes worker route through the `opencode-go` provider;
the legacy Codex dispatcher, gateway, and protocol shims have been removed.
Named fallbacks always stay on Codex lanes.

## Budget invariants

- Keep work orders and task briefs concise (roughly 600 tokens unless more is
  justified by acceptance criteria).
- Pass exact files, constraints, and acceptance checks instead of broad
  repository context.
- Batch independent read-only checks.
- Run one final validation pass; repair once only when the failed evidence
  points to a concrete fix.
- Preserve prompt caching: do not mutate the system prompt, toolset, or old
  conversation context mid-session.
- Never claim a delegated report proves that code works; verify the artifact.

For detailed routing, load `scale-orchestrator`. For initialization or
validation, load the matching specialized skill rather than this whole
workflow.
