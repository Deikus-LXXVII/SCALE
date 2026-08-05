# OpenCode Go in S.C.A.L.E.

S.C.A.L.E. treats OpenCode Go as an additional model pool exposed to Codex by
the managed OpenCodex Responses transport. Every registered model uses an
`opencode-go/<model>` catalog slug; the DeepSeek API is never configured.

Codex calls named SCALE custom-agent cards whose TOML pins the mapped
provider/model/effort. The named fallback is always a native Codex lane, never
a second external model.

`opencode/agents/scale-go-*.md` remain canonical role descriptions for
OpenCode Go agents. Runtime profiles declare model, reasoning effort, step
budget, and least-privilege permissions. Kimi K3 is `max` and is restricted to
user-directed design packets; Terra implements production UI.

See `docs/opencode-go.md` for routing policy and validation.
`docs/opencode-go-model-inventory-2026-08-04.md` records the live model
inventory and cost policy.
