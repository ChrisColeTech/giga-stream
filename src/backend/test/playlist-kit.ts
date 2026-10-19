// Shared pieces of the playlist tests (docs/43 section 7): a fake guarded fetch that serves playlists from memory,
// a multipart body builder, and the calls every test makes. Nothing here touches the network.
import { SafeFetchError, type SafeFetch, type SafeFetchCode } from "../src/services/safe-fetch.js";
import { itemsOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn, type Answer, type TestApp } from "./test-app.js";

export const ONE = "https://cdn.example/lists/us.m3u8?token=SECRET-VALUE";
export const TWO = "https://other.example/all.m3u?key=ANOTHER-SECRET";

export const entry = (name: string, address: string, extra = "") =>
  `#EXTINF:-1 ${extra}group-title="News",${name}\nhttps://stream.example/${address}.m3u8`;
export const playlistOf = (...entries: string[]): string => ["#EXTM3U", ...entries].join("\n");
export const M3U = playlistOf(entry("ABC", "abc", 'tvg-id="a" '), entry("ESPN", "espn"));

interface Gate {
  started: Promise<void>;
  release: () => void;
}

/** A fake guarded fetch: serves what the test sets, remembers what it was asked, and can hold an answer. */
export function fakeFeed(initial: Record<string, string> = {}) {
  const bodies = new Map<string, string>(Object.entries(initial));
  const failures = new Map<string, SafeFetchCode>();
  const gates = new Map<string, { wait: Promise<void>; started: () => void }>();
  const asked: string[] = [];
  const everything: string[] = [];
  const safeFetch: SafeFetch = async (url, options) => {
    everything.push(url);
    // `asked` is the playlist addresses the test set up; stream checks and logo-index lookups of the sync only reach `everything`.
    if (bodies.has(url) || failures.has(url) || gates.has(url)) asked.push(url);
    gates.get(url)?.started();
    const gate = gates.get(url);
    if (gate) {
      await Promise.race([
        gate.wait,
        new Promise<void>((_, reject) => options.signal?.addEventListener("abort", () => reject(new SafeFetchError("safe_fetch.aborted")))),
      ]);
    }
    const failure = failures.get(url);
    if (failure) throw new SafeFetchError(failure, new URL(url).host);
    const text = bodies.get(url);
    const body = Buffer.from(text ?? "missing");
    return { status: text === undefined ? 404 : 200, headers: {}, body, url, truncated: false };
  };
  return {
    safeFetch,
    asked,
    everything,
    set: (url: string, text: string): void => void bodies.set(url, text),
    fail: (url: string, code: SafeFetchCode): void => void failures.set(url, code),
    heal: (url: string): void => void failures.delete(url),
    /** Holds the next answers for `url` until `release()`; `started` resolves when a request is waiting. */
    hold(url: string): Gate {
      let started!: () => void;
      let release!: () => void;
      const startedPromise = new Promise<void>((resolve) => (started = resolve));
      const wait = new Promise<void>((resolve) => (release = resolve));
      gates.set(url, { wait, started });
      return { started: startedPromise, release };
    },
  };
}

/** A multipart/form-data body of the given parts, and its content type. */
export function multipartOf(parts: Array<{ name: string; filename?: string; content: string | Buffer }>) {
  const boundary = "----giga-test-boundary";
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = `form-data; name="${part.name}"${part.filename === undefined ? "" : `; filename="${part.filename}"`}`;
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: ${disposition}\r\n\r\n`), Buffer.from(part.content), Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** `POST /api/admin/playlists/import` with these multipart parts. */
export async function uploadParts(
  t: TestApp,
  token: string | undefined,
  parts: Array<{ name: string; filename?: string; content: string | Buffer }>,
): Promise<Answer> {
  const { payload, contentType } = multipartOf(parts);
  const reply = await t.app.inject({
    method: "POST",
    url: "/api/admin/playlists/import",
    headers: { "content-type": contentType, ...(token !== undefined && { authorization: `Bearer ${token}` }) },
    payload,
  });
  const body: unknown = reply.body === "" ? null : JSON.parse(reply.body);
  return { status: reply.statusCode, body, headers: reply.headers, raw: reply.rawPayload };
}

/** One file upload under `fileName`. */
export const uploadFile = (t: TestApp, token: string, fileName: string, content: string | Buffer): Promise<Answer> =>
  uploadParts(t, token, [{ name: "file", filename: fileName, content }]);

/** A test app with a fake feed and a signed-in admin, and the calls the playlist tests share. */
export async function setupPlaylists(options: { feed?: Record<string, string>; config?: Record<string, unknown> } = {}) {
  const feed = fakeFeed(options.feed ?? { [ONE]: M3U, [TWO]: M3U });
  const t = await makeApp({
    safeFetch: feed.safeFetch,
    ...(options.config && { config: options.config }),
  });
  const token = (await signIn(t.app)).access;
  const api = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => send(t.app, method, url, body, token);
  const channels = async () => itemsOf((await send(t.app, "GET", "/api/channels")).body);
  const adminChannels = async () => itemsOf((await api("GET", "/api/admin/channels")).body);
  const revision = async (): Promise<number> => Number(pick((await send(t.app, "GET", "/healthz")).body, "data.revision"));
  const audit = async (limit = 50): Promise<Array<Record<string, unknown>>> =>
    pick((await api("GET", `/api/admin/audit?limit=${limit}`)).body, "data.items") as Array<Record<string, unknown>>;
  const importUrl = (url: string, extra: Record<string, unknown> = {}) => api("POST", "/api/admin/playlists", { url, ...extra });
  return { t, token, feed, api, channels, adminChannels, revision, audit, importUrl };
}

/** Polls until `done`, with real short naps: a started run settles on its own. */
export async function until(done: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 300; i += 1) {
    if (await done()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`timed out waiting for ${what}`);
}
