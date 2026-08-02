# Current State & Developer Guide

Use Codex custom-agent profiles by name: `cell_architect`, `cell_backend`, `cell_qa`, and the other profiles in `.codex/agents/`. Each profile owns both its model selection and its `model_reasoning_effort`; do not rely on a prompt to select them.

For a multi-step task, invoke the `cell-orchestrator` skill. It maps independent work to specialized agents, keeps edits non-overlapping, and requires focused verification before completion.

For new projects, use `cell-genesis`. It creates or merges project context, verifies agent profiles, and runs architect → environment → builder → QA in order.

Validate role configuration after any profile change:

```bash
./scripts/validate-codex-cells.sh
```
