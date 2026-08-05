# scale_orchestrator quirks

- OpenCode Go model availability and quota are runtime state observed by the
  managed OpenCodex service; a Go provider failure triggers the single named Codex
  fallback exactly once, never a retry loop.
- The primary orchestrator is OpenCode Go DeepSeek V4 Flash High through its
  named Codex custom-agent card. Codex Luna is the named fallback; do not
  configure the DeepSeek API.
