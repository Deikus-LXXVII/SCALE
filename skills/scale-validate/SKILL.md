---
name: scale-validate
description: Validate S.C.A.L.E. agent profiles, model routing, library metadata, skills, and connected-project materialization. Use before promoting SCALE changes or when a connected project is missing an agent or skill.
---

# S.C.A.L.E. Validation

1. Run `scripts/validate-scale-agents.sh`, `scripts/validate-scale-library.sh`, and `scripts/validate-scale-knowledge.sh` from the canonical repository. For a machine-specific model check, also run `node scripts/validate-scale-model-registry.mjs --catalog "$HOME/.codex/models.json" --config "$HOME/.codex/config.toml"` without exposing credentials. For dispatcher changes, run `scripts/validate-scale-opencode-dispatch.sh` and inspect its telemetry report fixture.
2. For an installed project, run its `.codex/scale-library-src/scripts/scale-library-materialize.sh --target <project-root>` and verify that managed profiles are in `.codex/agents/` and skills are in `.agents/skills/`.
3. Confirm every changed role fixes `model`, `model_reasoning_effort`, and the least-privilege `sandbox_mode` required by its work.
4. Treat missing profiles, skills, registry metadata, unavailable providers, expired/uncurated knowledge, or unsupported models as findings. Do not promote changes until they are resolved or explicitly accepted.

For release-level changes to installation or refresh scripts, also run `scripts/validate-scale-install.sh`.
