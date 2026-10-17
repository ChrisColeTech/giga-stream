import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Services } from "../services/service-registry.js";
import { PlaylistSyncBodySchema } from "../types/playlist-sync.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const IgnoredParams = z.object({ ignoredId: z.string().regex(/^\d{1,12}$/) });

/**
 * The playlist sync (docs/03 section 7.2c): owner or editor. The POST awaits the run and answers
 * `202` with its counts; the GET reports the run in flight, the last outcome and the schedule.
 */
export function registerPlaylistSync(app: FastifyInstance, services: Services): void {
  app.get("/api/playlist-sync", async (request, reply) => {
    signedIn(services, request, ANY_ADMIN);
    return ok(reply, services.playlistSync.status());
  });

  app.post("/api/playlist-sync", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const body = parseInput(PlaylistSyncBodySchema, request.body);
    const answer = await services.playlistSync.run(body, actorOf(request, principal));
    return ok(reply, answer, 202);
  });

  // Channels an admin deleted from the sync: listed, and restorable (docs/26 section 3.10, rule 4).
  app.get("/api/playlist-sync/ignored", async (request, reply) => {
    signedIn(services, request, ANY_ADMIN);
    return ok(reply, services.playlistSync.ignored.list());
  });

  app.delete("/api/playlist-sync/ignored/:ignoredId", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { ignoredId } = parseInput(IgnoredParams, request.params);
    return ok(reply, services.playlistSync.ignored.restore(Number(ignoredId), actorOf(request, principal)));
  });
}
