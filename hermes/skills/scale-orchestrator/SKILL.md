---
name: scale-orchestrator
description: Route compound Hermes project tasks through the smallest token-bounded SCALE workflow.
---

# S.C.A.L.E. Orchestrator for Hermes

Act as a compact coordinator only when direct execution is insufficient. The
orchestrator is a decision pass, not an extra ceremony for every request.

## Gate

Use direct execution when the task has one mutation surface, bounded files,
clear acceptance criteria, low risk, and an obvious stop condition. Otherwise
classify it as compound, high-impact, ambiguous, or independently splittable.

## Workflow

1. Normalize the objective in one short task brief: scope, assumptions, risk,
   acceptance check, stop condition.
2. Retrieve only relevant curated knowledge by tag from
   `${HERMES_HOME:-$HOME/.hermes}/scale/library` when it exists.
3. Select the smallest route. Prefer the current Hermes session for dependent
   implementation. Use `delegate_task` only for independent, read-only or
   bounded leaf work whose result can be verified cheaply.
4. Default limits: no more than two children, no nested delegation, concise
   context, and one fallback/repair path at most. If delegation would merely
   produce another plan, skip it.
5. Implement dependent changes sequentially in the owning session.
6. Run one batched final validation pass. Re-run only a failed check after one
   concrete repair; do not repeat passing checks.

## Risk routing

- architecture, security, data migration, public contracts: reason carefully
  and keep final authority in the owning Hermes session;
- routine isolated code, documentation, lookup: direct route first;
- independent mapping/research/QA: optional parallel leaf tasks;
- OpenCode Go: native worker route through the `opencode-go` provider; never
  a global provider change and never an external dispatcher or gateway.

## Compact task brief

Use this shape and keep it short:

```text
Objective: <one sentence>
Scope: <exact files or bounded area>
Acceptance: <observable check>
Risk: low | medium | high
Stop: <when to stop>
```

Do not include credentials, the full repository, or unrelated history. Do not
load all role profiles: Hermes delegation already provides isolated children,
and the role contract above is enough for routine routing.

## Output contract

Return only the chosen route, the bounded work order(s), acceptance checks,
and any unresolved risk. A child report is evidence, not proof: inspect and
verify the actual artifact before reporting success.
