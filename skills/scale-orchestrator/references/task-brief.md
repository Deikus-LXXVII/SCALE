# SCALE Master Task Brief

The Master normalizes every compound task before execution. It returns a
compact plan, not production changes and not a second user-facing answer.

```json
{
  "objective": "one normalized outcome",
  "assumptions": [],
  "ambiguities": [],
  "needs_user_input": false,
  "risk": "low|medium|high|critical",
  "sensitivity": "public|private|sensitive",
  "scope": ["paths or bounded discovery targets"],
  "acceptance_criteria": ["observable outcomes"],
  "agents": [
    {"profile": "scale_code_standard", "reason": "...", "depends_on": []}
  ],
  "execution_order": ["scale_code_standard"],
  "validation_plan": {
    "batch_commands": ["one combined focused command"],
    "max_passes": 2,
    "repair_cycle": "rerun only failed checks, then one final acceptance pass"
  },
  "stop_condition": "...",
  "confidence": 0.0
}
```

Rules:

- A bullet list is compound even when every bullet is clear.
- Keep `agents` to the smallest useful set; a one-agent plan is valid.
- Every compound brief must contain at least one executor. The main session
  agent owns routing and acceptance, not implementation. Its normal pre-dispatch
  actions are `classify → read routing metadata → write work order → dispatch`;
  its post-dispatch actions are `inspect result → batched validation → report`.
- Parallel executors are reserved for independent scopes. A repair is another
  bounded delegated task, not a silent edit by the main agent.
- Do not invent requirements. Put uncertain interpretations in `assumptions` or
  set `needs_user_input` to `true`.
- Batch independent lint, typecheck, unit, schema, and smoke checks where the
  repository permits it. Do not rerun a passing check for another bullet.
- The default is one validation pass and at most one repair cycle. Critical
  tasks may add one final acceptance command, but still must not repeat the
  full suite per subtask.
