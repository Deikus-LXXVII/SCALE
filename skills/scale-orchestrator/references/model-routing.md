# S.C.A.L.E. safe hybrid routing

The registry is authoritative. Native Codex profiles use Luna, Terra, Sol, and
auto-review. OpenCode Go models are isolated behind
`scripts/scale-opencode-dispatch.mjs`; they are not placed in the global Codex
catalog and never require `openai_base_url`.

| Work | External primary/specialist | Native fallback/authority |
| --- | --- | --- |
| Control plane | DeepSeek V4 Flash High | Luna xhigh |
| Simple code | DeepSeek V4 Flash High | Luna xhigh |
| Standard implementation | DeepSeek V4 Pro High | Terra High |
| Critical/security | None | Sol High |
| Web design | Kimi K3 max design packet | Terra High implementation |
| Frontend prototype | Qwen 3.7 Plus High | Terra High integration |
| Routine/docs/indexing | DeepSeek V4 Flash High | Luna xhigh |

External work requires one bounded, privacy-gated work order and one named
fallback. Do not retry or silently substitute another Go model. Never send
secrets, credentials, PII, production dumps, or security investigations.

The experimental Responses gateway remains only as a compatibility fixture.
SessionStart starts it only when the exact loopback route was explicitly
configured. If Codex loses connectivity, run `scale-codex-recover`, restart
Codex, and validate the native catalog before doing any further provider work.

Per-profile budgets and registry hard caps still apply. The orchestrator may
make one evidence-backed adjustment across at most two dimensions; unchanged
defaults are the token-saving path.
