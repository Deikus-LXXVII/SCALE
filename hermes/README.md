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
