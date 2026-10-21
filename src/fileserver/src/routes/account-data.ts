import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import { AccountSettingsSchema } from "../services/account-data-service.js";
import type { AppServices } from "../services/app-services.js";

const Ref = z.object({ kind: z.enum(["title", "local"]), itemId: z.string().min(1).max(500) });
const CollectionId = z.object({ collectionId: z.string().min(1).max(200) });
const CollectionBody = z.object({
  name: z.string().trim().min(1).max(80), type: z.enum(["movie", "tv", "local"]),
}).strict();
const CollectionPatch = CollectionBody.partial().strict();
const ItemBody = z.object({ kind: z.enum(["title", "local"]), id: z.string().min(1).max(500) }).strict();
const CollectionItem = CollectionId.extend({ kind: z.enum(["title", "local"]), itemId: z.string().min(1).max(500) });
const WatchId = z.object({ watchId: z.string().min(1).max(200) });
export const AccountWatchBody = z.object({
  item: z.object({ kind: z.enum(["title", "local"]), id: z.string().min(1).max(200) }),
  season: z.number().int().positive().optional(), episode: z.number().int().positive().optional(),
  positionMs: z.number().int().nonnegative(), durationMs: z.number().int().positive().optional(),
  playbackId: z.string().min(1).max(200), seq: z.number().int().positive(),
}).passthrough();
const invalidSettings = { code: "settings.invalid" as const, status: 422 };
const invalidCollection = { code: "collection.invalid" as const, status: 422 };

const requestOf = (request: FastifyRequest) => ({
  ...(request.headers.authorization !== undefined && { authorization: request.headers.authorization }),
  address: request.ip,
});

/** Per-account settings, favorites, collections and watch data (docs/62 3.3, docs/63 3.2). */
export function registerAccountDataRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/account/settings", async (request) =>
    okEnvelope(await services.accountApi.settings(requestOf(request))));
  app.put("/api/account/settings", async (request) => {
    const body = parseInput(AccountSettingsSchema, request.body, invalidSettings);
    return okEnvelope(await services.accountApi.writeSettings(body, requestOf(request)));
  });
  app.get("/api/account/favorites", async (request) =>
    okEnvelope(await services.accountApi.favorites(requestOf(request))));
  for (const method of ["put", "delete"] as const) {
    app[method]("/api/account/favorites/:kind/:itemId", async (request) => {
      const ref = parseInput(Ref, request.params);
      return okEnvelope(await services.accountApi.favorite(
        ref.kind, ref.itemId, method === "put", requestOf(request),
      ));
    });
  }
  app.get("/api/account/collections", async (request) =>
    okEnvelope(await services.accountApi.collections(requestOf(request))));
  app.post("/api/account/collections", async (request, reply) => {
    const body = parseInput(CollectionBody, request.body, invalidCollection); reply.code(201);
    const saved = await services.accountApi.createCollection(
      body.name, body.type, requestOf(request),
    );
    return okEnvelope(saved);
  });
  app.patch("/api/account/collections/:collectionId", async (request) => {
    const { collectionId } = parseInput(CollectionId, request.params);
    const body = parseInput(CollectionPatch, request.body, invalidCollection);
    const saved = await services.accountApi.updateCollection(
      collectionId, body, requestOf(request),
    );
    return okEnvelope(saved);
  });
  app.delete("/api/account/collections/:collectionId", async (request) => {
    const { collectionId } = parseInput(CollectionId, request.params);
    return okEnvelope(await services.accountApi.removeCollection(collectionId, requestOf(request)));
  });
  app.put("/api/account/collections/:collectionId/items", async (request) => {
    const { collectionId } = parseInput(CollectionId, request.params);
    const body = parseInput(ItemBody, request.body, invalidCollection);
    return okEnvelope(await services.accountApi.setCollectionItem(
      collectionId, body.kind, body.id, true, requestOf(request),
    ));
  });
  app.delete("/api/account/collections/:collectionId/items/:kind/:itemId", async (request) => {
    const value = parseInput(CollectionItem, request.params);
    return okEnvelope(await services.accountApi.setCollectionItem(
      value.collectionId, value.kind, value.itemId, false, requestOf(request),
    ));
  });
  app.get("/api/account/items/:kind/:itemId/collections", async (request) => {
    const ref = parseInput(Ref, request.params);
    return okEnvelope(await services.accountApi.memberships(ref.kind, ref.itemId, requestOf(request)));
  });
  app.get("/api/account/watch", async (request) =>
    okEnvelope(await services.accountApi.watch(requestOf(request))));
  app.put("/api/account/watch", async (request) => {
    const body = parseInput(AccountWatchBody, request.body);
    return okEnvelope(await services.accountApi.writeWatch(body, requestOf(request)));
  });
  app.delete("/api/account/watch/:watchId", async (request) => {
    const { watchId } = parseInput(WatchId, request.params);
    return okEnvelope(await services.accountApi.dropWatch(watchId, requestOf(request)));
  });
  app.delete("/api/account/watch", async (request) =>
    okEnvelope(await services.accountApi.clearWatch(requestOf(request))));
}
