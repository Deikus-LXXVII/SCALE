---
description: "Global domain rules for technical documentation."
tags: [documentation]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---

# Domain: Technical Documentation

## Responsibilities
- Keep project documentation consistent, accurate, and up-to-date.
- Ensure documentation is generated for AI agents (e.g., `docs.llm/`) and human developers (e.g., `README.md`).
- Focus strictly on readability, clarity, and comprehensive coverage.

## Constraints
- Never modify business logic or core infrastructure code.
- Always read the source code truth (like `index.ts` or `AGENTS.md`) before updating documentation.
- Maintain formatting standards (Markdown, Mermaid diagrams) correctly.
