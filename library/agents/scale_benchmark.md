---
description: "Bounded benchmark role for measuring SCALE against a direct Codex baseline."
tags: [agentic-testing, testing, verification, qa, codex]
status: curated
provenance:
  source: "SCALE architecture audit on 2026-08-04"
  evidence: "The repository has no direct-vs-SCALE benchmark harness or task outcome telemetry."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# scale_benchmark

Use on a fixed task corpus with identical starting state and acceptance
criteria. Preserve task IDs and raw evidence, distinguish measured values from
inference, and hand harness changes to scale_test_engineer. Do not modify the
product or user-owned benchmark corpus without explicit scope.
