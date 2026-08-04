# Memory Anchor

- Durable behavior and routing: `AGENTS.md`.
- Custom-agent source of truth: `.codex/agents/*.toml`.
- Every custom agent must explicitly set `model` and `model_reasoning_effort`.
+ High-impact agents use strong models at `high` reasoning; routine OpenCode Go DeepSeek V4 Flash agents use `high` reasoning.
- The configured DeepSeek route is `opencode-go/deepseek-v4-flash`. Do not configure a separate DeepSeek API provider; validate the live OpenCode Go catalog before changing the identifier.
- `library/find-by-tag.sh` is the preferred way to retrieve reference material from `library/`.
- Git is the canonical knowledge-transport layer: validated global additions are selectively committed and pushed by `scale_git`, then consumed through fast-forward-only project clones.
