# scale_orchestrator quirks

- OpenCode Go model availability and quota are runtime state. A dispatcher exit
  code of 75 is a single deterministic fallback signal, never a retry loop.
- The orchestrator stays on Codex DeepSeek V4 Flash High; OpenCode Go performs
  the delegated bounded work and does not replace the Codex control plane.
