# Changelog

## [0.1.8+codex.20260807035311] - 2026-08-07

- Make Git Bash/MSYS sparse-checkout installation path-safe with
  `MSYS_NO_PATHCONV=1`, preserving the `/scripts/` materialization helper and
  adding focused regression coverage.

## [0.1.8+codex.20260806143514] - 2026-08-06

- Clarify the native Spark lane for small fixes, localized refactoring,
  boilerplate generation, single-file analysis, fast iterations, and granular
  UI changes while keeping the scope bounded and non-sensitive.
- Keep Spark medium as the `scale_code_simple` fallback and Spark low as the
  read-only observer fallback; Luna remains the shared high-context and QA
  lane.

## [0.1.8+codex.20260806142937] - 2026-08-06

- Admit native `gpt-5.3-codex-spark` with SCALE-approved `low` and `medium`
  reasoning for bounded, non-sensitive iteration. OpenAI documents Spark as a
  separate fast, less-capable model with its own usage limits and a fit for
  small, focused UI changes in a tight iteration loop ([speed guidance](https://learn.chatgpt.com/docs/agent-configuration/speed#codex-spark),
  [granular UI guidance](https://learn.chatgpt.com/use-cases/make-granular-ui-changes#introduction)).
- Route the `scale_code_simple` native fallback to Spark `medium` with
  `workspace-write`; route passive `scale_test_observer` fallback to Spark
  `low` with `read-only` sandboxing.
- Retain native Luna for orchestration, shared/high-context fallback lanes,
  research, model operations, QA, benchmark, knowledge, sync, and model-lab
  work; preserve Sol/Terra authority and all OpenCode primary routes.

## [0.1.8+codex.20260806140429] - 2026-08-06

- Add the registry-only `large-slow` timeout class for active max-capable
  OpenCode Go models, enforcing a 30-minute per-profile dispatch cap while
  preserving fast lanes, native fallbacks, and existing routing.
- Teach `scale_builder`, model-lab generation, and plaintext project overlays
  to propagate the class timeout without changing the OpenCode transport.

## [0.1.8+codex.20260806134450] - 2026-08-06

- Extend the Kimi K3 `scale_webdesign` dispatch budget to the registry's
  30-minute hard cap (1,800,000 ms) and lock it with a focused regression
  assertion.

## [0.1.8+codex.20260805213323] - 2026-08-05

- Add a delegation-first execution firewall for session-root and SCALE Master
  coordinators: compound work is handed to one bounded executor by default,
  repairs remain delegated, and validation is batched.
- Record the delegation policy in the model registry and validate its atomic
  direct-route, independent-parallelism, and one-executor invariants.
- Propagate the coordinator contract to the orchestrator skill, task brief,
  TwitchBot integration, release checks, and focused regression tests without
  changing OpenCode Go model routing.

## [0.1.8+codex.20260805020334] - 2026-08-05

- Replace encrypted OpenCode Codex-child spawning with a bounded plaintext work-order runner that validates scope, budgets, privacy, binding identity, and native fallback ownership.
- Add one-shot fallback requests with no retry or response resume, project overlay support, and focused transport/privacy tests.
- Make recovery non-destructive by default: `runner-start` preserves the active model route; `native-restore` is explicit and requires a Codex restart.
- Keep native fallback TOML identities truthful and derive external identity only from `response.model`.

## [0.1.8+codex.20260805002127] - 2026-08-05

- Route named Codex custom agents to task-specific native Codex and OpenCode Go models through a managed OpenCodex Responses transport.
- Add exact first-message SCALE role/model/reasoning identity contracts to every custom-agent profile and validator coverage for drift.
- Admit and smoke-test the full live OpenCode Go catalog, while hiding three upstream-unavailable or deprecated entries.
- Add launchd-backed OpenCodex installation, health checks, native Codex recovery, and reconnect tooling.
- Archive the retired Hermes/SHELF adapter and restore Codex-native project materialization.
- Generate idempotent named model-lab agents so every active OpenCode Go catalog model can be selected natively for a bounded Codex subagent task.

## [0.1.8+codex.20260804025238] - 2026-08-04

- Add offline direct-vs-SCALE benchmark comparison and candidate knowledge shadow replay.
- Add deterministic external-dispatch privacy, realpath, managed-agent integrity, and write-approval gates with schema-v2 telemetry for usage and outcomes.
- Add per-profile runtime budgets, bounded evidence-backed adjustments, refresh locking, health ledgers, and isolated incoming-revision validation.
- Prevent the global SessionStart hook from self-cloning the canonical SCALE checkout.
- Validate incoming profiles, library metadata, release package metadata, and install/dispatch fixtures in CI.
- Keep OpenCode live discovery opt-in; CI does not use external credentials or claim live runtime access.
