# C.E.L.L. for Codex

C.E.L.L. is a self-evolving, Git-synchronized knowledge library for Codex. It starts a project with a small core of stem roles, differentiates specialized agents and rules only when a project needs them, preserves verified learning as versioned library content, and dynamically distributes that knowledge to connected projects.

This is not merely a collection of agents. Its durable system is:

```text
project task → tagged retrieval → implementation/research → QA → Git promotion
→ canonical library → fast-forward refresh in every connected Codex project
```

## Architecture

- `.codex/agents/` — active Codex roles, each with an explicit model and reasoning effort.
- `library/rules/` — reusable domain rules.
- `library/books/` — cited research reports.
- `library/agents/` — catalogued, differentiated role profiles and tagged design notes.
- `library/quirks/` — persistent operational memory for every role.
- `library/tag-taxonomy.md` and `find-by-tag.sh` — governed semantic retrieval without broad scans.
- `scripts/cell-library-*.sh` — safe library refresh, project connection, and role activation.
- `.codex/hooks.json` — a trusted SessionStart hook that refreshes an attached library clone.

See [AGENTS.md](AGENTS.md) for the full lifecycle and routing contract.

## Git is required

Git is the library's synchronization and provenance layer. Do not point this Codex version at the original C.E.L.L. remote: publish it to its own canonical repository first.

```bash
git add .
git commit -m "feat: initialize Codex knowledge library"
git remote add origin <your-codex-library-git-url>
git push -u origin main
```

The initial commit and remote creation are intentionally not automated because the destination repository belongs to you.

## Connect another Codex project

After the canonical remote exists, run from this repository:

```bash
./scripts/cell-library-install.sh --target /absolute/path/to/project
```

It creates a sparse clone at the target's `.codex/cell-library-src/`, symlinks core agent profiles into `.codex/agents/`, links the library at `.codex/cell-library/`, and installs a SessionStart refresh hook only when the target has no existing hook configuration. It never overwrites a project-owned agent profile or hook file.

On the first trusted Codex session, review the hook in `/hooks`. Afterwards, every session start runs a `git pull --ff-only`; a dirty clone or network failure preserves the last valid local snapshot.

## Evolve the library

1. `cell_architect` identifies the required specialization and existing library coverage.
2. `cell_builder` creates a new role, rule, or catalog entry only after tag-governed retrieval.
3. `cell_research` writes a cited `library/books/` record when new research is needed.
4. `cell_qa` validates profiles and metadata.
5. `cell_git` pulls, selectively commits, and pushes the validated library changes to the canonical remote.

Use [model-routing.md](skills/cell-orchestrator/references/model-routing.md) for model allocation. Strong roles use `medium` reasoning; narrow QA/prompt roles use `high`; five routine roles actively use DeepSeek V4 Flash with `medium` and tightly scoped work orders.

## Validate

```bash
./scripts/validate-codex-cells.sh
./scripts/validate-codex-library.sh
```

The configured DeepSeek identifier is `deepseek-v4-flash`. If the connected provider exposes a different exact model identifier, change it only in the five DeepSeek profiles and retain their required `medium` reasoning effort.
