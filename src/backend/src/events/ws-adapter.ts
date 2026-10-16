import type { WebSocket } from "ws";

import type { Hub } from "./hub.js";

const OPEN = 1;

/** Connects a real socket to the hub; the hub itself never touches the socket library. */
export function attachWebSocket(hub: Hub, socket: WebSocket): void {
  const session = hub.attach({
    send(text, onSent) {
      if (socket.readyState !== OPEN) return onSent(true);
      // `ws` calls back with null (not undefined) on success, so test truthiness, never `!== undefined`.
      socket.send(text, (error) => onSent(Boolean(error)));
    },
    close(code, reason) {
      socket.close(code, reason);
    },
  });
  socket.on("message", (data, isBinary) => session.receive(isBinary ? undefined : data.toString()));
  socket.on("close", () => session.dispose());
  socket.on("error", () => session.dispose());
}
