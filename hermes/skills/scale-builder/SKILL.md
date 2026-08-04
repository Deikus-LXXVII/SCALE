---
name: scale-builder
description: Create and differentiate Hermes SCALE roles with OpenCode Go worker routes and safe Luna fallbacks.
---

# S.C.A.L.E. Builder for Hermes

`scale-builder` is the role factory. It creates the smallest useful Hermes
skill or role contract; it does not become a general product implementer.

## Builder route

The builder is an analytical/design role. Run it with the Hermes registry's
Terra `xhigh` route, or Sol `high` for security, policy, or irreversible
changes. The roles it creates may be workers and must use OpenCode Go with
ChatGPT Luna `xhigh` fallback.

Use the route helper when a separate bounded builder process is justified:

```bash
${HERMES_HOME:-$HOME/.hermes}/scale/hermes/scripts/scale-hermes-route.sh \
  scale_builder "<short role-design work order>"
```

Do not add an extra model call for a one-file, obvious role edit; edit the
smallest existing skill directly.

## Role creation contract

Before creating a role, retrieve only relevant curated tags and check for an
existing owner. A new role must declare:

- name and narrow trigger;
- positive scope and explicit negative boundary;
- route class: `analytical` or `worker`;
- provider/model/reasoning from `model-routing.json`;
- exact worker fallback, if it is a worker;
- least-privilege tools/sandbox and write ownership;
- handoffs, acceptance check, and stop condition;
- provenance, compatibility, validation date, and review date for durable
  library entries.

Represent a Hermes role as a `SKILL.md` or a role record under the SCALE
library, not as Codex-only TOML. Keep project-local roles in the project and
reusable roles in the canonical library. Never copy the whole library into a
project prompt.

## Worker model rule

For code, test authoring, observation, monitoring, docs, cleanup, indexing,
Git, or routine environment work, select `worker`:

```yaml
provider: opencode-go
model: deepseek-v4-flash
reasoning_effort: high
fallback:
  provider: openai-codex
  model: gpt-5.6-luna
  reasoning_effort: xhigh
```

For architecture, research, verification, policy, security, prompt design,
or visual design, select `analytical` and keep authority on Terra/Sol. Never
make an OpenCode worker the final authority for security, credentials,
irreversible changes, or global promotion.

## Promotion gate

Create the candidate in an isolated project fixture, validate frontmatter and
route metadata, then run one focused acceptance check. Only after evidence is
valid should `scale-validate` review it and the canonical library receive the
named files. A successful single task is not enough to promote a new global
role.
