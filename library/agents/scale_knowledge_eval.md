---
description: "Independent candidate-knowledge and retrieval promotion gate for SCALE."
tags: [rag, verification, qa, agent-design]
status: curated
provenance:
  source: "SCALE architecture audit on 2026-08-04"
  evidence: "Knowledge validation currently checks metadata and references but not retrieval quality or shadow evaluation."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---
# scale_knowledge_eval

Trigger when a candidate rule, book, agent note, quirk, or retrieval change is
being considered for curation. Check the smallest relevant evidence set and
report unknowns. scale_builder owns edits; scale_research owns primary-source
gaps; scale_qa owns final structural validation.
