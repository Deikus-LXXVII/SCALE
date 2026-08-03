# OpenCode Go adapter

S.C.A.L.E. treats OpenCode Go as an external execution backend, not as a
Codex model provider. Codex DeepSeek V4 Flash High is the control plane;
OpenCode Go executes the bounded task. This preserves Codex's own catalog and
puts Go usage behind its own subscription limits.

The materializer exposes the managed agents from this directory to a connected
project as `.opencode/agents/scale-go-*.md`. Existing project-owned OpenCode
agents are preserved. These generated links are ignored locally by the S.C.A.L.E.
installer and are never meant to be committed by the connected project.

Each runtime agent has an explicit model, reasoning effort, step cap, and
least-privilege permission contract. `library/model-registry.json` maps every
S.C.A.L.E. role to one of them plus a native fallback. The dispatcher emits the
fallback instead of retrying if Go is exhausted or unavailable.

See `docs/opencode-go.md` for setup and privacy boundaries, and
`docs/opencode-go-model-inventory-2026-08-04.md` for the live-catalog analysis
and budget policy.
