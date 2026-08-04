# S.C.A.L.E. hybrid model routing

The registry is authoritative. Codex provides native model authority and
fallbacks; OpenCode Go owns every DeepSeek V4 Flash route behind a local CLI
adapter. Each native profile has an explicit model, reasoning effort, and
sandbox. Each Go specialist has a narrow `use_when` condition and a single
native fallback.

| Work | Default owner | Optional specialist | Boundary |
| --- | --- | --- | --- |
| Control plane | Go DeepSeek V4 Flash High | Codex Luna High fallback | Decompose, select, validate handoffs. |
| Simple code | Go DeepSeek V4 Flash High | Codex Terra High fallback | Only isolated non-sensitive work with explicit tests. |
| Standard implementation | Codex Terra High | Go DeepSeek V4 Pro High | Explicit capacity decision for a bounded non-sensitive work order. |
| Critical/security | Codex Sol High | Read-only evidence only | Sol remains authority; no external final decision. |
| Web design | Go Kimi K3, max | None | Premium design brief only; no production edits. User-directed only because of cost. |
| Frontend implementation | Codex Terra High | Go Qwen3.7 Plus High | Qwen may prototype; Terra integrates and validates production code. |
| Routine/docs/environment/indexing | Go DeepSeek V4 Flash High | Codex Luna High fallback | Non-sensitive bounded handoff only. |
| Prompt/research | Codex Luna/Terra High | Go Luna/GLM High | Advisory non-sensitive packet only. |

## Selecting a Go specialist

Use the specialist only when all conditions are true:

1. Its `use_when` condition in `model-registry.json` matches.
2. The work has no secret, credential, private key, production dump,
   authentication material, or security investigation.
3. The work order has one objective, scoped files, acceptance criteria, output
   format, and stop condition.
4. The expected cost/benefit is explicit. Do not use Kimi K3 merely because it is
   available: its placement is reserved for high-value visual design tasks.

Run:

```bash
node scripts/scale-opencode-dispatch.mjs \
  --target /absolute/path/to/project \
  --profile scale_frontend \
  --specialist go-visual-prototype \
  --work-order /absolute/path/to/work-order.md
```

The command exits 75 with a JSON native fallback if Go cannot serve the model
or reports a limit. Route the unchanged work order once to that profile. Do not
retry Go or fall through to another Go model automatically.

## Budget selection and bounded adjustment

`library/model-registry.json` contains a cheap default budget, per-profile
overrides, and hard caps. The dispatcher always applies the profile budget
first. `scale_test_observer` uses a dedicated read-only monitor agent with a
larger time/step allowance; ordinary routine and exploration lanes remain
smaller to conserve tokens.

Only the orchestrator may submit one adjustment file, and only when the
baseline is demonstrably insufficient. Example:

```json
{
  "issuer": "scale_orchestrator",
  "reason": "long_monitoring",
  "estimate": {"estimated_minutes": 18, "estimated_steps": 16},
  "requested": {"max_dispatch_ms": 1200000, "max_agent_steps": 24}
}
```

The request is limited to two dimensions, bounded deltas, the hard registry
caps, and the OpenCode agent's declared `steps`. A missing or speculative
request is rejected; keeping the baseline is the token-saving default.
