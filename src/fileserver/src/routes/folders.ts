import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { AppError } from "../lib/app-error.js";
import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import type { PublicScanEvent } from "../types/scan-event.js";

const CollectionParams = z.object({ collectionId: z.string() });
const FolderParams = z.object({ folderId: z.string() });
const TokenBody = z.object({ token: z.unknown().optional() }).passthrough();

const asLine = (event: PublicScanEvent): string => `${JSON.stringify(event)}\n`;

/** Folders: attach, move, rescan, detach, and the streamed NDJSON scan (docs/03 section 3.8). */
export function registerFoldersRoutes(app: FastifyInstance, services: AppServices): void {
  app.post("/api/collections/:collectionId/folders", async (request, reply) => {
    const params = parseInput(CollectionParams, request.params);
    const body = parseInput(TokenBody, request.body);
    reply.code(201);
    return okEnvelope(await services.collections.attachFolder(params.collectionId, body.token));
  });

  app.put("/api/folders/:folderId", async (request) => {
    const params = parseInput(FolderParams, request.params);
    const body = parseInput(TokenBody, request.body);
    return okEnvelope(await services.collections.setFolderLocation(params.folderId, body.token));
  });

  app.post("/api/folders/:folderId/rescan", async (request, reply) => {
    const params = parseInput(FolderParams, request.params);
    reply.code(202);
    return okEnvelope(services.collections.rescan(params.folderId));
  });

  app.delete("/api/folders/:folderId", async (request) => {
    const params = parseInput(FolderParams, request.params);
    return okEnvelope(services.collections.detachFolder(params.folderId));
  });

  app.get("/api/folders/:folderId/scan", async (request, reply) => {
    const params = parseInput(FolderParams, request.params);
    const stream = services.scans.readStream(params.folderId);
    if (stream === undefined) {
      throw new AppError("job.not_running", 409, "No scan is running for that folder.");
    }
    reply.hijack();
    streamScan(stream, reply.raw);
  });
}

/** One NDJSON line per event: the snapshot first, then everything the scan still yields. */
function streamScan(
  stream: NonNullable<ReturnType<AppServices["scans"]["readStream"]>>,
  raw: FastifyReply["raw"],
): void {
  raw.setHeader("content-type", "application/x-ndjson");
  raw.setHeader("cache-control", "no-store");
  let live = false;
  const pending: Array<PublicScanEvent | null> = [];
  const unsubscribe = stream.subscribe(
    (event) => {
      if (live) raw.write(asLine(event));
      else pending.push(event);
    },
    () => {
      if (live) raw.end();
      else pending.push(null);
    },
  );
  raw.on("close", () => unsubscribe());
  raw.flushHeaders();
  for (const event of stream.snapshot) raw.write(asLine(event));
  live = true;
  for (const hold of pending) {
    if (hold === null) raw.end();
    else raw.write(asLine(hold));
  }
}
