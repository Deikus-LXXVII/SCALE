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
| Decompose a task, choose a hybrid lane, route bounded work to OpenCode Go, or handle a Go-limit fallback | `scale_orchestrator` |
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
| Privacy and external-routing boundary gate | `scale_privacy_gate` |
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

- The SCALE Master is mandatory for every compound task or task written as a
  bullet list. Only one atomic, low-risk action with an obvious acceptance
  check may bypass it. The Master may still select a single executor.
- For the normal non-sensitive Master route, create one context-complete JSON
  work order for `scale_orchestrator` and execute it with
  `scripts/scale-plaintext-runner.mjs`. Do not use Codex `thread_spawn` for an
  `opencode-go/*` primary: encrypted child state cannot be replayed safely by
  the external provider. The named TOML card is the native fallback only.
- Validation is batched: run one final combined check set for the whole task,
  not one test cycle per bullet. Allow at most one repair cycle and one final
  acceptance pass; do not rerun passing checks.

- `scale_orchestrator` uses OpenCode Go DeepSeek V4 Flash with `high` through a
  one-shot plaintext external work order. The runner sends no
  `previous_response_id`, performs no retry, applies no patch, and returns a
  machine-readable `fallback_required` object instead of silently invoking
  Codex. The host starts that fallback as a fresh native task.
- `gpt-5.6-sol` is hard-capped at `high` reasoning. No Sol profile, route,
  fallback, specialist, or project overlay may use `xhigh` or `max`; the
  registry validator enforces this limit.
- When the caller already provides a bounded low-risk profile, explicit files, acceptance criteria, and a stop condition, use that profile directly and skip an extra orchestration turn.
- Codex profiles keep Terra for production frontend, hardware/domain integration, and sensitive implementation; OpenCode Go owns bounded routine/simple work and non-sensitive standard implementation, while native Luna high is the low-cost fallback, advisory, and independent-QA lane. Sol remains critical authority. Every DeepSeek V4 Flash assignment is an OpenCode Go route; the DeepSeek API is not configured or used.
- Kimi K3 is the premium web-design specialist: it creates a design packet, never production UI code. Terra's `scale_frontend` implements the handoff. Security and Git promotion remain native Codex. A Go quota signal is routed once to the exact native fallback in the binding; it is never retried in a loop.
- Select the lane from change risk and coupling, not line count: isolated low-risk code is simple; ordinary multi-file work is standard; security boundaries, hard concurrency, data migration, public contracts, and cross-system changes are critical.
- DeepSeek may own bounded diagnostics, documentation, retrieval, and isolated low-risk code. As the Codex orchestrator, it must write one objective, exact scope/files when known, acceptance criteria, output format, and a stop condition before routing a Go lane. Independently validate global promotion and high-impact decisions.
- `library/model-registry.json` is the provider-neutral source of truth for
  approved providers, model IDs, efforts, and routes. It contains no
  credentials. Every OpenCode Go model uses an `opencode-go/<model>` catalog
  slug through OpenCodex's Codex-compatible Responses transport. OpenCode
  bindings are marked `plaintext-external`; their TOML cards pin the native
  fallback and must not be reported as external execution. Never
  configure a fake Codex model or route to the DeepSeek API. New code-default models are admitted only after catalog
  validation and a focused benchmark.
- Every active profile has a registry runtime budget for work-order bytes, context files/bytes, agent steps, and timeout. SCALE enforces the planning contract while Codex controls native turn execution. The orchestrator may request one evidence-backed adjustment across at most two dimensions; speculative increases are rejected. At most one fallback escalation is allowed per task.
- Every native SCALE profile must begin its first assistant message with the exact identity line declared in its TOML: `[SCALE agent=<role> model=<model> reasoning=<effort>]`. Plaintext external execution instead trusts `response.model` and the runner emits `[SCALE agent=<role> model=<actual> reasoning=<effort> transport=plaintext-external]`.
- OpenCodex is used as a one-request Responses gateway beside Codex's model
  route, not as an encrypted Codex child transport. Keep its background service
  healthy; `scripts/scale-codex-recover.sh runner-start` repairs it without
  stopping a healthy proxy. `native-restore` is the explicit destructive path.
- The internal-development lanes are deliberately separate: policy and privacy gates are read-only authority reports; model operations and benchmark roles provide admission evidence; knowledge evaluation gates candidate promotion; sync reports fleet health while `scale_git` remains the writer. Do not add a new agent when an existing owner can absorb the capability without widening its boundary.

## Collaboration rules

1. Delegate only independent bounded subtasks and keep write ownership non-overlapping.
2. Run independent read-only mapping, research, security, or QA in parallel; sequence implementation and validation.
3. A new durable fact must have a home: project fact → `docs.llm`, domain rule → `library/rules`, researched fact → `library/books`, role design → `library/agents`, operational workaround → `library/quirks`, model/provider policy → `library/model-registry.json`.
4. Preserve user changes. Use `rg` for search, `apply_patch` for edits, and never use destructive Git commands unless explicitly requested.
5. Project-level rules belong in `AGENTS.md`; Codex runtime defaults in `.codex/config.toml`; role settings in `.codex/agents`; reusable procedures in `skills`.
6. Durable library entries require provenance, evidence, compatibility, validation/review dates, and explicit conflict or supersession links where needed. Candidates remain shadow-evaluated until deterministic or human review promotes them.
