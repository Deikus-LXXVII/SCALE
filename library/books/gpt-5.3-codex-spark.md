---
description: "Verified model note for GPT-5.3-Codex-Spark routing boundaries."
tags: [codex, ai-agents, verification]
status: curated
provenance:
  source: "OpenAI Codex documentation and the local Codex model catalog"
  evidence: "OpenAI documents Codex-Spark as a separate fast, less-capable model for near-instant real-time coding iteration, and documents small focused UI changes as a suitable use. The local catalog exposes gpt-5.3-codex-spark; SCALE admits low and medium reasoning only."
  compatibility: "SCALE >= 0.1.8"
  validated_on: "2026-08-06"
  review_after: "2026-11-06"
---

# GPT-5.3-Codex-Spark

## Verified findings

- OpenAI describes GPT-5.3-Codex-Spark as a separate fast, less-capable Codex model optimized for near-instant, real-time coding iteration. The documentation also states that it has its own usage limits.
- OpenAI's granular-UI guidance recommends `gpt-5.3-codex-spark` for small, focused UI changes in a tight iteration loop.
- The local Codex catalog at `/Users/lxxvii/.codex/models.json` exposes the native slug `gpt-5.3-codex-spark` with low, medium, high, xhigh, max, and ultra reasoning levels. SCALE admits only low and medium for its bounded native fallbacks; this is a routing policy choice, not a claim that the other catalog levels are unavailable.

## Routing boundary

Use Spark only for bounded, non-sensitive small fixes, localized refactoring, boilerplate generation, single-file analysis, fast iterations, granular UI changes, or passive test observation. Keep higher-context orchestration, standard multi-file work, independent QA authority, security, critical decisions, and sensitive integration on their existing native lanes.

## Sources

- [OpenAI Codex-Spark speed guidance](https://learn.chatgpt.com/docs/agent-configuration/speed#codex-spark)
- [OpenAI granular UI changes use case](https://learn.chatgpt.com/use-cases/make-granular-ui-changes#introduction)
- [OpenAI Codex model reference](https://developers.openai.com/codex/models)
