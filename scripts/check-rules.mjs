#!/usr/bin/env node
// The executable copy of docs/01's rules and bans. A rule changes in 01 first and here in the same
// change. Usage: node scripts/check-rules.mjs [--summary] [--skip frontend] [--rule <text>]
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatFindings, runChecks } from "./check-rules/run-checks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueOf = (flag) => {
  const at = args.indexOf(flag);
  return at === -1 ? "" : (args[at + 1] ?? "");
};

const result = runChecks({
  root,
  skip: valueOf("--skip").split(",").filter(Boolean),
  only: valueOf("--rule"),
});

if (args.includes("--summary")) {
  const counts = new Map();
  for (const finding of result.findings) counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
  for (const [rule, count] of counts) console.log(`${String(count).padStart(5)}  ${rule}`);
  console.log(formatFindings({ checked: result.checked, findings: [] }).replace("no violations", `${result.findings.length} violations`));
} else {
  console.log(formatFindings(result));
}
process.exit(result.findings.length === 0 ? 0 : 1);
