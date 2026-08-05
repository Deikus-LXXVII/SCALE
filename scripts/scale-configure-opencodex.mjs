#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};
const home = os.homedir();
const ocxHome = path.resolve(value("--opencodex-home", path.join(home, ".opencodex")));
const authPath = path.resolve(value("--opencode-auth", path.join(home, ".local", "share", "opencode", "auth.json")));
const port = Number(value("--port", "10100"));
const dryRun = args.includes("--dry-run");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be an integer from 1024 to 65535");

const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
const key = auth?.["opencode-go"]?.key;
if (typeof key !== "string" || key.length < 8) throw new Error(`OpenCode Go credential is absent from ${authPath}`);

const configPath = path.join(ocxHome, "config.json");
let config = {};
if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.port = port;
config.providers = {
  ...(config.providers ?? {}),
  openai: {
    adapter: "openai-responses",
    baseUrl: "https://chatgpt.com/backend-api/codex",
    authMode: "forward",
    codexAccountMode: "direct"
  },
  "opencode-go": {
    adapter: "openai-chat",
    baseUrl: "https://opencode.ai/zen/go/v1",
    authMode: "key",
    apiKey: key,
    liveModels: true,
    modelAdapters: { "gpt-5.6-luna": "openai-responses" }
  }
};
config.defaultProvider = "openai";
config.multiAgentMode = "v1";
config.multiAgentGuidanceEnabled = true;
config.websockets = false;
config.injectionModel = "opencode-go/deepseek-v4-flash";
config.injectionEffort = "high";
config.subagentModels = [
  "opencode-go/deepseek-v4-flash",
  "opencode-go/deepseek-v4-pro",
  "opencode-go/kimi-k3",
  "opencode-go/qwen3.7-plus",
  "gpt-5.6-luna"
];
config.subagentModelFallback = ["gpt-5.6-luna"];
config.subagentModelFallbackPollMs = 60000;
config.disabledModels = [...new Set([
  ...(config.disabledModels ?? []),
  "opencode-go/grok-4.5",
  "opencode-go/mimo-v2-omni",
  "opencode-go/mimo-v2-pro"
])];
config.codexAutoStart = false;
config.codexShimAutoRestore = true;

if (dryRun) {
  console.log(JSON.stringify({ ok: true, dry_run: true, config_path: configPath, port, provider_names: Object.keys(config.providers), credential_loaded: true }));
  process.exit(0);
}

fs.mkdirSync(ocxHome, { recursive: true, mode: 0o700 });
if (fs.existsSync(configPath)) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  fs.copyFileSync(configPath, path.join(ocxHome, `config.before-scale-${stamp}.json`));
}
const temporary = `${configPath}.tmp-${process.pid}`;
fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, configPath);
fs.chmodSync(configPath, 0o600);
console.log(JSON.stringify({ ok: true, config_path: configPath, port, provider_names: Object.keys(config.providers), credential_loaded: true }));
