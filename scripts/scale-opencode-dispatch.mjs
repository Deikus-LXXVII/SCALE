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
const usage = () => console.log("Usage: scale-opencode-dispatch.mjs --target <project-dir> --profile <scale_profile> --work-order <file> [--specialist <id>] [--task-id <id>] [--budget-adjust <json-file>] [--context-file <path>]... [--allow-write]");

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
let budgetAdjustmentPath;
try {
  target = resolve(value("--target"));
  profile = value("--profile");
  workOrder = resolve(value("--work-order"));
  specialistId = args.includes("--specialist") ? value("--specialist") : undefined;
  taskId = args.includes("--task-id") ? value("--task-id") : randomUUID();
  contextFiles = values("--context-file");
  budgetAdjustmentPath = args.includes("--budget-adjust") ? resolve(value("--budget-adjust")) : undefined;
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

const budgetFields = ["max_work_order_bytes", "max_context_files", "max_context_bytes", "max_agent_steps", "max_dispatch_ms"];
const hardBudget = Object.fromEntries(budgetFields.map((field) => [field, runtimePolicy[field]]));
const defaultBudget = {
  ...Object.fromEntries(budgetFields.map((field) => [field, runtimePolicy.defaults?.[field] ?? runtimePolicy[field]])),
  ...(runtimePolicy.agent_budgets?.[profile] ?? {})
};
const budgetAdjustmentPolicy = runtimePolicy.orchestrator_adjustment ?? {};
let effectiveBudget = { ...defaultBudget };
let budgetAdjustment;
for (const field of budgetFields) {
  if (!Number.isInteger(effectiveBudget[field]) || effectiveBudget[field] <= 0 || effectiveBudget[field] > hardBudget[field]) {
    reject("runtime-budget-invalid", { field, value: effectiveBudget[field], hard_cap: hardBudget[field] });
  }
}
if (budgetAdjustmentPath) {
  if (!budgetAdjustmentPolicy.enabled) reject("budget-adjustment-disabled");
  if (priorEvents.some((entry) => entry.event === "budget_adjusted") && budgetAdjustmentPolicy.max_adjustments <= 1) {
    reject("budget-adjustment-already-used", { max_adjustments: budgetAdjustmentPolicy.max_adjustments }, 78);
  }
  let request;
  try {
    request = JSON.parse(readFileSync(budgetAdjustmentPath, "utf8"));
  } catch (error) {
    reject("budget-adjustment-invalid-json", { detail: error.message });
  }
  if (request?.issuer !== "scale_orchestrator") reject("budget-adjustment-issuer-required");
  if (!budgetAdjustmentPolicy.allowed_reasons?.includes(request?.reason)) {
    reject("budget-adjustment-reason-not-allowed", { reason: request?.reason });
  }
  if (budgetAdjustmentPolicy.require_estimate && (!request?.estimate || typeof request.estimate !== "object" || !Object.values(request.estimate).some((value) => Number.isFinite(value) && value > 0))) {
    reject("budget-adjustment-estimate-required");
  }
  const requested = request?.requested;
  if (!requested || typeof requested !== "object") reject("budget-adjustment-requested-missing");
  const changedFields = [];
  for (const [field, value] of Object.entries(requested)) {
    if (!budgetFields.includes(field)) reject("budget-adjustment-field-not-allowed", { field });
    if (!Number.isInteger(value) || value <= 0) reject("budget-adjustment-value-invalid", { field, value });
    if (value > hardBudget[field]) reject("budget-adjustment-hard-cap-exceeded", { field, value, hard_cap: hardBudget[field] });
    if (value !== effectiveBudget[field]) changedFields.push(field);
    if (value > effectiveBudget[field]) {
      const delta = value - effectiveBudget[field];
      const deltaCap = {
        max_work_order_bytes: budgetAdjustmentPolicy.max_work_order_increase_bytes,
        max_context_files: budgetAdjustmentPolicy.max_context_file_increase,
        max_context_bytes: budgetAdjustmentPolicy.max_context_byte_increase,
        max_agent_steps: budgetAdjustmentPolicy.max_step_increase,
        max_dispatch_ms: budgetAdjustmentPolicy.max_timeout_increase_ms
      }[field];
      if (delta > deltaCap) reject("budget-adjustment-increase-too-large", { field, delta, max_increase: deltaCap });
    }
  }
  if (changedFields.length === 0) reject("budget-adjustment-no-op");
  if (changedFields.length > budgetAdjustmentPolicy.max_adjusted_dimensions) {
    reject("budget-adjustment-too-many-dimensions", { dimensions: changedFields.length, max_adjusted_dimensions: budgetAdjustmentPolicy.max_adjusted_dimensions });
  }
  effectiveBudget = { ...effectiveBudget, ...requested };
  budgetAdjustment = { reason: request.reason, estimate: request.estimate, requested: requested, changed_fields: changedFields };
}

const fallback = selected.fallback ?? binding.fallback ?? binding.primary;
const agentPath = resolve(target, ".opencode/agents", `${selected.agent}.md`);
if (!existsSync(agentPath)) {
  reject("agent-not-materialized", { agent: selected.agent, path: agentPath });
}
const agentSource = readFileSync(agentPath, "utf8");
const declaredSteps = Number(agentSource.match(/^steps:\s*(\d+)$/m)?.[1] ?? 0);
if (!declaredSteps || effectiveBudget.max_agent_steps > declaredSteps || declaredSteps > hardBudget.max_agent_steps) {
  reject("agent-step-budget-exceeded", { agent: selected.agent, steps: declaredSteps, max_agent_steps: effectiveBudget.max_agent_steps, hard_max_agent_steps: hardBudget.max_agent_steps });
}
if (budgetAdjustment) {
  writeTelemetry("budget_adjusted", {
    reason: budgetAdjustment.reason,
    estimate: budgetAdjustment.estimate,
    requested: budgetAdjustment.requested,
    changed_fields: budgetAdjustment.changed_fields,
    baseline_budget: defaultBudget,
    effective_budget: effectiveBudget,
    token_saving_policy: "bounded-one-shot-adjustment"
  });
}

let workOrderBytes;
try {
  const workOrderStat = statSync(workOrder);
  if (!workOrderStat.isFile()) reject("work-order-not-file", { path: workOrder });
  workOrderBytes = workOrderStat.size;
} catch (error) {
  reject("work-order-unreadable", { detail: error.message });
}
if (workOrderBytes > effectiveBudget.max_work_order_bytes) {
  reject("work-order-budget-exceeded", { bytes: workOrderBytes, max_work_order_bytes: effectiveBudget.max_work_order_bytes, hard_max_work_order_bytes: hardBudget.max_work_order_bytes });
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
if (contextFiles.length > effectiveBudget.max_context_files) {
  reject("context-file-count-budget-exceeded", { count: contextFiles.length, max_context_files: effectiveBudget.max_context_files, hard_max_context_files: hardBudget.max_context_files });
}
if (contextBytes > effectiveBudget.max_context_bytes) {
  reject("context-byte-budget-exceeded", { bytes: contextBytes, max_context_bytes: effectiveBudget.max_context_bytes, hard_max_context_bytes: hardBudget.max_context_bytes });
}

const catalog = spawnSync("opencode", ["models", "opencode-go"], { encoding: "utf8" });
const catalogText = `${catalog.stdout ?? ""}\n${catalog.stderr ?? ""}`;
if (catalog.error || catalog.status !== 0 || !catalogText.includes(selected.model)) {
  const detail = (catalog.error?.message || catalog.stderr || "model is unavailable").trim();
  writeTelemetry("fallback_required", { reason: "opencode-catalog-unavailable", model: selected.model, reasoning_effort: selected.reasoning_effort, fallback, budget: effectiveBudget, work_order_bytes: workOrderBytes, context_file_count: contextFiles.length, context_bytes: contextBytes, detail });
  console.log(JSON.stringify({ status: "fallback-required", reason: "opencode-catalog-unavailable", profile, specialist: specialistId, fallback, detail }));
  process.exit(75);
}

const prompt = readFileSync(workOrder, "utf8");
const command = ["run", "--dir", target, "--agent", selected.agent, "--model", selected.model];
if (selected.reasoning_effort !== "provider-default") command.push("--variant", selected.reasoning_effort);
command.push("--format", "json");
if (args.includes("--allow-write")) command.push("--auto");
command.push(prompt);
const result = spawnSync("opencode", command, { encoding: "utf8", timeout: effectiveBudget.max_dispatch_ms });
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const quotaFailure = /(?:quota|rate\s*limit|usage\s*limit|credit|limit\s*reached|status\s*429)/i.test(output);
const timedOut = result.error?.code === "ETIMEDOUT";
if (quotaFailure || timedOut || result.status !== 0) {
  const reason = quotaFailure ? "opencode-go-limit" : timedOut ? "dispatch-timeout" : "opencode-exit";
  writeTelemetry("fallback_required", { reason, model: selected.model, reasoning_effort: selected.reasoning_effort, fallback, budget: effectiveBudget, work_order_bytes: workOrderBytes, context_file_count: contextFiles.length, context_bytes: contextBytes, exit_status: result.status ?? null, output_bytes: Buffer.byteLength(output), detail: result.error?.message ?? null });
  console.log(JSON.stringify({ status: "fallback-required", reason, profile, specialist: specialistId, fallback }));
  process.exit(75);
}
writeTelemetry("completed", { model: selected.model, reasoning_effort: selected.reasoning_effort, execution: selected.execution, budget: effectiveBudget, work_order_bytes: workOrderBytes, context_file_count: contextFiles.length, context_bytes: contextBytes, exit_status: result.status ?? 0, output_bytes: Buffer.byteLength(output), allow_write: args.includes("--allow-write") });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
