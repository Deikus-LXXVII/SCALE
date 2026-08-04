# OpenCode Go in S.C.A.L.E.

OpenCode Go is a separately metered model pool exposed natively in Codex.
SCALE installs all live Go models as `opencode-go/<model>` catalog entries and
routes them through the built-in OpenAI provider to the loopback gateway. No
custom `model_provider`, fake Codex provider, or DeepSeek API is used.

## Setup

Authenticate OpenCode Go once (`/connect -> OpenCode Go`) and keep the key in
OpenCode's credential store. The gateway reads
`~/.local/share/opencode/auth.json` at runtime. Never put credentials in
SCALE, Codex config, work orders, telemetry, or Git.

Install the native catalog and global route with an explicit confirmation:

```bash
node scripts/scale-install-opencode-native.mjs \
  --codex-home /Users/lxxvii/.codex \
  --allow-global-openai-proxy
```

The installer backs up `config.toml` and `models.json`, sets user-level
`openai_base_url = "http://127.0.0.1:8787/v1"`, removes the incompatible custom
provider, and adds all 18 current Go aliases. Restart Codex afterward because
the desktop app caches the catalog. The gateway pass-through preserves ordinary
Codex model requests; OpenCode slugs are handled locally.

SessionStart starts the gateway automatically. Manual health checks:

```bash
curl -sS http://127.0.0.1:8787/healthz
curl -sS http://127.0.0.1:8787/v1/models
```

The gateway selects protocols from the official Go model matrix: Luna uses
Responses, most models use Chat Completions, and MiniMax/Qwen entries use
Anthropic Messages. Standard function tools, tool-call history, and streaming
Responses events are translated; Codex keeps sandbox, approvals, and tool
execution.

## Routing policy

| Work | Native owner | Fallback/boundary |
| --- | --- | --- |
| Control plane and simple code | DeepSeek V4 Flash High | Luna xhigh; non-sensitive only |
| Standard code | DeepSeek V4 Pro High | Terra High for sensitive/complex integration |
| Critical/security/Git | Sol High or native QA | Never external final authority |
| Web design | Kimi K3 max | Design packet only; Terra implements |
| Frontend production | Terra High | Qwen 3.7 Plus is optional prototype input |
| Routine/docs/research | DeepSeek Flash High or Luna | Bounded, privacy-gated context |

The external dispatcher remains an opt-in legacy fallback. If used, report it
as external execution and allow only one escalation; do not retry or silently
switch to another Go model.

## Validation and cost controls

```bash
node scripts/validate-scale-model-registry.mjs \
  --catalog /Users/lxxvii/.codex/models.json \
  --config /Users/lxxvii/.codex/config.toml \
  --opencode
bash scripts/validate-scale-agents.sh
bash scripts/validate-scale-library.sh
```

Use the smallest per-profile context/step budget. The orchestrator may request
one evidence-backed adjustment across at most two dimensions; the registry
hard caps and one-fallback rule remain authoritative.
