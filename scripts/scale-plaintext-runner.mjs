#!/usr/bin/env node
/**
 * Run one bounded, non-sensitive SCALE work order against OpenCode Go without
 * Codex thread_spawn. The runner never applies changes, resumes a conversation,
 * retries, or executes a native fallback.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXIT_USAGE = 64;
const EXIT_FALLBACK = 75;
const allowedKeys = new Set([
  "schema_version", "execution_id", "agent", "model", "reasoning_effort",
  "objective", "files", "context", "acceptance", "output_mode",
  "stop_condition", "max_steps", "max_output_tokens"
]);
const sensitivePathFragments = [
  ".env", "credentials", "credential", "secrets", "secret", "id_rsa",
  "id_ed25519", ".pem", ".p12", ".pfx", ".key", "auth.json", "cookies"
];
const sensitiveTextPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/,
  /\bAuthorization\s*:\s*Bearer\s+\S+/i,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*["']?[^\s"']{6,}/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
];

export class WorkOrderError extends Error {}

function parseArgs(argv) {
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) throw new WorkOrderError(`Unexpected argument: ${item}`);
    if (["--dry-run", "--help"].includes(item)) {
      flags.add(item);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new WorkOrderError(`Missing value for ${item}`);
    values.set(item, value);
    index += 1;
  }
  return { values, flags };
}

const assert = (condition, message) => {
  if (!condition) throw new WorkOrderError(message);
};

function assertString(value, owner, maxLength) {
  assert(typeof value === "string" && value.trim().length > 0, `${owner} must be a non-empty string`);
  assert(Buffer.byteLength(value, "utf8") <= maxLength, `${owner} exceeds ${maxLength} bytes`);
}

function assertStringArray(value, owner, { min = 0, max, itemBytes }) {
  assert(Array.isArray(value), `${owner} must be an array`);
  assert(value.length >= min && value.length <= max, `${owner} must contain ${min}-${max} items`);
  value.forEach((item, index) => assertString(item, `${owner}[${index}]`, itemBytes));
}

function findSensitiveText(value) {
  return sensitiveTextPatterns.some((pattern) => pattern.test(value));
}

function resolveScopedFile(projectRoot, relativePath) {
  assert(!path.isAbsolute(relativePath), `files entries must be relative: ${relativePath}`);
  const normalized = path.normalize(relativePath);
  assert(normalized !== ".." && !normalized.startsWith(`..${path.sep}`), `files entry escapes project root: ${relativePath}`);
  const absolute = path.resolve(projectRoot, normalized);
  assert(absolute === projectRoot || absolute.startsWith(`${projectRoot}${path.sep}`), `files entry escapes project root: ${relativePath}`);
  const lower = normalized.toLowerCase();
  assert(!sensitivePathFragments.some((fragment) => lower.includes(fragment)), `files entry is blocked by the privacy boundary: ${relativePath}`);
  if (!fs.existsSync(absolute)) return { relative: normalized, absolute, exists: false, content: "" };
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile(), `files entry is not a regular file: ${relativePath}`);
  assert(!stat.isSymbolicLink(), `symlink files are not accepted: ${relativePath}`);
  const real = fs.realpathSync(absolute);
  assert(real === projectRoot || real.startsWith(`${projectRoot}${path.sep}`), `files entry resolves outside project root: ${relativePath}`);
  const content = fs.readFileSync(real);
  assert(!content.includes(0), `binary files are not accepted: ${relativePath}`);
  return { relative: normalized, absolute: real, exists: true, content: content.toString("utf8") };
}

export function validateWorkOrder({ workOrder, registry, projectBindings = null, projectRoot, rawBytes }) {
  assert(workOrder && typeof workOrder === "object" && !Array.isArray(workOrder), "work order must be a JSON object");
  for (const key of Object.keys(workOrder)) assert(allowedKeys.has(key), `unknown work-order field: ${key}`);
  for (const key of allowedKeys) assert(Object.hasOwn(workOrder, key), `missing work-order field: ${key}`);
  assert(workOrder.schema_version === 1, "schema_version must be 1");
  assertString(workOrder.execution_id, "execution_id", 96);
  assert(/^[A-Za-z0-9][A-Za-z0-9._-]{2,95}$/.test(workOrder.execution_id), "execution_id has an invalid format");
  assertString(workOrder.agent, "agent", 128);
  assertString(workOrder.model, "model", 192);
  assertString(workOrder.reasoning_effort, "reasoning_effort", 16);
  assertString(workOrder.objective, "objective", 8000);
  assertStringArray(workOrder.context, "context", { max: 12, itemBytes: 8000 });
  assertStringArray(workOrder.acceptance, "acceptance", { min: 1, max: 12, itemBytes: 2000 });
  assertStringArray(workOrder.files, "files", { max: 64, itemBytes: 512 });
  assert(["analysis", "patch"].includes(workOrder.output_mode), "output_mode must be analysis or patch");
  assertString(workOrder.stop_condition, "stop_condition", 2000);
  assert(Number.isInteger(workOrder.max_steps) && workOrder.max_steps > 0, "max_steps must be a positive integer");
  assert(Number.isInteger(workOrder.max_output_tokens) && workOrder.max_output_tokens >= 64, "max_output_tokens must be at least 64");

  const policy = registry.runtime_policy?.plaintext_external_policy;
  assert(policy?.enabled === true, "plaintext external execution is disabled in the registry");
  const canonicalBinding = registry.agent_bindings?.find((entry) => entry.profile === workOrder.agent);
  const overlayPrimary = projectBindings?.profiles?.[workOrder.agent];
  const overlayFallback = projectBindings?.fallbacks?.[workOrder.agent];
  const binding = canonicalBinding ?? (overlayPrimary && overlayFallback ? {
    profile: workOrder.agent,
    primary: { execution: "plaintext-external", ...overlayPrimary },
    fallback: overlayFallback
  } : null);
  assert(binding, `agent is not registered: ${workOrder.agent}`);
  const model = registry.models?.find((entry) => entry.id === workOrder.model);
  assert(model?.active === true && model.provider === "opencode-go", `model is not an active OpenCode Go model: ${workOrder.model}`);
  assert(binding.primary?.model === workOrder.model, `model does not match ${workOrder.agent} binding`);
  assert(binding.primary?.reasoning_effort === workOrder.reasoning_effort, `reasoning_effort does not match ${workOrder.agent} binding`);
  assert(binding.primary?.execution === "plaintext-external", `${workOrder.agent} is not a plaintext-external binding`);
  const allowedProfile = policy.allowed_profiles?.includes(workOrder.agent) || policy.allowed_profile_prefixes?.some((prefix) => workOrder.agent.startsWith(prefix));
  assert(allowedProfile, `${workOrder.agent} is outside the plaintext external allowlist`);
  if (!canonicalBinding) assert(workOrder.agent.startsWith("scale_telik_"), "only registered project overlays may use project bindings");
  if (workOrder.agent.startsWith("scale_model_lab_")) assert(workOrder.output_mode === "analysis", "model-lab profiles are read-only analysis lanes");
  if (!canonicalBinding) assert(workOrder.output_mode === "analysis", "project OpenCode overlays are read-only analysis lanes");
  if (policy.analysis_only_profiles?.includes(workOrder.agent)) assert(workOrder.output_mode === "analysis", `${workOrder.agent} is an analysis-only lane`);

  const profileBudget = registry.runtime_policy?.agent_budgets?.[workOrder.agent];
  let budget = profileBudget ?? registry.runtime_policy?.defaults;
  if (!profileBudget && !canonicalBinding && model.latency_class) {
    const timeoutClass = registry.runtime_policy?.timeout_classes?.[model.latency_class];
    assert(timeoutClass && Number.isInteger(timeoutClass.max_dispatch_ms) && timeoutClass.max_dispatch_ms > 0, `model ${workOrder.model} references an invalid timeout class ${model.latency_class}`);
    budget = { ...budget, max_dispatch_ms: timeoutClass.max_dispatch_ms };
  }
  assert(rawBytes <= budget.max_work_order_bytes, `work order exceeds ${workOrder.agent} byte budget`);
  assert(workOrder.files.length <= budget.max_context_files, `files exceed ${workOrder.agent} context-file budget`);
  assert(workOrder.max_steps <= budget.max_agent_steps, `max_steps exceeds ${workOrder.agent} budget`);
  assert(workOrder.max_output_tokens <= policy.max_output_tokens, `max_output_tokens exceeds plaintext external policy`);
  assert(model.approved_reasoning_efforts?.includes(workOrder.reasoning_effort), `reasoning_effort is not approved for ${workOrder.model}`);

  const stringSurface = [workOrder.objective, workOrder.stop_condition, ...workOrder.context, ...workOrder.acceptance].join("\n");
  assert(!findSensitiveText(stringSurface), "work order was rejected by the privacy scanner");

  const rootReal = fs.realpathSync(projectRoot);
  const files = workOrder.files.map((entry) => resolveScopedFile(rootReal, entry));
  const contextBytes = files.reduce((total, file) => total + Buffer.byteLength(file.content, "utf8"), Buffer.byteLength(workOrder.context.join("\n"), "utf8"));
  assert(contextBytes <= budget.max_context_bytes, `context exceeds ${workOrder.agent} byte budget`);
  for (const file of files) assert(!findSensitiveText(file.content), `file was rejected by the privacy scanner: ${file.relative}`);
  assert(binding.fallback?.profile && binding.fallback?.model && binding.fallback?.reasoning_effort, `${workOrder.agent} has no explicit native fallback`);
  return { policy, binding, budget, files, projectRoot: rootReal, contextBytes };
}

export function buildPrompt(workOrder, files) {
  const fileBlocks = files.map((file) => `--- FILE ${file.relative} (${file.exists ? "existing" : "new target"}) ---\n${file.content}\n--- END FILE ---`).join("\n\n");
  const outputContract = workOrder.output_mode === "patch"
    ? "Return only a unified diff that the Codex host can inspect and apply. Do not claim that you edited files or ran tools."
    : "Return a concise read-only analysis. Do not emit tool calls and do not claim that you changed the project.";
  return [
    `You are the S.C.A.L.E. role ${workOrder.agent}.`,
    "This is a single plaintext, context-complete work order. There is no hidden conversation and no tool access.",
    outputContract,
    `Objective:\n${workOrder.objective}`,
    `Acceptance criteria:\n${workOrder.acceptance.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `Additional context:\n${workOrder.context.length ? workOrder.context.map((item) => `- ${item}`).join("\n") : "(none)"}`,
    `Stop condition:\n${workOrder.stop_condition}`,
    `Maximum reasoning steps requested: ${workOrder.max_steps}.`,
    fileBlocks || "No project files were supplied."
  ].join("\n\n");
}

function extractText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (["output_text", "text"].includes(content.type) && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function fallbackRequest(workOrder, binding, reason) {
  return {
    schema_version: 1,
    execution_id: workOrder.execution_id,
    status: "fallback_required",
    reason,
    fallback: {
      profile: binding.fallback.profile,
      model: binding.fallback.model,
      reasoning_effort: binding.fallback.reasoning_effort
    },
    work_order: workOrder,
    resume_external_execution: false
  };
}

export async function executeWorkOrder({ workOrder, validated, baseUrl, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), validated.budget.max_dispatch_ms);
  let response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: workOrder.model,
        input: buildPrompt(workOrder, validated.files),
        reasoning: { effort: workOrder.reasoning_effort },
        max_output_tokens: workOrder.max_output_tokens,
        stream: false
      }),
      signal: controller.signal
    });
  } catch (error) {
    const message = error?.name === "AbortError" ? "OpenCode plaintext request timed out" : "OpenCode plaintext transport failed";
    return { status: "fallback_required", fallback_request: fallbackRequest(workOrder, validated.binding, { kind: "transport_error", message }) };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    return {
      status: "fallback_required",
      fallback_request: fallbackRequest(workOrder, validated.binding, {
        kind: "provider_error",
        message: "OpenCode plaintext provider rejected the request",
        http_status: response.status
      })
    };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { status: "fallback_required", fallback_request: fallbackRequest(workOrder, validated.binding, { kind: "invalid_response", message: "OpenCode returned non-JSON output" }) };
  }
  const actualModel = payload.model;
  if (actualModel !== workOrder.model) {
    return { status: "fallback_required", fallback_request: fallbackRequest(workOrder, validated.binding, { kind: "identity_mismatch", message: "OpenCode response model did not match the requested binding" }) };
  }
  const resultText = extractText(payload);
  if (!resultText) {
    return { status: "fallback_required", fallback_request: fallbackRequest(workOrder, validated.binding, { kind: "invalid_response", message: "OpenCode returned no assistant text" }) };
  }
  return {
    schema_version: 1,
    status: "completed",
    execution_id: workOrder.execution_id,
    identity: {
      agent: workOrder.agent,
      model: actualModel,
      reasoning_effort: workOrder.reasoning_effort,
      transport: "plaintext-external",
      source: "response.model"
    },
    identity_line: `[SCALE agent=${workOrder.agent} model=${actualModel} reasoning=${workOrder.reasoning_effort} transport=plaintext-external]`,
    result: { mode: workOrder.output_mode, text: resultText },
    response_id: typeof payload.id === "string" ? payload.id : null,
    work_order_sha256: crypto.createHash("sha256").update(JSON.stringify(workOrder)).digest("hex")
  };
}

async function main() {
  const { values, flags } = parseArgs(process.argv.slice(2));
  if (flags.has("--help")) {
    console.log("Usage: scale-plaintext-runner.mjs --work-order <json> [--project-root <dir>] [--registry <json>] [--project-bindings <json>] [--base-url <url>] [--dry-run]");
    return;
  }
  const workOrderPath = values.get("--work-order");
  assert(workOrderPath, "--work-order is required");
  const projectRoot = path.resolve(values.get("--project-root") ?? process.cwd());
  const registryPath = path.resolve(values.get("--registry") ?? path.join(root, "library", "model-registry.json"));
  const defaultProjectBindings = path.join(projectRoot, ".codex", "scale-project-bindings.json");
  const projectBindingsPath = values.get("--project-bindings") ? path.resolve(values.get("--project-bindings")) : defaultProjectBindings;
  const raw = fs.readFileSync(path.resolve(workOrderPath));
  const workOrder = JSON.parse(raw.toString("utf8"));
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const projectBindings = fs.existsSync(projectBindingsPath) ? JSON.parse(fs.readFileSync(projectBindingsPath, "utf8")) : null;
  const validated = validateWorkOrder({ workOrder, registry, projectBindings, projectRoot, rawBytes: raw.length });
  if (flags.has("--dry-run")) {
    console.log(JSON.stringify({ schema_version: 1, status: "validated", execution_id: workOrder.execution_id, agent: workOrder.agent, model: workOrder.model, reasoning_effort: workOrder.reasoning_effort, context_files: validated.files.length, context_bytes: validated.contextBytes }, null, 2));
    return;
  }
  const result = await executeWorkOrder({
    workOrder,
    validated,
    baseUrl: values.get("--base-url") ?? process.env.SCALE_OPENCODEX_URL ?? "http://127.0.0.1:10100/v1"
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "fallback_required") process.exitCode = EXIT_FALLBACK;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    const message = error instanceof SyntaxError ? "work order or registry is not valid JSON" : error.message;
    console.error(JSON.stringify({ schema_version: 1, status: "rejected", error: message }));
    process.exitCode = EXIT_USAGE;
  });
}
