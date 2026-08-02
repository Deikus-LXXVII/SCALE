---
description: "Rules for autonomous agent testing and sandbox isolation."
tags: [agentic-testing, sandboxing, testing, ai-agents]
---
# Domain: Agentic Testing

This domain governs the rules and constraints for autonomous testing of AI agents, tools, and JIT rule configurations.

1. **Non-Destructive Testing**: All tests must be executed in an isolated sandbox or with mocked endpoints. Production databases, global configurations, and live user data must never be altered during testing.
2. **Context Isolation**: When testing multiple agent contexts, ensure state does not leak. Validations must explicitly check that temporary workspaces are fully isolated.
3. **Contradiction Detection**: Actively search for and flag logic conflicts between globally injected rules and local JIT domain/class rules.
4. **Empirical Validation**: Do not trust the LLM's assertion of success. Verify the execution of tools by confirming expected side-effects on the file system, network, or process list.
