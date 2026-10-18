/* A text/event-stream parser (`44` section 4): chunks in, whole frames out. A frame ends at a blank line, so a chunk may
 * end anywhere - inside a field, between the two newlines, between a CR and its LF - and one chunk may hold several
 * frames. Lines starting with `:` are comments. Pure and stateful only in its buffer; no timer, no I/O. */
export interface SseFrame {
  readonly event: string;
  readonly data: string;
}

export interface SseParser {
  /** The frames the chunk completed, in order. */
  push: (chunk: string) => SseFrame[];
}

function frameOf(block: string): SseFrame | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? "" : line.slice(colon + 1);
    const value = raw.startsWith(" ") ? raw.slice(1) : raw;
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length === 0 ? null : { event, data: data.join("\n") };
}

export function createSseParser(): SseParser {
  let buffer = "";
  return {
    push(chunk) {
      /* A trailing CR may be the first half of a CRLF: it waits for the next chunk. */
      buffer = (buffer + chunk).replace(/\r\n/g, "\n").replace(/\r(?!$)/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      const frames: SseFrame[] = [];
      for (const block of blocks) {
        const frame = frameOf(block);
        if (frame !== null) frames.push(frame);
      }
      return frames;
    },
  };
}
