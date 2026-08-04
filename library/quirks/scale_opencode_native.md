# Known quirks: scale_opencode_native

The native OpenCode lane is a built-in Codex OpenAI route backed by the
loopback SCALE gateway. It selects `opencode-go/<model>` catalog slugs via the
user-level `openai_base_url`; no custom `model_provider` is used. Keep context
bounded and non-sensitive. The gateway preserves Codex tools and tool-call
history while translating the model's upstream protocol. A loopback fixture is
the deterministic acceptance check; live Go smoke tests must remain small.
