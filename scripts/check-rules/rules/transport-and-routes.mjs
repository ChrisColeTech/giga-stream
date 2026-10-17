import { lineAt } from "../load-files.mjs";

/** `01` §4.4: one request layer, one renderer socket, no browser storage, no SQL outside store/. */

/** Programs that make requests or hold UI: no storage, WebSocket only in the interface's events file. */
const CLIENTS = ["frontend", "admin", "shared-ui", "shared-http"];
/** Where `fetch` may appear: each app's services/ and the one shared request layer (docs/27 section 4.1). */
const FETCH_HOMES = /^src\/(frontend|admin)\/src\/services\/|^src\/shared\/http\/src\//;

const ROUTE_LITERAL = /\bapp\.(get|post|patch|put|delete|head)\(\s*["'`]([^"'`]+)["'`]/g;
const ROOT_ALLOWED = new Set(["/healthz", "/ws"]);

const SQL = /\b(SELECT\s[\s\S]{1,200}?\sFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE)\b/;

/**
 * The live stream addresses, which players load directly (`01` section 4.3): only in the one file of each
 * program that serves them (the backend's `live-streams.ts`). There `/live` and `/logos` are encapsulated
 * plugins registered with a `prefix`, so their routes are relative; the prefix is what must be one of the two.
 */
const STREAM_ROUTE_FILES = new Set(["src/backend/src/api/live-streams.ts"]);
const STREAM_ROUTE = /^\/(live|logos)\/|^\/test\/player\.html$/;
const STREAM_PREFIX = /^\/(live|logos)$/;
/** The built admin app at `/admin/` (docs/26 section 4.1): only in the backend's one static-serving file. */
const ADMIN_ROUTE_FILE = "src/backend/src/api/admin-static.ts";
const ADMIN_ROUTE = /^\/admin(\/|$)/;
const PREFIX_LITERAL = /\bprefix:\s*["'`]([^"'`]+)["'`]/g;

function inRouteFolder(rel) {
  return /^src\/fileserver\/src\/routes\//.test(rel) || /^src\/backend\/src\/api\//.test(rel);
}

export const transportAndRoutes = {
  id: "transport-and-routes",
  check(files) {
    const findings = [];
    for (const file of files) {
      const push = (offset, source, message) =>
        findings.push({ file: file.rel, line: lineAt(source, offset), message });

      // The clients: the interface, the admin app, the family UI library and the request layer (docs/27 section 4).
      if (CLIENTS.includes(file.program) && !file.isTest) {
        for (const m of file.bare.matchAll(/\bfetch\s*\(/g)) {
          if (!FETCH_HOMES.test(file.rel)) push(m.index, file.bare, "fetch belongs in services/ or the shared request layer");
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
