# Validation Notes

The project has no application build step. Configuration is validated with:

- `scripts/validate-scale-agents.sh` — confirms the 16 core profiles, required fields, and DeepSeek medium-reasoning policy.
- Python's `tomllib` — parses each custom-agent profile and `.codex/config.toml`.
- The plugin manifest is JSON and is checked with the local JSON parser.

The bundled plugin validator also requires the optional `PyYAML` package. If it is unavailable in the active Python runtime, run the structural checks above and rerun the bundled validator from an environment that has `PyYAML` installed.
