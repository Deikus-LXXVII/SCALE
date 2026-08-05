#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeWorkOrder, validateWorkOrder, WorkOrderError } from "./scale-plaintext-runner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "library", "model-registry.json"), "utf8"));
const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "scale-plaintext-runner-"));
fs.writeFileSync(path.join(projectRoot, "demo.js"), "export const value = 1;\n");

const baseWorkOrder = {
  schema_version: 1,
  execution_id: "test-plaintext-001",
  agent: "scale_code_simple",
  model: "opencode-go/deepseek-v4-flash",
  reasoning_effort: "high",
  objective: "Change the exported value from 1 to 2.",
  files: ["demo.js"],
  context: ["Keep the public export name."],
  acceptance: ["The unified diff changes only demo.js."],
  output_mode: "patch",
  stop_condition: "Stop after emitting one unified diff.",
  max_steps: 4,
  max_output_tokens: 512
};

const validate = (workOrder) => validateWorkOrder({ workOrder, registry, projectRoot, rawBytes: Buffer.byteLength(JSON.stringify(workOrder)) });
const validated = validate(baseWorkOrder);
assert.equal(validated.files[0].content, "export const value = 1;\n");

assert.throws(() => validate({ ...baseWorkOrder, objective: "Use password=supersecret123 for the test." }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, files: ["../outside.js"] }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, model: "opencode-go/deepseek-v4-pro" }), WorkOrderError);
assert.throws(() => validate({ ...baseWorkOrder, max_steps: 999 }), WorkOrderError);

const overlayBindings = {
  profiles: { scale_telik_status: { model: "opencode-go/deepseek-v4-pro", reasoning_effort: "high" } },
  fallbacks: { scale_telik_status: { profile: "scale_telik_optimizer", model: "gpt-5.6-luna", reasoning_effort: "high" } }
};
const overlayOrder = { ...baseWorkOrder, execution_id: "test-overlay-001", agent: "scale_telik_status", model: "opencode-go/deepseek-v4-pro", output_mode: "analysis" };
const overlayValidated = validateWorkOrder({ workOrder: overlayOrder, registry, projectBindings: overlayBindings, projectRoot, rawBytes: Buffer.byteLength(JSON.stringify(overlayOrder)) });
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
assert.equal(failed.fallback_request.fallback.model, "gpt-5.6-luna");
assert.equal(failed.fallback_request.resume_external_execution, false);

console.log(JSON.stringify({ ok: true, checks: 12, transport_requests: 2, retries: 0, automatic_fallbacks: 0 }));
