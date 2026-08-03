---
description: "Guidance for writing Codex custom-agent and skill instructions in this repository."
tags: [prompt-engineering, codex, agent-design]
---
# Domain Rules: Prompt Engineering for Codex

1. State a narrow role, a concrete trigger, scope boundaries, and the required deliverable.
2. Put durable repository rules in `AGENTS.md`, role-specific behavior in `.codex/agents/*.toml`, and reusable workflows in `skills/*/SKILL.md`.
3. Every custom agent must explicitly configure both `model` and `model_reasoning_effort`; model selection is configuration, not prompt prose.
4. Match `sandbox_mode` to the role. Reviewers and auditors should be `read-only`; implementation roles should use `workspace-write` only when editing is required.
5. For DeepSeek V4 Flash work, supply a single bounded objective, exact paths or commands when known, acceptance criteria, an output format, and an explicit stop condition. S.C.A.L.E.'s current Codex and OpenCode Go implementation lanes use `high`; reserve `medium` for a future, explicitly approved passive-observation profile and do not silently change a routed profile's effort.
6. Avoid references to unavailable tools or another product's agent manifest syntax. Validate the profile after editing it.
