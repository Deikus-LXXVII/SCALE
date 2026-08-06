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
  console.log("Usage: validate-scale-model-registry.mjs [--registry <file>] [--agents-dir <dir>] [--catalog <models.json>] [--config <config.toml>]");
  process.exit(0);
}

const registryPath = option("--registry", path.join(scriptRoot, "library", "model-registry.json"));
const agentsDir = option("--agents-dir", path.join(scriptRoot, ".codex", "agents"));
const opencodeAgentsDir = path.join(scriptRoot, "opencode", "agents");
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

requireValue([1, 2, 3, 4, 5].includes(registry.schema_version), "model registry must declare schema_version 1, 2, 3, 4, or 5");
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
requireValue(masterPolicy?.simple_max_actions === 1, "master_policy.simple_max_actions must remain one for the atomic direct route");
requireValue(masterPolicy?.required_for_compound_tasks === true, "master_policy must require compound tasks");
requireValue(masterPolicy?.required_for_bullet_lists === true, "master_policy must require bullet lists");
const delegationPolicy = registry.runtime_policy?.delegation_policy;
requireValue(delegationPolicy && typeof delegationPolicy === "object", "runtime_policy.delegation_policy is missing");
for (const field of ["minimum_delegated_executors", "default_executor_count"]) {
  requireValue(Number.isInteger(delegationPolicy?.[field]) && delegationPolicy[field] > 0, `delegation_policy.${field} must be a positive integer`);
}
requireValue(delegationPolicy?.enabled === true, "delegation_policy must be enabled");
requireValue(delegationPolicy?.required_for_compound_tasks === true, "delegation_policy must require compound tasks");
requireValue(Array.isArray(delegationPolicy?.coordinator_roles) && delegationPolicy.coordinator_roles.includes("session_root") && delegationPolicy.coordinator_roles.includes("scale_orchestrator"), "delegation_policy must identify the session root and SCALE Master coordinators");
requireValue(delegationPolicy?.minimum_delegated_executors <= masterPolicy?.max_planned_agents, "delegation_policy minimum exceeds master agent cap");
requireValue(delegationPolicy?.default_executor_count >= delegationPolicy?.minimum_delegated_executors, "delegation_policy default executor count is below its minimum");
requireValue(delegationPolicy?.default_executor_count <= masterPolicy?.max_planned_agents, "delegation_policy default executor count exceeds master agent cap");
for (const field of ["parallel_only_when_independent", "orchestrator_may_implement", "repair_requires_delegation", "direct_route_requires_single_atomic_mutation"]) {
  requireValue(typeof delegationPolicy?.[field] === "boolean", `delegation_policy.${field} must be boolean`);
}
requireValue(delegationPolicy?.parallel_only_when_independent === true, "delegation_policy must restrict parallel work to independent scopes");
requireValue(delegationPolicy?.orchestrator_may_implement === false, "delegation_policy must forbid orchestrator implementation");
requireValue(delegationPolicy?.repair_requires_delegation === true, "delegation_policy must require delegated repairs");
requireValue(delegationPolicy?.direct_route_requires_single_atomic_mutation === true, "delegation_policy direct route must stay atomic");
for (const field of ["main_agent_pre_dispatch_actions", "main_agent_post_dispatch_actions", "main_agent_forbidden_actions"]) {
  requireValue(Array.isArray(delegationPolicy?.[field]) && delegationPolicy[field].length > 0, `delegation_policy.${field} must be a non-empty array`);
}
requireValue(delegationPolicy?.main_agent_pre_dispatch_actions?.includes("dispatch"), "delegation_policy pre-dispatch actions must include dispatch");
requireValue(delegationPolicy?.main_agent_post_dispatch_actions?.includes("run_batched_validation"), "delegation_policy post-dispatch actions must include batched validation");
requireValue(delegationPolicy?.main_agent_forbidden_actions?.includes("self_implement_compound_task"), "delegation_policy must forbid self-implementation of compound tasks");
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
const plaintextPolicy = registry.runtime_policy?.plaintext_external_policy;
requireValue(plaintextPolicy && typeof plaintextPolicy === "object", "runtime_policy.plaintext_external_policy is missing");
requireValue(plaintextPolicy?.enabled === true, "plaintext external policy must be enabled");
requireValue(plaintextPolicy?.no_previous_response === true, "plaintext external policy must forbid previous_response_id");
requireValue(plaintextPolicy?.max_attempts === 1, "plaintext external policy must allow exactly one attempt");
requireValue(plaintextPolicy?.automatic_native_fallback === false, "plaintext external policy must forbid automatic native fallback");
requireValue(Number.isInteger(plaintextPolicy?.max_output_tokens) && plaintextPolicy.max_output_tokens > 0, "plaintext external policy needs a positive max_output_tokens");
requireValue(Array.isArray(plaintextPolicy?.allowed_profiles) && plaintextPolicy.allowed_profiles.length > 0, "plaintext external policy needs allowed_profiles");
requireValue(Array.isArray(plaintextPolicy?.allowed_profile_prefixes), "plaintext external policy needs allowed_profile_prefixes");
requireValue(Array.isArray(plaintextPolicy?.analysis_only_profiles), "plaintext external policy needs analysis_only_profiles");

const budgetFields = ["max_work_order_bytes", "max_context_files", "max_context_bytes", "max_agent_steps", "max_dispatch_ms"];
const hardBudget = Object.fromEntries(budgetFields.map((field) => [field, registry.runtime_policy?.[field]]));
const timeoutClasses = registry.runtime_policy?.timeout_classes;
requireValue(timeoutClasses && typeof timeoutClasses === "object" && !Array.isArray(timeoutClasses), "runtime_policy.timeout_classes is missing");
for (const [className, timeoutClass] of Object.entries(timeoutClasses ?? {})) {
  requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(className), `runtime_policy.timeout_classes has invalid class name ${className}`);
  requireValue(timeoutClass && typeof timeoutClass === "object" && !Array.isArray(timeoutClass), `runtime_policy.timeout_classes.${className} must be an object`);
  requireValue(Number.isInteger(timeoutClass?.max_dispatch_ms) && timeoutClass.max_dispatch_ms > 0, `runtime_policy.timeout_classes.${className}.max_dispatch_ms must be a positive integer`);
  if (Number.isInteger(timeoutClass?.max_dispatch_ms)) requireValue(timeoutClass.max_dispatch_ms <= hardBudget.max_dispatch_ms, `runtime_policy.timeout_classes.${className}.max_dispatch_ms exceeds hard runtime cap ${hardBudget.max_dispatch_ms}`);
  requireValue(typeof timeoutClass?.selection_signal === "string" && timeoutClass.selection_signal.length > 0, `runtime_policy.timeout_classes.${className}.selection_signal must be a non-empty string`);
  requireValue(typeof timeoutClass?.rationale === "string" && timeoutClass.rationale.length > 0, `runtime_policy.timeout_classes.${className}.rationale must be a non-empty string`);
}
const largeSlowTimeout = timeoutClasses?.["large-slow"];
requireValue(Boolean(largeSlowTimeout), "runtime_policy.timeout_classes.large-slow is required");
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
  requireValue(["native", "external"].includes(provider.kind), `provider ${provider.id} has invalid kind`);
  if (provider.kind === "external") requireValue(typeof provider.codex_provider === "string" && provider.codex_provider.length > 0, `external provider ${provider.id} needs codex_provider`);
}

const models = new Map();
for (const model of registry.models ?? []) {
  requireValue(typeof model.id === "string" && model.id.length > 0, "model is missing id");
  requireValue(!models.has(model.id), `duplicate model: ${model.id}`);
  models.set(model.id, model);
  requireValue(providers.has(model.provider), `model ${model.id} references unknown provider ${model.provider}`);
  requireValue(model.active === true || model.active === false, `model ${model.id} needs explicit active flag`);
  requireValue(Array.isArray(model.approved_reasoning_efforts) && model.approved_reasoning_efforts.length > 0, `model ${model.id} needs approved_reasoning_efforts`);
}
for (const model of models.values()) {
  const isMaxCapable = model.approved_reasoning_efforts?.includes("max");
  if (model.latency_class !== undefined) {
    requireValue(typeof model.latency_class === "string" && model.latency_class.length > 0, `model ${model.id} latency_class must be a non-empty string`);
    requireValue(Boolean(timeoutClasses?.[model.latency_class]), `model ${model.id} references unknown timeout class ${model.latency_class}`);
    requireValue(model.provider === "opencode-go", `model ${model.id} latency_class requires the opencode-go provider`);
    requireValue(isMaxCapable, `model ${model.id} latency_class requires approved max reasoning`);
  }
  if (model.active && model.provider === "opencode-go" && isMaxCapable) {
    requireValue(model.latency_class === "large-slow", `active max-capable OpenCode Go model ${model.id} must use latency_class large-slow`);
  }
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
  ["orchestration", ["scale_orchestrator", "opencode-go/deepseek-v4-flash", "high", "plaintext-external"]],
  ["simple-code", ["scale_code_simple", "opencode-go/deepseek-v4-flash", "high", "plaintext-external"]],
  ["standard-code", ["scale_code_standard", "opencode-go/deepseek-v4-pro", "high", "plaintext-external"]],
  ["critical-code", ["scale_code_critical", "gpt-5.6-sol", "high", "codex-native"]],
  ["web-design", ["scale_webdesign", "opencode-go/kimi-k3", "max", "plaintext-external"]]
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
  requireValue(["codex-native", "plaintext-external"].includes(route.execution), `route ${route.id} has unsupported execution ${route.execution}`);
  if (route.execution === "plaintext-external") requireValue(model?.provider === "opencode-go", `plaintext route ${route.id} must use OpenCode Go`);
  if (route.execution === "codex-native") requireValue(providers.get(model?.provider)?.kind === "native", `native route ${route.id} must use a native model`);
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
    const identity = `[SCALE agent=${name} model=${modelId} reasoning=${effort}]`;
    requireValue(source.includes(`Your first assistant message in every spawned task must begin exactly with: ${identity}.`), `profile ${entry} needs exact first-message identity ${identity}`);
    if (name) profileSources.set(name, { entry, modelId, effort });
  }
} catch (error) {
  failures.push(`cannot inspect profiles in ${agentsDir}: ${error.message}`);
}

const validateEndpoint = (profile, kind, endpoint) => {
  const model = models.get(endpoint?.model);
  requireValue(Boolean(model?.active), `${profile} ${kind} references inactive or unknown model ${endpoint?.model}`);
  requireValue(model?.approved_reasoning_efforts?.includes(endpoint?.reasoning_effort), `${profile} ${kind} uses unsupported effort ${endpoint?.reasoning_effort} for ${endpoint?.model}`);
  validateReasoningLimit(endpoint?.model, endpoint?.reasoning_effort, `${profile} ${kind}`);
  requireValue(["codex-native", "plaintext-external"].includes(endpoint?.execution), `${profile} ${kind} has unsupported execution ${endpoint?.execution}`);
  if (endpoint?.execution === "plaintext-external") requireValue(model?.provider === "opencode-go", `${profile} ${kind} plaintext execution must use OpenCode Go`);
  if (endpoint?.execution === "codex-native") requireValue(providers.get(model?.provider)?.kind === "native", `${profile} ${kind} native execution must use a native model`);
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
  if (route.execution === "plaintext-external") {
    validateNativeFallback(`route ${route.id}`, route.fallback);
  }
  const source = profileSources.get(route.profile);
  requireValue(Boolean(source), `route ${route.id} references missing Codex profile ${route.profile}`);
  if (route.execution === "codex-native") requireValue(source?.modelId === route.model && source?.effort === route.reasoning_effort, `native route ${route.id} must match Codex profile ${route.profile}`);
  if (route.execution === "plaintext-external") requireValue(source?.modelId === route.fallback?.model && source?.effort === route.fallback?.reasoning_effort, `plaintext route ${route.id} Codex card must match its native fallback`);
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
  const source = profileSources.get(profile);
  if (primary?.execution === "codex-native") requireValue(source?.modelId === primary.model && source?.effort === primary.reasoning_effort, `${profile} native primary must match its Codex profile model and reasoning`);
  if (primary?.execution === "plaintext-external") {
    validateNativeFallback(profile, binding.fallback);
    requireValue(source?.modelId === binding.fallback?.model && source?.effort === binding.fallback?.reasoning_effort, `${profile} Codex card must match its native fallback because the primary is plaintext-external`);
  }
  if (binding?.fallback && primary?.execution !== "plaintext-external") validateNativeFallback(profile, binding.fallback);
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
for (const profile of profileSources.keys()) {
  const effectiveProfile = profile;
  requireValue(bindingEntries.has(effectiveProfile), `Codex profile ${profile} has no agent binding`);
}
for (const model of models.values()) {
  if (!model.active || model.provider !== "opencode-go") continue;
  const covered = [...bindingEntries.values()].some((binding) => binding.primary?.execution === "plaintext-external" && binding.primary?.model === model.id);
  requireValue(covered, `active OpenCode Go model ${model.id} has no plaintext-external binding`);
}
for (const [profile, budget] of Object.entries(registry.runtime_policy?.agent_budgets ?? {})) {
  requireValue(bindings.has(profile), `runtime_policy.agent_budgets references unknown profile ${profile}`);
  validateBudget(budget, `runtime_policy.agent_budgets.${profile}`);
}
for (const profile of profileSources.keys()) {
  const effectiveProfile = profile;
  const budget = registry.runtime_policy?.agent_budgets?.[profile];
  requireValue(Boolean(budget), `runtime_policy.agent_budgets is missing profile ${profile}`);
  if (budget) validateBudget(budget, `runtime_policy.agent_budgets.${profile}`);
}
for (const binding of registry.agent_bindings ?? []) {
  const primary = binding?.primary;
  if (primary?.execution !== "plaintext-external") continue;
  const model = models.get(primary.model);
  const className = model?.latency_class;
  if (!className) continue;
  const timeoutClass = timeoutClasses?.[className];
  const budget = registry.runtime_policy?.agent_budgets?.[binding.profile];
  requireValue(Boolean(timeoutClass), `${binding.profile} references missing timeout class ${className}`);
  requireValue(Boolean(budget), `${binding.profile} needs a runtime budget for timeout class ${className}`);
  if (timeoutClass && budget) requireValue(budget.max_dispatch_ms === timeoutClass.max_dispatch_ms, `${binding.profile} must use timeout class ${className} max_dispatch_ms ${timeoutClass.max_dispatch_ms}`);
}
for (const route of routes.values()) {
  const binding = (registry.agent_bindings ?? []).find((entry) => entry?.profile === route.profile);
  const primary = binding?.primary;
  requireValue(Boolean(primary), `route ${route.id} needs a primary binding for ${route.profile}`);
  if (!primary) continue;
  requireValue(primary.execution === route.execution && primary.model === route.model && primary.reasoning_effort === route.reasoning_effort, `route ${route.id} must match primary binding for ${route.profile}`);
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
      const entry = bySlug.get(model.id);
      requireValue(Boolean(entry), `active model ${model.id} is absent from ${catalogPath}`);
      const efforts = (entry?.supported_reasoning_levels ?? entry?.reasoning_levels ?? []).map((level) => typeof level === "string" ? level : level.effort);
      for (const effort of model.approved_reasoning_efforts ?? []) {
        if (effort === "none" && efforts.length === 0) continue;
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

if (failures.length > 0) {
  for (const failure of failures) console.error(`S.C.A.L.E. model registry: ${failure}`);
  process.exit(1);
}

console.log(`Validated S.C.A.L.E. model registry, ${models.size} approved models, ${routes.size} routes, and ${agentCount} profiles.`);
