# Native OpenCode Go in Codex

SCALE exposes every model in the OpenCode Go catalog as a native Codex model
through the built-in OpenAI provider and a loopback gateway:

```text
Codex (main agent or subagent)
  -> built-in OpenAI provider /v1/responses
  -> http://127.0.0.1:8787/v1 (SCALE gateway)
  -> OpenCode Go protocol selected by model
```

This is native at the Codex surface: the model appears in the Codex catalog,
the picker, and subagent model overrides. It is not a custom Codex provider,
which is rejected when Codex is authenticated with a ChatGPT account. The
gateway is a protocol adapter, not a dispatcher and not a DeepSeek API client.

## Protocol and tool matrix

- `gpt-5.6-luna` uses OpenCode Go's Responses endpoint directly.
- Other OpenAI-compatible models use Chat Completions.
- MiniMax and Qwen entries use Anthropic Messages.
- Responses function tools, tool-call history, `function_call_output`, and
  streaming deltas are translated in both directions. Codex remains the tool
  executor and keeps its sandbox/approval boundary.

The gateway reads the existing OpenCode Go credential from
`~/.local/share/opencode/auth.json` (or `OPENCODE_GO_API_KEY` when explicitly
provided). Credentials never enter the repository, catalog, or project files.

## Installation

Run the installer once from the canonical checkout:

```sh
node scale/scripts/scale-install-opencode-native.mjs
```

It backs up `~/.codex/config.toml` and `~/.codex/models.json`, removes the old
custom provider/aliases, adds `openai_base_url` at the user config root, and
installs all currently registered `opencode-go/<model>` entries. Restart Codex
afterward because the desktop app caches its model catalog.

SessionStart starts the gateway automatically. To start it manually:

```sh
scale/scripts/scale-opencode-native-ensure.sh /path/to/project
```

## Agent selection

An agent profile selects a namespaced slug and a reasoning effort, without a
`model_provider` field:

```toml
name = "scale_opencode_native"
model = "opencode-go/deepseek-v4-flash"
model_reasoning_effort = "high"
sandbox_mode = "workspace-write"
```

The registry remains the source of truth. DeepSeek V4 Flash is reserved for
routine/diagnostic/simple non-sensitive work; Terra and Sol keep production,
control-boundary, security, and critical authority. Kimi K3 is a user-directed
design specialist and never an automatic fallback.

## Health and troubleshooting

```sh
curl -sS http://127.0.0.1:8787/healthz
curl -sS http://127.0.0.1:8787/v1/models
```

If a model is unavailable, the gateway returns a single explicit quota or
upstream error. SCALE may use the profile's native fallback once; it never
silently changes to another OpenCode model or retries in a loop.

The previous `scale-opencode-responses-shim.mjs` remains in the repository for
rollback/debugging, but it is not the active native route because it dropped
tools and history.
