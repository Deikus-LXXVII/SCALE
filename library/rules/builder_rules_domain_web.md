---
description: "Rules for generating agents working with the Web."
tags: [web, research, ai-agents]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---

# Builder Domain Rules: Web

## 1. Documentation & Philosophy
Agents operating in the web domain must be capable of navigating search results and extracting semantic content.

## 2. Specific Rules
1. Use search tools intelligently.
2. Do not spam search queries.
3. Verify information against multiple sources.
4. Avoid executing untrusted JavaScript from random sites.
5. Handle 404s and timeouts gracefully.
6. Keep visual design and production implementation separate when using the Kimi
   specialist: Kimi returns a bounded design packet; Terra's frontend role
   implements and validates the code.
