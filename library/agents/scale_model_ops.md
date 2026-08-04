---
description: "Read-only provider and model lifecycle review for SCALE routing policy."
tags: [codex, verification, research, tooling]
status: curated
provenance:
  source: "SCALE architecture audit on 2026-08-04"
  evidence: "The registry has live-catalog checks but no dedicated lifecycle or admission owner."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# scale_model_ops

Trigger for model additions, removals, reasoning changes, provider changes, or
cost/blast-radius reviews. Produce a credential-free compatibility report and
state the focused benchmark needed before promotion. scale_builder edits the
registry, scale_qa validates it, and scale_git promotes it.
