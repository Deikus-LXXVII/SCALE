#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const index = args.indexOf("--codex-home");
const codexHome = path.resolve(index === -1 ? path.join(os.homedir(), ".codex") : args[index + 1]);
const configPath = path.join(codexHome, "config.toml");
if (!fs.existsSync(configPath)) throw new Error(`Missing Codex config: ${configPath}`);
const original = fs.readFileSync(configPath, "utf8");
const recovered = original
  .split(/\r?\n/)
  .filter((line) => !/^\s*openai_base_url\s*=\s*["']http:\/\/(?:127\.0\.0\.1|localhost):\d+\/?(?:v1)?["']\s*$/.test(line))
  .join("\n");
if (recovered === original) {
  console.log(JSON.stringify({ ok: true, changed: false, config_path: configPath }));
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
const backup = path.join(codexHome, `config.before-scale-recovery-${stamp}.toml`);
fs.copyFileSync(configPath, backup);
const temporary = `${configPath}.tmp-${process.pid}`;
fs.writeFileSync(temporary, recovered);
fs.renameSync(temporary, configPath);
console.log(JSON.stringify({ ok: true, changed: true, config_path: configPath, backup }));
