#!/usr/bin/env node
const baseUrl = process.env.SCALE_OPENCODEX_URL ?? "http://127.0.0.1:10100/v1";
const model = process.env.SCALE_OPENCODEX_TOOL_MODEL ?? "opencode-go/deepseek-v4-flash";

const post = async (body) => {
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload;
};

const first = await post({
  model,
  input: "Call report_result exactly once with value TOOL_OK. Do not answer in text.",
  max_output_tokens: 128,
  tools: [{ type: "function", name: "report_result", description: "Report the smoke-test value.", parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false } }]
});
const call = first.output?.find((item) => item.type === "function_call" && item.name === "report_result");
if (!call) throw new Error(`No function_call in first response: ${JSON.stringify(first.output).slice(0, 800)}`);
const parsed = JSON.parse(call.arguments);
if (parsed.value !== "TOOL_OK") throw new Error(`Unexpected tool arguments: ${call.arguments}`);

const second = await post({
  model,
  previous_response_id: first.id,
  input: [{ type: "function_call_output", call_id: call.call_id, output: "accepted" }],
  max_output_tokens: 64
});
const continuation = second.status === "completed" && (second.output ?? []).length > 0;
if (!continuation) throw new Error(`No completed continuation after tool output: ${JSON.stringify(second).slice(0, 1000)}`);

const custom = await post({
  model,
  input: "Use apply_patch once with a patch that adds the line TOOL_OK to demo.txt. Do not answer in text.",
  max_output_tokens: 1024,
  tools: [{ type: "custom", name: "apply_patch", description: "Emit a unified patch." }]
});
const customCall = custom.output?.find((item) => item.type === "custom_tool_call" && item.name === "apply_patch");
if (!customCall || !String(customCall.input ?? "").includes("TOOL_OK")) throw new Error(`No valid custom apply_patch call: ${JSON.stringify(custom.output).slice(0, 1000)}`);

console.log(JSON.stringify({ ok: true, model, function_call: true, function_continuation: true, custom_apply_patch_call: true }));
