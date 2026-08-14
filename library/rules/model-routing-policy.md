---
description: "Provider-neutral hybrid policy for assigning Codex primaries and OpenCode Go specialists."
tags: [codex, ai-agents, verification]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---

# Hybrid model-routing policy

S.C.A.L.E. selects a model after classifying authority, sensitivity, required
modality/context, task scope, and cost. It never treats a provider subscription
as a reason to replace all Codex roles.

1. Start with the role's native `primary` in `model-registry.json`.
2. Use an OpenCode Go `specialist` only if its `use_when` condition is true,
   the request is non-sensitive, its result is bounded by a work order, and
   the work order contains only coordinator-authored plaintext context. Hidden
   or encrypted Codex child state is native-only; if it is essential, route to
   native Codex instead.
3. A Go failure or quota signal returns exactly one stated native fallback. Do
   not retry Go or silently select a more expensive Go model.
   The runner sends no `previous_response_id` and rejects continuation metadata.
   Before acting on cold project, production-surface, subsystem, or decision
   context, require bounded read-only Memora retrieval; unavailable or
   insufficiently proven context blocks or escalates native.
4. Sol remains final authority for security, critical decisions, and promotion;
   Sol is hard-capped at `high` reasoning. Never assign `xhigh` or `max` to a
   Sol profile, route, fallback, or overlay;
   Terra owns production multi-file and frontend implementation; OpenCode Go
   DeepSeek V4 Flash owns all DeepSeek orchestration and routine work. Do not
   configure the DeepSeek API in Codex.
5. Kimi K3 at max reasoning is a premium design specialist only: visual direction,
   design critique, responsive hierarchy, and component specification. It does
   not implement production UI. `scale_frontend` on Terra implements the
   validated design handoff. Its reasoning is recorded as `max` because the Go
   catalog exposes only the max Kimi K3 variant. It is user-directed and never
   an automatic fallback because of its cost.
6. Qwen3.7 Plus may supply a non-sensitive visual prototype, but it is not the
   authority for final product integration. New primary assignments require a
   focused benchmark and registry validation.
7. Runtime budgets are selected per profile from `model-registry.json`, with a
   smaller default than the hard cap to conserve tokens. The orchestrator may
   request one evidence-backed adjustment for `multi_step_plan`,
   `long_monitoring`, or `large_context_evidence`, limited to two dimensions
   and the agent's declared step contract. A sufficient baseline must not be
   enlarged speculatively.
