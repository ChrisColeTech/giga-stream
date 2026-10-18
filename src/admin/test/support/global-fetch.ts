import { scripted, type Call, type Handler } from "./fake-backend";

/** Runs `body` with the global fetch replaced by a scripted backend, then puts the real one back. The admin's one request
 *  layer (`services/api.ts`) reads the global at each call, so a real service module can be driven end to end with the
 *  tokens a signed-in test store holds. */
export async function withBackend(handler: Handler, body: (calls: Call[]) => Promise<void>): Promise<void> {
  const real = globalThis.fetch;
  const backend = scripted(handler);
  globalThis.fetch = (input, init) => backend.fetch(String(input), init);
  try {
    await body(backend.calls);
  } finally {
    globalThis.fetch = real;
  }
}
