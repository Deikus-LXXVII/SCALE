#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeWorkOrder, validateWorkOrder, WorkOrderError, SCALE_PROVENANCE_FIELDS } from "./scale-plaintext-runner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "library", "model-registry.json"), "utf8"));
const largeSlowTimeout = registry.runtime_policy.timeout_classes["large-slow"];
assert.equal(largeSlowTimeout.max_dispatch_ms, 30 * 60 * 1000, "large-slow timeout class must be 1800000 ms (30 minutes)");
assert.match(largeSlowTimeout.selection_signal, /active OpenCode Go model.*approved_reasoning_efforts.*max/);
assert.match(largeSlowTimeout.rationale, /registry-only/i);
const largeSlowModels = registry.models.filter((model) => model.active && model.provider === "opencode-go" && model.approved_reasoning_efforts.includes("max"));
assert.equal(largeSlowModels.length, 18, "all 18 active max-capable OpenCode Go models must be classified large-slow");
assert(largeSlowModels.every((model) => model.latency_class === "large-slow"), "every active max-capable OpenCode Go model must declare latency_class large-slow");
const largeSlowModelIds = new Set(largeSlowModels.map((model) => model.id));
for (const modelId of ["opencode-go/deepseek-v4-flash", "opencode-go/hy3", "opencode-go/kimi-k2.7-code"]) {
  assert.equal(registry.models.find((model) => model.id === modelId)?.latency_class, undefined, `${modelId} must remain outside large-slow`);
}
const largeSlowBindings = registry.agent_bindings.filter((binding) => binding.primary.execution === "plaintext-external" && largeSlowModelIds.has(binding.primary.model));
assert.equal(largeSlowBindings.length, 20, "all 20 large-slow plaintext bindings must be covered");
for (const binding of largeSlowBindings) {
  assert.equal(registry.runtime_policy.agent_budgets[binding.profile].max_dispatch_ms, largeSlowTimeout.max_dispatch_ms, `${binding.profile} must use the large-slow timeout class`);
}
for (const [profile, timeout] of Object.entries({
  scale_orchestrator: 600000,
  scale_cleaner: 480000,
  scale_code_simple: 600000,
  scale_docs: 480000,
  scale_environment: 480000,
  scale_indexer: 480000,
  scale_library: 480000,
  scale_test_observer: 1800000,
  scale_model_lab_opencode_go_hy3: 600000,
  scale_model_lab_opencode_go_kimi_k2_7_code: 600000
})) {
  assert.equal(registry.runtime_policy.agent_budgets[profile].max_dispatch_ms, timeout, `${profile} fast/monitoring timeout must remain unchanged`);
}
const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "scale-plaintext-runner-"));
fs.writeFileSync(path.join(projectRoot, "demo.js"), "export const value = 1;\n");
fs.writeFileSync(path.join(projectRoot, "hidden-context.txt"), "previous_response_id: resp_hidden\n");
fs.mkdirSync(path.join(projectRoot, ".codex", "sessions"), { recursive: true });
fs.writeFileSync(path.join(projectRoot, ".codex", "sessions", "task.json"), "{}\n");
fs.writeFileSync(path.join(projectRoot, ".codex", "config.toml"), "model = \"codex-auto-review\"\n");

const baseWorkOrder = {
  schema_version: 1,
  execution_id: "test-plaintext-001",
  agent: "scale_code_simple",
  model: "opencode-go/deepseek-v4-flash",
  reasoning_effort: "high",
  objective: "Change the exported value from 1 to 2.",
  files: ["demo.js"],
  context: ["Keep the public export name."],
  context_security: { mode: "plaintext", hidden: false, encrypted: false, previous_response_id: null },
  context_freshness: { scope: "active", memora: { status: "not_required", result_count: 0, provenance: [...SCALE_PROVENANCE_FIELDS] } },
  acceptance: ["The unified diff changes only demo.js."],
  output_mode: "patch",
  stop_condition: "Stop after emitting one unified diff.",
  max_steps: 4,
  max_output_tokens: 512
};

const validate = (workOrder) => validateWorkOrder({ workOrder, registry, projectRoot, rawBytes: Buffer.byteLength(JSON.stringify(workOrder)) });
const validated = validate(baseWorkOrder);
assert.equal(validated.files[0].content, "export const value = 1;\n");
const { context_freshness: _contextFreshness, ...withoutFreshness } = baseWorkOrder;
assert.throws(() => validate(withoutFreshness), WorkOrderError, "context freshness attestation is required");

assert.throws(() => validate({ ...baseWorkOrder, objective: "Use password=supersecret123 for the test." }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, context_security: { mode: "plaintext", hidden: true, encrypted: false, previous_response_id: null } }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, context_security: { mode: "plaintext", hidden: false, encrypted: true, previous_response_id: null } }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, context_security: { mode: "plaintext", hidden: false, encrypted: false, previous_response_id: "resp_hidden" } }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, previous_response_id: "resp_hidden" }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, context: ["encrypted_context: opaque-codex-state"] }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, files: ["hidden-context.txt"] }), WorkOrderError, "hidden context in file contents must route native");
assert.throws(() => validate({ ...baseWorkOrder, files: [".codex/sessions/task.json"] }), WorkOrderError, "Codex session artifacts must route native");
assert.throws(() => validate({ ...baseWorkOrder, files: [".codex\\sessions\\task.json"] }), WorkOrderError, "Windows-style Codex session paths must route native");
assert.doesNotThrow(() => validate({ ...baseWorkOrder, files: [".codex/config.toml"] }), "ordinary Codex config files remain allowed");
assert.doesNotThrow(() => validate({ ...baseWorkOrder, context_freshness: { scope: "active", memora: { status: "retrieved", result_count: 1, provenance: [...SCALE_PROVENANCE_FIELDS] } } }));
const coldFreshness = { scope: "cold", memora: { status: "retrieved", result_count: 1, provenance: [...SCALE_PROVENANCE_FIELDS] } };
assert.doesNotThrow(() => validate({ ...baseWorkOrder, execution_id: "test-cold-001", context_freshness: coldFreshness }), "cold context with complete Memora attestation must pass");
assert.throws(() => validate({ ...baseWorkOrder, execution_id: "test-cold-missing", context_freshness: { scope: "cold" } }), WorkOrderError, "cold context without Memora attestation must fail closed");
assert.throws(() => validate({ ...baseWorkOrder, execution_id: "test-cold-blocked", context_freshness: { scope: "cold", memora: { status: "blocked", result_count: 0, provenance: [...SCALE_PROVENANCE_FIELDS] } } }), WorkOrderError, "blocked cold retrieval must route native");
assert.throws(() => validate({ ...baseWorkOrder, execution_id: "test-cold-provenance", context_freshness: { scope: "cold", memora: { status: "retrieved", result_count: 1, provenance: SCALE_PROVENANCE_FIELDS.slice(1) } } }), WorkOrderError, "cold retrieval with insufficient provenance must fail closed");
assert.throws(() => validate({ ...baseWorkOrder, files: ["../outside.js"] }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, model: "opencode-go/deepseek-v4-pro" }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, max_steps: 999 }), WorkOrderError);

const overlayBindings = {
  profiles: { scale_telik_status: { model: "opencode-go/deepseek-v4-pro", reasoning_effort: "high" } },
  fallbacks: { scale_telik_status: { profile: "scale_telik_optimizer", model: "gpt-5.6-luna", reasoning_effort: "high" } }
};
const overlayOrder = { ...baseWorkOrder, execution_id: "test-overlay-001", agent: "scale_telik_status", model: "opencode-go/deepseek-v4-pro", output_mode: "analysis" };
const overlayValidated = validateWorkOrder({ workOrder: overlayOrder, registry, projectBindings: overlayBindings, projectRoot, rawBytes: Buffer.byteLength(JSON.stringify(overlayOrder)) });
assert.equal(overlayValidated.budget.max_dispatch_ms, 1800000, "large-slow project overlays must inherit the class timeout");
assert.equal(overlayValidated.binding.fallback.profile, "scale_telik_optimizer");
assert.throws(() => validateWorkOrder({ workOrder: { ...overlayOrder, output_mode: "patch" }, registry, projectBindings: overlayBindings, projectRoot, rawBytes: 1000 }), WorkOrderError);

let requestCount = 0;
const success = await executeWorkOrder({
  workOrder: baseWorkOrder,
  validated,
  baseUrl: "http://mock.invalid/v1",
  fetchImpl: async (_url, options) => {
    requestCount += 1;
    const request = JSON.parse(options.body);
    assert.equal(request.model, baseWorkOrder.model);
    assert.equal(Object.hasOwn(request, "previous_response_id"), false);
    return new Response(JSON.stringify({ id: "resp_test", model: baseWorkOrder.model, output: [{ type: "message", content: [{ type: "output_text", text: "--- a/demo.js\n+++ b/demo.js\n@@\n-1\n+2" }] }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
});
assert.equal(requestCount, 1);
assert.equal(success.status, "completed");
assert.equal(success.identity.model, baseWorkOrder.model);
assert.equal(success.identity.transport, "plaintext-external");

requestCount = 0;
const failed = await executeWorkOrder({
  workOrder: baseWorkOrder,
  validated,
  baseUrl: "http://mock.invalid/v1",
  fetchImpl: async () => {
    requestCount += 1;
    return new Response("upstream failed", { status: 502 });
  }
});
assert.equal(requestCount, 1, "runner must not retry");
assert.equal(failed.status, "fallback_required");
assert.equal(failed.fallback_request.fallback.profile, "scale_code_simple");
assert.equal(failed.fallback_request.fallback.model, "gpt-5.3-codex-spark");
assert.equal(failed.fallback_request.fallback.reasoning_effort, "medium");
assert.equal(failed.fallback_request.resume_external_execution, false);

console.log(JSON.stringify({ ok: true, checks: 13, transport_requests: 2, retries: 0, automatic_fallbacks: 0 }));
