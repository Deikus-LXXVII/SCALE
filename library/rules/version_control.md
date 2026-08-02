---
description: "Rules for interacting with Git, GitHub, and other version control systems."
tags: [git]
---
# Domain: Version Control

This domain governs the rules and constraints for interacting with Git repositories and remote platforms like GitHub.

1. **Destructive Actions**: Never use `git push --force` or modify history (`git reset --hard`) on shared remote branches (like `main` or `master`) unless explicitly confirmed by the user.
2. **Commit Messages**: Write clear, descriptive commit messages. Follow Conventional Commits format if the project specifies it. Include context for why a change was made.
3. **Secret Management**: NEVER commit credentials, API keys, or `.env` files. Always verify `.gitignore` is properly configured before staging changes.
4. **Clean Working Tree**: Ensure the working directory is clean before checking out new branches or pulling remote changes to avoid merge conflicts or data loss.
5. **Remote Configuration**: Verify remotes before pushing. Do not overwrite existing remotes unexpectedly.
