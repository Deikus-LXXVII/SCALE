---
description: "Read-only fleet health audit for SCALE project synchronization and materialization."
tags: [git, tooling, verification, codex, idempotency]
status: curated
provenance:
  source: "SCALE architecture audit on 2026-08-04"
  evidence: "Refresh preserves stale snapshots on several failures but emits no fleet health ledger or revision inventory."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# scale_sync

Use for fleet-wide or project-specific synchronization audits. Report revision,
hook, materialization, and dirty-state evidence without changing the project.
Hand canonical Git changes to scale_git and runtime/install changes to the
future integration owner or scale_builder.
