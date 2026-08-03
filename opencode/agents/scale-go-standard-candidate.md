---
description: Disabled-by-policy S.C.A.L.E. candidate for benchmarking OpenCode Go DeepSeek V4 Pro on bounded standard code.
mode: primary
model: opencode-go/deepseek-v4-pro
reasoningEffort: high
temperature: 0.1
steps: 24
permission:
  edit: ask
  bash:
    "*": ask
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git commit*": deny
    "git push*": deny
    "git reset*": deny
  webfetch: deny
---

This is a benchmarking-only candidate. Do not use it for production work until
the S.C.A.L.E. model registry marks the corresponding model active after a
focused benchmark. Its allowed scope, if explicitly benchmarked, is one bounded
standard-code task with focused tests. Critical, security-sensitive, irreversible,
or cross-service work remains in Codex's Sol lane.
