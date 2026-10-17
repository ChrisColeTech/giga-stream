import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { PlaylistInputSchema, PlaylistPatchSchema } from "../types/playlist.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const PlaylistParams = z.object({ playlistId: z.string().regex(/^\d{1,12}$/) });

/**
 * The playlists (docs/26 section 3.11): records with a name, an address and `Enabled`, for a signed-in admin,
 * audited. No answer carries the address - only the host and a masked form - so these routes are not on the
 * no-store list (`network-policy.ts`): they hold nothing a cache could leak.
 */
export function registerPlaylists(app: FastifyInstance, services: Services): void {
  app.get("/api/playlists", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.playlists.list());
  });

  app.post("/api/playlists", async (request, reply) => {
    const principal = signedIn(services, request);
    const input = parseInput(PlaylistInputSchema, request.body, ERRORS.playlistInvalid);
    return ok(reply, services.playlists.create(input, actorOf(request, principal)), 201);
  });

  app.get("/api/playlists/:playlistId", async (request, reply) => {
    signedIn(services, request);
    const { playlistId } = parseInput(PlaylistParams, request.params);
    return ok(reply, services.playlists.get(Number(playlistId)));
  });

  app.patch("/api/playlists/:playlistId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { playlistId } = parseInput(PlaylistParams, request.params);
    const patch = parseInput(PlaylistPatchSchema, request.body, ERRORS.playlistInvalid);
    return ok(reply, services.playlists.update(Number(playlistId), patch, actorOf(request, principal)));
  });

  app.delete("/api/playlists/:playlistId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { playlistId } = parseInput(PlaylistParams, request.params);
    return ok(reply, services.playlists.remove(Number(playlistId), actorOf(request, principal)));
  });
}
