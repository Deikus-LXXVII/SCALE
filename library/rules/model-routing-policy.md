---
description: "Provider-neutral hybrid policy for assigning Codex primaries and OpenCode Go specialists."
tags: [codex, ai-agents, verification]
---

# Hybrid model-routing policy

S.C.A.L.E. selects a model after classifying authority, sensitivity, required
modality/context, task scope, and cost. It never treats a provider subscription
as a reason to replace all Codex roles.

1. Start with the role's native `primary` in `model-registry.json`.
2. Use an OpenCode Go `specialist` only if its `use_when` condition is true,
   the request is non-sensitive, and its result is bounded by a work order.
3. A Go failure or quota signal returns exactly one stated native fallback. Do
   not retry Go or silently select a more expensive Go model.
4. Sol remains final authority for security, critical decisions, and promotion;
   Terra owns production multi-file and frontend implementation; OpenCode Go
   DeepSeek V4 Flash owns all DeepSeek orchestration and routine work. Do not
   configure the DeepSeek API in Codex.
5. Kimi K2.7 Code is a premium design specialist only: visual direction,
   design critique, responsive hierarchy, and component specification. It does
   not implement production UI. `scale_frontend` on Terra implements the
   validated design handoff. Its reasoning is recorded as `provider-default`
   because the Go catalog exposes no selectable Kimi variant.
6. Qwen3.7 Plus may supply a non-sensitive visual prototype, but it is not the
   authority for final product integration. New primary assignments require a
   focused benchmark and registry validation.
