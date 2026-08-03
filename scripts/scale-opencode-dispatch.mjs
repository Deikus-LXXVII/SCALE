#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const usage = () => console.log("Usage: scale-opencode-dispatch.mjs --target <project-dir> --profile <scale_profile> --work-order <file> [--allow-write]");

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

let target;
let profile;
let workOrder;
try {
  target = resolve(value("--target"));
  profile = value("--profile");
  workOrder = resolve(value("--work-order"));
} catch (error) {
  console.error(`S.C.A.L.E.: ${error.message}`);
  usage();
  process.exit(2);
}
if (!existsSync(workOrder)) {
  console.error(`S.C.A.L.E.: work order does not exist: ${workOrder}`);
  process.exit(2);
}

const registry = JSON.parse(readFileSync(resolve(root, "library/model-registry.json"), "utf8"));
const binding = (registry.agent_bindings ?? []).find((entry) => entry.profile === profile);
if (!binding) {
  console.error(`S.C.A.L.E.: no agent binding for ${profile}`);
  process.exit(2);
}
if (binding.primary?.execution !== "external-cli") {
  console.error(`S.C.A.L.E.: ${profile} is native Codex work; use ${binding.primary?.model ?? "its configured profile"}.`);
  process.exit(2);
}

const agentPath = resolve(target, ".opencode/agents", `${binding.primary.agent}.md`);
if (!existsSync(agentPath)) {
  console.error(`S.C.A.L.E.: OpenCode agent is not materialized: ${agentPath}`);
  process.exit(2);
}

const catalog = spawnSync("opencode", ["models", "opencode-go"], { encoding: "utf8" });
const catalogText = `${catalog.stdout ?? ""}\n${catalog.stderr ?? ""}`;
if (catalog.error || catalog.status !== 0 || !catalogText.includes(binding.primary.model)) {
  const detail = (catalog.error?.message || catalog.stderr || "model is unavailable").trim();
  console.log(JSON.stringify({ status: "fallback-required", reason: "opencode-catalog-unavailable", profile, fallback: binding.fallback, detail }));
  process.exit(75);
}

const prompt = readFileSync(workOrder, "utf8");
const command = ["run", "--dir", target, "--agent", binding.primary.agent, "--model", binding.primary.model, "--variant", binding.primary.reasoning_effort, "--format", "json"];
if (args.includes("--allow-write")) command.push("--auto");
command.push(prompt);
const result = spawnSync("opencode", command, { encoding: "utf8" });
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const quotaFailure = /(?:quota|rate\s*limit|usage\s*limit|credit|limit\s*reached|status\s*429)/i.test(output);
if (quotaFailure) {
  console.log(JSON.stringify({ status: "fallback-required", reason: "opencode-go-limit", profile, fallback: binding.fallback }));
  process.exit(75);
}
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
