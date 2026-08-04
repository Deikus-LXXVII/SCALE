#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const values = (name) => args.reduce((result, arg, index) => {
  if (arg === name && args[index + 1] && !args[index + 1].startsWith("--")) result.push(args[index + 1]);
  return result;
}, []);
const usage = () => console.log("Usage: scale-opencode-dispatch.mjs --target <project-dir> --profile <scale_profile> --work-order <file> [--specialist <id>] [--task-id <id>] [--context-file <path>]... [--allow-write]");

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

let target;
let profile;
let workOrder;
let specialistId;
let taskId;
let contextFiles;
try {
  target = resolve(value("--target"));
  profile = value("--profile");
  workOrder = resolve(value("--work-order"));
  specialistId = args.includes("--specialist") ? value("--specialist") : undefined;
  taskId = args.includes("--task-id") ? value("--task-id") : randomUUID();
  contextFiles = values("--context-file");
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
const runtimePolicy = registry.runtime_policy ?? {};
const telemetryPath = resolve(target, runtimePolicy.telemetry_path ?? ".codex/scale-telemetry.jsonl");
const startedAt = new Date().toISOString();
const startedMs = Date.now();
const writeTelemetry = (event, details = {}) => {
  try {
    mkdirSync(dirname(telemetryPath), { recursive: true });
    appendFileSync(telemetryPath, `${JSON.stringify({
      schema_version: 1,
      event,
      task_id: taskId,
      profile,
      specialist: specialistId ?? null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedMs,
      ...details
    })}\n`, { encoding: "utf8", mode: 0o600 });
  } catch (error) {
    console.error(`S.C.A.L.E.: telemetry write failed: ${error.message}`);
  }
};
const priorEvents = (() => {
  if (!existsSync(telemetryPath)) return [];
  try {
    return readFileSync(telemetryPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.task_id === taskId);
  } catch {
    return [];
  }
})();
const reject = (reason, details = {}, status = 2) => {
  writeTelemetry("rejected", { reason, ...details });
  console.error(`S.C.A.L.E.: dispatch rejected (${reason}).`);
  process.exit(status);
};
const binding = (registry.agent_bindings ?? []).find((entry) => entry.profile === profile);
if (!binding) {
  reject("unknown-profile");
}
const selected = specialistId
  ? (binding.specialists ?? []).find((candidate) => candidate.id === specialistId)
  : binding.primary;
if (!selected) {
  reject("unknown-specialist", { specialist: specialistId });
}
if (selected.execution !== "external-cli") {
  reject("native-route", { model: selected.model });
}

if (priorEvents.some((entry) => entry.event === "fallback_required") && runtimePolicy.max_escalations <= 1) {
  reject("escalation-budget-exhausted", { max_escalations: runtimePolicy.max_escalations }, 78);
}

const fallback = selected.fallback ?? binding.fallback ?? binding.primary;
const agentPath = resolve(target, ".opencode/agents", `${selected.agent}.md`);
if (!existsSync(agentPath)) {
  reject("agent-not-materialized", { agent: selected.agent, path: agentPath });
}
const agentSource = readFileSync(agentPath, "utf8");
const declaredSteps = Number(agentSource.match(/^steps:\s*(\d+)$/m)?.[1] ?? 0);
if (!declaredSteps || declaredSteps > runtimePolicy.max_agent_steps) {
  reject("agent-step-budget-exceeded", { agent: selected.agent, steps: declaredSteps, max_agent_steps: runtimePolicy.max_agent_steps });
}

let workOrderBytes;
try {
  const workOrderStat = statSync(workOrder);
  if (!workOrderStat.isFile()) reject("work-order-not-file", { path: workOrder });
  workOrderBytes = workOrderStat.size;
} catch (error) {
  reject("work-order-unreadable", { detail: error.message });
}
if (workOrderBytes > runtimePolicy.max_work_order_bytes) {
  reject("work-order-budget-exceeded", { bytes: workOrderBytes, max_work_order_bytes: runtimePolicy.max_work_order_bytes });
}

let contextBytes = 0;
for (const contextFile of contextFiles) {
  const absolute = resolve(target, contextFile);
  const outsideTarget = absolute !== target && !absolute.startsWith(`${target}${sep}`);
  if (outsideTarget) reject("context-file-outside-target", { path: contextFile });
  let bytes;
  try {
    const contextStat = statSync(absolute);
    if (!contextStat.isFile()) reject("context-file-not-file", { path: contextFile });
    bytes = contextStat.size;
  } catch (error) {
    reject("context-file-unreadable", { path: contextFile, detail: error.message });
  }
  contextBytes += bytes;
}
if (contextFiles.length > runtimePolicy.max_context_files) {
  reject("context-file-count-budget-exceeded", { count: contextFiles.length, max_context_files: runtimePolicy.max_context_files });
}
if (contextBytes > runtimePolicy.max_context_bytes) {
  reject("context-byte-budget-exceeded", { bytes: contextBytes, max_context_bytes: runtimePolicy.max_context_bytes });
}

const catalog = spawnSync("opencode", ["models", "opencode-go"], { encoding: "utf8" });
const catalogText = `${catalog.stdout ?? ""}\n${catalog.stderr ?? ""}`;
if (catalog.error || catalog.status !== 0 || !catalogText.includes(selected.model)) {
  const detail = (catalog.error?.message || catalog.stderr || "model is unavailable").trim();
  writeTelemetry("fallback_required", { reason: "opencode-catalog-unavailable", model: selected.model, reasoning_effort: selected.reasoning_effort, fallback, work_order_bytes: workOrderBytes, context_file_count: contextFiles.length, context_bytes: contextBytes, detail });
  console.log(JSON.stringify({ status: "fallback-required", reason: "opencode-catalog-unavailable", profile, specialist: specialistId, fallback, detail }));
  process.exit(75);
}

const prompt = readFileSync(workOrder, "utf8");
const command = ["run", "--dir", target, "--agent", selected.agent, "--model", selected.model];
if (selected.reasoning_effort !== "provider-default") command.push("--variant", selected.reasoning_effort);
command.push("--format", "json");
if (args.includes("--allow-write")) command.push("--auto");
command.push(prompt);
const result = spawnSync("opencode", command, { encoding: "utf8", timeout: runtimePolicy.max_dispatch_ms });
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const quotaFailure = /(?:quota|rate\s*limit|usage\s*limit|credit|limit\s*reached|status\s*429)/i.test(output);
const timedOut = result.error?.code === "ETIMEDOUT";
if (quotaFailure || timedOut || result.status !== 0) {
  const reason = quotaFailure ? "opencode-go-limit" : timedOut ? "dispatch-timeout" : "opencode-exit";
  writeTelemetry("fallback_required", { reason, model: selected.model, reasoning_effort: selected.reasoning_effort, fallback, work_order_bytes: workOrderBytes, context_file_count: contextFiles.length, context_bytes: contextBytes, exit_status: result.status ?? null, output_bytes: Buffer.byteLength(output), detail: result.error?.message ?? null });
  console.log(JSON.stringify({ status: "fallback-required", reason, profile, specialist: specialistId, fallback }));
  process.exit(75);
}
writeTelemetry("completed", { model: selected.model, reasoning_effort: selected.reasoning_effort, execution: selected.execution, work_order_bytes: workOrderBytes, context_file_count: contextFiles.length, context_bytes: contextBytes, exit_status: result.status ?? 0, output_bytes: Buffer.byteLength(output), allow_write: args.includes("--allow-write") });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
