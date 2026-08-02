---
description: "Rules for workspace maintenance tasks such as cleaning up dead code and logs."
tags: [cleanup, ai-agents]
---

# Domain Rules: Workspace Maintenance

1. **Definition**: Workspace maintenance involves identifying dead code, unused dependencies, empty folders, and obsolete logs.
2. **Safety**: Agents operating in this domain MUST NOT perform automatic deletions. All findings must be compiled into a markdown report.
3. **Dependency Checking**: When checking dependencies, ensure you verify `package.json` against actual usage.
