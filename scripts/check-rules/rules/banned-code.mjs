import { lineAt } from "../load-files.mjs";

/**
 * Type lies (`01` section 5) and raw colours (`01` section 2: styling through tokens in index.css).
 * Scanned on `bare`: comments and string bodies blanked.
 */
const PATTERNS = [
  { re: /:\s*any\b|<any[,>\s]|\bas\s+any\b|\bany\[\]|\(any\)/g, message: "`any` is forbidden; narrow from `unknown`" },
  { re: /@ts-ignore|@ts-nocheck/g, message: "type-checker suppressions are forbidden" },
  { re: /\bas\s+unknown\s+as\b/g, message: "a double assertion is a type lie" },
];

const HEX_COLOR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

export const bannedCode = {
  id: "banned-code",
  check(files) {
    const findings = [];
    for (const file of files) {
      if (!/\.(ts|tsx|cts)$/.test(file.rel)) continue;
      for (const { re, message } of PATTERNS) {
        for (const match of file.bare.matchAll(re)) {
          findings.push({ file: file.rel, line: lineAt(file.bare, match.index), message });
        }
      }
      // Suppression comments live in comments, which `bare` blanks; look for them in the raw text.
      for (const match of file.text.matchAll(/@ts-ignore|@ts-nocheck/g)) {
        findings.push({
          file: file.rel,
          line: lineAt(file.text, match.index),
          message: "type-checker suppressions are forbidden",
        });
      }
      // Colours are tokens in index.css; a component never writes a hex literal.
      if (file.program === "frontend" && !file.isTest) {
        for (const match of file.code.matchAll(HEX_COLOR)) {
          findings.push({
            file: file.rel,
            line: lineAt(file.code, match.index),
            message: `raw colour ${match[0]}; use a design token`,
          });
        }
      }
    }
    return dedupe(findings);
  },
};

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.file}:${finding.line}:${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
