# S.C.A.L.E. hybrid model routing

The registry is authoritative. Codex is the primary execution plane; OpenCode
Go is a supplemental specialist pool behind a local CLI adapter. Each native
profile has an explicit model, reasoning effort, and sandbox. Each Go
specialist has a narrow `use_when` condition and a single native fallback.

| Work | Default owner | Optional specialist | Boundary |
| --- | --- | --- | --- |
| Control plane | Codex DeepSeek V4 Flash High | None | Decompose, select, validate handoffs. |
| Simple code | Codex DeepSeek V4 Flash High | Go DeepSeek V4 Flash High | Only isolated non-sensitive work with explicit tests. |
| Standard implementation | Codex Terra High | Go DeepSeek V4 Pro High | Explicit capacity decision for a bounded non-sensitive work order. |
| Critical/security | Codex Sol High | Read-only evidence only | Sol remains authority; no external final decision. |
| Web design | Go Kimi K2.7 Code, provider-default | None | Premium design brief only; no production edits. |
| Frontend implementation | Codex Terra High | Go Qwen3.7 Plus High | Qwen may prototype; Terra integrates and validates production code. |
| Prompt/research | Codex Luna/Terra High | Go Luna/GLM High | Advisory non-sensitive packet only. |

## Selecting a Go specialist

Use the specialist only when all conditions are true:

1. Its `use_when` condition in `model-registry.json` matches.
2. The work has no secret, credential, private key, production dump,
   authentication material, or security investigation.
3. The work order has one objective, scoped files, acceptance criteria, output
   format, and stop condition.
4. The expected cost/benefit is explicit. Do not use Kimi merely because it is
   available: its placement is reserved for high-value visual design tasks.

Run:

```bash
node scripts/scale-opencode-dispatch.mjs \
  --target /absolute/path/to/project \
  --profile scale_frontend \
  --specialist go-visual-prototype \
  --work-order /absolute/path/to/work-order.md
```

The command exits 75 with a JSON native fallback if Go cannot serve the model
or reports a limit. Route the unchanged work order once to that profile. Do not
retry Go or fall through to another Go model automatically.
