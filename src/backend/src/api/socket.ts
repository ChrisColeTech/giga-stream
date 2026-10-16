import type { FastifyInstance } from "fastify";

import { attachWebSocket } from "../events/ws-adapter.js";
import type { Services } from "../services/service-registry.js";

/** `GET /ws` (docs/03 section 7.8): public and read-only; hello first, then a frame per change. */
export function registerSocket(app: FastifyInstance, services: Services): void {
  app.get("/ws", { websocket: true }, (socket) => attachWebSocket(services.hub, socket));
}
