---
description: "Guidance for writing Codex custom-agent and skill instructions in this repository."
tags: [prompt-engineering, codex, agent-design]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# Domain Rules: Prompt Engineering for Codex

1. State a narrow role, a concrete trigger, scope boundaries, and the required deliverable.
2. Put durable repository rules in `AGENTS.md`, role-specific behavior in `.codex/agents/*.toml`, and reusable workflows in `skills/*/SKILL.md`.
3. Every custom agent must explicitly configure both `model` and `model_reasoning_effort`; model selection is configuration, not prompt prose.
4. Match `sandbox_mode` to the role. Reviewers and auditors should be `read-only`; implementation roles should use `workspace-write` only when editing is required.
5. For OpenCode Go DeepSeek V4 Flash work, supply a single bounded objective, exact paths or commands when known, acceptance criteria, an output format, and an explicit stop condition. Its routed lanes use `high`; do not silently change a routed profile's effort or configure a separate DeepSeek API provider.
6. Avoid references to unavailable tools or another product's agent manifest syntax. Validate the profile after editing it.
