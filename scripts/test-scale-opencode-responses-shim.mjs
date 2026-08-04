#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const shim = resolve(root, "scripts/scale-opencode-responses-shim.mjs");
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

const upstream = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const body = request.method === "POST" ? await readBody(request) : "";
  requests.push({ method: request.method, pathname: url.pathname, directory: url.searchParams.get("directory"), body: body ? JSON.parse(body) : null });
  if (url.pathname === "/session" && request.method === "POST") return send(response, 200, { id: "fixture-session" });
  if (url.pathname === "/session/fixture-session/message" && request.method === "POST") {
    return send(response, 200, { parts: [{ type: "text", text: "native fixture result" }], usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 } });
  }
  if (url.pathname === "/session/fixture-session" && request.method === "DELETE") return send(response, 204, {});
  return send(response, 404, { error: "not found" });
});
await new Promise((done) => upstream.listen(0, "127.0.0.1", done));
const upstreamPort = upstream.address().port;
const shimPort = upstreamPort + 1;
const markerDir = await mkdtemp(`${tmpdir()}/scale-native-marker-`);
const markerPath = resolve(markerDir, "project-root");
await writeFile(markerPath, `${root}\n`);
const child = spawn(process.execPath, [shim], {
  cwd: root,
  env: { ...process.env, SCALE_OPENCODE_API_URL: `http://127.0.0.1:${upstreamPort}`, SCALE_OPENCODE_SHIM_PORT: String(shimPort), SCALE_OPENCODE_PROJECT_ROOT: root, SCALE_OPENCODE_PROJECT_ROOT_FILE: markerPath, OPENCODE_SERVER_PASSWORD: "fixture-secret" }
});
let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
const waitForHealth = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const result = await fetch(`http://127.0.0.1:${shimPort}/healthz`);
      if (result.ok) return;
    } catch { /* startup race */ }
    await new Promise((done) => setTimeout(done, 20));
  }
  throw new Error(`shim did not start: ${output}`);
};
try {
  await waitForHealth();
  const plain = await fetch(`http://127.0.0.1:${shimPort}/v1/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "opencode-go/deepseek-v4-flash", reasoning: { effort: "high" }, instructions: "Be concise.", input: "Return a bounded result." }) });
  assert.equal(plain.status, 200);
  const plainBody = await plain.json();
  assert.equal(plainBody.object, "response");
  assert.equal(plainBody.output[0].content[0].text, "native fixture result");
  assert.deepEqual(plainBody.usage, { input_tokens: 3, output_tokens: 4, total_tokens: 7 });
  const stream = await fetch(`http://127.0.0.1:${shimPort}/v1/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "opencode-go/deepseek-v4-flash", stream: true, input: "Stream it." }) });
  assert.equal(stream.status, 200);
  const streamBody = await stream.text();
  assert.match(streamBody, /response\.output_text\.delta/);
  assert.match(streamBody, /\[DONE\]/);
  const message = requests.find((entry) => entry.pathname.endsWith("/message"));
  assert.deepEqual(message.body.model, { providerID: "opencode-go", modelID: "deepseek-v4-flash" });
  assert.equal(message.body.variant, "high");
  assert.equal(message.directory, root);
  assert.equal(requests.filter((entry) => entry.method === "DELETE").length, 2);
  assert.ok(!output.includes("fixture-secret"));
  console.log("scale-opencode-responses-shim: ok");
} finally {
  child.kill("SIGTERM");
  await new Promise((done) => child.once("close", done));
  await new Promise((done) => upstream.close(done));
}
