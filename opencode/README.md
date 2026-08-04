# OpenCode Go in S.C.A.L.E.

S.C.A.L.E. treats OpenCode Go as an additional model pool invoked natively
from Hermes through the `opencode-go` provider. Every registered model uses an
`opencode-go/<model>` catalog slug; there is no custom `model_provider`, no
loopback gateway, no dispatcher, and no DeepSeek API configuration.

Hermes calls OpenCode Go directly for the role's mapped provider/model/effort.
Tool calling, sandbox, approvals, and output handling stay inside the Hermes
runtime. The named fallback is always a native Codex lane (Luna xhigh or Terra
high), never a second external model.

`opencode/agents/scale-go-*.md` remain canonical role descriptions for
OpenCode Go agents. Runtime profiles declare model, reasoning effort, step
budget, and least-privilege permissions. Kimi K3 is `max` and is restricted to
user-directed design packets; Terra implements production UI.

See `docs/opencode-go.md` for routing policy and validation.
`docs/opencode-go-model-inventory-2026-08-04.md` records the live model
inventory and cost policy.
