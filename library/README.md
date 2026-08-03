# S.C.A.L.E. Library

The library is a flat, tag-classified collection of reusable material.

- `rules/` holds domain rules and agent-class conventions.
- `books/` holds research reports.
- `agents/` is reserved for catalog notes and future reusable role designs; active Codex role configuration belongs in `.codex/agents/`.
- `model-registry.json` is the canonical, credential-free registry of approved Codex-native and external providers, exact model IDs, reasoning efforts, and code routes.

Do not scan all reference files manually. Use:

```sh
library/find-by-tag.sh <tag> [more-tags...]
```

The command OR-matches requested tags and emits the matching paths. Read only the relevant results. Every new tag must first be registered in `library/tag-taxonomy.md`.

Model changes follow a separate compatibility protocol because model availability is machine-specific: configure an external provider locally, update the registry, benchmark the candidate, run `scripts/validate-scale-model-registry.mjs` against the local Codex catalog, then update routed profiles and promote the validated change.
