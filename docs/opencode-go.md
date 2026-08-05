# OpenCode Go in S.C.A.L.E.

OpenCode Go is a separately metered model pool reached through OpenCodex 2.10+.
SCALE uses it as a one-request plaintext gateway. It does not use OpenCode as a
Codex `thread_spawn` child because encrypted task payloads and provider-specific
reasoning history cannot be replayed reliably across providers.

## Runtime contract

- Native ChatGPT/Codex remains the default OpenCodex provider and uses direct
  caller OAuth forwarding.
- OpenCode Go credentials are read from the user's OpenCode credential store
  and are never written to SCALE, telemetry, work orders, or Git.
- Each OpenCode role receives one schema-validated, context-complete work order.
  The runner sends no hidden history, tools, or `previous_response_id`.
- OpenCode output is a read-only analysis or unified-diff draft. Codex inspects
  and applies it; the external model never claims tool execution.
- Named `.codex/agents/<role>.toml` cards for an external primary pin its native
  fallback, not the OpenCode model.
- Models without a normal production role receive a bounded runner-only
  `scale_model_lab_*` binding. Regenerate those bindings and fallback cards with
  `node scripts/scale-generate-model-lab-agents.mjs`; the operation is
  idempotent.
- A launchd-managed OpenCodex service keeps the local gateway alive. A failure
  produces a machine-readable request for one separate native fallback.

## Installation and recovery

```bash
./scripts/scale-install-opencodex.sh --apply
./scripts/scale-codex-recover.sh status
./scripts/scale-codex-recover.sh restore
./scripts/scale-codex-recover.sh runner-start
```

`runner-start`/`reconnect` starts and health-checks OpenCodex without stopping a
healthy proxy or changing the model catalog. `restore` is now a no-op when the
gateway is healthy and refuses destructive recovery when it is not. Use
`native-restore` only when you explicitly accept removing OpenCode models and
restarting Codex Desktop.

## Routing policy

| Work | Primary | Native fallback/authority |
| --- | --- | --- |
| Control plane and simple code | DeepSeek V4 Flash High | Luna High |
| Standard code and focused tests | DeepSeek V4 Pro High | Luna High; Terra/Sol own sensitive decisions |
| Research/model operations | GLM 5.2 High | Luna High |
| Prompt work | Qwen 3.7 Plus High | Luna High |
| Critical/security/backend/Git | Native Sol at Medium or High | Never external final authority |
| Web design | Kimi K3 Max | Terra High implements production UI |
| Production frontend/domain integration | Terra High | Native authority |

Every profile's first assistant message must declare its exact SCALE role,
selected model, and reasoning effort. For plaintext execution the runner derives
identity from `response.model`; model-authored banners are not trusted.

## Plaintext work order

```bash
node scripts/scale-plaintext-runner.mjs \
  --work-order .codex/.workorders/task.json \
  --project-root "$PWD"
```

Exit 0 returns `completed`. Exit 75 returns `fallback_required` with the
unchanged work order and exact native profile. Start that fallback as a new
Codex task; never retry or resume the external response.

## Validation

```bash
node scripts/validate-scale-model-registry.mjs --catalog "$HOME/.codex/models.json"
bash scripts/validate-scale-agents.sh
ocx health --json
```

Use one bounded work order, the smallest per-profile context/step budget, one
fallback at most, and deterministic local validation. Never configure the
DeepSeek API.
