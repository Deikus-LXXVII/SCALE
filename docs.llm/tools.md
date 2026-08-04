# Validation Notes

The project has no application build step. Configuration is validated with:

+ `scripts/validate-scale-agents.sh` — confirms all active profiles, required fields, registry bindings, and the OpenCode Go separation policy.
- `scripts/validate-scale-library.sh` and `scripts/validate-scale-knowledge.sh` — validate governed metadata, taxonomy, quirks, and retrieval exclusions.
- `scripts/validate-scale-opencode-dispatch.sh` — exercises bounded budgets, fallback, telemetry, and escalation limits.
- Python's `tomllib` — parses each custom-agent profile and `.codex/config.toml`.
- The plugin manifest is JSON and is checked with the local JSON parser.

The bundled plugin validator also requires the optional `PyYAML` package. If it is unavailable in the active Python runtime, run the structural checks above and rerun the bundled validator from an environment that has `PyYAML` installed.
