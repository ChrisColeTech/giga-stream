import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { z } from "zod";
import { collectUntilDone, readNdjson } from "@/services/ndjson";
import { streamFolderScan } from "@/services/scan-stream";
import type { ScanProgress } from "@/types/collection";

const originalFetch = globalThis.fetch;
const EventSchema = z.object({ type: z.enum(["progress", "done"]), value: z.number() });
const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(bytes(chunk));
      controller.close();
    },
  });
}

describe("NDJSON decoding", () => {
  it("joins split chunks and reads an unterminated final line", async () => {
    const events = [];
    for await (const event of readNdjson(
      stream(['{"type":"prog', 'ress","value":1}\n{"type":"done","value":2}']),
      EventSchema,
    )) {
      events.push(event);
    }
    assert.deepEqual(events, [
      { type: "progress", value: 1 },
      { type: "done", value: 2 },
    ]);
  });

  it("refuses a malformed line", async () => {
    await assert.rejects(async () => {
      for await (const _event of readNdjson(stream(["not-json\n"]), EventSchema)) {
        // Consume the generator.
      }
    });
  });

  it("refuses a body that ends without done", async () => {
    await assert.rejects(
      collectUntilDone(stream(['{"type":"progress","value":1}\n']), EventSchema, (event) => event.type === "done"),
      /ended before it finished/,
    );
  });
});

describe("scan streaming", () => {
  it("reports indeterminate discovery, progress and done without exposing file paths", async () => {
    const lines = [
      JSON.stringify({
        type: "found",
        file: { path: "private/video.mp4", absolutePath: "C:/private/video.mp4", sizeBytes: 5, modifiedMs: 6 },
      }),
      JSON.stringify({ type: "progress", found: 1, probed: 0, total: null }),
      JSON.stringify({ type: "progress", found: 1, probed: 1, total: 1 }),
      JSON.stringify({ type: "done", files: [], found: 1, probed: 1, unplayable: 0 }),
    ];
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/folders/f%2F1/scan");
      assert.equal(init?.method, "GET");
      return new Response(stream([`${lines.join("\n")}\n`]), { status: 200 });
    };
    const progress: ScanProgress[] = [];
    await streamFolderScan("f/1", (next) => progress.push(next));
    assert.equal(progress[1]?.total, null);
    assert.deepEqual(progress.at(-1), { found: 1, probed: 1, total: 1, done: true });
    assert.doesNotMatch(JSON.stringify(progress), /private|video\.mp4|C:\//);
  });

  it("requires a done line from the scan route", async () => {
    globalThis.fetch = async () =>
      new Response(stream(['{"type":"progress","found":1,"probed":0,"total":null}\n']), { status: 200 });
    await assert.rejects(streamFolderScan("f-1", () => undefined), /ended before it finished/);
  });
});
