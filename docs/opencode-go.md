# OpenCode Go in S.C.A.L.E.

OpenCode Go is a separately metered model pool invoked **natively from Hermes**
through the `opencode-go` provider. No dispatcher, loopback gateway, API
client, protocol shim, or Codex `base_url` change is used: Hermes calls the
`opencode-go/<model>` slug directly, the same way it calls any other provider.

## Invocation model

- SCALE roles route through `hermes/model-routing.json`: worker roles resolve
  to `provider: opencode-go`, `model: deepseek-v4-flash` (or the route's
  approved model), and `reasoning_effort: high`.
- `hermes/scripts/scale-hermes-route.sh <role> <work-order>` reads that
  registry and executes the work order as a native Hermes run with the mapped
  provider/model/effort. Fallback is the named native route (Codex Luna xhigh
  or Terra high), never a second external model.
- Model calls are native Hermes calls: tool calling, sandbox, approvals, and
  output handling stay inside the Hermes runtime. There is no intermediate
  service between Hermes and OpenCode Go.

## Authentication

Authenticate OpenCode Go once (`opencode auth login` / the Hermes
`opencode-go` provider setup) and keep the credential in OpenCode's/Hermes'
credential store. Never put credentials in SCALE, work orders, telemetry, or
Git.

## Routing policy

| Work | Native owner | Fallback/boundary |
| --- | --- | --- |
| Control plane and simple code | DeepSeek V4 Flash High | Luna xhigh; non-sensitive only |
| Standard code | DeepSeek V4 Pro High | Terra High for sensitive/complex integration |
| Critical/security/Git | Sol High or native QA | Never external final authority |
| Web design | Kimi K3 max | Design packet only; Terra implements |
| Frontend production | Terra High | Qwen 3.7 Plus is optional prototype input |
| Routine/docs/research | DeepSeek Flash High or Luna | Bounded, privacy-gated context |

`library/model-registry.json` is the provider-neutral source of truth: routes
use `execution: hermes-native` for every OpenCode Go assignment. The
`opencode-go` provider is declared with `kind: native` and `runtime: hermes`.
Never configure a custom `model_provider`, fake Codex provider, or the
DeepSeek API.

## Validation

```bash
node scripts/validate-scale-model-registry.mjs
bash scripts/validate-scale-agents.sh
bash scripts/validate-scale-library.sh
```

Use the smallest per-profile context/step budget. One fallback escalation per
task; the registry hard caps remain authoritative. `opencode/agents/*.md` are
kept as canonical role descriptions for OpenCode Go and are not part of the
Hermes execution path.
