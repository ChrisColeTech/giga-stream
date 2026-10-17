import { isFamilyFile } from "../family-files.mjs";
import { lineAt } from "../load-files.mjs";

/**
 * One exported React component per file, named for the file; named exports only; one Zustand store
 * (`01` sections 4.1 and 5).
 */
const COMPONENT_EXPORT = /\bexport\s+(?:function|const)\s+([A-Z][A-Za-z0-9]*)\b/g;
const CREATE_STORE = /\bcreate\s*(?:<[^>]*>)?\s*\(\s*\)?\s*\(/g;

function stem(rel) {
  return (rel.split("/").at(-1) ?? "").replace(/\.tsx$/, "");
}

export const frontendStructure = {
  id: "frontend-structure",
  check(files) {
    const findings = [];
    let stores = 0;
    for (const file of files) {
      if (file.program !== "frontend") continue;

      const componentFile = file.rel.endsWith(".tsx") && /^src\/frontend\/src\/(components|pages)\//.test(file.rel);
      if (componentFile && !file.isTest && !isFamilyFile(file.rel)) {
        const exported = [...file.bare.matchAll(COMPONENT_EXPORT)].map((match) => match[1]);
        if (exported.length > 1) {
          findings.push({ file: file.rel, message: `exports ${exported.length} components; one per file` });
        }
        if (exported.length === 1 && exported[0] !== stem(file.rel)) {
          findings.push({ file: file.rel, message: `exports ${exported[0]}, but the file is named ${stem(file.rel)}` });
        }
        if (exported.length === 0) {
          findings.push({ file: file.rel, message: "a component file exports its component by name" });
        }
      }

      if (!file.isTest) {
        for (const match of file.bare.matchAll(/\bexport\s+default\b/g)) {
          findings.push({
            file: file.rel,
            line: lineAt(file.bare, match.index),
            message: "named exports only (01 section 5)",
          });
        }
      }

      if (file.rel.startsWith("src/frontend/src/store/") && !file.isTest) {
        stores += [...file.bare.matchAll(CREATE_STORE)].length;
      }
    }
    if (stores > 1) {
      findings.push({ file: "src/frontend/src/store", message: `${stores} Zustand stores; there is exactly one` });
    }
    return findings;
  },
};
