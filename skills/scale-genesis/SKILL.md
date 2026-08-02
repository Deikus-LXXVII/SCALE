---
name: scale-genesis
description: Initialize a project with S.C.A.L.E.'s Codex workflow, including project context files, model-routed agent configuration, and a staged execution roadmap.
---

# S.C.A.L.E. Project Genesis

Use this workflow when a project needs its initial Codex operating structure.

1. Inspect the workspace. Do not overwrite existing `AGENTS.md`, `.codex/`, or `docs.llm/` content without preserving and merging the user's rules.
2. Create or update the minimum project context under `docs.llm/`: `context.md`, `file_map.md`, `guide.md`, `memory_anchor.md`, `quirks.md`, and `roadmap.md`.
3. Connect the project to the canonical S.C.A.L.E. Git repository with `scripts/scale-library-install.sh`. This installs a sparse library clone, role symlinks, and a SessionStart refresh hook without overwriting project-owned profiles.
4. Ensure `.codex/config.toml` enables multi-agent work and every active profile explicitly sets both `model` and `model_reasoning_effort`.
5. Invoke `scale_architect` for concept analysis. After the direction is agreed, use `scale_environment`, then `scale_builder`, and validate with `scale_qa`.
6. Keep the roadmap state truthful: mark a stage complete only after its stated deliverable is verified. Promote reusable rules, research, role designs, and quirks through `scale_git` so other connected projects can receive them.
