# OpenCode Go adapter

S.C.A.L.E. treats OpenCode Go as an additional specialist pool, not as a Codex
model provider or blanket replacement. Codex DeepSeek V4 Flash High is the
control plane and the native Codex profile remains the default executor unless
the registry explicitly selects a Go specialist. This preserves Codex's own
catalog and puts Go usage behind its own subscription limits.

The materializer exposes the managed agents from this directory to a connected
project as `.opencode/agents/scale-go-*.md`. Existing project-owned OpenCode
agents are preserved. These generated links are ignored locally by the S.C.A.L.E.
installer and are never meant to be committed by the connected project.

Each runtime agent has an explicit model, step cap, and least-privilege
permission contract. Where the provider exposes one, it also has an explicit
reasoning effort; Kimi K2.7 Code is recorded as `provider-default` because Go
exposes no selectable variant. `library/model-registry.json` maps each Go use
to an eligible specialist plus a native fallback. The dispatcher emits that
fallback instead of retrying if Go is exhausted or unavailable.

See `docs/opencode-go.md` for setup and privacy boundaries, and
`docs/opencode-go-model-inventory-2026-08-04.md` for the live-catalog analysis
and budget policy.
