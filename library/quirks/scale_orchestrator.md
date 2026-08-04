# scale_orchestrator quirks

- OpenCode Go model availability and quota are runtime state. A dispatcher exit
  code of 75 is a single deterministic fallback signal, never a retry loop.
- The primary orchestrator is OpenCode Go DeepSeek V4 Flash High. Codex Luna is
  only the native gateway/fallback; do not configure the DeepSeek API.
