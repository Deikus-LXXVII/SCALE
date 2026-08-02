# File Map & Architecture

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Routing policy, DeepSeek delegation rules, and collaboration conventions. |
| `.codex/config.toml` | Project-level multi-agent defaults. |
| `.codex/hooks.json` | Trusted-session automatic library refresh. |
| `.codex/agents/*.toml` | Codex custom-agent profiles with explicit model and reasoning effort. |
| `.codex-plugin/plugin.json` | Plugin manifest exposing bundled skills. |
| `skills/scale-orchestrator/` | Reusable multi-agent orchestration workflow and model matrix. |
| `skills/scale-genesis/` | Project initialization workflow. |
| `library/` | Tagged reusable domain rules and research. |
| `library/quirks/` | Persistent role-local operational memory. |
| `docs.llm/` | Project context, operational notes, and roadmap. |
| `scripts/scale-library-*.sh` | Dynamic library connection, refresh, and role activation. |
| `scripts/validate-codex-*.sh` | Structural validators for profiles and library metadata. |
