#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "library", "model-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
// Model-lab bindings are generated coverage, not functional routing roles.
// Excluding them keeps this generator idempotent: on a second run the already
// generated cards must remain desired instead of making every lab model look
// functionally assigned and then being deleted as stale.
const functionalBindings = registry.agent_bindings.filter(
  (entry) => !entry.profile?.startsWith("scale_model_lab_")
);
const usedModels = new Set(functionalBindings.map((entry) => entry.primary?.model));
const labModels = registry.models.filter((entry) => entry.active && entry.provider === "opencode-go" && !usedModels.has(entry.id));
const desiredProfiles = new Set();

const profileName = (model) => `scale_model_lab_${model.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase()}`;
const selectEffort = (model) => model.approved_reasoning_efforts.includes("high") ? "high"
  : model.approved_reasoning_efforts.includes("medium") ? "medium"
    : model.approved_reasoning_efforts[0];
const dispatchTimeoutFor = (model) => {
  if (!model.latency_class) return registry.runtime_policy.defaults.max_dispatch_ms;
  const timeout = registry.runtime_policy.timeout_classes?.[model.latency_class]?.max_dispatch_ms;
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error(`model ${model.id} references missing timeout class ${model.latency_class}`);
  }
  return timeout;
};

for (const model of labModels) {
  const name = profileName(model.id);
  const effort = selectEffort(model);
  desiredProfiles.add(name);
  const existing = registry.agent_bindings.find((entry) => entry.profile === name);
  const binding = {
    profile: name,
    primary: { execution: "plaintext-external", model: model.id, reasoning_effort: effort },
    fallback: { profile: "scale_optimizer", model: "gpt-5.6-luna", reasoning_effort: "high" }
  };
  if (existing) Object.assign(existing, binding); else registry.agent_bindings.push(binding);
  registry.runtime_policy.agent_budgets[name] = {
    max_work_order_bytes: 20000,
    max_context_files: 6,
    max_context_bytes: 60000,
    max_agent_steps: 12,
    max_dispatch_ms: dispatchTimeoutFor(model)
  };

  const identity = `[SCALE agent=${name} model=gpt-5.6-luna reasoning=high]`;
  const profile = `name = "${name}"
description = "Native Codex fallback card for the runner-only SCALE role ${name}."
model = "gpt-5.6-luna"
model_reasoning_effort = "high"
sandbox_mode = "workspace-write"
developer_instructions = """
Your first assistant message in every spawned task must begin exactly with: ${identity}. This is the active SCALE role, model, and reasoning contract; report a runtime mismatch instead of claiming this identity.

This is the native fallback for a manual plaintext model-access lane, not an automatic routing role. Use it only when the runner returned fallback_required for this exact role or scale_model_ops assigns a bounded benchmark. Work only on named non-sensitive files with explicit acceptance criteria and a stop condition. Never claim the OpenCode model executed in this native task. Run the smallest deterministic check and return outcome, changed paths, evidence, and any protocol limitation.
"""
`;
  fs.writeFileSync(path.join(root, ".codex", "agents", `${name}.toml`), profile);
  fs.writeFileSync(path.join(root, "library", "quirks", `${name}.md`), `# ${name} quirks\n\n- Manual compatibility lane for \`${model.id}\`; promote no capability claim without a focused deterministic benchmark.\n`);
}

for (const binding of [...registry.agent_bindings]) {
  if (!binding.profile?.startsWith("scale_model_lab_") || desiredProfiles.has(binding.profile)) continue;
  registry.agent_bindings.splice(registry.agent_bindings.indexOf(binding), 1);
  delete registry.runtime_policy.agent_budgets[binding.profile];
}
for (const directory of [path.join(root, ".codex", "agents"), path.join(root, "library", "quirks")]) {
  for (const entry of fs.readdirSync(directory).filter((name) => name.startsWith("scale_model_lab_"))) {
    const name = entry.replace(/\.(toml|md)$/, "");
    if (!desiredProfiles.has(name)) fs.unlinkSync(path.join(directory, entry));
  }
}

fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Generated ${labModels.length} plaintext model-lab bindings with native fallback cards; ${usedModels.size} models already have functional roles.`);
