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
  const state = { channels: initial, revision: 1, down: false, stalled: false, gate: undefined as Promise<void> | undefined };

  const fetcher = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, headers: new Headers(init?.headers), credentials: init?.credentials });
    if (state.gate !== undefined) await state.gate;
    if (state.stalled) {
      // Never answers; only the caller's abort ends it.
      await new Promise<never>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
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
  }) as typeof fetch;

  return {
    fetch: fetcher,
    calls,
    /** Publish a new list (the backend's revision moves with it). */
    publish(channels: FakeChannel[]): void {
      state.channels = channels;
      state.revision += 1;
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
    channelCalls: (): FakeCall[] => calls.filter((call) => call.url.endsWith("/api/channels")),
  };
}

export type FakeBackend = ReturnType<typeof fakeBackend>;
