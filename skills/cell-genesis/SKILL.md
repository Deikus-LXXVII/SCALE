---
name: cell-genesis
description: Initialize a project with C.E.L.L.'s Codex workflow, including project context files, model-routed agent configuration, and a staged execution roadmap.
---

# C.E.L.L. Project Genesis

Use this workflow when a project needs its initial Codex operating structure.

1. Inspect the workspace. Do not overwrite existing `AGENTS.md`, `.codex/`, or `docs.llm/` content without preserving and merging the user's rules.
2. Create or update the minimum project context under `docs.llm/`: `context.md`, `file_map.md`, `guide.md`, `memory_anchor.md`, `quirks.md`, and `roadmap.md`.
3. Connect the project to the canonical C.E.L.L. Git repository with `scripts/cell-library-install.sh`. This installs a sparse library clone, role symlinks, and a SessionStart refresh hook without overwriting project-owned profiles.
4. Ensure `.codex/config.toml` enables multi-agent work and every active profile explicitly sets both `model` and `model_reasoning_effort`.
5. Invoke `cell_architect` for concept analysis. After the direction is agreed, use `cell_environment`, then `cell_builder`, and validate with `cell_qa`.
6. Keep the roadmap state truthful: mark a stage complete only after its stated deliverable is verified. Promote reusable rules, research, role designs, and quirks through `cell_git` so other connected projects can receive them.
