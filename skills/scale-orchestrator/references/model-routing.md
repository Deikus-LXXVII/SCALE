# Model routing matrix

`library/model-registry.json` is the authoritative provider-neutral registry.
This page explains its current S.C.A.L.E. policy; the profiles in
`.codex/agents/` are the executable bindings.

## Code-complexity lanes

| Lane | Agent | Model | Reasoning | Route when | Do not route when |
| --- | --- | --- | --- | --- | --- |
| Simple | `scale_code_simple` | `deepseek-v4-flash` | high | One isolated, low-risk implementation with explicit tests and no sensitive boundary. | The change affects auth, schemas, public contracts, hard concurrency, multiple services, or architecture. |
| Standard | `scale_code_standard` | `gpt-5.6-terra` | high | Ordinary multi-file feature, bounded integration, or non-critical refactor. | The failure blast radius is high or the work crosses critical boundaries. |
| Critical | `scale_code_critical` | `gpt-5.6-sol` | high | Cross-cutting systems code, security-sensitive work, hard concurrency, irreversible data behavior, or major interfaces. | Never downgrade merely because the diff is short. |

## External OpenCode Go lanes

These routes run outside Codex through the local OpenCode client; they do not
consume a Codex model slot and do not alter `~/.codex/config.toml`.

| Lane | OpenCode agent | Model | Reasoning | Route when | Guardrail |
| --- | --- | --- | --- | --- | --- |
| Go exploration | `scale-go-explorer` | `opencode-go/deepseek-v4-flash` | high | Read-only mapping, evidence collection, bounded diagnosis, and documentation. | No edits, no security decisions, no global promotion. |
| Go simple-code candidate | `scale-go-simple-code` | `opencode-go/deepseek-v4-flash` | high | An approved isolated patch with focused tests. | Interactive permissions only; it is not a default code lane until the OpenCode Go benchmark passes. |

Keep `scale_code_standard` and `scale_code_critical` on Terra and Sol. The
quality-saving pattern is to use Go for reconnaissance and narrow drafts, then
send only the compact evidence and diff to Codex for integration or review.

The lane is based on coupling and consequence, not how many lines change. A simple
patch that changes authorization is critical; a large but isolated mechanical
refactor can remain standard after validation.

## Specialized roles

| Agent group | Model | Reasoning | Why |
| --- | --- | --- | --- |
| `scale_architect`, `scale_builder`, `scale_backend`, `scale_security` | `gpt-5.6-sol` | high | Architecture and release-critical work require the critical lane. |
| `scale_audio`, `scale_swift`, `scale_openwrt`, `scale_research`, `scale_git` | `gpt-5.6-terra` | high | Specialized, bounded work normally fits the standard lane. |
| `scale_qa`, `scale_prompt` | `codex-auto-review` / `gpt-5.6-luna` | high | Narrow independent review and instruction work. |
| `scale_environment`, `scale_docs`, `scale_cleaner`, `scale_library`, `scale_indexer` | `deepseek-v4-flash` | high | Routine evidence-backed work; each remains scope-bounded. |

## Adding or updating a model

1. For a Codex external provider, configure its endpoint and credential in the user's
   Codex configuration. For OpenCode Go, authenticate through OpenCode's `/connect`
   flow and keep its key in OpenCode's credential store. Keep credentials outside
   S.C.A.L.E. and Git.
2. Confirm the exact local model ID and supported reasoning levels with `codex debug models`.
3. Add the provider or model to `library/model-registry.json`; do not change a route
   default until the candidate has a focused benchmark.
4. Run `node scripts/validate-scale-model-registry.mjs --catalog "$HOME/.codex/models.json" --config "$HOME/.codex/config.toml"`; add `--opencode` after OpenCode Go is installed and authenticated.
5. Update the explicit affected agent profiles, run S.C.A.L.E. validation and QA,
   then promote through `scale_git`.

At a connected-project SessionStart, S.C.A.L.E. fetches incoming changes and
validates any changed model registry or profile against the local catalog before
fast-forwarding and materializing. An unavailable provider or model leaves the
last known compatible library snapshot active.
