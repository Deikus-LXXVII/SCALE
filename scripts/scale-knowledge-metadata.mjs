#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
};
const libraryRoot = path.resolve(option("--library-root", path.join(repoRoot, "library")));
const validatedOn = option("--validated-on", "2026-08-04");
const reviewAfter = option("--review-after", "2026-11-02");
const write = args.includes("--write");

const files = [];
for (const directory of ["rules", "books", "agents"]) {
  const absolute = path.join(libraryRoot, directory);
  for (const entry of fs.readdirSync(absolute).filter((name) => name.endsWith(".md") && name !== "README.md").sort()) files.push(path.join(absolute, entry));
}

let changed = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.startsWith("---\n")) throw new Error(`Missing YAML frontmatter: ${file}`);
  const end = source.indexOf("\n---", 4);
  if (end === -1) throw new Error(`Unclosed YAML frontmatter: ${file}`);
  const frontmatter = source.slice(4, end);
  if (/^provenance:\s*$/m.test(frontmatter)) continue;
  if (!/^tags:\s*\[[^\n]*\]\s*$/m.test(frontmatter)) throw new Error(`Missing single-line tags in frontmatter: ${file}`);
  const metadata = [
    "status: curated",
    "provenance:",
    '  source: "canonical SCALE Git history"',
    '  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."',
    '  compatibility: "SCALE >= 0.1.4"',
    `  validated_on: "${validatedOn}"`,
    `  review_after: "${reviewAfter}"`
  ].join("\n");
  const updated = `${source.slice(0, end)}\n${metadata}${source.slice(end)}`;
  if (write) fs.writeFileSync(file, updated);
  changed += 1;
}

console.log(`${write ? "Updated" : "Would update"} ${changed} library knowledge entr${changed === 1 ? "y" : "ies"}.`);
