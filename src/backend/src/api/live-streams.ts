import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Config } from "../config.js";
import { AppError, ERRORS } from "../constants/errors.js";
import { LOGO_CACHE_MAX_AGE_S, LOGO_CACHE_NAME } from "../constants/limits.js";
import { playerPage } from "../live/stream/test-page.js";
import { streamCorsOptions } from "../network-policy.js";
import type { Services } from "../services/service-registry.js";
import { sendMedia } from "./byte-range.js";
import { parseInput } from "./parse-input.js";

const RAW_TRAVERSAL = /\.\.|%2e|%2f|%5c|\\|\0|%00/i;
const LiveParams = z.object({ channelId: z.string().regex(/^[a-z0-9-]{1,64}$/), "*": z.string().max(200) });
const LogoParams = z.object({ file: z.string().regex(/^[a-z0-9-]{1,64}\.png$/) });
const CachedLogoParams = z.object({ file: z.string().regex(LOGO_CACHE_NAME) });
const PNG_SUFFIX = ".png";

/**
 * The live streams, at the addresses a player loads (docs/10 section 3.1, `01` section 4.3): playlists and
 * segments under `/live/:channelId/`, logos under `/logos/`, and with `TEST_PAGE` the test player. These are
 * media, not the API, so they sit outside `/api` and answer bytes; an error is still the envelope.
 *
 * `/live` and `/logos` are each an encapsulated plugin with the stream CORS policy (loopback origins always,
 * the `Range` header, GET and HEAD). The plugin registers its own `OPTIONS` route under its prefix, so the
 * `/api` policy (registered once at the root, with its own `OPTIONS *`) and this one never collide. Register
 * this before the root CORS plugin: a child inherits only what its parent has when it is created, and the CORS
 * plugin decorates the request, which a child cannot do again once its parent has.
 */
export async function registerLiveStreams(app: FastifyInstance, services: Services, settings: Config): Promise<void> {
  await app.register(
    async (live) => {
      await live.register(cors, streamCorsOptions(settings));
      live.get("/:channelId/*", async (request, reply) => {
        if (RAW_TRAVERSAL.test((request.raw.url ?? "").split("?")[0] ?? "")) throw new AppError(ERRORS.pathInvalid);
        const params = parseInput(LiveParams, request.params, ERRORS.pathInvalid);
        return sendMedia(request, reply, await services.live.stream.read(params.channelId, params["*"].split("/")));
      });
    },
    { prefix: "/live" },
  );

  await app.register(
    async (logos) => {
      await logos.register(cors, streamCorsOptions(settings));
      // The sync's cached logo images (docs/43 section 3.1): a content-hash name, public, never changes.
      logos.get("/c/:file", async (request, reply) => {
        const { file } = parseInput(CachedLogoParams, request.params, ERRORS.pathInvalid);
        const image = await services.logoCache.read(file);
        if (image === undefined) throw new AppError(ERRORS.mediaNotFound);
        return reply
          .header("content-type", image.type)
          .header("cache-control", `public, max-age=${LOGO_CACHE_MAX_AGE_S}, immutable`)
          .header("x-content-type-options", "nosniff")
          .send(image.bytes);
      });
      logos.get("/:file", async (request, reply) => {
        const { file } = parseInput(LogoParams, request.params, ERRORS.pathInvalid);
        return sendMedia(request, reply, services.live.stream.logo(file.slice(0, -PNG_SUFFIX.length)));
      });
    },
    { prefix: "/logos" },
  );

  if (settings.TEST_PAGE) {
    const page = playerPage();
    app.get("/test/player.html", async (_request, reply) =>
      reply.header("content-type", "text/html; charset=utf-8").header("cache-control", "no-store").send(page));
  }
}
