---
name: scale-orchestrator
description: Route a multi-step software task through S.C.A.L.E. with explicit model, reasoning, sandbox, and validation ownership. Use native Codex children for native bindings and one-shot plaintext work orders for OpenCode Go bindings.
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

### Delegation-first execution firewall

The main session agent is an orchestrator for compound work, not its default
implementer. It must dispatch at least one bounded executor after the Master
gate. One best-fit executor is the token-saving default; parallel work is
allowed only when scopes are independent. Before dispatch, the main agent may
classify the request, read routing metadata, write the work order, and dispatch.
After dispatch it may inspect the result, run batched deterministic validation,
and report. It must not edit product/library files, perform a broad unbounded
scan, or silently repair delegated work. Repairs remain delegated and continue
only while token budget and validated acceptance progress permit; stop on
acceptance, cancellation, budget exhaustion, repeated no-progress, unsafe
boundary, or native escalation, with telemetry. Repair pass count is not a
termination condition. Only the single-atomic-low-risk direct-route exception
may bypass this firewall.

### Plaintext OpenCode execution beside Codex

Codex `thread_spawn` may encrypt the child task and carry provider-specific
history. Therefore an OpenCode Go primary is never spawned as a Codex child.
The host writes a bounded JSON work order and calls
`scripts/scale-plaintext-runner.mjs`; the runner sends one context-complete
Responses request and returns analysis or a patch draft for the host to inspect.
Named TOML cards for those roles pin only their native fallback identity.

1. Refresh a connected `.codex/scale-library-src` clone before retrieving knowledge; SessionStart normally handles this, but verify its state when the task depends on fresh knowledge. Before acting on cold project, production-surface, subsystem, or decision context, require bounded read-only Memora retrieval; missing or insufficient provenance blocks the action or escalates native.
2. Classify the request before creating agents. If the caller already supplies an explicit SCALE profile, bounded files, acceptance criteria, a low-risk scope, and a stop condition, use the direct route once.
3. Resolve the `scale_orchestrator` binding in `library/model-registry.json`. Its primary is plaintext-external OpenCode Go DeepSeek V4 Flash High; its named Codex profile is native Luna High fallback only.
4. Write one concise work order with objective, scope/files, acceptance criteria, output format, and stop condition for the mapped role.
5. The orchestrator may request one bounded budget adjustment only when the baseline is insufficient; hard caps and the one-fallback rule remain authoritative.
6. For `plaintext-external`, serialize the work order using `scripts/schemas/scale-plaintext-work-order.schema.json`, then run `node scripts/scale-plaintext-runner.mjs --work-order <file> --project-root <project>`. Inspect its output; the runner never applies its patch draft.
7. If the runner returns `fallback_required` (exit 75), spawn the named native fallback as a fresh task using the embedded unchanged work order. Do not resume the external response, retry, or silently upgrade. Kimi K3 produces a design packet only; `scale_frontend` on Terra implements it. `scale_security` and `scale_git` stay native.
8. Require each native spawned agent's first message to match its TOML identity. For plaintext execution trust only the runner identity derived from `response.model`; do not trust a banner written by the model.
9. Run read-only mapping, research, security, or QA work in parallel when their outputs do not depend on each other. Run dependent implementation and validation sequentially.
10. When durable knowledge changes, require provenance, validation evidence, review/expiry metadata, and explicit conflict handling. Route it through `scale_builder` or `scale_research`, validate with `scale_qa`, then invoke `scale_git` to promote only the named library files to the canonical remote. A strong external result is evidence, not an automatic global promotion.

## Escalation

- Send high-impact design, security, or backend decisions to `scale_architect`, `scale_security`, or `scale_backend`.
- If a routine agent uncovers a cross-cutting risk, stop its task and route the decision to the relevant stronger specialist.
- Never treat an unverified agent report as proof that a code change works.

## Batched validation

For compound work, run batched validation for the whole task; do not run the
same check after every bullet. After each delegated repair, rerun only changed
acceptance checks and continue or stop according to the documented stop
conditions. Do not rerun passing checks unless changed files invalidate their
evidence or the registry explicitly requires a critical full suite.

The Master returns the compact Task Brief in `references/task-brief.md`:
normalized objective, assumptions, ambiguities, risk/sensitivity, acceptance
criteria, the smallest agent set, dependencies, one batched validation plan,
stop condition, and confidence.
