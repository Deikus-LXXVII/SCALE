# OpenCode Go native adapter

S.C.A.L.E. treats OpenCode Go as an additional model pool, exposed natively
through Codex's built-in OpenAI provider. Every registered model uses an
`opencode-go/<model>` catalog slug and the loopback
`scripts/scale-opencode-native-gateway.mjs`; no custom `model_provider` and no
DeepSeek API are configured.

The gateway routes Luna through Responses, OpenAI-compatible models through
Chat Completions, and MiniMax/Qwen models through Anthropic Messages. It
translates function tools, tool-call history, and streaming Responses events,
so Codex main agents and subagents retain their normal sandbox and approval
boundary. The external dispatcher remains an explicit legacy fallback only.

The materializer exposes managed role profiles to connected projects as
`.opencode/agents/scale-go-*.md`; project-owned agents are preserved. Runtime
profiles declare model, reasoning effort, step budget, and least-privilege
permissions. Kimi K3 is `max` and is restricted to user-directed design
packets; Terra implements production UI.

See `docs/native-opencode.md` for installation, health checks, and the global
Codex restart requirement. `docs/opencode-go-model-inventory-2026-08-04.md`
records the live model inventory and cost policy.
