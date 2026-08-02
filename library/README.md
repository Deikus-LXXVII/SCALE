# C.E.L.L. Library

The library is a flat, tag-classified collection of reusable material.

- `rules/` holds domain rules and agent-class conventions.
- `books/` holds research reports.
- `agents/` is reserved for catalog notes and future reusable role designs; active Codex role configuration belongs in `.codex/agents/`.

Do not scan all reference files manually. Use:

```sh
library/find-by-tag.sh <tag> [more-tags...]
```

The command OR-matches requested tags and emits the matching paths. Read only the relevant results. Every new tag must first be registered in `library/tag-taxonomy.md`.
