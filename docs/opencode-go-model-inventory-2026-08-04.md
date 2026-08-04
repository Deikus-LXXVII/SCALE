# OpenCode Go live model inventory — 2026-08-04

Source: `opencode models opencode-go --verbose` on the authenticated Mac. The
catalog is dynamic; this is a routing snapshot, not a promise that a future Go
session exposes the same models or prices. Costs are the runtime's displayed
USD per one million input/output tokens before cache effects.

| Model | Input / output | Context | Explicit high-capable variant | S.C.A.L.E. decision |
| --- | ---: | ---: | --- | --- |
| DeepSeek V4 Flash | $0.14 / $0.28 | 1M | high, max | Optional routine, exploration, docs, and isolated-code specialist. |
| DeepSeek V4 Pro | $0.435 / $0.87 | 1M | high, max | Optional bounded standard-code specialist. |
| GLM-5.1 | $1.40 / $4.40 | 203K | no exposed variant | Available, not auto-routed. |
| GLM-5.2 | $1.40 / $4.40 | 1M | high, max | Infrequent architecture/research and critical decision packets. |
| GPT-5.6 Luna | $0.10 / $0.60 | 1.05M | none through max | Prompt/instruction work and bounded QA. |
| Grok 4.5 | $2.00 / $6.00 | 500K | low, medium, high | Manual-only escalation; not automatic because of cost. |
| Hy3 | $0.14 / $0.58 | 256K | none, low, high | Available, not auto-routed. |
| Kimi K2.6 | $0.95 / $4.00 | 262K | no exposed variant | Available, not auto-routed. |
| Kimi K2.7 Code | $0.95 / $4.00 | 262K | no exposed variant | User-selected premium web-design specialist; design packet only, not a production code executor. |
| Kimi K3 | $3.00 / $15.00 | 1M | max | Manual-only escalation; too costly for automatic fallback. |
| MiMo V2.5 | $0.14 / $0.28 | 1M | no exposed variant | Available multimodal option, not auto-routed. |
| MiMo V2.5 Pro | $0.435 / $0.87 | 1M | no exposed variant | Available, not auto-routed. |
| MiniMax M2.7 | $0.30 / $1.20 | 205K | no exposed variant | Available, not auto-routed. |
| MiniMax M3 | $0.30 / $1.20 | 1M | adaptive thinking | Available, not auto-routed until benchmarked. |
| Qwen3.6 Plus | $0.50 / $3.00 | 1M | high, max | Reserve candidate for performance work. |
| Qwen3.7 Plus | $0.40 / $1.60 | 1M | high, max | Optional visual prototype and frontend exploration specialist. |
| Qwen3.7 Max | $2.50 / $7.50 | 1M | high, max | Manual-only escalation; not automatic. |
| Qwen3.8 Max | $2.00 / $6.00 | 1M | high, max | Manual-only escalation; not automatic. |

## Budget policy

OpenCode Go has value-based five-hour, weekly, and monthly limits. S.C.A.L.E.
therefore never chooses Grok, Kimi K3, or Qwen Max automatically. Codex remains
the steady-state primary: DeepSeek Flash for volume, Terra for implementation,
and Sol for critical authority. Go Flash, DeepSeek Pro, Luna, Qwen Plus, and
GLM-5.2 are opted-in specialists. Kimi K2.7 Code is reserved for scarce,
high-value visual design briefs despite its higher cost.

The Go runtime does not expose remaining subscription balance through its local
CLI. `opencode stats` measures observed session usage; the OpenCode console is
the source for remaining Go entitlement.

## Fallback contract

`scale-opencode-dispatch.mjs` checks the live Go catalog before a dispatch. A
catalog error, quota error, rate limit, credit error, or HTTP 429 emits one JSON
handoff and exits 75. `scale_orchestrator` then routes the unchanged work order
to the binding's native Codex fallback exactly once. It never retries Go and
never falls through to an expensive Go model automatically.
