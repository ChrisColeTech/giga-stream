import { APP_VERSION } from "../constants/deployment.js";
import { SOCKET_CLOSE_GOING_AWAY } from "../constants/limits.js";
import type { BackendFrame, EventSink } from "../types/events.js";
import { ClientSession, type HubSocket } from "./client-session.js";

/**
 * The one socket hub (docs/03 section 7.8): greets each reader with the current revision and fans every
 * change out to all of them. There is no replay: a reconnect gets a fresh hello and treats it as
 * authoritative.
 */
export class Hub implements EventSink {
  private readonly sessions = new Set<ClientSession>();

  constructor(
    private readonly currentRevision: () => number,
    private readonly now: () => number,
  ) {}

  /** The hello is always the first frame a session is offered. */
  attach(socket: HubSocket): ClientSession {
    const session = new ClientSession(socket, (closed) => this.sessions.delete(closed), this.now);
    this.sessions.add(session);
    session.offer({ type: "hello", data: { version: APP_VERSION, revision: this.currentRevision() } });
    return session;
  }

  publish(frame: BackendFrame): void {
    for (const session of this.sessions) session.offer(frame);
  }

  closeAll(): void {
    for (const session of [...this.sessions]) session.close(SOCKET_CLOSE_GOING_AWAY, "shutting down");
  }
}
