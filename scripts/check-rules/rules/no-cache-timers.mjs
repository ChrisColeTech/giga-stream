import { lineAt } from "../load-files.mjs";

/**
 * `01` section 4.4 and `46`: the fileserver's backend cache has no timer. Staleness is checked at launch and
 * when a page reads, never on a schedule. The one allowed clock is `AbortSignal.timeout`, a request deadline
 * (it is a different name, so it never matches). Files that already used a timer for another reason are listed
 * here by exact path; today none do.
 */
const GUARDED = /^src\/fileserver\/src\/(services|store|routes|lib)\//;
const TIMER = /\b(setInterval|setTimeout|setImmediate)\b/g;
const ALLOWED_FILES = new Set([]);

export const noCacheTimers = {
  id: "no-cache-timers",
  check(files) {
    const findings = [];
    for (const file of files) {
      if (file.isTest || !GUARDED.test(file.rel) || ALLOWED_FILES.has(file.rel)) continue;
      for (const match of file.bare.matchAll(TIMER)) {
        findings.push({
          file: file.rel,
          line: lineAt(file.bare, match.index),
          message: `${match[1]} is a timer; the backend cache is checked on launch and on reads (docs/46)`,
        });
      }
    }
    return findings;
  },
};
