#!/usr/bin/env node

// Emergency recovery for a Codex installation whose global provider route
// points at a dead or incompatible local gateway. The default recovery is
// deliberately conservative: restore the built-in Codex route, remove only
// SCALE OpenCode catalog aliases, stop stale gateway processes, and keep a
// timestamped backup of every changed file.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const value = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback; };
const codexHome = resolve(value("--codex-home", process.env.SCALE_CODEX_HOME ?? "/Users/lxxvii/.codex"));
const requestedModel = value("--model", "gpt-5.6-luna");
const requestedEffort = value("--reasoning", "high");
const dryRun = has("--dry-run");
const statusOnly = has("--status");
const recover = has("--recover") || (!statusOnly && !has("--help") && !has("-h"));
const configPath = join(codexHome, "config.toml");
const catalogPath = join(codexHome, "models.json");
const runtimeDir = join(codexHome, "run", "scale-opencode");

const usage = () => console.log("Usage: scale-codex-recover.mjs [--recover|--status] [--dry-run] [--codex-home <dir>] [--model <native-model>] [--reasoning <effort>]");
if (has("--help") || has("-h")) { usage(); process.exit(0); }
if (!existsSync(configPath) || !existsSync(catalogPath)) throw new Error(`Codex config/catalog not found under ${codexHome}`);

const readState = () => {
  const config = readFileSync(configPath, "utf8");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  if (!Array.isArray(catalog.models)) throw new Error("models.json has no models array");
  return { config, catalog };
};
const commandForPid = (pid) => { try { return execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).trim(); } catch { return ""; } };
const pidState = (filename) => {
  const path = join(runtimeDir, filename); if (!existsSync(path)) return { path, pid: null, running: false, command: "" };
  const pid = Number(readFileSync(path, "utf8").trim()); const command = Number.isInteger(pid) && pid > 1 ? commandForPid(pid) : "";
  return { path, pid: Number.isInteger(pid) ? pid : null, running: Boolean(command), command };
};
const current = readState();
const aliases = current.catalog.models.filter((model) => /^opencode-go(?:-native)?\//.test(String(model.slug ?? "")));
const route = current.config.match(/^openai_base_url\s*=\s*"([^"]+)"/m)?.[1] ?? null;
const legacyProvider = current.config.includes("[model_providers.opencode_go_native]");
const gatewayPids = [pidState("native-gateway.pid"), pidState("responses-shim.pid")];
if (statusOnly) {
  console.log(JSON.stringify({ codex_home: codexHome, openai_base_url: route, openai_route_is_scale_loopback: /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):8787\/v1\/?$/.test(route ?? ""), legacy_custom_provider: legacyProvider, opencode_catalog_aliases: aliases.length, gateway_processes: gatewayPids.map(({ pid, running, command }) => ({ pid, running, scale_process: /scale-opencode-(native-gateway|responses-shim)/.test(command) })) }, null, 2));
  process.exit(0);
}
if (!recover) { usage(); process.exit(2); }

const stripLegacyProvider = (source) => {
  const lines = source.split("\n"); const output = [];
  let skippingLegacy = false; let inRoot = true;
  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      inRoot = false;
      if (line.trim() === "[model_providers.opencode_go_native]") { skippingLegacy = true; continue; }
      skippingLegacy = false;
    }
    if (skippingLegacy) continue;
    if (/^\s*openai_base_url\s*=/.test(line)) continue;
    if (inRoot && /^\s*(model|model_reasoning_effort|model_provider)\s*=/.test(line)) continue;
    output.push(line);
  }
  const firstTable = output.findIndex((line) => /^\s*\[/.test(line));
  const nativeLines = [`model = "${requestedModel}"`, `model_reasoning_effort = "${requestedEffort}"`];
  output.splice(firstTable >= 0 ? firstTable : output.length, 0, ...nativeLines);
  return output.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\s+/, "");
};
const nativeModels = current.catalog.models.filter((model) => !/^opencode-go(?:-native)?\//.test(String(model.slug ?? "")));
if (!nativeModels.some((model) => model.slug === requestedModel)) throw new Error(`Requested recovery model is absent from the native catalog: ${requestedModel}`);
const nextConfig = stripLegacyProvider(current.config);
const nextCatalog = { ...current.catalog, models: nativeModels };
const plan = { codex_home: codexHome, remove_openai_base_url: Boolean(route), remove_legacy_custom_provider: legacyProvider, remove_opencode_aliases: aliases.length, native_model: requestedModel, reasoning: requestedEffort, stop_gateway_pids: gatewayPids.filter((item) => item.running && /scale-opencode-(native-gateway|responses-shim)/.test(item.command)).map((item) => item.pid), restart_required: true };
if (dryRun) { console.log(JSON.stringify({ dry_run: true, ...plan }, null, 2)); process.exit(0); }

const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupDir = join(codexHome, "backups", `scale-codex-recovery-${timestamp}`);
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
copyFileSync(configPath, join(backupDir, "config.toml")); copyFileSync(catalogPath, join(backupDir, "models.json"));
const atomicWrite = (target, contents) => { const temp = `${target}.scale-recover-${process.pid}`; writeFileSync(temp, contents, { mode: 0o600 }); renameSync(temp, target); };
try {
  atomicWrite(configPath, nextConfig.endsWith("\n") ? nextConfig : `${nextConfig}\n`);
  atomicWrite(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`);
  const toml = spawnSync("python3", ["-c", "import sys,tomllib; tomllib.load(open(sys.argv[1],'rb'))", configPath], { encoding: "utf8" });
  if (toml.status !== 0) throw new Error(`TOML validation failed: ${toml.stderr.trim()}`);
  JSON.parse(readFileSync(catalogPath, "utf8"));
} catch (error) {
  copyFileSync(join(backupDir, "config.toml"), configPath); copyFileSync(join(backupDir, "models.json"), catalogPath);
  throw new Error(`Recovery validation failed; original files restored from backup: ${error.message}`);
}
for (const item of gatewayPids) {
  if (item.running && /scale-opencode-(native-gateway|responses-shim)/.test(item.command)) { try { process.kill(item.pid, "SIGTERM"); } catch {} }
  if (existsSync(item.path)) { try { unlinkSync(item.path); } catch {} }
}
console.log(JSON.stringify({ ok: true, backup_dir: backupDir, ...plan }, null, 2));
