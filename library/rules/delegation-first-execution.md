---
description: "Delegation-first execution contract for Codex session coordinators."
tags: [agent-design, codex, verification]
status: curated
provenance:
  source: "Canonical SCALE policy review and repeated session execution traces."
  evidence: "The main session agent performed implementation and repeated per-item checks instead of handing bounded work to SCALE executors; the registry now records an explicit delegation firewall."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-05"
  review_after: "2026-11-03"
---

# Delegation-first execution

The main Codex session agent coordinates compound work. It does not become the
default implementer merely because it can read files or call tools directly.

1. Treat any task with multiple actions, files, dependencies, validation steps,
   or a bullet list as compound. Pass it through the SCALE Master first.
2. Dispatch at least one bounded executor with an objective, exact scope,
   acceptance criteria, output format, and stop condition. One best-fit executor
   is the default; use parallel executors only for independent scopes.
3. Before dispatch, the main agent may classify the task, read routing metadata,
   write the work order, and dispatch. After dispatch it may inspect the result,
   run one batched deterministic validation pass, and report.
4. Do not self-implement compound work, run a broad unbounded scan before
   dispatch, or silently repair delegated changes. A failed check gets at most
   one bounded repair task, followed by the failed check and one final acceptance
   pass.
5. A direct route is allowed only for one atomic, low-risk mutation with one
   obvious acceptance check and one mutation surface.

This contract optimizes token use by delegating implementation without creating
unnecessary fan-out or repeated validation loops. Model/provider routing remains
the responsibility of `library/model-registry.json`; this rule does not change
OpenCode Go transport or model assignments.
