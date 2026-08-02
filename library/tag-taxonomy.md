# C.E.L.L. Tag Taxonomy Registry

Canonical tag list for `library/rules/`, `library/books/`, and `library/agents/`.
`cell-builder` (rules/agents) and `cell-research` (books) MUST read this file before
assigning any tag to a new or edited library entry. Reuse an existing canonical tag if a
semantically equivalent one already exists (e.g. do not invent `swiftlang` or `macos-swift`
when `swift` + `macos` already exist) rather than inventing a new spelling. Append genuinely
new tags here, alphabetically, in the same change that introduces their first use.

Format per entry: `tag` — one-line description.

## Registry

- `agent-design` — prompting/authoring conventions for LLM subagents themselves.
- `agentic-testing` — testing/validating autonomous agents and tool-use pipelines in sandboxes.
- `ai-agents` — general guidance about agent behavior/architecture, not tied to one domain.
- `api-design` — REST/RPC/service interface design conventions.
- `apple-silicon` — M-series (ARM64) macOS hardware-specific guidance (Metal/MPS, unified memory).
- `audio` — audio pipeline work: STT, TTS, real-time routing, audio DSP.
- `backend` — general server-side/backend engineering.
- `ci-cd` — build/release/deployment pipeline conventions.
- `codex` — Codex-specific configuration, custom-agent, skill, and prompting notes.
- `cleanup` — dead code / unused dependency / stale artifact detection (report-only). Canonical for this concept — do not create `dead-code` or `workspace-maintenance` as separate tags.
- `code-review` — reviewing code for correctness/security/quality.
- `concurrency` — async/await, actors, strict concurrency, threading.
- `cryptokit` — Apple CryptoKit-specific cryptography guidance.
- `csr` — client-side-rendering frontend architecture.
- `deployment` — shipping/releasing built artifacts.
- `documentation` — writing/maintaining docs (human- or AI-facing). Canonical for this concept — do not create `technical-writing` as a separate tag.
- `embedded-linux` — resource-constrained embedded Linux targets (routers, IoT).
- `environment-setup` — local dev tool/environment auditing and installation.
- `frontend` — client-side/browser or CSR UI work.
- `git` — git/GitHub/VCS operations, commit hygiene, remotes, branching, tagging.
- `idempotency` — scripts/operations safe to re-run without side effects.
- `javascript` — plain JS/ES6+ conventions (not React/TypeScript-specific).
- `luci` — OpenWrt's LuCI web UI framework specifically.
- `macos` — macOS-specific platform guidance (any domain).
- `nodejs` — Node.js runtime-specific guidance.
- `openwrt` — OpenWrt embedded router OS in general (UCI/procd/ubus/POSIX shell).
- `owasp` — OWASP Top 10 vulnerability classes specifically.
- `posix` — POSIX-compliant `sh`/`ash` shell scripting (no bashisms).
- `procd` — OpenWrt's procd init/process-supervision system.
- `prompt-engineering` — how to write/refine LLM prompts in general.
- `qa` — quality assurance / verification mandate and behavior.
- `rag` — retrieval-augmented-generation-specific search/synthesis conventions.
- `real-time` — low-latency, streaming, or live-processing constraints.
- `release-management` — versioning, tagging, release-branch conventions.
- `research` — general web research/synthesis methodology.
- `sandboxing` — isolation guarantees for testing/execution.
- `secrets-detection` — hardcoded credential/API-key scanning.
- `security` — general security auditing/hardening (any domain).
- `serp` — traditional search-engine-results-page scraping/query conventions.
- `stt` — speech-to-text specifically.
- `swift` — the Swift language/runtime in general.
- `swiftui` — SwiftUI-specific UI framework guidance.
- `testing` — general testing methodology, any domain.
- `tooling` — dev tool installation/auditing, any platform.
- `tts` — text-to-speech specifically.
- `typescript` — TypeScript-specific language/tooling guidance. (Do not use `ts`.)
- `ubus` — OpenWrt's ubus JSON-RPC IPC bus.
- `uci` — OpenWrt's Unified Configuration Interface.
- `verification` — zero-trust "actually run it and check" methodology.
- `vulnerability-scanning` — dependency/code vulnerability scanning specifically.
- `web` — general web-domain agent behavior (search, scraping, browsing).
- `web-search` — search-API-specific conventions (SERP vs semantic engines).
- `xpc` — Apple XPC inter-process communication.

## Merge log (self-learning, parallel to Known Quirks)

(cell-builder appends here if it later discovers two existing tags are actually the same
concept, before proposing a merge to the orchestrator/user — see `cell-builder.md` Rules.)
