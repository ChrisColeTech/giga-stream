import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import { PLAYLIST_UPLOAD_HEADER_PAIRS, PLAYLIST_UPLOAD_OVERHEAD_BYTES } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { PlaylistInputSchema, PlaylistNameSchema, PlaylistPatchSchema } from "../types/playlist.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const PlaylistParams = z.object({ playlistId: z.string().regex(/^\d{1,12}$/) });
const FILE_FIELD = "file";

const badUpload = (): AppError => new AppError(ERRORS.requestInvalid, { field: FILE_FIELD }, "Send exactly one playlist file.");

/**
 * Exactly one `file` part and at most one `name` field, in either order. Unknown or repeated parts and a truncated file
 * are `400 request.invalid`. The client's file name remains the fallback name for external clients.
 */
async function readUpload(request: FastifyRequest): Promise<{ fileName: string; body: Buffer; name?: string }> {
  let upload: { fileName: string; body: Buffer } | undefined;
  let name: string | undefined;
  for await (const part of request.parts()) {
    if (part.type === "field") {
      if (part.fieldname !== "name" || name !== undefined || typeof part.value !== "string") throw badUpload();
      const parsed = PlaylistNameSchema.safeParse(part.value);
      if (!parsed.success) throw new AppError(ERRORS.playlistInvalid, { field: "name" });
      name = parsed.data;
    } else {
      if (part.fieldname !== FILE_FIELD || upload !== undefined) throw badUpload();
      const body = await part.toBuffer();
      if (part.file.truncated) throw badUpload();
      upload = { fileName: part.filename, body };
    }
  }
  if (upload === undefined) throw badUpload();
  return { ...upload, ...(name !== undefined && { name }) };
}

/**
 * The playlists (docs/43 section 3.2, docs/03 section 7.2c): a signed-in admin, audited. A web playlist's answer
 * carries its address in full, so these routes are `no-store` like every private `/api` route (`network-policy.ts`).
 * The file import is multipart, registered in its own scope so no other route's parsing changes.
 */
export function registerPlaylists(app: FastifyInstance, services: Services): void {
  const { maxBytes } = services.importer;

  void app.register(async (upload) => {
    await upload.register(multipart, {
      limits: { files: 1, fields: 1, fileSize: maxBytes, headerPairs: PLAYLIST_UPLOAD_HEADER_PAIRS },
    });
    upload.post("/api/playlists/import", { bodyLimit: maxBytes + PLAYLIST_UPLOAD_OVERHEAD_BYTES }, async (request, reply) => {
      const principal = signedIn(services, request);
      const answer = services.importer.importFile(await readUpload(request), actorOf(request, principal));
      return ok(reply, answer, answer.created ? 201 : 200);
    });
  });

  app.get("/api/playlists", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.playlists.list());
  });

  app.post("/api/playlists", async (request, reply) => {
    const principal = signedIn(services, request);
    const input = parseInput(PlaylistInputSchema, request.body, ERRORS.playlistInvalid);
    const answer = await services.importer.importUrl(input, actorOf(request, principal));
    return ok(reply, answer, answer.created ? 201 : 200);
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
    return ok(reply, await services.playlists.remove(Number(playlistId), actorOf(request, principal)));
  });
}
