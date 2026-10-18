// A minimal event-stream client for the progress stream tests (docs/44 section 3.3): a real socket to a listening app.
import http from "node:http";

import { until } from "./playlist-kit.js";

export interface Frame {
  event: string;
  data: unknown;
}

/** `event:`/`data:` frames out of the text received so far; a half-received frame is left for the next read. */
export function parseFrames(text: string): Frame[] {
  return text.split("\n\n").slice(0, -1).map((block) => {
    const lines = block.split("\n");
    const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "";
    const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
    return { event, data: data === undefined ? undefined : (JSON.parse(data) as unknown) };
  });
}

export interface EventsClient {
  status: number;
  headers: http.IncomingHttpHeaders;
  /** Every frame received so far, in order. */
  frames: () => Frame[];
  /** The body, for a refusal (a normal JSON error answer). */
  body: () => string;
  /** Resolves when the server ended the stream or the socket closed. */
  closed: Promise<void>;
  waitFor: (predicate: (frames: Frame[]) => boolean, label: string) => Promise<void>;
  /** The client goes away (a closed window). */
  destroy: () => void;
}

/** `GET /api/jobs/events` on `base` with `token`; resolves once the response headers have arrived. */
export function openEvents(base: string, token?: string, headers: Record<string, string> = {}): Promise<EventsClient> {
  return new Promise((resolve, reject) => {
    const authorization = token === undefined ? {} : { authorization: `Bearer ${token}` };
    const request = http.get(`${base}/api/jobs/events`, { headers: { ...headers, ...authorization } });
    request.once("error", reject);
    request.once("response", (response) => {
      let text = "";
      response.setEncoding("utf-8");
      response.on("data", (chunk: string) => void (text += chunk));
      const closed = new Promise<void>((done) => {
        response.once("close", () => done());
        response.once("error", () => done());
      });
      const frames = (): Frame[] => parseFrames(text);
      resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        frames,
        body: () => text,
        closed,
        waitFor: (predicate, label) => until(() => predicate(frames()), label),
        destroy: () => request.destroy(),
      });
    });
  });
}
