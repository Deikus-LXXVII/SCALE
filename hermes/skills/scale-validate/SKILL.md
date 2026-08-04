---
name: scale-validate
description: Validate the Hermes-native SCALE installation and project changes with one token-bounded final pass.
---

# S.C.A.L.E. Validation for Hermes

Validate the changed surface, not the entire SCALE/Codex implementation.

## Global installation checks

Confirm:

- `$HERMES_HOME/scale` points to the canonical SCALE checkout;
- `scale`, `scale-orchestrator`, `scale-genesis`, and `scale-validate` appear
  in `hermes skills list`;
- the skill frontmatter parses and no unrelated global skill was replaced.

The installer is `hermes/scripts/install-scale-hermes.sh` in the canonical
checkout. Use `--dry-run` before changing a path you do not own.

## Project checks

For a project change, run the smallest relevant test/lint/typecheck command
once. Batch independent checks, then inspect the result. Use one repair cycle
at most; after repair, run one final acceptance pass. Do not rerun checks that
remain valid merely for reassurance.

## Legacy checks

The parent `scripts/validate-scale-*.sh` suite validates the Codex/OpenCode
layer and may require `rg`, Codex files, or external runtimes. Run it only when
that layer changed; it is not required to validate Hermes skill installation.

Never treat a delegated report or a successful symlink creation as proof that
an application works. Verify the installed skill list and the actual artifact.
