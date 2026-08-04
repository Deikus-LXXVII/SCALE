# Project Context & Vision

S.C.A.L.E. (Self-evolving Codex Agent Library Ecosystem) for Codex is a Git-versioned knowledge lifecycle, not just a set of custom agents. It preserves the original project's specialization, tagged retrieval, persistent learning, and global library synchronization while using Codex-native configuration.

The authoritative operating rules are `AGENTS.md`. Role definitions and fixed model assignments live in `.codex/agents/`. Reusable workflows live under `skills/`.

The routing policy is intentional:

- complex or high-impact work receives a strong model with `high` reasoning;
- narrow QA and prompt editing receive a lower-cost model with `high` reasoning;
- routine, bounded work uses OpenCode Go DeepSeek V4 Flash with `high` reasoning and a tightly scoped work order;
- durable learning is promoted through a canonical Git repository and dynamically pulled by connected projects.
