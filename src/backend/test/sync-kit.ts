// Shared pieces of the sync step tests (docs/43 section 7): a scriptable fake guarded fetch (status, headers, body,
// failure, a gate that holds a request until released or aborted), image bytes, and an app with a file playlist whose
// job the test runs by hand. No network, no sleeping: a run is awaited by its job's `lastRunAt` moving.
import { SafeFetchError, type SafeFetch, type SafeFetchCode } from "../src/services/safe-fetch.js";
import { uploadFile, until } from "./playlist-kit.js";
import { itemsOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

export interface Reply {
  status?: number;
  headers?: Record<string, string>;
  body?: Buffer | string;
  fail?: SafeFetchCode;
}

export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("png-body-one")]);
export const PNG_TWO = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("png-body-two")]);
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("jpeg-body")]);
export const GIF = Buffer.from("GIF89a-gif-body");
export const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 ")]);
export const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
export const image = (body: Buffer, type = "image/png"): Reply => ({ headers: { "content-type": type }, body });
export const MANIFEST: Reply = { body: "#EXTM3U\n#EXT-X-VERSION:3\n" };

/** A scriptable guarded fetch: replies by exact address (404 when none is set), a log, optional gates and a hook. */
export function fakeNet() {
  const replies = new Map<string, Reply>();
  const gates = new Map<string, { wait: Promise<void>; started: () => void }>();
  const log: string[] = [];
  let aborted = 0;
  let hook: ((url: string) => void) | undefined;
  const safeFetch: SafeFetch = async (url, options) => {
    log.push(url);
    hook?.(url);
    const gate = gates.get(url);
    if (gate) {
      gate.started();
      await Promise.race([
        gate.wait,
        new Promise<void>((_, reject) => {
          const abort = (): void => { aborted += 1; reject(new SafeFetchError("safe_fetch.aborted", new URL(url).host)); };
          if (options.signal?.aborted) abort();
          else options.signal?.addEventListener("abort", abort, { once: true });
        }),
      ]);
    }
    const reply = replies.get(url) ?? { status: 404 };
    if (reply.fail) throw new SafeFetchError(reply.fail, new URL(url).host);
    const body = Buffer.from(reply.body ?? "");
    if (options.maxBytes !== undefined && body.length > options.maxBytes) throw new SafeFetchError("safe_fetch.too_large", new URL(url).host);
    const cut = options.prefixBytes !== undefined && body.length > options.prefixBytes;
    return {
      status: reply.status ?? 200,
      headers: reply.headers ?? {},
      body: cut ? body.subarray(0, options.prefixBytes) : body,
      url,
      truncated: cut,
    };
  };
  return {
    safeFetch,
    log,
    set: (url: string, reply: Reply): void => void replies.set(url, reply),
    aborts: (): number => aborted,
    onRequest: (fn: ((url: string) => void) | undefined): void => void (hook = fn),
    hold(url: string) {
      let started!: () => void;
      let release!: () => void;
      const startedPromise = new Promise<void>((resolve) => (started = resolve));
      gates.set(url, { wait: new Promise<void>((resolve) => (release = resolve)), started });
      return { started: startedPromise, release: () => { gates.delete(url); release(); } };
    },
    /** The requests so far that start with `prefix`. */
    asked: (prefix: string): string[] => log.filter((url) => url.startsWith(prefix)),
  };
}

export type Net = ReturnType<typeof fakeNet>;
export const STREAM = (host: string, name: string): string => `https://${host}/${name}.m3u8`;
export const LOGO = (name: string): string => `https://img.example/${name}.png`;

/** One M3U entry: its name, stream address and, optionally, its own logo address. */
export const m3uEntry = (name: string, stream: string, logo?: string): string =>
  `#EXTINF:-1 ${logo === undefined ? "" : `tvg-logo="${logo}" `}group-title="News",${name}\n${stream}`;
export const m3u = (...entries: string[]): string => ["#EXTM3U", ...entries].join("\n");

/** An app on the fake net with one uploaded file playlist (`list.m3u`) and helpers to run its job and read channels. */
export async function setupSync(net: Net, entries: string[]) {
  const t: TestApp = await makeApp({ safeFetch: net.safeFetch });
  let token = (await signIn(t.app)).access;
  const api = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => send(t.app, method, url, body, token);
  await uploadFile(t, token, "list.m3u", m3u(...entries));
  const jobs = async (): Promise<Array<Record<string, unknown>>> =>
    pick((await api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>;
  const job = async (): Promise<Record<string, unknown>> => (await jobs()).find((j) => j.type === "playlist") ?? {};
  const channels = async () => itemsOf((await api("GET", "/api/admin-channels")).body);
  const revision = async (): Promise<number> => Number(pick((await send(t.app, "GET", "/healthz")).body, "data.revision"));
  /** Starts the job and waits for it to settle; the session is renewed first, as the clock moves past its lifetime. */
  async function run(advanceMs = 1000): Promise<Record<string, unknown>> {
    t.clock.advance(advanceMs);
    token = (await signIn(t.app)).access;
    const before = (await job()).lastRunAt;
    const id = Number((await job()).id);
    const started = await api("POST", `/api/jobs/${id}/run`);
    if (started.status !== 202) throw new Error(`run refused: ${started.status}`);
    await until(async () => (await job()).lastRunAt !== before && (await job()).running === false, "the run");
    return job();
  }
  return { t, api, job, channels, revision, run, net, id: async (): Promise<number> => Number((await job()).id) };
}

export type Sync = Awaited<ReturnType<typeof setupSync>>;
