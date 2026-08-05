#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "library", "model-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const supplementalModels = [
  ["opencode-go/glm-5", ["low", "medium", "high", "xhigh", "max"], "manual OpenCode Go general reasoning model"],
  ["opencode-go/kimi-k2.5", ["none"], "manual OpenCode Go Kimi compatibility model"],
  ["opencode-go/mimo-v2-omni", ["low", "medium", "high", "xhigh", "max"], "manual OpenCode Go multimodal model"],
  ["opencode-go/mimo-v2-pro", ["low", "medium", "high", "xhigh", "max"], "manual OpenCode Go premium MiMo model"],
  ["opencode-go/minimax-m2.5", ["none"], "manual OpenCode Go MiniMax compatibility model"],
  ["opencode-go/qwen3.5-plus", ["low", "medium", "high", "xhigh", "max"], "manual OpenCode Go Qwen compatibility model"]
];
for (const [id, efforts, use] of supplementalModels) {
  if (!registry.models.some((entry) => entry.id === id)) {
    registry.models.push({ id, provider: "opencode-go", active: true, approved_reasoning_efforts: efforts, use });
  }
}
const unavailableModels = new Map([
  ["opencode-go/grok-4.5", { reason: "OpenCode Go returned Router.Unavailable on 2026-08-05", replacement: null }],
  ["opencode-go/mimo-v2-omni", { reason: "OpenCode Go marked the model deprecated on 2026-08-05", replacement: "opencode-go/mimo-v2.5" }],
  ["opencode-go/mimo-v2-pro", { reason: "OpenCode Go marked the model deprecated on 2026-08-05", replacement: "opencode-go/mimo-v2.5-pro" }]
]);
for (const model of registry.models) {
  const unavailable = unavailableModels.get(model.id);
  if (!unavailable) continue;
  model.active = false;
  model.unavailable_reason = unavailable.reason;
  model.replacement = unavailable.replacement;
}

const assignments = {
  scale_orchestrator: ["opencode-go/deepseek-v4-flash", "high"],
  scale_architect: ["gpt-5.6-sol", "high"],
  scale_audio: ["gpt-5.6-terra", "high"],
  scale_backend: ["gpt-5.6-sol", "high"],
  scale_builder: ["gpt-5.6-sol", "high"],
  scale_cleaner: ["opencode-go/deepseek-v4-flash", "high"],
  scale_code_critical: ["gpt-5.6-sol", "high"],
  scale_code_simple: ["opencode-go/deepseek-v4-flash", "high"],
  scale_code_standard: ["opencode-go/deepseek-v4-pro", "high"],
  scale_docs: ["opencode-go/deepseek-v4-flash", "high"],
  scale_environment: ["opencode-go/deepseek-v4-flash", "high"],
  scale_frontend: ["gpt-5.6-terra", "high"],
  scale_git: ["gpt-5.6-sol", "medium"],
  scale_indexer: ["opencode-go/deepseek-v4-flash", "high"],
  scale_library: ["opencode-go/deepseek-v4-flash", "high"],
  scale_openwrt: ["gpt-5.6-terra", "high"],
  scale_optimizer: ["gpt-5.6-luna", "high"],
  scale_prompt: ["opencode-go/qwen3.7-plus", "high"],
  scale_qa: ["gpt-5.6-luna", "high"],
  scale_research: ["opencode-go/glm-5.2", "high"],
  scale_security: ["gpt-5.6-sol", "high"],
  scale_swift: ["gpt-5.6-terra", "high"],
  scale_test_engineer: ["opencode-go/deepseek-v4-pro", "high"],
  scale_test_observer: ["opencode-go/deepseek-v4-flash", "high"],
  scale_webdesign: ["opencode-go/kimi-k3", "max"],
  scale_policy_auditor: ["gpt-5.6-sol", "medium"],
  scale_privacy_gate: ["gpt-5.6-sol", "high"],
  scale_model_ops: ["opencode-go/glm-5.2", "high"],
  scale_benchmark: ["gpt-5.6-luna", "high"],
  scale_knowledge_eval: ["gpt-5.6-luna", "high"],
  scale_sync: ["opencode-go/deepseek-v4-flash", "high"]
};

registry.description = "Canonical S.C.A.L.E. hybrid model policy. Codex is the session runtime; OpenCodex exposes the authenticated OpenCode Go catalog through Codex's native Responses transport while preserving native ChatGPT/Codex fallback authority.";
const goProvider = registry.providers.find((entry) => entry.id === "opencode-go");
Object.assign(goProvider, {
  kind: "native",
  catalog_owner: "user's OpenCode Go subscription via OpenCodex",
  update_policy: "Discover the authenticated OpenCode Go catalog through OpenCodex, admit exact IDs only after a live smoke test, and keep native Codex as the default provider and recovery path.",
  runtime: "codex-opencodex"
});
const catalogEffortOverrides = new Map([
  ["opencode-go/deepseek-v4-flash", ["high"]],
  ["opencode-go/gpt-5.6-luna", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/glm-5.1", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/hy3", ["low", "high"]],
  ["opencode-go/kimi-k2.5", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/kimi-k2.6", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/kimi-k2.7-code", ["none"]],
  ["opencode-go/mimo-v2.5", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/mimo-v2.5-pro", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/minimax-m2.5", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/minimax-m2.7", ["low", "medium", "high", "xhigh", "max"]],
  ["opencode-go/minimax-m3", ["low", "medium", "high", "xhigh", "max"]]
]);
for (const model of registry.models) {
  if (catalogEffortOverrides.has(model.id)) model.approved_reasoning_efforts = catalogEffortOverrides.get(model.id);
  if (model.id === "codex-auto-review") {
    model.active = false;
    model.unavailable_reason = "Absent from the installed Codex catalog on 2026-08-05";
    model.replacement = "gpt-5.6-luna";
  }
}

for (const route of registry.routes) {
  route.execution = "codex-native";
  if (route.fallback) {
    route.fallback = route.id === "web-design"
      ? { profile: "scale_frontend", model: "gpt-5.6-terra", reasoning_effort: "high" }
      : { profile: "scale_optimizer", model: "gpt-5.6-luna", reasoning_effort: "high" };
  }
}
const routeBoundaries = {
  orchestration: "OpenCode Go DeepSeek V4 Flash creates the non-sensitive route plan; native Luna high is the single fallback when Go is unavailable.",
  "simple-code": "Default for one isolated, low-risk, non-sensitive implementation with explicit acceptance checks; native Luna high is the single fallback.",
  "standard-code": "Default for bounded non-sensitive multi-file implementation; native Luna high is the transport fallback while Terra/Sol retain sensitive authority.",
  "critical-code": "Default and final authority for critical changes. OpenCode may provide a read-only draft, never final authority.",
  "web-design": "Premium visual design brief and review only. Kimi K3 does not implement production web code; Terra is the native implementation fallback."
};
for (const route of registry.routes) route.boundary = routeBoundaries[route.id] ?? route.boundary;

for (const binding of registry.agent_bindings) {
  const assignment = assignments[binding.profile];
  if (!assignment && binding.profile?.startsWith("scale_model_lab_")) continue;
  if (!assignment) throw new Error(`Missing assignment for ${binding.profile}`);
  binding.primary = { execution: "codex-native", model: assignment[0], reasoning_effort: assignment[1] };
  if (assignment[0].startsWith("opencode-go/")) {
    binding.fallback = binding.profile === "scale_webdesign"
      ? { profile: "scale_frontend", model: "gpt-5.6-terra", reasoning_effort: "high" }
      : { profile: "scale_optimizer", model: "gpt-5.6-luna", reasoning_effort: "high" };
  } else {
    delete binding.fallback;
  }
}

registry.native_provider_policy = {
  status: "codex-native-via-opencodex",
  reason: "OpenCodex translates the Codex Responses protocol to OpenCode Go and returns the models in the native Codex catalog; named SCALE TOML profiles therefore pin external models for ordinary spawn_agent calls.",
  safe_default: "OpenCodex keeps the canonical OpenAI provider as the default and forwards ChatGPT OAuth directly. The emergency recovery command removes the loopback base URL and restores an untouched native Codex path if the local service fails.",
  multi_agent_mode: "v1",
  limitation: "Codex exposes at most five ad-hoc model overrides; every approved SCALE role remains available through its named custom-agent TOML profile. V1 is required because V2 can encrypt parent-to-child task bodies for the native OpenAI backend."
};
registry.change_protocol = [
  "Keep provider credentials outside S.C.A.L.E. and Git.",
  "Use OpenCodex service mode with health checks; never point Codex at an unmanaged one-shot proxy.",
  "DeepSeek means OpenCode Go through OpenCodex; never configure the DeepSeek API.",
  "Keep the canonical OpenAI provider as the default and retain one named native Codex fallback at most per task.",
  "Keep Sol at high or lower reasoning and preserve Terra for sensitive integration.",
  "Every agent's first assistant message must identify its SCALE role, exact selected model, and reasoning effort."
];

fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Updated ${Object.keys(assignments).length} SCALE bindings for Codex/OpenCodex native routing.`);
