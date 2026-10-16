import { loadFiles } from "./load-files.mjs";
import { RULES } from "./rule-list.mjs";

/**
 * Run every rule (or those whose id contains `only`) over the repository at `root`.
 * `skip` names programs not yet cleaned up; a skip is a recorded, temporary exception, never a
 * quiet default (see `scripts/check/gate.mjs`).
 */
export function runChecks({ root, skip = [], only = "" }) {
  const files = loadFiles(root, skip);
  const findings = [];
  for (const rule of RULES) {
    if (only && !rule.id.includes(only)) continue;
    for (const finding of rule.check(files, { root, skip })) findings.push({ rule: rule.id, ...finding });
  }
  return { checked: files.length, findings };
}

export function formatFindings({ checked, findings }) {
  const lines = findings.map((finding) => {
    const where = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    return `[${finding.rule}] ${where}  ${finding.message}`;
  });
  lines.push(
    findings.length === 0
      ? `check-rules: ${checked} files, no violations`
      : `check-rules: ${checked} files, ${findings.length} violation${findings.length === 1 ? "" : "s"}`,
  );
  return lines.join("\n");
}
