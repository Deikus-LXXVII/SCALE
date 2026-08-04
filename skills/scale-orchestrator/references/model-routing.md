# S.C.A.L.E. safe hybrid routing

The registry is authoritative. Native Codex profiles use Luna, Terra, Sol, and
auto-review. OpenCode Go models are invoked natively through the Hermes
`opencode-go` provider (`execution: hermes-native`); there is no dispatcher,
no loopback gateway, and no `openai_base_url` override.

| Work | OpenCode Go (native Hermes) | Native fallback/authority |
| --- | --- | --- |
| Control plane | DeepSeek V4 Flash High | Luna xhigh |
| Simple code | DeepSeek V4 Flash High | Luna xhigh |
| Standard implementation | DeepSeek V4 Pro High | Terra High |
| Critical/security | None | Sol High |
| Web design | Kimi K3 max design packet | Terra High implementation |
| Frontend prototype | Qwen 3.7 Plus High | Terra High integration |
| Routine/docs/indexing | DeepSeek V4 Flash High | Luna xhigh |

Worker work requires one bounded, privacy-gated work order and one named
fallback. Do not retry or silently substitute another Go model. Never send
secrets, credentials, PII, production dumps, or security investigations.

Per-profile budgets and registry hard caps still apply. The orchestrator may
make one evidence-backed adjustment across at most two dimensions; unchanged
defaults are the token-saving path.
