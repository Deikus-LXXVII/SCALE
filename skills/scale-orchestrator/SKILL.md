---
name: scale-orchestrator
description: Route a multi-step software task through S.C.A.L.E. custom agents with explicit model, reasoning, sandbox, and validation ownership. Use when focused delegation, DeepSeek V4 Flash work orders, or independent QA improves a Codex task.
---

# S.C.A.L.E. Orchestrator

Read `AGENTS.md` and select only the roles relevant to the current request. S.C.A.L.E. is a knowledge lifecycle, not merely a role list: agents retrieve tagged knowledge, validate durable additions, and use Git to synchronize the canonical library. The profiles live in `.codex/agents/`; each fixes that role's model and `model_reasoning_effort`.

## Workflow

1. Refresh a connected `.codex/scale-library-src` clone before retrieving knowledge; SessionStart normally handles this, but verify its state when the task depends on fresh knowledge.
2. Break the request into independent, bounded subtasks. Assign every subtask a single owner and avoid overlapping writes.
3. For code, route by `library/model-registry.json`: `scale_code_simple` for isolated low-risk changes, `scale_code_standard` for ordinary multi-file work, and `scale_code_critical` for high-impact or cross-cutting work. Do not use line count alone as a complexity signal.
4. Spawn the selected role by its configured name. Do not override its `model` or `model_reasoning_effort` unless the user explicitly changes the routing policy.
5. For `deepseek-v4-flash` roles, send one concise work order containing: objective, scope/files, acceptance criteria, output format, and an explicit stop condition. Trust DeepSeek with evidence-backed mapping, diagnosis, documentation, and isolated low-risk changes inside its assigned scope; do not bundle unrelated investigation and implementation.
6. Run read-only mapping, research, security, or QA work in parallel when their outputs do not depend on each other. Run dependent implementation and validation sequentially.
7. When durable knowledge changes, route it through `scale_builder` or `scale_research`, validate with `scale_qa`, then invoke `scale_git` to promote only the named library files to the canonical remote. A strong DeepSeek result is evidence, not an automatic global promotion.

## Escalation

- Send high-impact design, security, or backend decisions to `scale_architect`, `scale_security`, or `scale_backend`.
- If a routine agent uncovers a cross-cutting risk, stop its task and route the decision to the relevant stronger specialist.
- Never treat an unverified agent report as proof that a code change works.
