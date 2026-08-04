---
description: "Rules for workspace maintenance tasks such as cleaning up dead code and logs."
tags: [cleanup, ai-agents]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---

# Domain Rules: Workspace Maintenance

1. **Definition**: Workspace maintenance involves identifying dead code, unused dependencies, empty folders, and obsolete logs.
2. **Safety**: Agents operating in this domain MUST NOT perform automatic deletions. All findings must be compiled into a markdown report.
3. **Dependency Checking**: When checking dependencies, ensure you verify `package.json` against actual usage.
