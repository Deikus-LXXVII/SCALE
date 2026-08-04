---
description: "Domain rules for interacting with and setting up the user's local OS environment."
tags: [environment-setup, macos, tooling, idempotency]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---

# Domain Rules: Local Environment

1. **System Awareness**: Always verify the operating system and architecture before running environment-specific commands. Use the system's preferred package manager (e.g., `brew` on macOS).
2. **Idempotency**: Environment setup and auditing scripts MUST be idempotent. Check if a tool, directory, or configuration exists before attempting to create or install it.
3. **Safety First**: Do not modify system-wide configurations unless explicitly requested. Prefer local or user-scoped installations. Avoid `sudo` where possible.
4. **Validation**: After installing a tool, immediately verify its installation by checking its version or running a basic command.
5. **Path Management**: Respect standard directory structures. Do not pollute the root directory or the user's home directory with project-specific config files unless necessary.
