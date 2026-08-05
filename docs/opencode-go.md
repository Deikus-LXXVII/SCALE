# OpenCode Go in S.C.A.L.E.

OpenCode Go is a separately metered model pool exposed inside Codex through
OpenCodex 2.10+. OpenCodex accepts Codex Responses requests, translates model
and tool traffic to the authenticated OpenCode Go provider, and injects the
resulting `opencode-go/<model>` entries into the Codex catalog.

## Runtime contract

- Native ChatGPT/Codex remains the default OpenCodex provider and uses direct
  caller OAuth forwarding.
- OpenCode Go credentials are read from the user's OpenCode credential store
  and are never written to SCALE, telemetry, work orders, or Git.
- Multi-agent mode is forced to V1 because parent-to-child task bodies can be
  backend-encrypted in V2 and therefore unavailable to external providers.
- Codex offers five ad-hoc spawn model slots. Every approved SCALE role is
  still available through a named `.codex/agents/<role>.toml` card that pins
  its exact model and reasoning effort.
- Models without a normal production role receive a bounded
  `scale_model_lab_*` custom-agent card. This keeps every currently verified
  active OpenCode Go model natively spawnable without assigning an expensive
  or weakly benchmarked model to routine work. Regenerate those cards with
  `node scripts/scale-generate-model-lab-agents.mjs`; the operation is
  idempotent.
- A launchd-managed OpenCodex service keeps the local transport alive. One
  native Luna fallback is allowed per external task.

## Installation and recovery

```bash
./scripts/scale-install-opencodex.sh --apply
./scripts/scale-codex-recover.sh status
./scripts/scale-codex-recover.sh restore
./scripts/scale-codex-recover.sh reconnect
```

`restore` removes the loopback dependency and returns Codex to native
ChatGPT routing even if the proxy process is dead. `reconnect` starts and
health-checks OpenCodex, re-enables its transport, and refreshes the catalog.

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
selected model, and reasoning effort. A mismatch is a routing failure, not a
cosmetic issue.

## Validation

```bash
node scripts/validate-scale-model-registry.mjs --catalog "$HOME/.codex/models.json"
bash scripts/validate-scale-agents.sh
ocx health --json
```

Use one bounded work order, the smallest per-profile context/step budget, one
fallback at most, and deterministic local validation. Never configure the
DeepSeek API.
