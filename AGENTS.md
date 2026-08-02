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

## Differentiation and promotion

1. Architect identifies only the capabilities a project actually needs.
2. Builder retrieves existing knowledge, creates the smallest useful new role/rule/document, and governs tags.
3. Research writes a tagged book only when existing library coverage is insufficient.
4. QA validates profiles, taxonomy, file references, and claimed verification.
5. Git promotes only validated, explicitly named library files to the canonical remote. It pulls first, never force-pushes, and reports unresolved conflicts.
6. Connected projects pull fast-forward updates at trusted Codex session start through `.codex/hooks.json`; the refresh never overwrites a dirty library clone or a project-owned custom agent.

## Model policy

- High-impact decisions and complex implementation use `gpt-5.6-sol` or `gpt-5.6-terra` with `medium` reasoning.
- Narrow but judgment-sensitive QA and prompt work uses lower-cost specialists with `high` reasoning.
- Routine, bounded work uses `deepseek-v4-flash` with `medium` reasoning. A DeepSeek delegation must state one objective, exact scope/files when known, acceptance criteria, output format, and a stop condition. Do not combine unrelated tasks.

## Collaboration rules

1. Delegate only independent bounded subtasks and keep write ownership non-overlapping.
2. Run independent read-only mapping, research, security, or QA in parallel; sequence implementation and validation.
3. A new durable fact must have a home: project fact → `docs.llm`, domain rule → `library/rules`, researched fact → `library/books`, role design → `library/agents`, operational workaround → `library/quirks`.
4. Preserve user changes. Use `rg` for search, `apply_patch` for edits, and never use destructive Git commands unless explicitly requested.
5. Project-level rules belong in `AGENTS.md`; Codex runtime defaults in `.codex/config.toml`; role settings in `.codex/agents`; reusable procedures in `skills`.
