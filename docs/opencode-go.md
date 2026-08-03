# OpenCode Go in S.C.A.L.E.

## Purpose

OpenCode Go is a low-cost, separately metered execution backend. It must not be
added as a `model_provider` in Codex: Codex custom-agent profiles can only use
models exposed by Codex's catalog, while OpenCode Go owns its own credential,
model catalog, permissions, session history, and limits.

S.C.A.L.E. therefore uses this split:

```text
Codex DeepSeek V4 Flash: control plane, work-order boundaries, validation, and fallback selection
OpenCode Go: normal non-sensitive execution through explicitly model-bound agents
Codex Terra/Sol: one deterministic fallback, security, Git promotion, and final critical authority
```

This saves Codex limits by making the Codex call small and routing substantial
non-sensitive work through Go, while retaining native Terra/Sol for an explicit
fallback and trust-sensitive authority.

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

| Work | Default owner | Why |
| --- | --- | --- |
| Control plane | Codex `scale_orchestrator` / DeepSeek V4 Flash High | Emits bounded work orders and receives Go failures. |
| Routine evidence, docs, cleanup | Go `scale-go-routine` / DeepSeek V4 Flash High | Lowest steady-state Go cost. |
| Isolated and standard implementation | Go Flash/Pro High | Flash for simple, Pro for ordinary multi-file work. |
| Frontend and web design | Go `scale-go-interface` / Qwen3.7 Plus High | Dedicated visual-interface lane. |
| Prompt or bounded QA | Go `scale-go-prompt-qa` / GPT-5.6 Luna High | Low-cost high-context review lane. |
| Architecture, research, critical draft | Go `scale-go-architecture` / GLM-5.2 High | Infrequent, bounded decision packet only. |
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
5. Do not call both DeepSeek providers for the same mapping task. Use the native
   Codex DeepSeek lane where Codex tool access is essential; otherwise prefer
   Go's explorer for that routine discovery.

OpenCode Go's published subscription budget is value-based, so request count
depends on the selected model. Monitor it through the OpenCode console or
`opencode stats`; do not silently enable overage balance as a S.C.A.L.E.
default.
