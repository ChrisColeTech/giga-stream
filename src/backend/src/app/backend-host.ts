import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.js";
import { config } from "../config.js";

/** The backend this window talks to: ours, started in this process, or one already running at the same address. */
export interface BackendHandle {
  /** `http://127.0.0.1:<port>`: where `/admin/` and `/api` answer. */
  readonly origin: string;
  /** True when a backend was already listening and this process only opens a window on it. */
  readonly attached: boolean;
  /** Closes the backend this process started; a no-op for an attached one, which is not ours to stop. */
  close(): Promise<void>;
}

const WILDCARD_HOSTS = new Set(["0.0.0.0", "::", ""]);
const HEALTH_TIMEOUT_MS = 1500;

/** The address the window uses: loopback unless the backend is bound to one specific other address. */
function originOf(): string {
  const host = WILDCARD_HOSTS.has(config.HOST) ? "127.0.0.1" : config.HOST;
  const scheme = config.TLS_CERT_FILE !== "" ? "https" : "http";
  return `${scheme}://${host}:${config.PORT}`;
}

/** Whether the admin backend already answers at the address (its `/healthz` names its role, docs/03 section 7.1). */
async function backendAnswers(origin: string): Promise<boolean> {
  try {
    const reply = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    const body: unknown = await reply.json();
    const data = typeof body === "object" && body !== null && "data" in body ? body.data : null;
    return typeof data === "object" && data !== null && "role" in data && data.role === "admin-backend";
  } catch {
    return false;
  }
}

/**
 * The Electron process IS the backend server with a window (docs/26 section 4.1): it builds the same app `npm start`
 * does and listens on the same port, so quitting the window stops the backend and one shutdown path exists. When a
 * backend already runs there (the owner's `npm run dev`), it attaches instead and stops nothing on quit.
 */
export async function startOrAttach(): Promise<BackendHandle> {
  const origin = originOf();
  if (await backendAnswers(origin)) return { origin, attached: true, close: async () => undefined };
  const server: FastifyInstance = await buildApp();
  await server.listen({ host: config.HOST, port: config.PORT });
  return { origin, attached: false, close: () => server.close() };
}
