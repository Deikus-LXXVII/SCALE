# Quirks

- Codex resolves custom agents from `.codex/agents/*.toml`; the profile's `name` field is authoritative.
- Custom agent profiles may inherit omitted settings from the parent session, so the model and reasoning effort are always stated explicitly here.
- Provider model identifiers are local-catalog dependent. Verify the exact DeepSeek V4 Flash model label once in the connected Codex catalog before the first production use.
