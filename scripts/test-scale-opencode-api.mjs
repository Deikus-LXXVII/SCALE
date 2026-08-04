#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const client = resolve(root, "scripts/scale-opencode-api-client.mjs");
const dispatcher = resolve(root, "scripts/scale-opencode-dispatch.mjs");
const requests = [];
const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};
const send = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const body = request.method === "POST" ? await readBody(request) : "";
  requests.push({ method: request.method, pathname: url.pathname, directory: url.searchParams.get("directory"), body: body ? JSON.parse(body) : null });
  if (url.pathname === "/global/health" && request.method === "GET") return send(response, 200, { healthy: true, version: "test" });
  if (url.pathname === "/config/providers" && request.method === "GET") {
    return send(response, 200, { providers: [{ id: "opencode-go", models: { "deepseek-v4-flash": {} } }], default: {} });
  }
  if (url.pathname === "/session" && request.method === "POST") return send(response, 200, { id: "session-1" });
  if (url.pathname === "/session/session-1/message" && request.method === "POST") {
    return send(response, 200, { parts: [{ type: "text", text: "bounded result" }], usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 } });
  }
  if (url.pathname === "/session/session-1" && request.method === "DELETE") return send(response, 204, {});
  return send(response, 404, { error: "not found" });
});

await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const runClient = (payload) => new Promise((resolveClient, rejectClient) => {
  const child = spawn(process.execPath, [client], { env: { ...process.env, OPENCODE_SERVER_PASSWORD: "fixture-secret" } });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", rejectClient);
  child.on("close", (status) => resolveClient({ status, stdout, stderr }));
  child.stdin.end(JSON.stringify({ base_url: baseUrl, target: "/tmp/scale-api-fixture", model: "opencode-go/deepseek-v4-flash", agent: "scale-go-routine", reasoning_effort: "high", task_id: "fixture", timeout_ms: 5000, ...payload }));
});

const probe = await runClient({ operation: "probe" });
assert.equal(probe.status, 0, `${probe.stdout}${probe.stderr}`);
assert.equal(JSON.parse(probe.stdout).reason, "api-catalog-passed");
const run = await runClient({ operation: "run", prompt: "Return a bounded result." });
assert.equal(run.status, 0);
const result = JSON.parse(run.stdout);
assert.equal(result.ok, true);
assert.match(result.output, /bounded result/);
assert.equal(requests.filter((request) => request.pathname === "/session").length, 1);
const message = requests.find((request) => request.pathname === "/session/session-1/message");
assert.equal(message.directory, "/tmp/scale-api-fixture");
assert.deepEqual(message.body.model, { providerID: "opencode-go", modelID: "deepseek-v4-flash", variant: "high" });
assert.equal(message.body.agent, "scale-go-routine");
assert.equal(message.body.parts[0].text, "Return a bounded result.");
assert.ok(!run.stdout.includes("fixture-secret"));

const target = await mkdtemp(`${tmpdir()}/scale-api-dispatch-`);
await mkdir(resolve(target, ".opencode/agents"), { recursive: true });
await writeFile(resolve(target, ".opencode/agents/scale-go-routine.md"), await readFile(resolve(root, "opencode/agents/scale-go-routine.md")));
await writeFile(resolve(target, "work-order.md"), "Return a bounded result.\n");
const runDispatcher = await new Promise((resolveDispatcher, rejectDispatcher) => {
  const child = spawn(process.execPath, [dispatcher, "--target", target, "--profile", "scale_docs", "--work-order", "work-order.md", "--task-id", "api-dispatch-fixture"], {
    cwd: target,
    env: { ...process.env, SCALE_OPENCODE_TRANSPORT: "api", SCALE_OPENCODE_API_URL: baseUrl, OPENCODE_SERVER_PASSWORD: "fixture-secret" }
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", rejectDispatcher);
  child.on("close", (status) => resolveDispatcher({ status, stdout, stderr }));
});
assert.equal(runDispatcher.status, 0, `${runDispatcher.stdout}${runDispatcher.stderr}`);
assert.match(runDispatcher.stdout, /bounded result/);
const telemetry = JSON.parse((await readFile(resolve(target, ".codex/scale-telemetry.jsonl"), "utf8")).trim());
assert.equal(telemetry.transport, "api");

await new Promise((resolveServer) => server.close(resolveServer));
console.log("scale-opencode-api: ok");
