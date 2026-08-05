---
name: twitchbot-scale-orchestration
description: Route non-trivial TwitchBot work through connected SCALE roles. Use for compound repository changes, architecture, testing, agent/profile work, external state, or independent validation.
---

# TwitchBot SCALE orchestration

Read `AGENTS.md`, then `$scale-orchestrator`; use `$scale-validate` for final
acceptance. Keep the task brief and delegated context bounded.

1. Invoke named `scale_orchestrator` for every compound task or bullet list.
   Only one atomic low-risk action with one obvious check may bypass it.
2. Use bare `scale_*` for global responsibilities and `scale_telik_*` for
   TwitchBot topology, latency, data, hardware, persona, and product contracts.
   One mutation surface has one owner.
3. Resolve project overlay models from `.codex/scale-project-bindings.json`.
   For an `opencode-go/*` primary, run one plaintext work order through
   `.codex/scale-library-src/scripts/scale-plaintext-runner.mjs`; never spawn
   that primary with Codex `thread_spawn`. Its project TOML is native fallback.
4. Every native child's first response must match its TOML identity:
   `[SCALE agent=<role> model=<model> reasoning=<effort>]`. Stop on mismatch.
5. Never send secrets, credentials, PII, production dumps, auth flows, or
   security investigations to OpenCode Go. Keep critical backend, identity,
   injection-defense, and Git authority native.
6. Give each work order an objective, exact scope, acceptance criteria, output
   format, and stop condition. At most one fallback is allowed.
7. Run one batched deterministic validation pass. After one repair, rerun only
   the failed check and perform one final acceptance pass; never rerun passing
   checks without invalidating changes.
8. If the runner exits 75, start the returned native fallback as a fresh task;
   do not retry or resume the OpenCode response. If OpenCodex itself fails, use
   `.codex/scale-library-src/scripts/scale-codex-recover.sh runner-start` so the
   gateway is repaired without stopping the active Codex model route. Use
   `native-restore` only as an explicit emergency that removes OpenCode models.

Report the selected roles, actual model identity lines, deterministic evidence,
and whether a fallback occurred.
