---
name: scale-orchestrator
description: Route a multi-step software task through S.C.A.L.E. custom agents with explicit model, reasoning, sandbox, and validation ownership. Use when focused delegation, OpenCode Go DeepSeek V4 Flash work orders, or independent QA improves a Codex task.
---

# S.C.A.L.E. Orchestrator

Read `AGENTS.md` and select only the roles relevant to the current request. S.C.A.L.E. is a knowledge lifecycle, not merely a role list: agents retrieve tagged knowledge, validate durable additions, and use Git to synchronize the canonical library. The profiles live in `.codex/agents/`; each fixes that role's model and `model_reasoning_effort`.

## Workflow

1. Refresh a connected `.codex/scale-library-src` clone before retrieving knowledge; SessionStart normally handles this, but verify its state when the task depends on fresh knowledge.
2. Classify the request before creating agents. If the caller already supplies an explicit SCALE profile, bounded files, acceptance criteria, a low-risk scope, and a stop condition, use the direct route: invoke that profile once and do not spend an additional orchestration turn. Use `scale_orchestrator` only when decomposition, model selection, or cross-agent dependencies are genuinely ambiguous.
3. For genuinely multi-model work, begin with `scale_orchestrator` (OpenCode Go DeepSeek V4 Flash High). It selects the exact `agent_bindings` record in `library/model-registry.json`; do not infer a model from the role name or line count. Its native Codex Luna profile is the gateway/fallback, not a DeepSeek API route.
4. Select an `external-cli` specialist only when its `use_when` condition applies and the work is non-sensitive. Create one concise work order containing objective, scope/files, acceptance criteria, output format, and an explicit stop condition. The registry supplies a cheaper per-profile budget before the hard cap. Pass only the necessary `--context-file` paths and invoke `scripts/scale-opencode-dispatch.mjs` with the project root, profile, and work-order file. Do not override the external agent's model or reasoning effort.
5. The orchestrator may request one bounded budget adjustment only when the baseline is insufficient. Write a small JSON file with `issuer: "scale_orchestrator"`, one allowed `reason` (`multi_step_plan`, `long_monitoring`, or `large_context_evidence`), a positive `estimate`, and at most two requested budget fields. Never request an increase speculatively: leave the default budget unchanged when it is sufficient. The dispatcher enforces per-dimension deltas, hard caps, and the agent's declared step contract, then records the adjustment in telemetry.
6. A dispatcher exit of 75 is a Go quota/catalog/timeout failure. Route the unchanged work order once to the stated native fallback profile; the telemetry escalation budget rejects a second fallback. Do not retry or silently upgrade to another Go model. Kimi K2.7 Code produces a design packet only; `scale_frontend` on Terra implements it. `scale_security` and `scale_git` stay native.
7. Run read-only mapping, research, security, or QA work in parallel when their outputs do not depend on each other. Run dependent implementation and validation sequentially.
8. When durable knowledge changes, require provenance, validation evidence, review/expiry metadata, and explicit conflict handling. Route it through `scale_builder` or `scale_research`, validate with `scale_qa`, then invoke `scale_git` to promote only the named library files to the canonical remote. A strong external result is evidence, not an automatic global promotion.

## Escalation

- Send high-impact design, security, or backend decisions to `scale_architect`, `scale_security`, or `scale_backend`.
- If a routine agent uncovers a cross-cutting risk, stop its task and route the decision to the relevant stronger specialist.
- Never treat an unverified agent report as proof that a code change works.
