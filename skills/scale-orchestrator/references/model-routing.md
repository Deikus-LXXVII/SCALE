# Model routing matrix

| Agent | Model | Reasoning | Why |
| --- | --- | --- | --- |
| `scale_architect` | `gpt-5.6-sol` | medium | High-consequence systems decisions. |
| `scale_builder` | `gpt-5.6-sol` | medium | Core Codex workflow and agent design. |
| `scale_security` | `gpt-5.6-sol` | medium | Release-critical security analysis. |
| `scale_backend` | `gpt-5.6-sol` | medium | Complex implementation and integration work. |
| `scale_swift` | `gpt-5.6-terra` | medium | Specialized platform implementation. |
| `scale_openwrt` | `gpt-5.6-terra` | medium | Specialized embedded systems work. |
| `scale_audio` | `gpt-5.6-terra` | medium | Real-time, cross-component pipelines. |
| `scale_research` | `gpt-5.6-terra` | medium | Source evaluation and reusable knowledge synthesis. |
| `scale_qa` | `codex-auto-review` | high | Narrow independent verification. |
| `scale_prompt` | `gpt-5.3-codex-spark` | high | Focused instruction editing. |
| `scale_environment` | `deepseek-v4-flash` | medium | Bounded diagnostics. |
| `scale_docs` | `deepseek-v4-flash` | medium | Evidence-based documentation upkeep. |
| `scale_cleaner` | `deepseek-v4-flash` | medium | Read-only hygiene audit. |
| `scale_git` | `gpt-5.6-terra` | medium | High-consequence global knowledge promotion. |
| `scale_library` | `deepseek-v4-flash` | medium | Focused taxonomy and reference lookup. |
| `scale_indexer` | `deepseek-v4-flash` | medium | Routine library-integrity scan. |

`deepseek-v4-flash` must match the model identifier exposed by the connected provider. If the local model catalog spells it differently, replace this exact string in the five DeepSeek profiles, without changing their required `medium` reasoning effort.
