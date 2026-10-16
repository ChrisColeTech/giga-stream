import path from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { locateTool } from "../../shared/media/src/ffmpeg/locate-tool.ts";
import { registerChannels } from "./api/channels.ts";
import { registerErrorHandling } from "./api/envelope.ts";
import { registerFaults } from "./api/faults.ts";
import { registerHealth } from "./api/health.ts";
import { registerMedia } from "./api/media.ts";
import { config, type Config } from "./config.ts";
import { DATABASE_FILE_NAME, REQUEST_BODY_LIMIT_BYTES } from "./constants/limits.ts";
import { createServices, type ServiceOptions, type Services } from "./services/service-registry.ts";
import { seedTestChannels } from "./services/test-channels.ts";
import { createStore } from "./store/store.ts";
import { playerPage } from "./stream/test-page.ts";

const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export interface LiveServer {
  app: FastifyInstance;
  services: Services;
}

/**
 * The live server's composition root: one Fastify instance, one store, one runtime. `overrides` replace
 * config values without touching `process.env` (tests pass a temporary DATA_DIR); `now` is the one clock.
 * Every saved channel starts in the background, so the server answers at once and each channel's state
 * says how far it got.
 */
export async function buildLiveServer(
  overrides: Partial<Config> = {},
  extra: Partial<Pick<ServiceOptions, "now" | "sleep">> = {},
): Promise<LiveServer> {
  const settings: Config = { ...config, ...overrides };
  const store = createStore(path.join(settings.DATA_DIR, DATABASE_FILE_NAME));
  try {
    const app = Fastify({ logger: settings.NODE_ENV !== "test", bodyLimit: REQUEST_BODY_LIMIT_BYTES });
    const services = createServices(store, {
      cacheDir: settings.CACHE_DIR,
      dataDir: settings.DATA_DIR,
      ffmpegPath: locateTool("ffmpeg"),
      now: extra.now ?? Date.now,
      log: (line) => app.log.warn(line),
      ...(extra.sleep && { sleep: extra.sleep }),
    });
    if (settings.SEED_TEST_CHANNELS) seedTestChannels(services.channels, settings.FIXTURE_DIR);
    services.channels.startAll();

    app.addHook("onClose", async () => {
      await services.stop();
      store.close();
    });
    registerErrorHandling(app);
    const extraOrigins = settings.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
    await app.register(cors, {
      origin: [LOOPBACK_ORIGIN, ...extraOrigins],
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["range", "content-type"],
      exposedHeaders: ["content-length", "content-range", "accept-ranges"],
    });
    registerHealth(app, services);
    registerChannels(app, services);
    registerFaults(app, services);
    registerMedia(app, services, settings.TEST_PAGE ? playerPage() : null);
    return { app, services };
  } catch (error) {
    store.close();
    throw error;
  }
}
