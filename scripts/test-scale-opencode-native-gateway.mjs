#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const upstream = createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk); const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  response.statusCode = 200; response.setHeader("content-type", "text/event-stream");
  const events = request.url.endsWith("/messages") ? [
    { type: "message_start", message: { id: "msg_test" } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call_anthropic", name: "shell_command", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ cmd: "printf ok" }) } },
    { type: "message_stop" }
  ] : [
    { id: "chatcmpl_test", choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "call_chat", type: "function", function: { name: "shell_command", arguments: JSON.stringify({ cmd: "printf ok" }) } }] } }] },
    { id: "chatcmpl_test", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }
  ];
  for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`); response.end("data: [DONE]\n\n");
});
const upstreamPort = await listen(upstream); const gatewayPort = upstreamPort + 1;
const child = spawn(process.execPath, [join(repo, "scripts", "scale-opencode-native-gateway.mjs")], { env: { ...process.env, OPENCODE_GO_API_KEY: "fixture", SCALE_OPENCODE_GATEWAY_PORT: String(gatewayPort), SCALE_OPENCODE_GO_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`, SCALE_OPENCODE_ALLOW_INSECURE_TEST: "1" }, stdio: ["ignore", "pipe", "pipe"] });
const waitHealth = async () => { for (let i = 0; i < 30; i++) { try { const response = await fetch(`http://127.0.0.1:${gatewayPort}/healthz`); if (response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("gateway did not start"); };
try {
  await waitHealth();
  const models = await (await fetch(`http://127.0.0.1:${gatewayPort}/v1/models`)).json(); assert.equal(models.data.length, 18);
  const request = { model: "opencode-go/deepseek-v4-flash", instructions: "Use tools", input: "run it", stream: true, tools: [{ type: "function", name: "shell_command", parameters: { type: "object", properties: { cmd: { type: "string" } } } }] };
  const response = await fetch(`http://127.0.0.1:${gatewayPort}/v1/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) }); const text = await response.text(); assert.equal(response.status, 200); assert.match(text, /response\.function_call_arguments\.done/); assert.match(text, /printf ok/);
  const anthropic = await fetch(`http://127.0.0.1:${gatewayPort}/v1/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...request, model: "opencode-go/qwen3.7-plus" }) }); const anthropicText = await anthropic.text(); assert.equal(anthropic.status, 200); assert.match(anthropicText, /response\.function_call_arguments\.done/);
  const bad = await fetch(`http://127.0.0.1:${gatewayPort}/v1/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "opencode-go/not-a-model", input: "x" }) }); assert.equal(bad.status, 400);
  console.log("SCALE native gateway fixture: PASS (catalog, chat tools, Anthropic tools, rejection)");
} finally { child.kill("SIGTERM"); await once(child, "exit").catch(() => undefined); upstream.close(); }
