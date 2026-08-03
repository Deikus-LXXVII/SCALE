# OpenCode Go in S.C.A.L.E.

## Purpose

OpenCode Go is a low-cost, separately metered execution backend. It must not be
added as a `model_provider` in Codex: Codex custom-agent profiles can only use
models exposed by Codex's catalog, while OpenCode Go owns its own credential,
model catalog, permissions, session history, and limits.

S.C.A.L.E. therefore uses this split:

```text
Codex: route, preserve project context, integrate, validate, and own critical decisions
OpenCode Go: bounded read-only exploration, documentation, and candidate isolated patches
```

This saves Codex limits by eliminating duplicate repository mapping and routine
draft work, while retaining Terra/Sol where their quality materially changes the
outcome.

## One-time local setup

OpenCode is not installed on this Mac yet. Install its stable CLI, authenticate
with the Go subscription, and inspect the live catalog:

```bash
brew install anomalyco/tap/opencode
opencode
# In the OpenCode TUI: /connect -> OpenCode Go -> paste the Go API key
# Then: /models
opencode auth list
opencode models opencode-go
```

Use the model IDs reported by the final command. As of 2026-08-04, Go documents
`opencode-go/deepseek-v4-flash`, `opencode-go/deepseek-v4-pro`, and several
other models, but the provider's catalog is intentionally dynamic.

Credentials stay in OpenCode's credential store. Do not put the Go key in
`opencode.json`, S.C.A.L.E., a shell history, or Git. The OpenCode Go account is
an external processor: do not route secrets, private keys, production dumps,
unredacted customer data, authentication material, or security investigations
to it. In particular, gateway data-retention properties are model-specific and
can change.

## Validate the adapter

From the canonical S.C.A.L.E. repository, after authentication:

```bash
node scripts/validate-scale-model-registry.mjs \
  --catalog "$HOME/.codex/models.json" \
  --config "$HOME/.codex/config.toml" \
  --opencode
./scripts/validate-scale-agents.sh
./scripts/validate-scale-library.sh
./scripts/validate-scale-install.sh
```

The optional `--opencode` check runs only `opencode models opencode-go`; it does
not read or print credentials. It confirms that the live Go catalog exposes the
currently active S.C.A.L.E. Go model. If the provider replaces that model, the
validator blocks promotion until the registry is updated and the replacement is
benchmarked.

## Daily routing policy

| Work | Default owner | Why |
| --- | --- | --- |
| Repository map, narrow diagnosis, file/symbol evidence, documentation draft | `scale-go-explorer` | Uses Go's DeepSeek V4 Flash and keeps the Codex context short. |
| One isolated low-risk patch | `scale-go-simple-code` only after a focused Go benchmark | External write permissions remain interactive; Codex validates the patch. |
| Multi-file integration | `scale_code_standard` on Terra | Retains stronger native integration and validation. |
| Security, migrations, public contracts, concurrency, cross-service changes | `scale_code_critical` on Sol | Never trade this quality boundary for quota savings. |

For an exploration task, open the target project in OpenCode and select
`scale-go-explorer`, or run:

```bash
opencode run --dir /absolute/path/to/project \
  --agent scale-go-explorer \
  "Map the exact files and symbols implementing <one bounded question>. Return evidence, recommended next action, and uncertainty only. Do not edit files."
```

Pass the resulting compact handoff to Codex rather than the whole transcript.
This avoids paying for the same repository discovery twice. Do not use
`--auto` for S.C.A.L.E. Go code agents: their edits and shell commands are
intentionally approval-gated.

## Cost controls

1. Make one work order one objective, bounded path/scope, acceptance criteria,
   requested output, and stop condition.
2. Keep Go exploration at ten agent steps and code candidates at sixteen;
   escalation is an explicit new task, not an open-ended continuation.
3. Reuse a Go session only for the same bounded problem. Start a fresh session
   for a different subsystem so old context does not consume the five-hour Go
   budget.
4. Let local tests and deterministic checks reject routine failures. Escalate to
   Terra only if the Go result is incomplete, the test fails, or the change has
   non-trivial coupling; escalate to Sol only at the critical boundary above.
5. Do not call both DeepSeek providers for the same mapping task. Use the native
   Codex DeepSeek lane where Codex tool access is essential; otherwise prefer
   Go's explorer for that routine discovery.

OpenCode Go's published subscription budget is value-based, so request count
depends on the selected model. Monitor it through the OpenCode console or
`opencode stats`; do not silently enable overage balance as a S.C.A.L.E.
default.
