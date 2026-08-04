# scale_orchestrator quirks

- OpenCode Go model availability and quota are runtime state observed by the
  Hermes runtime; a Go provider failure triggers the single named Codex
  fallback exactly once, never a retry loop.
- The primary orchestrator is OpenCode Go DeepSeek V4 Flash High (native
  Hermes `opencode-go` provider). Codex Luna is the named fallback; do not
  configure the DeepSeek API.
