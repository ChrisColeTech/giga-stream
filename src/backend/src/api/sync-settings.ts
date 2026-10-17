import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { ADDRESS_MAX } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const SCHEDULE_MAX = 20;
const PatchBody = z
  .object({ titleSchedule: z.string().trim().max(SCHEDULE_MAX).optional(), playlistSchedule: z.string().trim().max(SCHEDULE_MAX).optional() })
  .strict();
const PlaylistBody = z.object({ url: z.string().trim().min(1).max(ADDRESS_MAX) }).strict();
const PlaylistParams = z.object({ playlistId: z.string().regex(/^\d{1,12}$/) });

/**
 * The sync settings (docs/26 section 3.11): both schedules and the playlist addresses, stored and editable, for an
 * owner or editor, audited. No answer carries a playlist's address - only its id, host and a masked form - so these
 * routes are not on the no-store list (`network-policy.ts`): they hold nothing a cache could leak.
 */
export function registerSyncSettings(app: FastifyInstance, services: Services): void {
  app.get("/api/sync-settings", async (request, reply) => {
    signedIn(services, request, ANY_ADMIN);
    return ok(reply, services.syncSettings.view());
  });

  app.patch("/api/sync-settings", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const patch = parseInput(PatchBody, request.body, ERRORS.settingsInvalid);
    return ok(reply, services.syncSettings.update(patch, actorOf(request, principal)));
  });

  app.post("/api/sync-settings/playlists", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { url } = parseInput(PlaylistBody, request.body, ERRORS.settingsInvalid);
    return ok(reply, services.syncSettings.addPlaylist(url, actorOf(request, principal)), 201);
  });

  app.delete("/api/sync-settings/playlists/:playlistId", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { playlistId } = parseInput(PlaylistParams, request.params);
    return ok(reply, services.syncSettings.removePlaylist(Number(playlistId), actorOf(request, principal)));
  });
}
