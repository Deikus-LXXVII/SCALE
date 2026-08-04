# OpenCode Go in S.C.A.L.E.

## Purpose

OpenCode Go is a separately metered specialist pool. It must not be
added as a `model_provider` in Codex: Codex custom-agent profiles can only use
models exposed by Codex's catalog, while OpenCode Go owns its own credential,
model catalog, permissions, session history, and limits.

S.C.A.L.E. therefore uses this split:

```text
Codex DeepSeek V4 Flash: control plane, work-order boundaries, validation, and fallback selection
Codex native profiles: default implementation and authority for their role
OpenCode Go: explicitly eligible non-sensitive specialists, never a blanket replacement
```

This conserves Codex limits only where a specialist is deliberately justified,
while retaining native Codex ownership and trust-sensitive authority.

## One-time local setup

OpenCode Go is authenticated on the Mac. Inspect the live catalog when the
model policy changes:

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

| Work | Default owner | Optional Go specialist |
| --- | --- | --- |
| Control plane | Codex `scale_orchestrator` / DeepSeek V4 Flash High | Emits bounded work orders and receives Go failures. |
| Routine evidence, docs, cleanup | Codex DeepSeek V4 Flash High | Go Flash High for an explicit non-sensitive overflow work order. |
| Isolated and standard implementation | Codex DeepSeek Flash / Terra High | Go Flash/Pro High only for an eligible bounded work order. |
| Web design | Go `scale-go-web-designer` / Kimi K2.7 Code | Premium visual brief only; no edits or production implementation. |
| Frontend implementation | Codex `scale_frontend` / Terra High | Go Qwen3.7 Plus High may prototype; Terra integrates. |
| Prompt or research | Codex Luna/Terra High | Go Luna/GLM High for a non-sensitive advisory packet. |
| Security and Git promotion | Native Sol/Terra | Never dispatched to Go. |

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
2. Keep Go exploration at ten agent steps, routine tasks at twelve, prompt/QA
   at fourteen, interface work at twenty, and standard code at twenty-four;
   escalation is an explicit new task, not an open-ended continuation.
3. Reuse a Go session only for the same bounded problem. Start a fresh session
   for a different subsystem so old context does not consume the five-hour Go
   budget.
4. Let local tests and deterministic checks reject routine failures. On a Go
   catalog/quota/rate-limit signal, the dispatcher exits 75 and hands the same
   task to its one native fallback. Escalate to Sol only at the critical
   boundary above.
5. Do not call both a native owner and a Go specialist for the same task unless
   the specialist is intentionally producing an advisory or design handoff.
   Use Kimi only for high-value visual design work; its cost and provider-default
   reasoning make it unsuitable as an automatic coding fallback.

OpenCode Go's published subscription budget is value-based, so request count
depends on the selected model. Monitor it through the OpenCode console or
`opencode stats`; do not silently enable overage balance as a S.C.A.L.E.
default.
