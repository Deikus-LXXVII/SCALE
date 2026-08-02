# Memory Anchor

- Durable behavior and routing: `AGENTS.md`.
- Custom-agent source of truth: `.codex/agents/*.toml`.
- Every custom agent must explicitly set `model` and `model_reasoning_effort`.
- High-impact agents use strong models at `medium` reasoning; routine DeepSeek V4 Flash agents always use `medium` reasoning.
- The configured DeepSeek string is `deepseek-v4-flash`. If the connected provider exposes another identifier, change only that identifier in the DeepSeek profiles and preserve their reasoning effort and work-order format.
- `library/find-by-tag.sh` is the preferred way to retrieve reference material from `library/`.
- Git is the canonical knowledge-transport layer: validated global additions are selectively committed and pushed by `cell_git`, then consumed through fast-forward-only project clones.
