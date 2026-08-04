# S.C.A.L.E. for Codex

**S**elf-evolving **C**odex **A**gent **L**ibrary **E**cosystem.

S.C.A.L.E. is a Git-versioned, self-evolving library of agents, rules, research, documentation, and role-local operational memory. The custom-agent profiles in `.codex/agents/` are authoritative: every profile explicitly fixes its `model` and `model_reasoning_effort`.

## Knowledge lifecycle

```text
retrieve by tags → apply → find a durable gap → research or build → QA
→ focused Git promotion to the canonical library → fast-forward pull in connected projects
```

The persistent layers are deliberately separate:

- `library/rules/` — reusable domain constraints and implementation guidance.
- `library/books/` — source-backed research reports.
- `library/agents/` — catalog profiles and tagged design notes for differentiated roles.
- `library/quirks/` — Git-versioned role-local observations and verified workarounds.
- `library/tag-taxonomy.md` — canonical tags and merge log.
- `docs.llm/` — project-specific context; it is not a substitute for global knowledge.

Never scan the library wholesale. Use `library/find-by-tag.sh <tag...>`, read only the matched files, and preserve its flat tagged structure.

## Routing

| Work | Agent |
| --- | --- |
| Decompose a task, choose a hybrid lane, dispatch an eligible OpenCode Go specialist, or handle a Go-limit fallback | `scale_orchestrator` |
| Architecture, scope critique, stack decisions | `scale_architect` |
| Differentiate or change agents, skills, rules, taxonomy, or library records | `scale_builder` |
| Primary-source research to become reusable knowledge | `scale_research` |
| Independent profile and library validation | `scale_qa` |
| Canonical Git promotion and global synchronization | `scale_git` |
| Security audit | `scale_security` |
| Backend implementation | `scale_backend` |
| Swift/macOS, OpenWrt, or audio domain work | `scale_swift`, `scale_openwrt`, `scale_audio` |
| Prompt/instruction design | `scale_prompt` |
| Environment, documentation, cleanup, library lookup, or integrity scan | `scale_environment`, `scale_docs`, `scale_cleaner`, `scale_library`, `scale_indexer` |
| Policy and source-of-truth drift audit | `scale_policy_auditor` |
| External-dispatch privacy and boundary gate | `scale_privacy_gate` |
| Model/provider lifecycle and admission review | `scale_model_ops` |
| Direct-vs-SCALE benchmark and efficiency measurement | `scale_benchmark` |
| Candidate knowledge and retrieval evaluation | `scale_knowledge_eval` |
| Connected-project sync and materialization health | `scale_sync` |

## Differentiation and promotion

1. Architect identifies only the capabilities a project actually needs.
2. Builder retrieves existing knowledge, creates the smallest useful new role/rule/document, and governs tags.
3. Research writes a tagged book only when existing library coverage is insufficient.
4. QA validates profiles, taxonomy, file references, and claimed verification.
5. Git promotes only validated, explicitly named library files to the canonical remote. It pulls first, never force-pushes, and reports unresolved conflicts.
6. Connected projects pull fast-forward updates at trusted Codex session start, then materialize all managed agent profiles and skills. Refresh never overwrites a dirty library clone, project-owned profile, skill, library path, or hook configuration.

## Model policy

- `scale_orchestrator` dispatches through OpenCode Go DeepSeek V4 Flash with `high`; native Codex Luna is its gateway/fallback only. It writes bounded work orders, selects `agent_bindings`, and receives deterministic fallbacks.
- When the caller already provides a bounded low-risk profile, explicit files, acceptance criteria, and a stop condition, use that profile directly and skip an extra orchestration turn.
- Codex profiles remain primary for Terra standard implementation and production frontend work, Sol critical authority, Luna fallback/prompt work, and auto-review QA. Every DeepSeek V4 Flash assignment is an OpenCode Go route; the DeepSeek API is not configured or used.
- Kimi K3 is the premium web-design specialist: it creates a design packet, never production UI code. Terra's `scale_frontend` implements the handoff. Security and Git promotion remain native Codex. A Go quota signal is routed once to the exact native fallback in the binding; it is never retried in a loop.
- Select the lane from change risk and coupling, not line count: isolated low-risk code is simple; ordinary multi-file work is standard; security boundaries, hard concurrency, data migration, public contracts, and cross-system changes are critical.
- DeepSeek may own bounded diagnostics, documentation, retrieval, and isolated low-risk code. As the Codex orchestrator, it must write one objective, exact scope/files when known, acceptance criteria, output format, and a stop condition before dispatching Go. Independently validate global promotion and high-impact decisions.
- `library/model-registry.json` is the provider-neutral source of truth for approved providers, model IDs, efforts, and routes. It contains no credentials. Codex-native and Codex-external models are validated against the local Codex catalog; external CLI providers such as OpenCode Go are validated by their own executable and must never be represented as a fake Codex provider. New native or external code-default models are admitted only after catalog validation and a focused benchmark.
- Every active profile has a registry runtime budget for work-order bytes, context files/bytes, agent steps, and timeout. The dispatcher enforces it for external routes; native lanes use the same budget contract for route selection and handoff planning, while Codex controls native turn execution. The orchestrator may request one evidence-backed adjustment across at most two dimensions; speculative increases are rejected. At most one fallback escalation is allowed per task. Credential-free JSONL telemetry is written to the project-local ignored `.codex/scale-telemetry.jsonl`.
- The internal-development lanes are deliberately separate: policy and privacy gates are read-only authority reports; model operations and benchmark roles provide admission evidence; knowledge evaluation gates candidate promotion; sync reports fleet health while `scale_git` remains the writer. Do not add a new agent when an existing owner can absorb the capability without widening its boundary.

## Collaboration rules

1. Delegate only independent bounded subtasks and keep write ownership non-overlapping.
2. Run independent read-only mapping, research, security, or QA in parallel; sequence implementation and validation.
3. A new durable fact must have a home: project fact → `docs.llm`, domain rule → `library/rules`, researched fact → `library/books`, role design → `library/agents`, operational workaround → `library/quirks`, model/provider policy → `library/model-registry.json`.
4. Preserve user changes. Use `rg` for search, `apply_patch` for edits, and never use destructive Git commands unless explicitly requested.
5. Project-level rules belong in `AGENTS.md`; Codex runtime defaults in `.codex/config.toml`; role settings in `.codex/agents`; reusable procedures in `skills`.
6. Durable library entries require provenance, evidence, compatibility, validation/review dates, and explicit conflict or supersession links where needed. Candidates remain shadow-evaluated until deterministic or human review promotes them.
