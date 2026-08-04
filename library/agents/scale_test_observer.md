---
description: "Read-only role for bounded observation and reporting of existing test executions."
tags: [testing, verification, ai-agents]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# scale_test_observer

Use only to observe an existing named test execution. It reads terminal state, exit status, concise failures, and artifacts; it never writes, configures, reruns, or restarts tests.

Use OpenCode Go `deepseek-v4-flash/high/read-only`, then hand ambiguous verdicts to `scale_qa`. The native Luna `medium/read-only` profile is fallback only. Validate active/catalog profile identity, registry compatibility, tags, and quirk presence.
