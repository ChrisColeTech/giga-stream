import { lineAt } from "../load-files.mjs";

/** `01` §4.4: one request layer, one renderer socket, no browser storage, no SQL outside store/. */

const ROUTE_LITERAL = /\bapp\.(get|post|patch|put|delete|head)\(\s*["'`]([^"'`]+)["'`]/g;
const ROOT_ALLOWED = new Set(["/healthz", "/ws"]);

const SQL = /\b(SELECT\s[\s\S]{1,200}?\sFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE)\b/;

/** The live server's stream addresses, which players load directly (`01` section 4.3): only in its media file. */
const STREAM_ROUTE_FILE = "src/live-server/src/api/media.ts";
const STREAM_ROUTE = /^\/(live|logos)\/|^\/test\/player\.html$/;

function inRouteFolder(rel) {
  return /^src\/fileserver\/src\/routes\//.test(rel) || /^src\/(backend|live-server)\/src\/api\//.test(rel);
}

export const transportAndRoutes = {
  id: "transport-and-routes",
  check(files) {
    const findings = [];
    for (const file of files) {
      const push = (offset, source, message) =>
        findings.push({ file: file.rel, line: lineAt(source, offset), message });

      if (file.program === "frontend" && !file.isTest) {
        for (const m of file.bare.matchAll(/\bfetch\s*\(/g)) {
          if (!file.rel.startsWith("src/frontend/src/services/")) push(m.index, file.bare, "fetch belongs in services/");
        }
        for (const m of file.bare.matchAll(/\bnew\s+(WebSocket|EventSource)\b/g)) {
          if (file.rel !== "src/frontend/src/services/events.ts") {
            push(m.index, file.bare, `${m[1]} may be constructed only in services/events.ts`);
          }
        }
        for (const m of file.bare.matchAll(/\b(localStorage|sessionStorage|indexedDB)\b/g)) {
          push(m.index, file.bare, "the renderer persists nothing to browser storage");
        }
      }

      if (inRouteFolder(file.rel) && !file.isTest) {
        for (const m of file.code.matchAll(ROUTE_LITERAL)) {
          const url = m[2];
          const streamRoute = file.rel === STREAM_ROUTE_FILE && STREAM_ROUTE.test(url);
          if (!url.startsWith("/api/") && !ROOT_ALLOWED.has(url) && !streamRoute) {
            push(m.index, file.code, `route ${url} must begin /api (only /healthz and /ws are root-level)`);
          }
        }
      }

      if (file.program !== "scripts" && !file.isTest && !/\/store\//.test(file.rel)) {
        const match = SQL.exec(file.code);
        if (match) push(match.index, file.code, "SQL belongs under a store/ folder");
      }
    }
    return findings;
  },
};
