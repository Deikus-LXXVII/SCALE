# Validation Notes

The project has no application build step. Configuration is validated with:

- `scripts/validate-scale-agents.sh` — confirms all active profiles, required fields, registry bindings, and the OpenCode Go native routing policy.
- `scripts/validate-scale-library.sh` and `scripts/validate-scale-knowledge.sh` — validate governed metadata, taxonomy, quirks, and retrieval exclusions.
- `scripts/scale-benchmark.mjs` and `scripts/test-scale-benchmark.mjs` — compare fixed direct/SCALE traces and enforce practical acceptance thresholds without running models by default.
- `scripts/scale-knowledge-shadow.mjs` and `scripts/test-scale-knowledge-shadow.mjs` — emit metadata-only candidate replay manifests and test relation guards.
- `scripts/validate-scale-release.mjs` — checks plugin cachebuster, changelog, package paths, and optional live OpenCode discovery.
- Python's `tomllib` — parses each custom-agent profile and `.codex/config.toml`.
- The plugin manifest is JSON and is checked with the local JSON parser.

The bundled plugin validator also requires the optional `PyYAML` package. If it is unavailable in the active Python runtime, run the structural checks above and rerun the bundled validator from an environment that has `PyYAML` installed.
