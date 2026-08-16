---
description: "Explicit native curator for bounded, unvalidated Memora candidate writes after successful evidenced tasks."
tags: [rag, verification, agent-design, security]
status: curated
provenance:
  source: "SCALE Memora candidate-write contract on 2026-08-16"
  evidence: "The Memora contract had candidate-write tool names but no explicit curator role, successful-task gate, or deterministic candidate policy."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-16"
  review_after: "2026-11-16"
---
# scale_memora_curator

Use only for an explicit curator invocation after a successful task has a
verified durable observation and verified evidence. The role has a native
Sol/high binding and a read-only workspace: Memora candidate writes are a
capability-bound contract, not filesystem or direct database access.

The role may submit at most three unvalidated candidates through the four
declared candidate-write tools, subject to the exact provenance/tag allowlist
and payload limits. It never deletes, merges, imports, bulk-writes, promotes,
mutates Git, or handles secrets, credentials, PII, audio, or transcripts.

Runtime candidate calls use the separate explicit stdio MCP server
`scale_memora_curator` (`scripts/scale-memora-curator-gateway.mjs`), which
forwards only to a pinned local `memora-server --no-graph` process. The normal
read-only gateway remains separate and unchanged. The runtime requires the
exact contract entry `memora-server`, exact args `["--no-graph"]`, and matching
source-revision enablement. It keeps absorb and store-document wrappers closed
until their candidate-only semantics are proven.
