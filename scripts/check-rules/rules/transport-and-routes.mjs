import { lineAt } from "../load-files.mjs";

/** `01` §4.4: one request layer, one renderer socket, no browser storage, no SQL outside store/. */

const ROUTE_LITERAL = /\bapp\.(get|post|patch|put|delete|head)\(\s*["'`]([^"'`]+)["'`]/g;
const ROOT_ALLOWED = new Set(["/healthz", "/ws"]);

const SQL = /\b(SELECT\s[\s\S]{1,200}?\sFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE)\b/;

/**
 * The live stream addresses, which players load directly (`01` section 4.3): only in the one file of each
 * program that serves them (the live server's media file, and the merged backend's `live-streams.ts`). There
 * `/live` and `/logos` are encapsulated plugins registered with a `prefix`, so their routes are relative; the
 * prefix is what must be one of the two.
 */
const STREAM_ROUTE_FILES = new Set(["src/live-server/src/api/media.ts", "src/backend/src/api/live-streams.ts"]);
const STREAM_ROUTE = /^\/(live|logos)\/|^\/test\/player\.html$/;
const STREAM_PREFIX = /^\/(live|logos)$/;
/** The built admin app at `/admin/` (docs/26 section 4.1): only in the backend's one static-serving file. */
const ADMIN_ROUTE_FILE = "src/backend/src/api/admin-static.ts";
const ADMIN_ROUTE = /^\/admin(\/|$)/;
const PREFIX_LITERAL = /\bprefix:\s*["'`]([^"'`]+)["'`]/g;

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
          const streamRoute = STREAM_ROUTE_FILES.has(file.rel) && STREAM_ROUTE.test(url);
          const adminRoute = file.rel === ADMIN_ROUTE_FILE && ADMIN_ROUTE.test(url);
          if (!url.startsWith("/api/") && !ROOT_ALLOWED.has(url) && !streamRoute && !adminRoute) {
            push(m.index, file.code, `route ${url} must begin /api (only /healthz and /ws are root-level)`);
          }
        }
        // An encapsulated plugin's prefix is where its routes really begin.
        for (const m of file.code.matchAll(PREFIX_LITERAL)) {
          const prefix = m[1];
          const streamPrefix = STREAM_ROUTE_FILES.has(file.rel) && STREAM_PREFIX.test(prefix);
          if (!prefix.startsWith("/api") && !streamPrefix) {
            push(m.index, file.code, `plugin prefix ${prefix} must begin /api (only the live stream plugins are root-level)`);
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
