#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "library", "model-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const bindings = new Map(registry.agent_bindings.map((entry) => [entry.profile, entry.primary]));
const profileDirs = [path.join(root, ".codex", "agents"), path.join(root, "library", "agents")];
let updated = 0;

for (const directory of profileDirs) {
  if (!fs.existsSync(directory)) continue;
  for (const entry of fs.readdirSync(directory).filter((name) => name.endsWith(".toml")).sort()) {
    const profilePath = path.join(directory, entry);
    let source = fs.readFileSync(profilePath, "utf8");
    const name = source.match(/^name = "([^"]+)"$/m)?.[1];
    const binding = bindings.get(name);
    if (!binding) throw new Error(`No registry binding for ${name} (${profilePath})`);

    source = source
      .replace(/^model = "[^"]+"$/m, `model = "${binding.model}"`)
      .replace(/^model_reasoning_effort = "[^"]+"$/m, `model_reasoning_effort = "${binding.reasoning_effort}"`);

    const identity = `Your first assistant message in every spawned task must begin exactly with: [SCALE agent=${name} model=${binding.model} reasoning=${binding.reasoning_effort}]. This is the active SCALE role, model, and reasoning contract; never claim an inherited or fallback identity unless the runtime actually selected it.`;
    const identityPattern = /^Your first assistant message in every spawned task must begin exactly with: \[SCALE agent=.*$/m;
    if (identityPattern.test(source)) {
      source = source.replace(identityPattern, identity);
    } else {
      source = source.replace('developer_instructions = """\n', `developer_instructions = """\n${identity}\n\n`);
    }

    fs.writeFileSync(profilePath, source);
    updated += 1;
  }
}

console.log(`Synchronized ${updated} SCALE agent profiles from the registry.`);
