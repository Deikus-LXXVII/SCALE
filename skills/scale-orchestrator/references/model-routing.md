# S.C.A.L.E. safe hybrid routing

The registry is authoritative. Native Codex profiles use Luna, Terra, and Sol;
independent QA uses a separate Luna context. OpenCode Go models are catalogued and invoked by Codex through the
managed OpenCodex Responses transport (`execution: codex-native`).

| Work | OpenCode Go in Codex | Native fallback/authority |
| --- | --- | --- |
| Control plane | DeepSeek V4 Flash High | Luna High |
| Simple code | DeepSeek V4 Flash High | Luna High |
| Standard implementation | DeepSeek V4 Pro High | Luna High; Terra/Sol own sensitive decisions |
| Critical/security | None | Sol High |
| Web design | Kimi K3 max design packet | Terra High implementation |
| Frontend prototype | Qwen 3.7 Plus High | Terra High integration |
| Routine/docs/indexing | DeepSeek V4 Flash High | Luna High |

Worker work requires one bounded, privacy-gated work order and one named
fallback. Do not retry or silently substitute another Go model. Never send
secrets, credentials, PII, production dumps, or security investigations.

Per-profile budgets and registry hard caps still apply. The orchestrator may
make one evidence-backed adjustment across at most two dimensions; unchanged
defaults are the token-saving path.
