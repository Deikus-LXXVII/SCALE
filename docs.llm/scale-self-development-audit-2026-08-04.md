# SCALE self-development audit — 2026-08-04

## Evidence

Reviewed profiles, registry, OpenCode adapter, dispatcher, materialization and refresh scripts, library governance, hooks, validators, docs, and Git state. Existing checks passed for 25 Codex profiles, 10 OpenCode agents, 29 governed knowledge entries, and five routed lanes. The untracked `benchmarks/` directory was excluded.

## Findings

### P0 correctness and boundary risk

- Policy drift existed between `AGENTS.md`, docs.llm, the registry, and active profiles. The stale Kimi K2.7 reference and old profile/reasoning counts could misroute an orchestrator.
- OpenCode privacy boundaries were mostly prose contracts. The dispatcher needs deterministic realpath/symlink checks, secret/PII gating, managed-agent integrity checks, and explicit write approval before external context or `--auto`.
- SessionStart refresh validates model and knowledge subsets, but not every changed script, skill, hook, or plugin path before execution.

### P1 effectiveness and maintenance

- Telemetry records bytes, elapsed time, model, and fallback events but not token/spend, acceptance outcome, first-pass success, regression, human intervention, or knowledge reuse.
- No direct-Codex versus SCALE benchmark harness or candidate-knowledge shadow replay exists.
- The registry duplicates route, binding, profile, OpenCode frontmatter, and hardcoded validator sources of truth.
- Fleet refresh preserves a last-known-good snapshot but exposes no central revision, hook, materialization, or stale-project health ledger.
- Native roles have no runtime budget records even though external routes do.
- `scale-agent-activate.sh` previously looked only in `library/agents/`, while the active core profile set is larger than the differentiated catalog.
- No CI/release workflow validates the complete incoming package on every push or pull request.

## New ownership roles

- `scale_policy_auditor` — read-only policy and source-of-truth drift gate.
- `scale_privacy_gate` — read-only external-dispatch privacy and least-privilege gate.
- `scale_model_ops` — live catalog, variants, cost, and model admission evidence.
- `scale_benchmark` — direct-vs-SCALE quality, cost, latency, and regression measurement.
- `scale_knowledge_eval` — candidate knowledge shadow evaluation and promotion recommendation.
- `scale_sync` — read-only connected-project and materialization fleet health.

No separate release, telemetry, or generic runtime roles were added yet: existing `scale_git`, `scale_optimizer`, `scale_test_engineer`, `scale_library`, and `scale_environment` remain owners until benchmark evidence justifies more specialization.

## Staged follow-up

1. Add deterministic path, realpath, secret, managed-agent, and write-approval gates before OpenCode dispatch.
2. Expand telemetry to tokens, spend, route reason, acceptance outcome, and fallback completion; then build a 30–50 task direct-vs-SCALE benchmark.
3. Add candidate shadow replay, retrieval manifests, conflict graph checks, and provenance-aware promotion evidence.
4. Validate all incoming scripts, skills, hooks, and plugin metadata in an isolated pre-merge fixture; add release/version consistency checks.
5. Add fleet health reporting and safe refresh locks without overwriting project-owned paths.

No unrun benchmark or runtime hardening is claimed as complete by this note.
