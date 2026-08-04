# S.C.A.L.E. for Codex

**S**elf-evolving **C**odex **A**gent **L**ibrary **E**cosystem.

S.C.A.L.E. is a self-evolving, Git-synchronized knowledge library for Codex. It starts a project with a small core of stem roles, differentiates specialized agents and rules only when a project needs them, preserves verified learning as versioned library content, and dynamically distributes that knowledge to connected projects.

This is not merely a collection of agents. Its durable system is:

```text
project task → tagged retrieval → implementation/research → QA → Git promotion
→ canonical library → fast-forward refresh in every connected Codex project
```

## Architecture

- `.codex/agents/` — active Codex roles, each with an explicit model and reasoning effort. OpenCode Go DeepSeek V4 Flash High owns the default control-plane route in Hermes via the native `opencode-go` provider; Codex Luna xhigh is its named native fallback and high-context advisory lane.
- `opencode/agents/` — canonical OpenCode Go role descriptions (model, reasoning, step budget). Hermes executes these roles natively through the `opencode-go` provider; no dispatcher or gateway is used.
- `library/rules/` — reusable domain rules.
- `library/books/` — cited research reports.
- `library/agents/` — catalogued, differentiated role profiles and tagged design notes.
- `library/quirks/` — persistent operational memory for every role.
- `library/tag-taxonomy.md` and `find-by-tag.sh` — governed semantic retrieval without broad scans.
- `library/model-registry.json` — credential-free provider/model policy and stable code-complexity routes.
- Internal SCALE development has dedicated read-only policy, privacy, model-operations, knowledge-evaluation, and fleet-sync gates, plus a measured direct-vs-SCALE benchmark role; existing Git, optimizer, library, and test owners remain the writers.
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

## Hermes integration

S.C.A.L.E. also ships a Hermes-native adapter under `hermes/`. It exposes the
workflow as four global skills (`scale`, `scale-orchestrator`, `scale-genesis`,
and `scale-validate`) without importing the Codex TOML catalog or loading the
whole knowledge library into every prompt. The adapter prefers direct,
token-bounded execution; delegation is opt-in, and OpenCode Go worker routing is
native through the `opencode-go` provider.

Install it for the active Hermes profile with:

```bash
bash hermes/scripts/install-scale-hermes.sh
```

The installer creates profile-safe symlinks under `$HERMES_HOME` (or
`~/.hermes`) and refuses to replace unrelated user-owned paths. Validate it
with `bash hermes/scripts/validate-scale-hermes-install.sh`.

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

Use [model-routing.md](skills/scale-orchestrator/references/model-routing.md) for allocation. Every DeepSeek V4 Flash route runs through the native Hermes `opencode-go` provider; the Codex lane is a named fallback, never the DeepSeek API. Bounded standard implementation now prefers OpenCode Go DeepSeek Pro, with Terra reserved for sensitive/complex integration and production frontend. Luna xhigh covers native fallbacks and high-context advisory work. Kimi K3 at max reasoning owns user-directed premium web-design packets. The registry governs exact IDs, reasoning efforts, cost boundaries, provider compatibility, and runtime budgets. An explicit low-risk profile with bounded files uses the direct route and skips an unnecessary orchestration turn.

Runtime budgets are enforced per profile (work-order bytes, context files/bytes, agent steps, timeout), with one fallback escalation per task and a bounded, evidenced orchestrator adjustment option; leaving the profile budget unchanged is the default. Telemetry is credential-free JSONL at the project-local ignored `.codex/scale-telemetry.jsonl` (written only by legacy Codex tooling).

Use `scripts/scale-benchmark.mjs` for an offline-first direct-vs-SCALE comparison. It accepts the same fixed corpus and acceptance IDs for both lanes, reports success/first-pass/escalation/call/context/token/cost/time metrics, and defaults to practical acceptance thresholds. Recorded traces are preferred; live runner commands require explicit `--allow-run`.

Normal tagged retrieval returns only `curated` knowledge. Use `library/find-by-tag.sh --include-candidates <tag>` only when deliberately shadow-evaluating a candidate; deprecated entries remain excluded.

## Validate

```bash
./scripts/validate-scale-agents.sh
./scripts/validate-scale-opencode-agents.sh
./scripts/validate-scale-library.sh
./scripts/validate-scale-knowledge.sh
./scripts/validate-scale-install.sh
```

Run `node scripts/validate-scale-model-registry.mjs --catalog "$HOME/.codex/models.json" --config "$HOME/.codex/config.toml"` to verify a machine before accepting a new Codex model route. The configured DeepSeek identifier is `opencode-go/deepseek-v4-flash`; its routes use High reasoning, and QA still gates global promotion. OpenCode Go is a native Hermes provider (`opencode-go/<model>` slug, `execution: hermes-native`), never a fake Codex provider and never the DeepSeek API; no `base_url` override or loopback service exists. See [OpenCode Go integration](docs/opencode-go.md) for its cost-saving routing and privacy boundary. Add or update models only in `library/model-registry.json`, benchmark them, then update the exact routed profiles. Never commit provider credentials or overwrite a user's global Codex configuration.
