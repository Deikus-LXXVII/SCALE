#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) throw new Error(`Missing ${name}`);
  return path.resolve(args[index + 1]);
};
const agentsDir = option("--agents-dir");
const bindingsPath = option("--bindings");
const bindings = JSON.parse(fs.readFileSync(bindingsPath, "utf8"));
let updated = 0;

for (const [name, binding] of Object.entries(bindings.profiles ?? {})) {
  const profilePath = path.join(agentsDir, `${name}.toml`);
  if (!fs.existsSync(profilePath)) throw new Error(`Missing project agent ${profilePath}`);
  const endpoint = binding.model.startsWith("opencode-go/") ? bindings.fallbacks?.[name] : binding;
  if (!endpoint?.model || !endpoint?.reasoning_effort) throw new Error(`Missing native endpoint for project profile ${name}`);
  let source = fs.readFileSync(profilePath, "utf8")
    .replace(/^model = "[^"]+"$/m, `model = "${endpoint.model}"`)
    .replace(/^model_reasoning_effort = "[^"]+"$/m, `model_reasoning_effort = "${endpoint.reasoning_effort}"`);
  const identity = `Your first assistant message in every spawned task must begin exactly with: [SCALE agent=${name} model=${endpoint.model} reasoning=${endpoint.reasoning_effort}]. This is the active SCALE role, model, and reasoning contract; report a runtime mismatch instead of claiming this identity.`;
  const pattern = /^Your first assistant message in every spawned task must begin exactly with: \[SCALE agent=.*$/m;
  source = pattern.test(source)
    ? source.replace(pattern, identity)
    : source.replace('developer_instructions = """\n', `developer_instructions = """\n${identity}\n\n`);
  fs.writeFileSync(profilePath, source);
  updated += 1;
}

console.log(`Synchronized ${updated} project SCALE profiles.`);
