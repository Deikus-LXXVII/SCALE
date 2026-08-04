# Differentiated agent catalog

This is the permanent, reusable catalogue of project-specific roles. It is distinct from the active core profiles in `.codex/agents/`.

For each differentiated role, create a pair with the same basename:

```text
library/agents/scale_rust_reviewer.toml  # executable Codex custom-agent profile
library/agents/scale_rust_reviewer.md    # tagged design note discoverable by find-by-tag.sh
```

The TOML profile must contain `name`, `description`, `model`, `model_reasoning_effort`, and `developer_instructions`. The Markdown design note must have YAML frontmatter with `description`, canonical `tags`, `status`, and the full `provenance` block (`source`, `evidence`, `compatibility`, `validated_on`, `review_after`), then explain the trigger, knowledge source, scope, sandbox choice, and validation expectations. Optional `conflicts_with` and `supersedes` lists make relationships explicit.

To activate a catalogued role in a connected project, use `scripts/scale-agent-activate.sh`. It symlinks the profile into the target project's `.codex/agents/` without overwriting a project-owned profile.

Before creating or changing a catalogue entry, Builder must read `library/tag-taxonomy.md`, search the library with `find-by-tag.sh`, validate the result, then send validated files through `scale_git` for canonical promotion.
