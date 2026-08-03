# OpenCode Go adapter

S.C.A.L.E. treats OpenCode Go as an external execution backend, not as a
Codex model provider. This preserves Codex's own catalog and puts OpenCode Go
usage behind its own subscription limits.

The materializer exposes the managed agents from this directory to a connected
project as `.opencode/agents/scale-go-*.md`. Existing project-owned OpenCode
agents are preserved. These generated links are ignored locally by the S.C.A.L.E.
installer and are never meant to be committed by the connected project.

`scale-go-explorer` is ready for read-only mapping and documentation after the
runtime check passes. `scale-go-simple-code` requires interactive approvals and
is deliberately a candidate until the OpenCode Go path has a focused coding
benchmark. `scale-go-standard-candidate` is present only for benchmarking
DeepSeek V4 Pro; Terra and Sol retain the standard and critical default routes.

See `docs/opencode-go.md` for setup, validation, privacy boundaries, and the
quota-saving routing policy.
