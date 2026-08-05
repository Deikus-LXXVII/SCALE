# Changelog

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
