import type { z } from "zod";

export async function* readNdjson<T>(body: ReadableStream<Uint8Array>, schema: z.ZodType<T>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield schema.parse(JSON.parse(line) as unknown);
      }
      if (chunk.done) break;
    }
    if (pending.trim()) yield schema.parse(JSON.parse(pending) as unknown);
  } finally {
    reader.releaseLock();
  }
}

export async function collectUntilDone<T>(
  body: ReadableStream<Uint8Array>,
  schema: z.ZodType<T>,
  isDone: (event: T) => boolean,
): Promise<readonly T[]> {
  const events: T[] = [];
  for await (const event of readNdjson(body, schema)) {
    events.push(event);
    if (isDone(event)) return events;
  }
  throw new Error("The scan stream ended before it finished.");
}
