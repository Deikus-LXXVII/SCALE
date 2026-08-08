#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "scale-knowledge-shadow-"));
const write = (name, body) => fs.writeFileSync(path.join(fixture, "library", "agents", name), body);
const entry = (description, status, relations = "", evidence = "fixture evidence") => `---\ndescription: "${description}"\ntags: [fixture]\nstatus: ${status}\nprovenance:\n  source: "fixture"\n  evidence: "${evidence}"\n  compatibility: "fixture"\n  validated_on: "2026-08-04"\n  review_after: "2099-01-01"\n${relations}---\n# Fixture\n`;
try {
  fs.mkdirSync(path.join(fixture, "library", "agents"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "library", "rules")); fs.mkdirSync(path.join(fixture, "library", "books"));
  write("curated.md", entry("curated", "curated")); write("candidate.md", entry("candidate", "candidate"));
  const script = path.join(root, "scripts", "scale-knowledge-shadow.mjs");
  const base = JSON.parse(execFileSync(process.execPath, [script, "--library-root", path.join(fixture, "library"), "--tag", "fixture"], { encoding: "utf8" }));
  if (base.selected.length !== 1 || base.statuses.candidate !== 0) throw new Error("default shadow retrieval leaked candidate knowledge");
  const replay = JSON.parse(execFileSync(process.execPath, [script, "--candidate-replay", "--library-root", path.join(fixture, "library"), "--tag", "fixture"], { encoding: "utf8" }));
  if (replay.selected.length !== 2 || replay.statuses.candidate !== 1 || replay.selected.some((item) => "evidence_text" in item)) throw new Error("candidate replay manifest is incomplete or exposes evidence text");
  write("broken.md", entry("broken", "candidate", "conflicts_with: [agents/curated.md]\n", ""));
  write("cycle-a.md", entry("cycle a", "candidate", "supersedes: [agents/cycle-b.md]\nsuperseded_by: [agents/cycle-b.md]\n"));
  write("cycle-b.md", entry("cycle b", "candidate", "supersedes: [agents/cycle-a.md]\nsuperseded_by: [agents/cycle-a.md]\n"));
  let rejected = false;
  let rejection = "";
  try { execFileSync(process.execPath, [path.join(root, "scripts", "validate-scale-knowledge.mjs"), "--library-root", path.join(fixture, "library"), "--as-of", "2026-08-04"], { stdio: "pipe" }); } catch (error) { rejected = true; rejection = error.stderr?.toString() ?? ""; }
  if (!rejected || !rejection.includes("provenance.evidence") || !rejection.includes("conflicts_with") || !rejection.includes("supersession cycle")) throw new Error("knowledge validator missed evidence, reciprocal conflict, or supersession cycle guard");
  console.log("Validated candidate shadow replay, metadata-only manifest, and relation guards.");
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
