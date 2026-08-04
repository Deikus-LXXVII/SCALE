---
name: scale-genesis
description: Initialize a Hermes project with the smallest useful S.C.A.L.E. context and roadmap.
---

# S.C.A.L.E. Genesis for Hermes

Use only when a project needs initial operating context. Do not initialize
projects automatically just because they are Git repositories.

1. Inspect the workspace and preserve existing `AGENTS.md`, `.hermes/`,
   `docs.llm/`, and user rules. Never overwrite them blindly.
2. Create only missing, useful context files. Prefer a short `AGENTS.md` and a
   minimal `docs.llm/roadmap.md`; add `context.md`, `file_map.md`, `guide.md`,
   `memory_anchor.md`, or `quirks.md` only when the project needs them.
3. Keep project facts local. Global reusable knowledge belongs in the SCALE
   library and must not be copied wholesale into the project prompt.
4. Use the current Hermes model and tools. Do not create Codex TOML profiles,
   alter provider credentials, or set a global OpenAI-compatible base URL.
5. Define one acceptance check per roadmap stage and stop after the requested
   stage is verified. Do not fan out agents for documentation-only setup.

If the project already has adequate context, report that no genesis mutation
is needed and continue with the direct task route.
