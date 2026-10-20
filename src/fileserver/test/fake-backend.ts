import { createServer, type Server } from "node:http";

import type { Client } from "@libsql/client";

import { attachAdminDatabase, controlledDatabase, makeAdminDatabase } from "./admin-database.js";

/** A scripted stand-in for the admin backend's public channels: an injected `fetch` that logs every call. */
export interface FakeChannel {
  id: string;
  name: string;
  category?: string;
  number?: string;
  logoUrl?: string;
  cachedLogoUrl?: string;
  streamUrl?: string;
}

export interface FakeCall {
  url: string;
  headers: Headers;
  credentials: RequestCredentials | undefined;
}

export const FAKE_ADMIN_URL = "http://127.0.0.1:4747";

export function streamOf(id: string): string {
  return `http://streams.example.test/${id}/master.m3u8`;
}

export function fakeBackend(initial: FakeChannel[] = []) {
  const calls: FakeCall[] = [];
  const state = {
    channels: initial, revision: 1, down: false, stalled: false,
    gate: undefined as Promise<void> | undefined,
  };

  let raw: Client;
  let pending = makeAdminDatabase().then(async (database) => {
    raw = database;
    await replaceChannels(database, state.channels, state.revision);
    return database;
  });

  async function before(sql: string): Promise<void> {
    await pending;
    if (!/\bchannels\b|backend_revision/i.test(sql)) return;
    calls.push({ url: `${FAKE_ADMIN_URL}/database/channels`, headers: new Headers(), credentials: undefined });
    if (state.gate !== undefined) await state.gate;
    if (state.down) throw new Error("database unavailable");
    if (state.stalled) await new Promise<never>(() => undefined);
  }

  const fetcher = attachAdminDatabase((async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, headers: new Headers(init?.headers), credentials: init?.credentials });
    if (state.gate !== undefined) await state.gate;
    if (state.stalled) {
      // Never answers; only the caller's abort ends it.
      await new Promise<never>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort", () => reject(new DOMException("aborted", "AbortError")), { once: true },
        );
      });
    }
    if (state.down || !url.endsWith("/api/channels")) throw new TypeError("fetch failed");
    const items = state.channels.map((channel) => ({
      category: "General",
      revision: state.revision,
      streamUrl: streamOf(channel.id),
      ...channel,
    }));
    const body = { ok: true, data: { items, revision: state.revision } };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch, async () => controlledDatabase(await pending, before));

  return {
    fetch: fetcher,
    calls,
    /** Publish a new list (the backend's revision moves with it). */
    publish(channels: FakeChannel[]): void {
      state.channels = channels;
      state.revision += 1;
      pending = pending.then(async () => {
        await replaceChannels(raw, channels, state.revision);
        return raw;
      });
    },
    setDown(down: boolean): void {
      state.down = down;
    },
    setStalled(stalled: boolean): void {
      state.stalled = stalled;
    },
    /** Hold every answer until the returned function is called (a sync is then deterministically in flight). */
    hold(): () => void {
      let release = (): void => undefined;
      state.gate = new Promise<void>((resolve) => {
        release = () => {
          state.gate = undefined;
          resolve();
        };
      });
      return release;
    },
    /** The calls that asked for the channel list. */
    channelCalls: (): FakeCall[] => calls.filter((call) => call.url.endsWith("/database/channels")),
  };
}

async function replaceChannels(database: Client, channels: FakeChannel[], revision: number): Promise<void> {
  const transaction = await database.transaction("write");
  try {
    await transaction.execute("DELETE FROM channels");
    for (const [position, channel] of channels.entries()) {
      await transaction.execute({
        sql: `INSERT INTO channels
          (id, name, category, number, logo_url, logo_file, stream_url, revision, created_at,
            kind, enabled, sync_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stream', 1, NULL)`,
        args: [
          channel.id, channel.name, channel.category ?? "General", channel.number ?? String(position + 1),
          channel.logoUrl ?? null,
          channel.cachedLogoUrl?.startsWith("/logos/c/") ? channel.cachedLogoUrl.slice(9) : null,
          channel.streamUrl ?? streamOf(channel.id), revision, 1,
        ],
      });
    }
    await transaction.execute({ sql: "UPDATE backend_revision SET revision = ? WHERE id = 1", args: [revision] });
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback();
    throw error;
  }
}

export type FakeBackend = ReturnType<typeof fakeBackend>;

/** What one request left at the fake upstream: where it landed and the forwarded-for chain it carried. */
export interface UpstreamHit {
  path: string;
  forwardedFor: string | string[] | undefined;
}

/** A real HTTP stand-in for the admin backend sibling the fileserver's proxy points at: every request
 *  answers the standard envelope naming the path it landed on, and every hit is logged for assertions. */
export interface FakeUpstream {
  url: string;
  seen: UpstreamHit[];
  close(): Promise<void>;
}

/** Starts the fake upstream on an ephemeral loopback port (test/admin-proxy.test.ts closes it). */
export async function startFakeUpstream(): Promise<FakeUpstream> {
  const seen: UpstreamHit[] = [];
  const server: Server = createServer((request, response) => {
    const path = request.url ?? "/";
    seen.push({
      path,
      forwardedFor: Array.isArray(request.headers["x-forwarded-for"])
        ? request.headers["x-forwarded-for"].join(", ")
        : request.headers["x-forwarded-for"],
    });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true, data: { path } }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await closeServer(server);
    throw new Error("the fake upstream got no ephemeral port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    seen,
    close: () => closeServer(server),
  };
}

/** Stops listening and drops the keep-alive sockets the proxy's undici pool leaves idle behind. */
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeIdleConnections();
    server.closeAllConnections();
    server.close(() => resolve());
  });
}
