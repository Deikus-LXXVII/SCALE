# Quirks

- Codex resolves custom agents from `.codex/agents/*.toml`; the profile's `name` field is authoritative.
- Custom agent profiles may inherit omitted settings from the parent session, so the model and reasoning effort are always stated explicitly here.
- Provider model identifiers are runtime-dependent. Verify `opencode-go/deepseek-v4-flash` in the connected OpenCode Go catalog before the first production use.
