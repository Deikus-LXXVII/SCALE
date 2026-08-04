# S.C.A.L.E. for Hermes

This directory is the Hermes-native adapter for the canonical S.C.A.L.E.
Codex/OpenCode implementation in the parent repository.

## Design goals

- Keep the existing Codex/OpenCode implementation intact.
- Make the useful SCALE workflow available globally in Hermes through skills.
- Prefer a direct route for one atomic, low-risk action.
- Delegate only bounded, independent work when the saved time is worth the
  extra model calls.
- Read only the library entries needed for the current task; never preload the
  whole library into the system prompt.
- Do not change Hermes providers, credentials, or a global OpenAI-compatible
  `base_url` as part of SCALE installation.

## Install globally

From this directory's parent repository:

```bash
bash hermes/scripts/install-scale-hermes.sh
```

The installer creates profile-safe symlinks under `$HERMES_HOME` (or
`~/.hermes` when unset):

- `scale` -> this canonical repository
- `skills/software-development/scale*` -> the Hermes-native skills

It refuses to replace unrelated user-owned paths. Run with `--dry-run` to
preview changes.

## Token policy

The adapter is intentionally conservative:

- atomic task: current Hermes session, no child;
- compound task: one bounded coordination pass, then implementation;
- independent subtasks: at most two leaf children by default;
- validation: one batched final pass and at most one repair cycle;
- context: only named files and relevant tagged knowledge;
- OpenCode Go worker routing: native through the `opencode-go` provider; no
  external dispatcher or gateway.

The canonical Codex/OpenCode layer remains available for Codex projects and is
not automatically imported into Hermes.

## Library synchronization

The `scale-hermes` plugin runs two zero-token filesystem operations at every
new session/reset (they never inject context or start a model call):

1. `scripts/scale-hermes-library-sync.sh` — fast-forward-only `git pull` of the
   canonical checkout from its origin. It runs only on a clean working tree
   (local changes are preserved), never pushes, and silently preserves the
   local snapshot on any failure (offline, diverged, no remote).
2. `scripts/scale-hermes-project-sync.sh` — links the global library into the
   current Git project (` .hermes/scale-library` symlink + metadata).

Push stays manual and explicit. Promote any project artifact (agents, skills,
rules, books, quirks, docs) into the canonical library with:

```bash
${HERMES_HOME:-$HOME/.hermes}/scale/hermes/scripts/scale-hermes-promote.sh \
  <source> <canonical-rel> [...] --validate --commit "<message>" --push
```

Destinations are explicit canonical-relative paths (e.g.
`library/rules/foo.md`, `hermes/skills/foo/SKILL.md`, `.codex/agents/foo.toml`,
`docs/foo.md`). Nothing is committed without `--commit`, nothing is pushed
without `--push`, and only the promoted paths are staged. Use `--dry-run` to
preview.
