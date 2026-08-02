# Persistent agent quirks

Each file in this folder is the durable, Git-versioned operational memory of one Codex role. Before a role starts work, it reads its own quirk file after resolving the active C.E.L.L. library. When it encounters a reproducible limitation, bug, or workaround that will help a future task, it appends a short entry:

```markdown
- **Problem**: What failed or was surprising.
  **Environment**: Where it occurs.
  **Solution**: The confirmed workaround or fix.
```

Do not record guesses, secrets, one-off user data, or unverified claims. Quirks are local working knowledge; reusable domain knowledge belongs in a tagged `library/rules/` entry and researched facts belong in `library/books/`.
