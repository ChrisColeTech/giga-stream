import { SOCKET_CLOSE_OVERLOAD, SOCKET_CLOSE_POLICY, SOCKET_QUEUE_LIMIT, SOCKET_VIOLATION_LIMIT } from "../constants/limits.js";
import { ClientFrameSchema, type BackendFrame } from "../types/events.js";

/** The little a session needs from a socket; `ws-adapter.ts` provides it for a real one. */
export interface HubSocket {
  /** Reports whether the frame could not be written. */
  send(text: string, onSent: (failed: boolean) => void): void;
  close(code: number, reason: string): void;
}

/**
 * One connected reader: a bounded outbound queue and a count of protocol violations. Every frame
 * defines state, so a reader too slow to keep up is closed with 1013 rather than silently skipped.
 */
export class ClientSession {
  private queue: BackendFrame[] = [];
  private sending = false;
  private closed = false;
  private violations = 0;

  constructor(
    private readonly socket: HubSocket,
    private readonly onClosed: (session: ClientSession) => void,
    private readonly now: () => number,
  ) {}

  offer(frame: BackendFrame): void {
    if (this.closed) return;
    if (this.queue.length >= SOCKET_QUEUE_LIMIT) return this.close(SOCKET_CLOSE_OVERLOAD, "overloaded");
    this.queue.push(frame);
    this.pump();
  }

  /** `text` is undefined for a binary frame. Only `{"type":"ping"}` is valid, and it is answered with pong. */
  receive(text: string | undefined): void {
    if (this.closed) return;
    let valid = false;
    if (text !== undefined) {
      try {
        valid = ClientFrameSchema.safeParse(JSON.parse(text)).success;
      } catch {
        valid = false;
      }
    }
    if (valid) return this.offer({ type: "pong", data: { at: this.now() } });
    this.violations += 1;
    if (this.violations >= SOCKET_VIOLATION_LIMIT) this.close(SOCKET_CLOSE_POLICY, "policy violation");
  }

  /** Called when the transport closed on its own. */
  dispose(): void {
    this.closed = true;
    this.queue = [];
    this.onClosed(this);
  }

  close(code: number, reason: string): void {
    if (this.closed) return;
    this.dispose();
    this.socket.close(code, reason);
  }

  private pump(): void {
    if (this.sending || this.closed) return;
    const next = this.queue.shift();
    if (!next) return;
    this.sending = true;
    this.socket.send(JSON.stringify(next), (failed) => {
      this.sending = false;
      if (failed) this.dispose();
      else this.pump();
    });
  }
}
