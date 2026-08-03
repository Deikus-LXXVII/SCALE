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
  console.log("Usage: validate-scale-model-registry.mjs [--registry <file>] [--agents-dir <dir>] [--catalog <models.json>] [--config <config.toml>] [--opencode]");
  process.exit(0);
}

const registryPath = option("--registry", path.join(scriptRoot, "library", "model-registry.json"));
const agentsDir = option("--agents-dir", path.join(scriptRoot, ".codex", "agents"));
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

requireValue([1, 2].includes(registry.schema_version), "model registry must declare schema_version 1 or 2");
requireValue(Array.isArray(registry.providers) && registry.providers.length > 0, "model registry has no providers");
requireValue(Array.isArray(registry.models) && registry.models.length > 0, "model registry has no models");
requireValue(Array.isArray(registry.routes) && registry.routes.length > 0, "model registry has no routes");

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

const expectedRoutes = new Map([
  ["simple-code", ["scale_code_simple", "deepseek-v4-flash", "high"]],
  ["standard-code", ["scale_code_standard", "gpt-5.6-terra", "high"]],
  ["critical-code", ["scale_code_critical", "gpt-5.6-sol", "high"]]
]);
const routes = new Map();
for (const route of registry.routes ?? []) {
  requireValue(typeof route.id === "string" && route.id.length > 0, "route is missing id");
  requireValue(!routes.has(route.id), `duplicate route: ${route.id}`);
  routes.set(route.id, route);
  const model = models.get(route.model);
  requireValue(Boolean(model?.active), `route ${route.id} references an inactive or unknown model ${route.model}`);
  requireValue(model?.approved_reasoning_efforts?.includes(route.reasoning_effort), `route ${route.id} uses unsupported effort ${route.reasoning_effort} for ${route.model}`);
  if (route.execution === "external-cli") requireValue(typeof route.agent === "string" && route.agent.length > 0, `external CLI route ${route.id} needs an agent`);
}
for (const [id, [profile, model, effort]] of expectedRoutes) {
  const route = routes.get(id);
  requireValue(Boolean(route), `missing required route: ${id}`);
  if (route) requireValue(route.profile === profile && route.model === model && route.reasoning_effort === effort, `required route ${id} must use ${profile} -> ${model} (${effort})`);
}

let agentCount = 0;
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
  }
} catch (error) {
  failures.push(`cannot inspect profiles in ${agentsDir}: ${error.message}`);
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
