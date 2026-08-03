# Model routing matrix

`library/model-registry.json` is the authoritative provider-neutral registry.
This page explains its current S.C.A.L.E. policy; the profiles in
`.codex/agents/` are the executable bindings.

## Control plane and code lanes

| Lane | Agent | Model | Reasoning | Route when | Do not route when |
| --- | --- | --- | --- | --- | --- |
| Control plane | `scale_orchestrator` | Codex `deepseek-v4-flash` | high | Decompose, issue bounded work orders, dispatch, and select fallback. | It is not the default implementation worker. |
| Simple | `scale-go-simple-code` | Go `deepseek-v4-flash` | high | One isolated, low-risk implementation with explicit tests and no sensitive boundary. | Auth, schemas, public contracts, hard concurrency, or cross-service work. |
| Standard | `scale-go-code-standard` | Go `deepseek-v4-pro` | high | Ordinary bounded multi-file feature or integration. | High-impact/security boundary or failed focused validation. |
| Critical draft | `scale-go-architecture` | Go `glm-5.2` | high | Non-sensitive architecture or critical-code decision packet. | Security, migrations, irreversible behavior, or final authority. |

## External OpenCode Go lanes

These routes run outside Codex through the authenticated local OpenCode client;
they do not consume a Codex model slot and do not alter `~/.codex/config.toml`.
`agent_bindings` is the exact per-role source of truth. In addition to code
lanes: Flash/high owns routine evidence and docs; Qwen3.7 Plus/high owns
frontend/web design; Luna/high owns prompt/QA; GLM-5.2/high owns rare
architecture/research packets. Security and Git remain native.

When Go reports a quota/rate-limit/catalog failure, `scale-opencode-dispatch.mjs`
exits 75 and prints the binding's native fallback as JSON. Re-submit the same
bounded work order once to that profile; never spend both Go and Codex on the
same speculative exploration.

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
3. Add the provider or model to `library/model-registry.json`; do not widen a
   code route's blast radius until the candidate has a focused benchmark.
4. Run `node scripts/validate-scale-model-registry.mjs --catalog "$HOME/.codex/models.json" --config "$HOME/.codex/config.toml"`; add `--opencode` after OpenCode Go is installed and authenticated.
5. Update the explicit affected agent profiles, run S.C.A.L.E. validation and QA,
   then promote through `scale_git`.

At a connected-project SessionStart, S.C.A.L.E. fetches incoming changes and
validates any changed model registry or profile against the local catalog before
fast-forwarding and materializing. An unavailable provider or model leaves the
last known compatible library snapshot active.
