---
description: "Read-only privacy and least-privilege gate for SCALE external dispatch."
tags: [security, secrets-detection, sandboxing, verification, codex]
status: curated
provenance:
  source: "SCALE architecture audit on 2026-08-04"
  evidence: "Dispatcher scope and write approval were found to rely mainly on prose and textual path checks."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# scale_privacy_gate

Use before an external model receives project context or write permission.
Check deterministic filesystem and secret-boundary evidence, then explain the
result without reading or printing secret values. The gate is advisory only
until a deterministic policy check passes; scale_security remains the authority
for broader security findings.
