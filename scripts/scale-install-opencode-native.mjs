#!/usr/bin/env node

// Install SCALE's native OpenCode Go route into Codex's built-in OpenAI
// provider. This intentionally does not add a custom model provider: the
// ChatGPT-authenticated Codex desktop rejects custom providers. The loopback
// gateway is selected by openai_base_url and catalog slugs are namespaced.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => { const index = args.indexOf(name); return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : fallback; };
const codexHome = resolve(value("--codex-home", process.env.SCALE_CODEX_HOME ?? "/Users/lxxvii/.codex"));
const configPath = join(codexHome, "config.toml");
const catalogPath = join(codexHome, "models.json");
const gatewayPort = Number(value("--gateway-port", process.env.SCALE_OPENCODE_GATEWAY_PORT ?? "8787"));
const dryRun = flag("--dry-run");
const allowGlobalProxy = flag("--allow-global-openai-proxy");
if (!existsSync(configPath) || !existsSync(catalogPath)) throw new Error(`Codex files not found under ${codexHome}`);
if (!Number.isInteger(gatewayPort) || gatewayPort < 1024 || gatewayPort > 65535) throw new Error("--gateway-port must be 1024..65535");

const config = readFileSync(configPath, "utf8");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
if (!Array.isArray(catalog.models)) throw new Error("Codex catalog must contain a models array");
const base = catalog.models.find((model) => model.slug === "gpt-5.6-luna") ?? catalog.models[0];
if (!base) throw new Error("Codex catalog has no base model entry");

const specs = [
  ["deepseek-v4-flash", "OpenCode Go DeepSeek V4 Flash (native gateway)", "Routine, diagnostic, documentation, and simple non-sensitive work", ["low", "high"]],
  ["deepseek-v4-pro", "OpenCode Go DeepSeek V4 Pro (native gateway)", "Bounded standard non-sensitive code", ["high", "max"]],
  ["glm-5.1", "OpenCode Go GLM 5.1 (native gateway)", "Manual high-context specialist", ["none"]],
  ["glm-5.2", "OpenCode Go GLM 5.2 (native gateway)", "Research and architecture drafts", ["high", "max"]],
  ["gpt-5.6-luna", "OpenCode Go Luna (native gateway)", "High-context advisory work", ["none", "low", "medium", "high", "xhigh", "max"]],
  ["grok-4.5", "OpenCode Go Grok 4.5 (native gateway)", "Manual premium escalation", ["low", "medium", "high"]],
  ["hy3", "OpenCode Go Hy3 (native gateway)", "Manual general-purpose specialist", ["none", "low", "high"]],
  ["kimi-k2.6", "OpenCode Go Kimi K2.6 (native gateway)", "Manual multimodal specialist", ["none"]],
  ["kimi-k2.7-code", "OpenCode Go Kimi K2.7 Code (native gateway)", "Manual code specialist", ["none"]],
  ["kimi-k3", "OpenCode Go Kimi K3 (native gateway)", "Premium web-design briefs", ["max"]],
  ["mimo-v2.5", "OpenCode Go MiMo V2.5 (native gateway)", "Manual multimodal specialist", ["none"]],
  ["mimo-v2.5-pro", "OpenCode Go MiMo V2.5 Pro (native gateway)", "Manual premium specialist", ["none"]],
  ["minimax-m2.7", "OpenCode Go MiniMax M2.7 (native gateway)", "Manual general-purpose specialist", ["none"]],
  ["minimax-m3", "OpenCode Go MiniMax M3 (native gateway)", "Manual adaptive-thinking specialist", ["none"]],
  ["qwen3.6-plus", "OpenCode Go Qwen 3.6 Plus (native gateway)", "Reserve performance specialist", ["high", "max"]],
  ["qwen3.7-max", "OpenCode Go Qwen 3.7 Max (native gateway)", "Manual premium escalation", ["high", "max"]],
  ["qwen3.7-plus", "OpenCode Go Qwen 3.7 Plus (native gateway)", "Visual prototype exploration", ["high", "max"]],
  ["qwen3.8-max", "OpenCode Go Qwen 3.8 Max (native gateway)", "Manual premium escalation", ["high", "max"]]
];
const levelDescription = (effort) => ({ none: "Provider default", low: "Fast responses with lighter reasoning", medium: "Balances speed and reasoning depth", high: "Greater reasoning depth", xhigh: "Extra high reasoning depth", max: "Maximum reasoning depth" }[effort] ?? effort);
const makeEntry = ([id, displayName, description, efforts], index) => {
  const entry = JSON.parse(JSON.stringify(base));
  entry.slug = `opencode-go/${id}`;
  entry.display_name = displayName;
  entry.description = `${description}. Requests are translated by the local SCALE gateway; Codex keeps sandbox and tool execution.`;
  entry.default_reasoning_level = efforts.includes("high") ? "high" : efforts[0];
  entry.supported_reasoning_levels = efforts.map((effort) => ({ effort, description: levelDescription(effort) }));
  entry.priority = Math.max(Number(base.priority ?? 1), 20 + index);
  entry.visibility = "list";
  entry.supported_in_api = true;
  entry.model_provider = undefined;
  // The gateway supports standard function tools and tool-call round trips.
  entry.tool_mode = "code_mode_only";
  entry.supports_parallel_tool_calls = true;
  entry.supports_search_tool = false;
  entry.use_responses_lite = false;
  delete entry.model_provider;
  return entry;
};
const entries = specs.map(makeEntry);
const wanted = new Map(entries.map((entry) => [entry.slug, entry]));
const nextModels = catalog.models.filter((model) => !model.slug.startsWith("opencode-go-native/")).map((model) => wanted.get(model.slug) ?? model);
for (const entry of entries) if (!nextModels.some((model) => model.slug === entry.slug)) nextModels.push(entry);
const nextCatalog = { ...catalog, models: nextModels };

const rootLines = config.split("\n");
const setRootKey = (lines, key, line) => { const index = lines.findIndex((value) => new RegExp(`^${key}\\s*=`).test(value)); if (index >= 0) lines[index] = line; else { const firstTable = lines.findIndex((value) => /^\s*\[/.test(value)); lines.splice(firstTable >= 0 ? firstTable : lines.length, 0, line); } return lines; };
const nextConfig = setRootKey(setRootKey(rootLines, "openai_base_url", `openai_base_url = "http://127.0.0.1:${gatewayPort}/v1"`), "model_catalog_json", `model_catalog_json = "${catalogPath}"`).join("\n");
const legacyProvider = "[model_providers.opencode_go_native]";
const withoutLegacy = nextConfig.split("\n");
const legacyIndex = withoutLegacy.findIndex((line) => line.trim() === legacyProvider);
if (legacyIndex >= 0) {
  let end = legacyIndex + 1;
  while (end < withoutLegacy.length && !/^\s*\[/.test(withoutLegacy[end])) end += 1;
  withoutLegacy.splice(legacyIndex, end - legacyIndex);
}
const finalConfig = withoutLegacy.join("\n").replace(/\n{3,}/g, "\n\n");

if (dryRun) {
  console.log(JSON.stringify({ dry_run: true, codex_home: codexHome, gateway: `http://127.0.0.1:${gatewayPort}/v1`, custom_provider_removed: config.includes(legacyProvider), models: entries.map((entry) => entry.slug), legacy_aliases_removed: catalog.models.filter((model) => model.slug.startsWith("opencode-go-native/")).length, explicit_global_proxy_confirmation_required: !allowGlobalProxy }));
  process.exit(0);
}
if (!allowGlobalProxy) throw new Error("Refusing to change global openai_base_url. Re-run with --allow-global-openai-proxy after confirming that the loopback gateway pass-through is allowed for native Codex models.");
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupDir = join(codexHome, "backups", `scale-opencode-native-gateway-${timestamp}`);
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
copyFileSync(configPath, join(backupDir, "config.toml")); copyFileSync(catalogPath, join(backupDir, "models.json"));
const writeAtomic = (target, content) => { const temp = `${target}.scale-tmp-${process.pid}`; writeFileSync(temp, content, { mode: 0o600 }); renameSync(temp, target); };
writeAtomic(configPath, finalConfig.endsWith("\n") ? finalConfig : `${finalConfig}\n`); writeAtomic(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, codex_home: codexHome, backup_dir: backupDir, gateway: `http://127.0.0.1:${gatewayPort}/v1`, custom_provider_removed: config.includes(legacyProvider), models_added_or_updated: entries.map((entry) => entry.slug), legacy_aliases_removed: catalog.models.filter((model) => model.slug.startsWith("opencode-go-native/")).length, restart_required: true }));
