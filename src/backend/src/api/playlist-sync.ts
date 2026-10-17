import type { FastifyInstance } from "fastify";

import type { Services } from "../services/service-registry.js";
import { PlaylistSyncBodySchema } from "../types/playlist-sync.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/**
 * The playlist sync as a whole (docs/03 section 7.2c), kept as a thin wrapper over the playlists: owner or editor.
 * The POST awaits a run over every enabled playlist and answers `202` with its counts; the GET reports the run in
 * flight, the last outcome and the first enabled playlist job's schedule. A single playlist is synced by its job.
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
}
