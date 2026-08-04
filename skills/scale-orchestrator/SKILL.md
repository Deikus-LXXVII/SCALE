---
name: scale-orchestrator
description: Route a multi-step software task through S.C.A.L.E. custom agents with explicit model, reasoning, sandbox, and validation ownership. Use when focused delegation, DeepSeek V4 Flash work orders, or independent QA improves a Codex task.
---

# S.C.A.L.E. Orchestrator

Read `AGENTS.md` and select only the roles relevant to the current request. S.C.A.L.E. is a knowledge lifecycle, not merely a role list: agents retrieve tagged knowledge, validate durable additions, and use Git to synchronize the canonical library. The profiles live in `.codex/agents/`; each fixes that role's model and `model_reasoning_effort`.

## Workflow

1. Refresh a connected `.codex/scale-library-src` clone before retrieving knowledge; SessionStart normally handles this, but verify its state when the task depends on fresh knowledge.
2. Break the request into independent, bounded subtasks. Assign every subtask a single owner and avoid overlapping writes.
3. Begin multi-model work with `scale_orchestrator` (Codex DeepSeek V4 Flash High). It selects the exact `agent_bindings` record in `library/model-registry.json`; do not infer a model from the role name or line count. The binding's native `primary` is the default.
4. Select an `external-cli` specialist only when its `use_when` condition applies and the work is non-sensitive. Create one concise work order containing objective, scope/files, acceptance criteria, output format, and an explicit stop condition. Invoke `scripts/scale-opencode-dispatch.mjs` with the project root, profile, work-order file, and `--specialist <id>`. Do not override the external agent's model or reasoning effort.
5. A dispatcher exit of 75 is a Go quota/catalog failure. Route the unchanged work order once to the stated native fallback profile. Do not retry or silently upgrade to another Go model. Kimi K2.7 Code produces a design packet only; `scale_frontend` on Terra implements it. `scale_security` and `scale_git` stay native.
6. Run read-only mapping, research, security, or QA work in parallel when their outputs do not depend on each other. Run dependent implementation and validation sequentially.
7. When durable knowledge changes, route it through `scale_builder` or `scale_research`, validate with `scale_qa`, then invoke `scale_git` to promote only the named library files to the canonical remote. A strong external result is evidence, not an automatic global promotion.

## Escalation

- Send high-impact design, security, or backend decisions to `scale_architect`, `scale_security`, or `scale_backend`.
- If a routine agent uncovers a cross-cutting risk, stop its task and route the decision to the relevant stronger specialist.
- Never treat an unverified agent report as proof that a code change works.
