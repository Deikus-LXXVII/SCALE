# Current State & Developer Guide

Use Codex custom-agent profiles by name: `scale_architect`, `scale_backend`, `scale_qa`, and the other profiles in `.codex/agents/`. Each profile owns both its model selection and its `model_reasoning_effort`; do not rely on a prompt to select them.

For a multi-step task, invoke the `scale-orchestrator` skill. It maps independent work to specialized agents, keeps edits non-overlapping, and requires focused verification before completion.

For new projects, use `scale-genesis`. It creates or merges project context, verifies agent profiles, and runs architect → environment → builder → QA in order.

Validate role configuration after any profile change:

```bash
./scripts/validate-scale-agents.sh
```

## Offline evaluation and release checks

Use the same fixed task corpus and acceptance criteria for both lanes. The benchmark
harness consumes recorded JSONL traces by default and never starts a runner unless
`--allow-run` is explicit. It normalizes only outcome and resource metrics, refuses
to overwrite an existing report, and does not copy prompts, outputs, or credentials.

```bash
node scripts/scale-benchmark.mjs \
  --corpus /path/to/tasks.json \
  --direct-trace /path/to/direct.jsonl \
  --scale-trace /path/to/scale.jsonl \
  --max-escalation-rate 0.20 \
  --min-codex-token-reduction 0.25 \
  --json-out /new/path/report.json \
  --jsonl-out /new/path/task-metrics.jsonl
```

Candidate knowledge is never returned by default lookup. Use explicit shadow replay
to inspect a metadata-only manifest (paths, hashes, tags, estimates, relation
statuses, and coverage), then promote only after review:

```bash
node scripts/scale-knowledge-shadow.mjs --candidate-replay --tag verification --max-tokens 12000 \
  --manifest /new/path/knowledge-manifest.json
```

Run the focused offline suite before release. `--opencode` is intentionally optional
and skipped in CI because it requires a user-provided external runtime and may need
authentication; it is not evidence of live access when omitted.

```bash
bash scripts/validate-scale-agents.sh
bash scripts/validate-scale-library.sh
node scripts/test-scale-benchmark.mjs
node scripts/test-scale-knowledge-shadow.mjs
bash scripts/validate-scale-install.sh
node scripts/validate-scale-release.mjs
```
