#!/usr/bin/env node
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync
} from "node:fs";
import { resolve, dirname, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const optionalValue = (name) => args.includes(name) ? value(name) : undefined;
const values = (name) => args.reduce((result, arg, index) => {
  if (arg === name && args[index + 1] && !args[index + 1].startsWith("--")) result.push(args[index + 1]);
  return result;
}, []);
const usage = () => console.log("Usage: scale-opencode-dispatch.mjs --target <project-dir> --profile <scale_profile> --work-order <file> [--specialist <id>] [--task-id <id>] [--budget-adjust <json-file>] [--context-file <path>]... [--allow-write] [--input-tokens <n>] [--output-tokens <n>] [--cost-usd <n>] [--task-outcome <success|partial|failure|unknown>] [--acceptance-outcome <passed|failed|not-run|unknown>] [--human-intervention <none|required>] [--knowledge-reuse <none|project|library|unknown>] [--regression <none|detected|unknown>]");

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const within = (path, parent) => path === parent || path.startsWith(`${parent}${sep}`);
const boundedEnum = (flag, allowed) => {
  const selected = optionalValue(flag);
  if (selected === undefined) return undefined;
  if (!allowed.includes(selected)) throw new Error(`Invalid ${flag}`);
  return selected;
};
const boundedNumber = (flag) => {
  const selected = optionalValue(flag);
  if (selected === undefined) return undefined;
  const number = Number(selected);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid ${flag}`);
  return number;
};

let target;
let profile;
let workOrderInput;
let specialistId;
let taskId;
let contextFiles;
let budgetAdjustmentInput;
let taskOutcomeMetadata;
let declaredUsage;
try {
  const targetInput = resolve(value("--target"));
  if (!statSync(targetInput).isDirectory()) throw new Error("Target is not a directory");
  target = realpathSync(targetInput);
  profile = value("--profile");
  workOrderInput = value("--work-order");
  specialistId = optionalValue("--specialist");
  taskId = optionalValue("--task-id") ?? randomUUID();
  contextFiles = values("--context-file");
  budgetAdjustmentInput = optionalValue("--budget-adjust");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(taskId)) throw new Error("Invalid --task-id");
  taskOutcomeMetadata = Object.fromEntries(Object.entries({
    task_outcome: boundedEnum("--task-outcome", ["success", "partial", "failure", "unknown"]),
    acceptance_outcome: boundedEnum("--acceptance-outcome", ["passed", "failed", "not-run", "unknown"]),
    human_intervention: boundedEnum("--human-intervention", ["none", "required"]),
    knowledge_reuse: boundedEnum("--knowledge-reuse", ["none", "project", "library", "unknown"]),
    regression: boundedEnum("--regression", ["none", "detected", "unknown"])
  }).filter(([, entry]) => entry !== undefined));
  declaredUsage = Object.fromEntries(Object.entries({
    input_tokens: boundedNumber("--input-tokens"),
    output_tokens: boundedNumber("--output-tokens"),
    cost_usd: boundedNumber("--cost-usd")
  }).filter(([, entry]) => entry !== undefined));
} catch (error) {
  console.error(`S.C.A.L.E.: ${error.message}`);
  usage();
  process.exit(2);
}

const registry = JSON.parse(readFileSync(resolve(root, "library/model-registry.json"), "utf8"));
const runtimePolicy = registry.runtime_policy ?? {};
const telemetryRelative = runtimePolicy.telemetry_path ?? ".codex/scale-telemetry.jsonl";
const telemetryCandidate = resolve(target, telemetryRelative);
if (!within(telemetryCandidate, target)) {
  console.error("S.C.A.L.E.: dispatch rejected (telemetry-path-outside-target).");
  process.exit(2);
}
let telemetryPath;
try {
  mkdirSync(dirname(telemetryCandidate), { recursive: true, mode: 0o700 });
  const telemetryParent = realpathSync(dirname(telemetryCandidate));
  if (!within(telemetryParent, target)) throw new Error("telemetry-path-symlink-escape");
  if (existsSync(telemetryCandidate) && (!lstatSync(telemetryCandidate).isFile() || lstatSync(telemetryCandidate).isSymbolicLink())) {
    throw new Error("telemetry-path-not-regular-file");
  }
  telemetryPath = telemetryCandidate;
} catch (error) {
  console.error(`S.C.A.L.E.: dispatch rejected (${error.message}).`);
  process.exit(2);
}

const startedAt = new Date().toISOString();
const startedMs = Date.now();
let routeSelectionReason = null;
let catalogCheckStatus = "not-checked";
let workOrderSha256 = null;
let contextSha256 = [];
let usageMetadata = Object.keys(declaredUsage).length > 0 ? { ...declaredUsage } : null;
const writeTelemetry = (event, details = {}) => {
  try {
    appendFileSync(telemetryPath, `${JSON.stringify({
      schema_version: 2,
      event,
      task_id: taskId,
      profile,
      specialist: specialistId ?? null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedMs,
      route_selection_reason: routeSelectionReason,
      provider_catalog_check_status: catalogCheckStatus,
      work_order_sha256: workOrderSha256,
      context_sha256: contextSha256,
      task_outcome_metadata: taskOutcomeMetadata,
      usage: usageMetadata,
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
  writeTelemetry("rejected", { reason, exit_reason: "rejected", ...details });
  console.error(`S.C.A.L.E.: dispatch rejected (${reason}).`);
  process.exit(status);
};
const resolveTargetFile = (input, artifactKind, artifactIndex = undefined) => {
  const lexical = resolve(target, input);
  if (!within(lexical, target)) reject(`${artifactKind}-outside-target`, { artifact_kind: artifactKind, artifact_index: artifactIndex });
  let canonical;
  try {
    canonical = realpathSync(lexical);
  } catch {
    reject(`${artifactKind}-unreadable`, { artifact_kind: artifactKind, artifact_index: artifactIndex });
  }
  if (!within(canonical, target)) reject(`${artifactKind}-symlink-escape`, { artifact_kind: artifactKind, artifact_index: artifactIndex });
  try {
    if (!statSync(canonical).isFile()) reject(`${artifactKind}-not-regular-file`, { artifact_kind: artifactKind, artifact_index: artifactIndex });
  } catch {
    reject(`${artifactKind}-unreadable`, { artifact_kind: artifactKind, artifact_index: artifactIndex });
  }
  return canonical;
};

const sensitiveBasenames = [
  /^(?:\.env(?:\..+)?|\.netrc|\.npmrc|credentials?(?:\..+)?|secrets?(?:\..+)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..+)?|shadow|passwd)$/i,
  /(?:^|[-_.])(?:private[-_.]?key|client[-_.]?secret|customer[-_.]?pii|patient[-_.]?data|medical[-_.]?record|social[-_.]?security|passport|drivers?[-_.]?license|tax[-_.]?id)(?:[-_.]|$)/i,
  /\.(?:pem|p12|pfx|key)$/i
];
const placeholderValue = (candidate) => /(?:example|sample|dummy|fake|test|placeholder|redacted|changeme|replace[-_ ]?me|process\.env|getenv|\$\{|<[^>]+>)/i.test(candidate);
const luhnValid = (candidate) => {
  const digits = candidate.replace(/[^0-9]/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit && (digit *= 2) > 9) digit -= 9;
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
};
const sensitiveFinding = (filePath, content) => {
  const name = basename(filePath);
  if (sensitiveBasenames.some((pattern) => pattern.test(name))) return "sensitive-filename";
  const text = content.toString("utf8");
  const fixedPatterns = [
    ["private-key", /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/],
    ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ["github-token", /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/],
    ["openai-token", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
    ["slack-token", /\bxox(?:a|b|p|r|s)-[A-Za-z0-9-]{16,}\b/],
    ["jwt-token", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
    ["bearer-token", /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i],
    ["pii-ssn", /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/],
    ["credential-uri", /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]{6,}@/i]
  ];
  for (const [finding, pattern] of fixedPatterns) if (pattern.test(text)) return finding;
  const assignment = /["']?(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']/ig;
  for (const match of text.matchAll(assignment)) if (!placeholderValue(match[1])) return "credential-literal";
  const emails = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig) ?? [];
  if (emails.some((email) => !/@(?:example\.(?:com|org|net)|example|localhost|invalid)$/i.test(email))) return "pii-email";
  const cardCandidates = text.match(/\b(?:\d[ -]?){12,18}\d\b/g) ?? [];
  if (cardCandidates.some(luhnValid)) return "pii-payment-card";
  return null;
};
const privacyGate = (filePath, content, artifactKind, artifactIndex = undefined) => {
  const finding = sensitiveFinding(filePath, content);
  if (finding) reject("sensitive-material", { artifact_kind: artifactKind, artifact_index: artifactIndex, finding });
};

const extractUsage = (output) => {
  const candidates = [];
  const visit = (node, depth = 0) => {
    if (depth > 5 || !node || typeof node !== "object") return;
    const source = node.usage && typeof node.usage === "object" ? node.usage : node.token_usage && typeof node.token_usage === "object" ? node.token_usage : node;
    const candidate = {};
    const aliases = {
      input_tokens: ["input_tokens", "prompt_tokens", "inputTokens"],
      output_tokens: ["output_tokens", "completion_tokens", "outputTokens"],
      total_tokens: ["total_tokens", "totalTokens"],
      cost_usd: ["cost_usd", "costUsd", "total_cost_usd"]
    };
    for (const [field, names] of Object.entries(aliases)) {
      for (const name of names) {
        const number = Number(source[name]);
        if (Number.isFinite(number) && number >= 0) { candidate[field] = number; break; }
      }
    }
    if (Object.keys(candidate).length > 0) candidates.push(candidate);
    for (const child of Object.values(node)) visit(child, depth + 1);
  };
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    try { visit(JSON.parse(line)); } catch { /* OpenCode may emit non-JSON diagnostics. */ }
  }
  if (candidates.length === 0) return null;
  return candidates.sort((left, right) => Object.keys(right).length - Object.keys(left).length).at(0);
};

const binding = (registry.agent_bindings ?? []).find((entry) => entry.profile === profile);
if (!binding) reject("unknown-profile");
const selected = specialistId
  ? (binding.specialists ?? []).find((candidate) => candidate.id === specialistId)
  : binding.primary;
routeSelectionReason = specialistId ? "explicit-specialist" : "profile-primary";
if (!selected) reject("unknown-specialist");
if (selected.execution !== "external-cli") reject("native-route", { model: selected.model });

if (priorEvents.some((entry) => entry.event === "fallback_required") && runtimePolicy.max_escalations <= 1) {
  reject("escalation-budget-exhausted", { max_escalations: runtimePolicy.max_escalations }, 78);
}

const workOrder = resolveTargetFile(workOrderInput, "work-order");
const workOrderBuffer = readFileSync(workOrder);
privacyGate(workOrder, workOrderBuffer, "work-order");
workOrderSha256 = sha256(workOrderBuffer);
const prompt = workOrderBuffer.toString("utf8");
let dispatchMetadata = {};
const metadataMatch = prompt.match(/^\s*<!--\s*scale-dispatch:\s*(\{[^\r\n]*\})\s*-->\s*(?:\r?\n|$)/i);
if (metadataMatch) {
  try {
    dispatchMetadata = JSON.parse(metadataMatch[1]);
  } catch {
    reject("work-order-metadata-invalid");
  }
}
const approvalClasses = Array.isArray(dispatchMetadata.approval_classes)
  ? dispatchMetadata.approval_classes.filter((entry) => typeof entry === "string")
  : [];
if (args.includes("--allow-write") && !approvalClasses.includes("external-write")) {
  reject("write-approval-required", { required_approval_class: "external-write" });
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
if (budgetAdjustmentInput) {
  if (!budgetAdjustmentPolicy.enabled) reject("budget-adjustment-disabled");
  if (priorEvents.some((entry) => entry.event === "budget_adjusted") && budgetAdjustmentPolicy.max_adjustments <= 1) {
    reject("budget-adjustment-already-used", { max_adjustments: budgetAdjustmentPolicy.max_adjustments }, 78);
  }
  const budgetAdjustmentPath = resolveTargetFile(budgetAdjustmentInput, "budget-adjustment");
  const adjustmentBuffer = readFileSync(budgetAdjustmentPath);
  privacyGate(budgetAdjustmentPath, adjustmentBuffer, "budget-adjustment");
  let request;
  try {
    request = JSON.parse(adjustmentBuffer.toString("utf8"));
  } catch {
    reject("budget-adjustment-invalid-json");
  }
  if (request?.issuer !== "scale_orchestrator") reject("budget-adjustment-issuer-required");
  if (!budgetAdjustmentPolicy.allowed_reasons?.includes(request?.reason)) reject("budget-adjustment-reason-not-allowed", { reason: request?.reason });
  if (budgetAdjustmentPolicy.require_estimate && (!request?.estimate || typeof request.estimate !== "object" || !Object.values(request.estimate).some((entry) => Number.isFinite(entry) && entry > 0))) {
    reject("budget-adjustment-estimate-required");
  }
  const requested = request?.requested;
  if (!requested || typeof requested !== "object") reject("budget-adjustment-requested-missing");
  const changedFields = [];
  for (const [field, selectedValue] of Object.entries(requested)) {
    if (!budgetFields.includes(field)) reject("budget-adjustment-field-not-allowed", { field });
    if (!Number.isInteger(selectedValue) || selectedValue <= 0) reject("budget-adjustment-value-invalid", { field, value: selectedValue });
    if (selectedValue > hardBudget[field]) reject("budget-adjustment-hard-cap-exceeded", { field, value: selectedValue, hard_cap: hardBudget[field] });
    if (selectedValue !== effectiveBudget[field]) changedFields.push(field);
    if (selectedValue > effectiveBudget[field]) {
      const delta = selectedValue - effectiveBudget[field];
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
  budgetAdjustment = { reason: request.reason, estimate: request.estimate, requested, changed_fields: changedFields };
}

const fallback = selected.fallback ?? binding.fallback ?? binding.primary;
const agentPath = resolveTargetFile(resolve(target, ".opencode/agents", `${selected.agent}.md`), "managed-agent");
const agentBuffer = readFileSync(agentPath);
const agentHash = sha256(agentBuffer);
let trustedAgentHash;
try {
  const trustedAgentSource = realpathSync(resolve(root, "opencode/agents", `${selected.agent}.md`));
  if (!statSync(trustedAgentSource).isFile()) throw new Error("not-file");
  trustedAgentHash = sha256(readFileSync(trustedAgentSource));
} catch {
  reject("managed-agent-source-unavailable", { agent: selected.agent });
}
const projectOwnedApproved = approvalClasses.includes("project-owned-agent")
  && typeof dispatchMetadata.approved_agent_sha256 === "string"
  && dispatchMetadata.approved_agent_sha256 === agentHash;
if (agentHash !== trustedAgentHash && !projectOwnedApproved) {
  reject("managed-agent-integrity-failed", { agent: selected.agent, finding: "hash-mismatch", required_approval_class: "project-owned-agent" });
}
const agentSource = agentBuffer.toString("utf8");
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

const workOrderBytes = workOrderBuffer.byteLength;
if (workOrderBytes > effectiveBudget.max_work_order_bytes) {
  reject("work-order-budget-exceeded", { bytes: workOrderBytes, max_work_order_bytes: effectiveBudget.max_work_order_bytes, hard_max_work_order_bytes: hardBudget.max_work_order_bytes });
}

let contextBytes = 0;
const resolvedContexts = [];
for (const [index, contextFile] of contextFiles.entries()) {
  const absolute = resolveTargetFile(contextFile, "context-file", index);
  const contextBuffer = readFileSync(absolute);
  privacyGate(absolute, contextBuffer, "context-file", index);
  resolvedContexts.push({ bytes: contextBuffer.byteLength, hash: sha256(contextBuffer) });
  contextBytes += contextBuffer.byteLength;
}
contextSha256 = resolvedContexts.map((entry) => entry.hash);
if (contextFiles.length > effectiveBudget.max_context_files) {
  reject("context-file-count-budget-exceeded", { count: contextFiles.length, max_context_files: effectiveBudget.max_context_files, hard_max_context_files: hardBudget.max_context_files });
}
if (contextBytes > effectiveBudget.max_context_bytes) {
  reject("context-byte-budget-exceeded", { bytes: contextBytes, max_context_bytes: effectiveBudget.max_context_bytes, hard_max_context_bytes: hardBudget.max_context_bytes });
}

const catalog = spawnSync("opencode", ["models", "opencode-go"], { encoding: "utf8" });
const catalogOutput = `${catalog.stdout ?? ""}\n${catalog.stderr ?? ""}`;
catalogCheckStatus = catalog.error || catalog.status !== 0 || !catalogOutput.includes(selected.model) ? "failed" : "passed";
if (catalogCheckStatus === "failed") {
  const outputBytes = Buffer.byteLength(catalogOutput);
  writeTelemetry("fallback_required", {
    reason: "opencode-catalog-unavailable",
    fallback_reason: "opencode-catalog-unavailable",
    exit_reason: "fallback-required",
    model: selected.model,
    reasoning_effort: selected.reasoning_effort,
    fallback,
    budget: effectiveBudget,
    work_order_bytes: workOrderBytes,
    context_file_count: contextFiles.length,
    context_bytes: contextBytes,
    exit_status: catalog.status ?? null,
    output_sha256: sha256(catalogOutput),
    output_bytes: outputBytes
  });
  console.log(JSON.stringify({ status: "fallback-required", reason: "opencode-catalog-unavailable", profile, specialist: specialistId, fallback }));
  process.exit(75);
}

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
  writeTelemetry("fallback_required", {
    reason,
    fallback_reason: reason,
    exit_reason: "fallback-required",
    model: selected.model,
    reasoning_effort: selected.reasoning_effort,
    fallback,
    budget: effectiveBudget,
    work_order_bytes: workOrderBytes,
    context_file_count: contextFiles.length,
    context_bytes: contextBytes,
    exit_status: result.status ?? null,
    output_sha256: sha256(output),
    output_bytes: Buffer.byteLength(output)
  });
  console.log(JSON.stringify({ status: "fallback-required", reason, profile, specialist: specialistId, fallback }));
  process.exit(75);
}
usageMetadata = { ...(extractUsage(output) ?? {}), ...(usageMetadata ?? {}) };
writeTelemetry("completed", {
  model: selected.model,
  reasoning_effort: selected.reasoning_effort,
  execution: selected.execution,
  budget: effectiveBudget,
  work_order_bytes: workOrderBytes,
  context_file_count: contextFiles.length,
  context_bytes: contextBytes,
  exit_status: result.status ?? 0,
  exit_reason: "completed",
  fallback_reason: null,
  output_sha256: sha256(output),
  output_bytes: Buffer.byteLength(output),
  task_outcome_metadata: {
    task_outcome: taskOutcomeMetadata.task_outcome ?? "success",
    acceptance_outcome: taskOutcomeMetadata.acceptance_outcome ?? "unknown",
    human_intervention: taskOutcomeMetadata.human_intervention ?? "none",
    knowledge_reuse: taskOutcomeMetadata.knowledge_reuse ?? "unknown",
    regression: taskOutcomeMetadata.regression ?? "unknown"
  },
  allow_write: args.includes("--allow-write")
});
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
