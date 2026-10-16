import type { FastifyInstance } from "fastify";

import { okEnvelope } from "../lib/envelope.js";
import type { AppServices } from "../services/app-services.js";
import { APP_RUNTIME, APP_VERSION } from "../constants/deployment.js";

/**
 * `GET /api/state` (docs/03 section 4): the complete picture in one answer. Collections and jobs are
 * the later phases' tables, read here so the route's shape is complete from the start; until those
 * waves land they answer empty.
 */
export function registerStateRoute(app: FastifyInstance, services: AppServices): void {
  app.get("/api/state", async () => {
    // The channels read fills the live view first, so `backend` reports the read that just happened
    // (docs/03 section 4: connection is a fact of the last request, and this request is that read).
    const channels = await channelsOf(services);
    const backend = services.live.backend();
    const lastChannelId = services.live.lastId(() => services.channelState.readLastChannelId());
    return okEnvelope({
      version: APP_VERSION,
      host: { runtime: APP_RUNTIME },
      settings: services.settings.get(),
      shell: services.shell.get(),
      backend,
      channels,
      ...(lastChannelId !== undefined && { lastChannelId }),
      collections: [],
      jobs: [],
    });
  });
}

/** The channels part of state: the live view when it is fresh, empty when the backend is not reachable. */
async function channelsOf(services: AppServices) {
  const read = await services.live.list({});
  if ("failure" in read) return { items: [], categories: [], revision: 0 };
  return read.list;
}
