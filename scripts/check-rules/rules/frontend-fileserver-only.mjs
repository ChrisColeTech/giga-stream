import { lineAt } from "../load-files.mjs";

const ADMIN_ADDRESS = /(?:127\.0\.0\.1|localhost):(?:3001|8091)|https?:\/\/[^\s"'`]*(?:themoviedb|omdbapi)/gi;
const DIRECT_ADMIN_FETCH = /\bfetch\s*\(\s*adminUrl\b/g;

export const frontendFileserverOnly = {
  id: "frontend-fileserver-only",
  check(files) {
    const findings = [];
    for (const file of files) {
      if (file.program !== "frontend" || file.isTest) continue;
      for (const match of file.code.matchAll(ADMIN_ADDRESS)) {
        findings.push({
          file: file.rel,
          line: lineAt(file.code, match.index),
          message: "the frontend talks only to the fileserver; do not embed an admin or metadata-service address",
        });
      }
      for (const match of file.bare.matchAll(DIRECT_ADMIN_FETCH)) {
        findings.push({
          file: file.rel,
          line: lineAt(file.bare, match.index),
          message: "adminUrl is settings data, never a frontend request target",
        });
      }
    }
    return findings;
  },
};
