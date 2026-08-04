# S.C.A.L.E. for Codex

**S**elf-evolving **C**odex **A**gent **L**ibrary **E**cosystem.

S.C.A.L.E. is a self-evolving, Git-synchronized knowledge library for Codex. It starts a project with a small core of stem roles, differentiates specialized agents and rules only when a project needs them, preserves verified learning as versioned library content, and dynamically distributes that knowledge to connected projects.

This is not merely a collection of agents. Its durable system is:

```text
project task → tagged retrieval → implementation/research → QA → Git promotion
→ canonical library → fast-forward refresh in every connected Codex project
```

## Architecture

- `.codex/agents/` — active Codex roles, each with an explicit model and reasoning effort. OpenCode Go DeepSeek V4 Flash High owns the default control-plane route; Codex Luna is its native gateway/fallback.
- `opencode/agents/` — managed OpenCode Go external agents, also with explicit model and reasoning effort; they are materialized safely into connected projects without changing Codex's catalog.
- `library/rules/` — reusable domain rules.
- `library/books/` — cited research reports.
- `library/agents/` — catalogued, differentiated role profiles and tagged design notes.
- `library/quirks/` — persistent operational memory for every role.
- `library/tag-taxonomy.md` and `find-by-tag.sh` — governed semantic retrieval without broad scans.
- `library/model-registry.json` — credential-free provider/model policy and stable code-complexity routes.
- `library/*` frontmatter — provenance, compatibility, review/expiry, status, and optional conflict/supersession metadata for durable knowledge.
- `scripts/scale-library-*.sh` — safe library refresh, project connection, and role activation; model-policy updates are compatibility-gated before materialization.
- `.codex/hooks.json` and `hooks/hooks.json` — trusted SessionStart hooks that refresh and materialize an attached library clone.

See [AGENTS.md](AGENTS.md) for the full lifecycle and routing contract.

## Git is required

Git is the library's synchronization and provenance layer. Keep this Codex implementation on its own canonical remote rather than sharing a predecessor's remote.

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
./scripts/scale-library-install.sh --target /absolute/path/to/project
```

It creates a sparse clone at the target's `.codex/scale-library-src/`, materializes managed agent profiles into `.codex/agents/`, exposes SCALE skills through `.agents/skills/`, and links the library at `.codex/scale-library/`. It installs a SessionStart hook only when the target has no existing hook configuration. It never overwrites a project-owned agent profile, skill, library path, or hook file.

On the first trusted Codex session, review the hook in `/hooks`. Afterwards, every session start runs a `git pull --ff-only` followed by safe materialization of newly added SCALE agents and skills; a dirty clone or network failure preserves the last valid local snapshot.

## Enable every Git project

Install the `scale` plugin once from this repository's Git marketplace. Its global
SessionStart hook connects any Git project opened in Codex to the canonical library
on first use, then refreshes it on later sessions. The automatic path writes only
S.C.A.L.E.-managed files under `.codex/` and `.agents/skills/`; its ignores live in
the repository-local `.git/info/exclude`, so it does not modify a project's tracked
`.gitignore` or replace a project-owned hook configuration. Non-Git folders retain
the global plugin skills but are not materialized as S.C.A.L.E. projects.

## Evolve the library

1. `scale_architect` identifies the required specialization and existing library coverage.
2. `scale_builder` creates a new role, rule, or catalog entry only after tag-governed retrieval.
3. `scale_research` writes a cited `library/books/` record when new research is needed.
4. `scale_qa` validates profiles and metadata.
5. `scale_git` pulls, selectively commits, and pushes the validated library changes to the canonical remote.

Use [model-routing.md](skills/scale-orchestrator/references/model-routing.md) for allocation. Every DeepSeek V4 Flash route runs through authenticated OpenCode Go; the native Codex lane is a named fallback, never the DeepSeek API. Terra/Sol/Luna retain their Codex roles, Kimi K2.7 Code owns premium web-design packets, and Terra owns production frontend implementation. The registry governs exact IDs, reasoning efforts, cost boundaries, provider compatibility, and runtime budgets. An explicit low-risk profile with bounded files uses the direct route and skips an unnecessary orchestration turn.

Dispatcher telemetry is project-local JSONL at `.codex/scale-telemetry.jsonl` (ignored by Git). It records completed, rejected, budget-adjusted, and fallback-required events without prompts or credentials. Inspect it with `node scripts/scale-telemetry-report.mjs --input <project>/.codex/scale-telemetry.jsonl --json`. The dispatcher applies cheaper per-profile budgets first, then enforces hard work-order/context/steps/timeout caps and one fallback escalation per task. The orchestrator can request one bounded, evidenced adjustment; leaving the profile budget unchanged is the default.

Normal tagged retrieval returns only `curated` knowledge. Use `library/find-by-tag.sh --include-candidates <tag>` only when deliberately shadow-evaluating a candidate; deprecated entries remain excluded.

## Validate

```bash
./scripts/validate-scale-agents.sh
./scripts/validate-scale-opencode-agents.sh
./scripts/validate-scale-opencode-dispatch.sh
./scripts/validate-scale-library.sh
./scripts/validate-scale-knowledge.sh
./scripts/validate-scale-install.sh
```

Run `node scripts/validate-scale-model-registry.mjs --catalog "$HOME/.codex/models.json" --config "$HOME/.codex/config.toml"` to verify a machine before accepting a new Codex model route. The configured DeepSeek identifier is `opencode-go/deepseek-v4-flash`; its routes use High reasoning, and QA still gates global promotion. OpenCode Go is integrated as a separate CLI backend, never a fake Codex provider; after it is installed and authenticated, add `--opencode` to validate its live model catalog. See [OpenCode Go integration](docs/opencode-go.md) for its cost-saving routing and privacy boundary. Add or update models only in `library/model-registry.json`, benchmark them, then update the exact routed profiles. Never commit provider credentials or overwrite a user's global Codex configuration.
