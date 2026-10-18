import type { FastifyInstance } from "fastify";

import { okEnvelope } from "../lib/envelope.js";
import type { AppServices } from "../services/app-services.js";
import { APP_RUNTIME, APP_VERSION } from "../constants/deployment.js";

/**
 * `GET /api/state` (docs/03 section 4): the complete picture in one answer. Collections and jobs are
 * read fresh; the channels part is the cached snapshot of the backend's channels.
 */
export function registerStateRoute(app: FastifyInstance, services: AppServices): void {
  app.get("/api/state", async () => {
    // The cache answers at once; a cold cache starts its first sync detached and is not awaited here
    // (docs/03 section 5.1), and `backend` describes the cache's last attempt.
    const { list: channels, backend } = await services.live.list({}, { awaitCold: false });
    // The last channel rides along only when Live is set to open on it (03 section 3.2: liveOnOpen).
    const lastChannelId =
      services.settings.get().liveOnOpen === "last"
        ? services.live.lastId(() => services.channelState.readLastChannelId())
        : undefined;
    return okEnvelope({
      version: APP_VERSION,
      host: { runtime: APP_RUNTIME },
      settings: services.settings.get(),
      shell: services.shell.get(),
      backend,
      channels,
      ...(lastChannelId !== undefined && { lastChannelId }),
      collections: services.collections.list(),
      jobs: services.jobs.listRecent(),
    });
  });
}
