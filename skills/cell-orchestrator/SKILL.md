---
name: cell-orchestrator
description: Route a software task through C.E.L.L.'s Codex-native custom agents, using the repository's explicit model and reasoning assignments. Use for multi-step work that benefits from focused delegation and independent verification.
---

# C.E.L.L. Orchestrator

Read `AGENTS.md` and select only the roles relevant to the current request. C.E.L.L. is a knowledge lifecycle, not merely a role list: agents retrieve tagged knowledge, validate durable additions, and use Git to synchronize the canonical library. The profiles live in `.codex/agents/`; each fixes that role's model and `model_reasoning_effort`.

## Workflow

1. Refresh a connected `.codex/cell-library-src` clone before retrieving knowledge; SessionStart normally handles this, but verify its state when the task depends on fresh knowledge.
2. Break the request into independent, bounded subtasks. Assign every subtask a single owner and avoid overlapping writes.
3. Spawn the role by its configured name. Do not override its `model` or `model_reasoning_effort` unless the user explicitly changes the routing policy.
4. For `deepseek-v4-flash` roles, send one concise work order containing: objective, scope/files, acceptance criteria, output format, and an explicit stop condition. Do not bundle unrelated investigation and implementation.
5. Run read-only mapping, research, security, or QA work in parallel when their outputs do not depend on each other. Run dependent implementation and validation sequentially.
6. When durable knowledge changes, route it through `cell_builder` or `cell_research`, validate with `cell_qa`, then invoke `cell_git` to promote only the named library files to the canonical remote.

## Escalation

- Send high-impact design, security, or backend decisions to `cell_architect`, `cell_security`, or `cell_backend`.
- If a routine agent uncovers a cross-cutting risk, stop its task and route the decision to the relevant stronger specialist.
- Never treat an unverified agent report as proof that a code change works.
