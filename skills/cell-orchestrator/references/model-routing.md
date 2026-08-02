# Model routing matrix

| Agent | Model | Reasoning | Why |
| --- | --- | --- | --- |
| `cell_architect` | `gpt-5.6-sol` | medium | High-consequence systems decisions. |
| `cell_builder` | `gpt-5.6-sol` | medium | Core Codex workflow and agent design. |
| `cell_security` | `gpt-5.6-sol` | medium | Release-critical security analysis. |
| `cell_backend` | `gpt-5.6-sol` | medium | Complex implementation and integration work. |
| `cell_swift` | `gpt-5.6-terra` | medium | Specialized platform implementation. |
| `cell_openwrt` | `gpt-5.6-terra` | medium | Specialized embedded systems work. |
| `cell_audio` | `gpt-5.6-terra` | medium | Real-time, cross-component pipelines. |
| `cell_research` | `gpt-5.6-terra` | medium | Source evaluation and reusable knowledge synthesis. |
| `cell_qa` | `codex-auto-review` | high | Narrow independent verification. |
| `cell_prompt` | `gpt-5.3-codex-spark` | high | Focused instruction editing. |
| `cell_environment` | `deepseek-v4-flash` | medium | Bounded diagnostics. |
| `cell_docs` | `deepseek-v4-flash` | medium | Evidence-based documentation upkeep. |
| `cell_cleaner` | `deepseek-v4-flash` | medium | Read-only hygiene audit. |
| `cell_git` | `gpt-5.6-terra` | medium | High-consequence global knowledge promotion. |
| `cell_library` | `deepseek-v4-flash` | medium | Focused taxonomy and reference lookup. |
| `cell_indexer` | `deepseek-v4-flash` | medium | Routine library-integrity scan. |

`deepseek-v4-flash` must match the model identifier exposed by the connected provider. If the local model catalog spells it differently, replace this exact string in the five DeepSeek profiles, without changing their required `medium` reasoning effort.
