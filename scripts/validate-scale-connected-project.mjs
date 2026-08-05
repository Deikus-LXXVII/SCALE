#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) throw new Error(`Missing ${name}`);
  return path.resolve(args[index + 1]);
};
const project = option("--project");
const bindingsPath = option("--bindings");
const bindings = JSON.parse(fs.readFileSync(bindingsPath, "utf8"));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const agentsDir = path.join(project, ".codex", "agents");
const clone = path.join(project, ".codex", "scale-library-src");

requireValue(fs.existsSync(path.join(clone, "library", "model-registry.json")), "connected SCALE library is missing");
requireValue(fs.lstatSync(path.join(project, ".codex", "scale-library")).isSymbolicLink(), "scale-library must be a symlink");

for (const [name, binding] of Object.entries(bindings.profiles ?? {})) {
  const profilePath = path.join(agentsDir, `${name}.toml`);
  requireValue(fs.existsSync(profilePath), `missing project profile ${name}`);
  if (!fs.existsSync(profilePath)) continue;
  requireValue(!fs.lstatSync(profilePath).isSymbolicLink(), `${name} must remain project-owned, not managed symlink`);
  const source = fs.readFileSync(profilePath, "utf8");
  requireValue(source.includes(`model = "${binding.model}"`), `${name} model mismatch`);
  requireValue(source.includes(`model_reasoning_effort = "${binding.reasoning_effort}"`), `${name} reasoning mismatch`);
  requireValue(/^sandbox_mode = "(?:read-only|workspace-write)"$/m.test(source), `${name} sandbox missing`);
  const identity = `[SCALE agent=${name} model=${binding.model} reasoning=${binding.reasoning_effort}]`;
  requireValue(source.includes(`first assistant message in every spawned task must begin exactly with: ${identity}.`), `${name} identity mismatch`);
}

const canonicalCount = fs.readdirSync(path.join(clone, ".codex", "agents")).filter((name) => name.startsWith("scale_") && name.endsWith(".toml")).length;
const managed = fs.readdirSync(agentsDir).filter((name) => name.startsWith("scale_") && name.endsWith(".toml") && fs.lstatSync(path.join(agentsDir, name)).isSymbolicLink());
requireValue(managed.length === canonicalCount, `expected ${canonicalCount} managed global agents; found ${managed.length}`);
for (const entry of managed) requireValue(fs.existsSync(path.join(agentsDir, entry)), `broken managed agent link ${entry}`);

for (const retired of [path.join(project, ".hermes"), path.join(agentsDir, "scale_opencode_native.toml")]) {
  requireValue(!fs.existsSync(retired) && !fs.existsSync(retired), `retired path remains: ${retired}`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`S.C.A.L.E. project: ${failure}`));
  process.exit(1);
}
console.log(`Validated connected SCALE project: ${canonicalCount} managed agents and ${Object.keys(bindings.profiles ?? {}).length} project profiles.`);
