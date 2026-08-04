#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return path.resolve(value);
};

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: validate-scale-model-registry.mjs [--registry <file>] [--agents-dir <dir>] [--opencode-agents-dir <dir>] [--catalog <models.json>] [--config <config.toml>] [--opencode]");
  process.exit(0);
}

const registryPath = option("--registry", path.join(scriptRoot, "library", "model-registry.json"));
const agentsDir = option("--agents-dir", path.join(scriptRoot, ".codex", "agents"));
const opencodeAgentsDir = option("--opencode-agents-dir", path.join(scriptRoot, "opencode", "agents"));
const catalogPath = args.includes("--catalog") ? option("--catalog", "") : "";
const configPath = args.includes("--config") ? option("--config", "") : "";
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

let registry;
try {
  registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
} catch (error) {
  console.error(`Cannot read model registry ${registryPath}: ${error.message}`);
  process.exit(1);
}

requireValue([1, 2, 3, 4].includes(registry.schema_version), "model registry must declare schema_version 1, 2, 3, or 4");
requireValue(Array.isArray(registry.providers) && registry.providers.length > 0, "model registry has no providers");
requireValue(Array.isArray(registry.models) && registry.models.length > 0, "model registry has no models");
requireValue(Array.isArray(registry.routes) && registry.routes.length > 0, "model registry has no routes");
requireValue(registry.runtime_policy && typeof registry.runtime_policy === "object", "model registry has no runtime_policy");
for (const key of ["telemetry_path", "max_work_order_bytes", "max_context_files", "max_context_bytes", "max_agent_steps", "max_dispatch_ms", "max_escalations", "direct_route"]) {
  requireValue(registry.runtime_policy?.[key] !== undefined, `runtime_policy is missing ${key}`);
}
requireValue(Number.isInteger(registry.runtime_policy?.max_work_order_bytes) && registry.runtime_policy.max_work_order_bytes > 0, "runtime_policy.max_work_order_bytes must be a positive integer");
requireValue(Number.isInteger(registry.runtime_policy?.max_context_files) && registry.runtime_policy.max_context_files > 0, "runtime_policy.max_context_files must be a positive integer");
requireValue(Number.isInteger(registry.runtime_policy?.max_context_bytes) && registry.runtime_policy.max_context_bytes > 0, "runtime_policy.max_context_bytes must be a positive integer");
requireValue(Number.isInteger(registry.runtime_policy?.max_agent_steps) && registry.runtime_policy.max_agent_steps > 0, "runtime_policy.max_agent_steps must be a positive integer");
requireValue(Number.isInteger(registry.runtime_policy?.max_dispatch_ms) && registry.runtime_policy.max_dispatch_ms > 0, "runtime_policy.max_dispatch_ms must be a positive integer");
requireValue(Number.isInteger(registry.runtime_policy?.max_escalations) && registry.runtime_policy.max_escalations >= 0, "runtime_policy.max_escalations must be a non-negative integer");
const masterPolicy = registry.runtime_policy?.master_policy;
requireValue(masterPolicy && typeof masterPolicy === "object", "runtime_policy.master_policy is missing");
for (const field of ["simple_max_actions", "max_planned_agents", "max_plan_tokens"]) {
  requireValue(Number.isInteger(masterPolicy?.[field]) && masterPolicy[field] > 0, `master_policy.${field} must be a positive integer`);
}
requireValue(masterPolicy?.required_for_compound_tasks === true, "master_policy must require compound tasks");
requireValue(masterPolicy?.required_for_bullet_lists === true, "master_policy must require bullet lists");
const validationPolicy = registry.runtime_policy?.validation_policy;
requireValue(validationPolicy && typeof validationPolicy === "object", "runtime_policy.validation_policy is missing");
for (const field of ["default_passes", "max_passes", "max_repair_cycles", "max_full_suite_runs"]) {
  requireValue(Number.isInteger(validationPolicy?.[field]) && validationPolicy[field] >= 0, `validation_policy.${field} must be a non-negative integer`);
}
requireValue(validationPolicy?.default_passes <= validationPolicy?.max_passes, "validation_policy.default_passes exceeds max_passes");
requireValue(validationPolicy?.max_repair_cycles <= 1, "validation_policy.max_repair_cycles must not exceed one");
requireValue(validationPolicy?.max_full_suite_runs <= 1, "validation_policy.max_full_suite_runs must not exceed one");
requireValue(validationPolicy?.batch_independent_checks === true, "validation_policy must batch independent checks");
requireValue(validationPolicy?.rerun_passing_checks === false, "validation_policy must disable rerunning passing checks");

const budgetFields = ["max_work_order_bytes", "max_context_files", "max_context_bytes", "max_agent_steps", "max_dispatch_ms"];
const hardBudget = Object.fromEntries(budgetFields.map((field) => [field, registry.runtime_policy?.[field]]));
const validateBudget = (budget, owner, allowMissing = false) => {
  if (!budget || typeof budget !== "object") {
    if (!allowMissing) requireValue(false, `${owner} is missing`);
    return;
  }
  for (const field of budgetFields) {
    requireValue(Number.isInteger(budget[field]) && budget[field] > 0, `${owner}.${field} must be a positive integer`);
    if (Number.isInteger(budget[field])) requireValue(budget[field] <= hardBudget[field], `${owner}.${field} exceeds hard runtime cap ${hardBudget[field]}`);
  }
};
validateBudget(registry.runtime_policy?.defaults, "runtime_policy.defaults");
const adjustment = registry.runtime_policy?.orchestrator_adjustment;
requireValue(adjustment && typeof adjustment === "object", "runtime_policy.orchestrator_adjustment is missing");
requireValue(typeof adjustment?.enabled === "boolean", "orchestrator_adjustment.enabled must be boolean");
for (const field of ["max_adjustments", "max_adjusted_dimensions", "max_step_increase", "max_timeout_increase_ms", "max_work_order_increase_bytes", "max_context_file_increase", "max_context_byte_increase"]) {
  requireValue(Number.isInteger(adjustment?.[field]) && adjustment[field] > 0, `orchestrator_adjustment.${field} must be a positive integer`);
}
requireValue(Array.isArray(adjustment?.allowed_reasons) && adjustment.allowed_reasons.length > 0, "orchestrator_adjustment.allowed_reasons must be a non-empty array");
requireValue(typeof adjustment?.require_estimate === "boolean", "orchestrator_adjustment.require_estimate must be boolean");
requireValue(adjustment?.max_adjusted_dimensions <= budgetFields.length, "orchestrator_adjustment.max_adjusted_dimensions exceeds available dimensions");

const providers = new Map();
for (const provider of registry.providers ?? []) {
  requireValue(typeof provider.id === "string" && provider.id.length > 0, "provider is missing id");
  requireValue(!providers.has(provider.id), `duplicate provider: ${provider.id}`);
  providers.set(provider.id, provider);
  requireValue(["native", "external", "external-cli"].includes(provider.kind), `provider ${provider.id} has invalid kind`);
  if (provider.kind === "external") requireValue(typeof provider.codex_provider === "string" && provider.codex_provider.length > 0, `external provider ${provider.id} needs codex_provider`);
  if (provider.kind === "external-cli") {
    requireValue(typeof provider.runtime_command === "string" && provider.runtime_command.length > 0, `external CLI provider ${provider.id} needs runtime_command`);
    requireValue(typeof provider.runtime_provider === "string" && provider.runtime_provider.length > 0, `external CLI provider ${provider.id} needs runtime_provider`);
  }
}

const models = new Map();
for (const model of registry.models ?? []) {
  requireValue(typeof model.id === "string" && model.id.length > 0, "model is missing id");
  requireValue(!models.has(model.id), `duplicate model: ${model.id}`);
  models.set(model.id, model);
  requireValue(providers.has(model.provider), `model ${model.id} references unknown provider ${model.provider}`);
  requireValue(model.active === true || model.active === false, `model ${model.id} needs explicit active flag`);
  requireValue(Array.isArray(model.approved_reasoning_efforts) && model.approved_reasoning_efforts.length > 0, `model ${model.id} needs approved_reasoning_efforts`);
  const provider = providers.get(model.provider);
  if (provider?.kind === "external-cli") requireValue(model.id.startsWith(`${provider.runtime_provider}/`), `external CLI model ${model.id} must use ${provider.runtime_provider}/ prefix`);
}

const reasoningRank = new Map([["none", 0], ["low", 1], ["medium", 2], ["high", 3], ["xhigh", 4], ["max", 5]]);
for (const [modelId, limit] of Object.entries(registry.reasoning_limits ?? {})) {
  requireValue(models.has(modelId), `reasoning limit references unknown model ${modelId}`);
  requireValue(reasoningRank.has(limit), `reasoning limit for ${modelId} is invalid: ${limit}`);
  if (models.has(modelId)) requireValue(models.get(modelId).approved_reasoning_efforts.includes(limit), `reasoning limit for ${modelId} must be an approved effort`);
}
const validateReasoningLimit = (modelId, effort, owner) => {
  const limit = registry.reasoning_limits?.[modelId];
  if (!limit || !reasoningRank.has(effort)) return;
  requireValue(reasoningRank.get(effort) <= reasoningRank.get(limit), `${owner} exceeds reasoning limit ${limit} for ${modelId}`);
};

const expectedRoutes = new Map([
  ["orchestration", ["scale_orchestrator", "opencode-go/deepseek-v4-flash", "high", "external-cli"]],
  ["simple-code", ["scale_code_simple", "opencode-go/deepseek-v4-flash", "high", "external-cli"]],
  ["standard-code", ["scale_code_standard", "opencode-go/deepseek-v4-pro", "high", "external-cli"]],
  ["critical-code", ["scale_code_critical", "gpt-5.6-sol", "high", "codex-native"]],
  ["web-design", ["scale_webdesign", "opencode-go/kimi-k3", "max", "external-cli"]]
]);
const routes = new Map();
for (const route of registry.routes ?? []) {
  requireValue(typeof route.id === "string" && route.id.length > 0, "route is missing id");
  requireValue(!routes.has(route.id), `duplicate route: ${route.id}`);
  routes.set(route.id, route);
  const model = models.get(route.model);
  requireValue(Boolean(model?.active), `route ${route.id} references an inactive or unknown model ${route.model}`);
  requireValue(model?.approved_reasoning_efforts?.includes(route.reasoning_effort), `route ${route.id} uses unsupported effort ${route.reasoning_effort} for ${route.model}`);
  validateReasoningLimit(route.model, route.reasoning_effort, `route ${route.id}`);
  requireValue(["codex-native", "external-cli"].includes(route.execution), `route ${route.id} needs codex-native or external-cli execution`);
  if (route.execution === "codex-native") requireValue(["native", "external"].includes(providers.get(model?.provider)?.kind), `native route ${route.id} must use a native or configured custom Responses model`);
  if (route.execution === "external-cli") requireValue(providers.get(model?.provider)?.kind === "external-cli", `external CLI route ${route.id} must use an external CLI model`);
}
for (const [id, [profile, model, effort, execution]] of expectedRoutes) {
  const route = routes.get(id);
  requireValue(Boolean(route), `missing required route: ${id}`);
  if (route) requireValue(route.profile === profile && route.model === model && route.reasoning_effort === effort && route.execution === execution, `required route ${id} must use ${profile} -> ${model} (${effort}, ${execution})`);
}

let agentCount = 0;
const profileSources = new Map();
try {
  for (const entry of fs.readdirSync(agentsDir).filter((name) => name.endsWith(".toml")).sort()) {
    agentCount += 1;
    const source = fs.readFileSync(path.join(agentsDir, entry), "utf8");
    const name = source.match(/^name = "([^"]+)"$/m)?.[1];
    const modelId = source.match(/^model = "([^"]+)"$/m)?.[1];
    const effort = source.match(/^model_reasoning_effort = "([^"]+)"$/m)?.[1];
    requireValue(Boolean(name && modelId && effort), `incomplete profile: ${entry}`);
    const model = models.get(modelId);
    requireValue(Boolean(model?.active), `profile ${entry} uses inactive or unregistered model ${modelId}`);
    requireValue(model?.approved_reasoning_efforts?.includes(effort), `profile ${entry} uses unapproved effort ${effort} for ${modelId}`);
    validateReasoningLimit(modelId, effort, `profile ${entry}`);
    if (name) profileSources.set(name, { entry, modelId, effort });
  }
} catch (error) {
  failures.push(`cannot inspect profiles in ${agentsDir}: ${error.message}`);
}

const validateExternalAgent = (agent, modelId, effort, owner) => {
  if (typeof agent !== "string" || agent.length === 0) {
    failures.push(`${owner} needs an OpenCode agent`);
    return;
  }
  const profilePath = path.join(opencodeAgentsDir, `${agent}.md`);
  let source = "";
  try {
    source = fs.readFileSync(profilePath, "utf8");
  } catch (error) {
    failures.push(`${owner} references missing OpenCode agent ${profilePath}`);
    return;
  }
  const configuredModel = source.match(/^model: (\S+)$/m)?.[1];
  const configuredEffort = source.match(/^reasoningEffort: (\S+)$/m)?.[1];
  requireValue(configuredModel === modelId, `${owner} OpenCode agent ${agent} must use ${modelId}`);
  if (effort === "provider-default") {
    requireValue(!configuredEffort, `${owner} OpenCode agent ${agent} must not invent a reasoning variant`);
  } else {
    requireValue(configuredEffort === effort, `${owner} OpenCode agent ${agent} must use ${effort} reasoning`);
  }
};

const validateEndpoint = (profile, kind, endpoint) => {
  const model = models.get(endpoint?.model);
  requireValue(Boolean(model?.active), `${profile} ${kind} references inactive or unknown model ${endpoint?.model}`);
  requireValue(model?.approved_reasoning_efforts?.includes(endpoint?.reasoning_effort), `${profile} ${kind} uses unsupported effort ${endpoint?.reasoning_effort} for ${endpoint?.model}`);
  validateReasoningLimit(endpoint?.model, endpoint?.reasoning_effort, `${profile} ${kind}`);
  requireValue(["codex-native", "external-cli"].includes(endpoint?.execution), `${profile} ${kind} needs codex-native or external-cli execution`);
  if (endpoint?.execution === "codex-native") requireValue(["native", "external"].includes(providers.get(model?.provider)?.kind), `${profile} ${kind} must use a native or configured custom Responses model`);
  if (endpoint?.execution === "external-cli") {
    requireValue(providers.get(model?.provider)?.kind === "external-cli", `${profile} ${kind} must use an external CLI model`);
    validateExternalAgent(endpoint.agent, endpoint.model, endpoint.reasoning_effort, `${profile} ${kind}`);
  }
};

const validateNativeFallback = (owner, fallback) => {
  requireValue(Boolean(fallback && typeof fallback === "object"), `${owner} needs an explicit native fallback`);
  if (!fallback || typeof fallback !== "object") return;
  const profile = fallback.profile;
  requireValue(typeof profile === "string" && profile.length > 0, `${owner} fallback needs a Codex profile`);
  const source = profileSources.get(profile);
  requireValue(Boolean(source), `${owner} fallback references missing Codex profile ${profile}`);
  const endpoint = { execution: "codex-native", ...fallback };
  validateEndpoint(owner, "fallback", endpoint);
  requireValue(source?.modelId === fallback.model && source?.effort === fallback.reasoning_effort, `${owner} fallback must match Codex profile ${profile}`);
};

for (const route of routes.values()) {
  const model = models.get(route.model);
  if (route.execution === "external-cli") {
    validateExternalAgent(route.agent, route.model, route.reasoning_effort, `route ${route.id}`);
    validateNativeFallback(`route ${route.id}`, route.fallback);
  }
  const source = profileSources.get(route.profile);
  requireValue(Boolean(source), `route ${route.id} references missing Codex profile ${route.profile}`);
  if (route.execution === "codex-native") requireValue(source?.modelId === route.model && source?.effort === route.reasoning_effort, `native route ${route.id} must match Codex profile ${route.profile}`);
}

const bindings = new Set();
const bindingEntries = new Map();
for (const binding of registry.agent_bindings ?? []) {
  const profile = binding?.profile;
  requireValue(typeof profile === "string" && profile.length > 0, "agent binding is missing profile");
  requireValue(!bindings.has(profile), `duplicate agent binding: ${profile}`);
  if (typeof profile === "string") {
    bindings.add(profile);
    bindingEntries.set(profile, binding);
  }
  requireValue(profileSources.has(profile), `agent binding references missing Codex profile ${profile}`);
  const primary = binding?.primary;
  validateEndpoint(profile, "primary", primary);
  if (primary?.execution === "codex-native") {
    const source = profileSources.get(profile);
    requireValue(source?.modelId === primary.model && source?.effort === primary.reasoning_effort, `${profile} native primary must match its Codex profile model and reasoning`);
  }
  if (primary?.execution === "external-cli") validateNativeFallback(profile, binding.fallback);
  if (binding?.fallback && primary?.execution !== "external-cli") validateNativeFallback(profile, binding.fallback);
  requireValue(!binding?.specialists || Array.isArray(binding.specialists), `${profile} specialists must be an array`);
  const specialistIds = new Set();
  for (const specialist of binding?.specialists ?? []) {
    requireValue(typeof specialist?.id === "string" && specialist.id.length > 0, `${profile} specialist is missing id`);
    requireValue(!specialistIds.has(specialist?.id), `${profile} has duplicate specialist ${specialist?.id}`);
    specialistIds.add(specialist?.id);
    requireValue(typeof specialist?.use_when === "string" && specialist.use_when.length > 0, `${profile} specialist ${specialist?.id} needs use_when`);
    validateEndpoint(profile, `specialist ${specialist?.id}`, specialist);
    requireValue(Boolean(specialist?.fallback), `${profile} specialist ${specialist?.id} needs a fallback`);
    if (specialist?.fallback) validateNativeFallback(`${profile} specialist ${specialist.id}`, specialist.fallback);
  }
}
const overlayBases = new Map();
for (const overlay of registry.overlay_bindings ?? []) {
  const profile = overlay?.profile;
  const baseProfile = overlay?.base_profile;
  const dispatchMode = overlay?.dispatch_mode;
  requireValue(typeof profile === "string" && /^scale_telik_[a-z0-9_]+$/.test(profile), `overlay binding has invalid profile ${profile ?? "<missing>"}`);
  requireValue(typeof baseProfile === "string" && baseProfile.length > 0, `overlay binding ${profile ?? "<missing>"} is missing base_profile`);
  requireValue(["external-primary", "specialist-only", "native"].includes(dispatchMode), `overlay binding ${profile ?? "<missing>"} has invalid dispatch_mode`);
  requireValue(!bindings.has(profile), `overlay binding ${profile} duplicates an agent binding`);
  requireValue(!overlayBases.has(profile), `duplicate overlay binding: ${profile}`);
  requireValue(bindings.has(baseProfile), `overlay binding ${profile} references missing base profile ${baseProfile}`);
  if (typeof profile === "string" && typeof baseProfile === "string") overlayBases.set(profile, baseProfile);
}
for (const profile of profileSources.keys()) {
  const effectiveProfile = overlayBases.get(profile) ?? profile;
  requireValue(bindingEntries.has(effectiveProfile), `Codex profile ${profile} has no agent binding`);
}
for (const [profile, budget] of Object.entries(registry.runtime_policy?.agent_budgets ?? {})) {
  requireValue(bindings.has(profile), `runtime_policy.agent_budgets references unknown profile ${profile}`);
  validateBudget(budget, `runtime_policy.agent_budgets.${profile}`);
}
for (const profile of profileSources.keys()) {
  const effectiveProfile = overlayBases.get(profile) ?? profile;
  const budget = registry.runtime_policy?.agent_budgets?.[profile] ?? registry.runtime_policy?.agent_budgets?.[effectiveProfile];
  requireValue(Boolean(budget), `runtime_policy.agent_budgets is missing profile ${profile}`);
  if (budget) validateBudget(budget, `runtime_policy.agent_budgets.${profile}`);
}
for (const binding of registry.agent_bindings ?? []) {
  const externalAgents = [];
  if (binding.primary?.execution === "external-cli") externalAgents.push(binding.primary.agent);
  for (const specialist of binding.specialists ?? []) if (specialist.execution === "external-cli") externalAgents.push(specialist.agent);
  if (externalAgents.length === 0) continue;
  const budget = registry.runtime_policy?.agent_budgets?.[binding.profile];
  requireValue(Boolean(budget), `runtime_policy.agent_budgets is missing external profile ${binding.profile}`);
  for (const agent of externalAgents) {
    let source = "";
    try {
      source = fs.readFileSync(path.join(opencodeAgentsDir, `${agent}.md`), "utf8");
    } catch {
      continue;
    }
    const steps = Number(source.match(/^steps:\s*(\d+)$/m)?.[1] ?? 0);
    requireValue(steps >= budget?.max_agent_steps, `${binding.profile} budget steps must not exceed OpenCode agent ${agent} contract (${steps})`);
  }
}
for (const route of routes.values()) {
  const binding = (registry.agent_bindings ?? []).find((entry) => entry?.profile === route.profile);
  const primary = binding?.primary;
  requireValue(Boolean(primary), `route ${route.id} needs a primary binding for ${route.profile}`);
  if (!primary) continue;
  requireValue(primary.execution === route.execution && primary.model === route.model && primary.reasoning_effort === route.reasoning_effort, `route ${route.id} must match primary binding for ${route.profile}`);
  if (route.execution === "external-cli") requireValue(primary.agent === route.agent, `route ${route.id} must match OpenCode agent for ${route.profile}`);
}

if (catalogPath) {
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch (error) {
    failures.push(`cannot read Codex catalog ${catalogPath}: ${error.message}`);
  }
  const entries = Array.isArray(catalog) ? catalog : catalog?.models;
  if (!Array.isArray(entries)) {
    failures.push(`Codex catalog ${catalogPath} has no models array`);
  } else {
    const bySlug = new Map(entries.map((entry) => [entry.slug ?? entry.id ?? entry.model, entry]));
    for (const model of models.values()) {
      if (!model.active) continue;
      if (providers.get(model.provider)?.kind === "external-cli") continue;
      const entry = bySlug.get(model.id);
      requireValue(Boolean(entry), `active model ${model.id} is absent from ${catalogPath}`);
      const efforts = (entry?.supported_reasoning_levels ?? entry?.reasoning_levels ?? []).map((level) => typeof level === "string" ? level : level.effort);
      for (const effort of model.approved_reasoning_efforts ?? []) {
        requireValue(efforts.includes(effort), `catalog model ${model.id} does not expose reasoning effort ${effort}`);
      }
    }
  }
}

if (configPath) {
  let config = "";
  try {
    config = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    failures.push(`cannot read Codex config ${configPath}: ${error.message}`);
  }
  for (const provider of providers.values()) {
    if (provider.kind !== "external") continue;
    const heading = `[model_providers.${provider.codex_provider}]`;
    requireValue(config.includes(heading), `external provider ${provider.id} is not configured as ${heading} in ${configPath}`);
  }
}

if (args.includes("--opencode")) {
  const { spawnSync } = await import("node:child_process");
  for (const provider of providers.values()) {
    if (provider.kind !== "external-cli") continue;
    const result = spawnSync(provider.runtime_command, ["models", provider.runtime_provider], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
      const detail = (result.error?.message || result.stderr || "unknown error").trim();
      failures.push(`cannot discover ${provider.id} with ${provider.runtime_command} models ${provider.runtime_provider}: ${detail}`);
      continue;
    }
    const discovered = `${result.stdout}\n${result.stderr}`;
    for (const model of models.values()) {
      if (!model.active || model.provider !== provider.id) continue;
      requireValue(discovered.includes(model.id), `${provider.id} runtime does not expose active model ${model.id}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`S.C.A.L.E. model registry: ${failure}`);
  process.exit(1);
}

console.log(`Validated S.C.A.L.E. model registry, ${models.size} approved models, ${routes.size} routes, and ${agentCount} profiles.`);
