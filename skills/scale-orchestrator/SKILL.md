---
name: scale-orchestrator
description: Route a multi-step software task through S.C.A.L.E. custom agents with explicit model, reasoning, sandbox, and validation ownership. Use when focused delegation, OpenCode Go DeepSeek V4 Flash work orders, or independent QA improves a Codex task.
---

# S.C.A.L.E. Orchestrator

Read `AGENTS.md` and select only the roles relevant to the current request. S.C.A.L.E. is a knowledge lifecycle, not merely a role list: agents retrieve tagged knowledge, validate durable additions, and use Git to synchronize the canonical library. The profiles live in `.codex/agents/`; each fixes that role's model and `model_reasoning_effort`.

## Workflow

### Master gate

The direct-route exception below applies only to one atomic, low-risk action
with an obvious acceptance check and one mutation surface. Every compound task,
task with more than one action, or task expressed as a bullet list must first
go through `scale_orchestrator` as the SCALE Master, even when the wording is
already clear. The Master may return a one-agent plan, so this gate does not
force unnecessary specialist fan-out.

### Isolated OpenCode execution

The Codex custom-agent card remains on its native Luna/Terra/Sol fallback.
OpenCode Go runs natively through the Hermes `opencode-go` provider with a
bounded, privacy-gated work order. Do not set a global `openai_base_url`; the
legacy dispatcher, gateway, and protocol shims were removed.

1. Refresh a connected `.codex/scale-library-src` clone before retrieving knowledge; SessionStart normally handles this, but verify its state when the task depends on fresh knowledge.
2. Classify the request before creating agents. If the caller already supplies an explicit SCALE profile, bounded files, acceptance criteria, a low-risk scope, and a stop condition, use the direct route once.
3. For genuinely multi-model work, resolve the `scale_orchestrator` binding in `library/model-registry.json`. Its visible Codex profile is Luna xhigh fallback; OpenCode Go DeepSeek V4 Flash High is the native `hermes-native` primary route.
4. Write one concise work order with objective, scope/files, acceptance criteria, output format, and stop condition for the mapped role.
5. The orchestrator may request one bounded budget adjustment only when the baseline is insufficient; hard caps and the one-fallback rule remain authoritative.
6. An OpenCode Go provider failure routes the unchanged work order once to the named native fallback. Do not retry or silently upgrade. Kimi K3 produces a design packet only; `scale_frontend` on Terra implements it. `scale_security` and `scale_git` stay native.
7. Run read-only mapping, research, security, or QA work in parallel when their outputs do not depend on each other. Run dependent implementation and validation sequentially.
8. When durable knowledge changes, require provenance, validation evidence, review/expiry metadata, and explicit conflict handling. Route it through `scale_builder` or `scale_research`, validate with `scale_qa`, then invoke `scale_git` to promote only the named library files to the canonical remote. A strong external result is evidence, not an automatic global promotion.

## Escalation

- Send high-impact design, security, or backend decisions to `scale_architect`, `scale_security`, or `scale_backend`.
- If a routine agent uncovers a cross-cutting risk, stop its task and route the decision to the relevant stronger specialist.
- Never treat an unverified agent report as proof that a code change works.

## Batched validation

For compound work, run one final batched validation pass for the whole task;
do not run the same check after every bullet. Re-run only the failed check after
a repair, then stop after one final acceptance pass. Do not rerun passing checks
unless changed files invalidate their evidence or the registry explicitly
requires a critical full suite.

The Master returns the compact Task Brief in `references/task-brief.md`:
normalized objective, assumptions, ambiguities, risk/sensitivity, acceptance
criteria, the smallest agent set, dependencies, one batched validation plan,
stop condition, and confidence.
