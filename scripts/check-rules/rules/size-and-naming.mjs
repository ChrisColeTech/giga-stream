import { isFamilyFile } from "../family-files.mjs";

const COLUMNS = 120;
const SOURCE_CEILING = 200;
const TEST_CEILING = 250;
const GRAB_BAG = /(^|[-_.])(utils?|helpers?|misc|common)([-_.]|$)/i;

/** Lines wrapped at 120 columns: the sum over lines of max(1, ceil(length / 120)). */
export function measure(text) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.trimEnd().length / COLUMNS)), 0);
}

function stemOf(rel) {
  const base = rel.split("/").at(-1) ?? "";
  return base.replace(/\.(test\.)?(tsx|ts|cts|mjs)$/, "");
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const HOOK = /^use[A-Z][A-Za-z0-9]*$/;

function nameProblem(file) {
  const stem = stemOf(file.rel);
  const inFrontendComponents = /^src\/frontend\/src\/(components|pages)\//.test(file.rel);
  const inHooks = file.rel.startsWith("src/frontend/src/hooks/");
  if (file.rel.endsWith(".tsx") && inFrontendComponents) {
    return PASCAL.test(stem) ? null : "a component file is PascalCase.tsx";
  }
  if (inHooks) return HOOK.test(stem) ? null : "a hook file is useThing.ts";
  return KEBAB.test(stem) ? null : "source files are kebab-case";
}

export const sizeAndNaming = {
  id: "size-and-naming",
  check(files) {
    const findings = [];
    for (const file of files) {
      const lines = measure(file.text);
      const ceiling = file.isTest ? TEST_CEILING : SOURCE_CEILING;
      if (lines > ceiling && !isFamilyFile(file.rel)) {
        findings.push({ file: file.rel, message: `${lines} measured lines exceeds the ${ceiling}-line ceiling` });
      }
      const problem = nameProblem(file);
      if (problem) findings.push({ file: file.rel, message: problem });
      for (const segment of file.rel.split("/")) {
        if (GRAB_BAG.test(segment.replace(/\.(test\.)?(tsx|ts|cts|mjs)$/, ""))) {
          findings.push({ file: file.rel, message: `"${segment}" is a grab-bag name; name the concern` });
        }
      }
    }
    return findings;
  },
};
