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

async function principal(request: FastifyRequest, services: AppServices) {
  return services.accountAuth.authenticate(request.headers.authorization);
}

/** Per-account settings, favorites, collections and watch data (docs/62 3.3, docs/63 3.2). */
export function registerAccountDataRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/account/settings", async (request) =>
    okEnvelope(await services.accountData.settings(await principal(request, services))));
  app.put("/api/account/settings", async (request) => {
    const body = parseInput(AccountSettingsSchema, request.body, invalidSettings);
    return okEnvelope(await services.accountData.writeSettings(await principal(request, services), body));
  });
  app.get("/api/account/favorites", async (request) =>
    okEnvelope(await services.accountData.favorites(await principal(request, services))));
  for (const method of ["put", "delete"] as const) {
    app[method]("/api/account/favorites/:kind/:itemId", async (request) => {
      const ref = parseInput(Ref, request.params);
      return okEnvelope(await services.accountData.favorite(
        await principal(request, services), ref.kind, ref.itemId, method === "put",
      ));
    });
  }
  app.get("/api/account/collections", async (request) =>
    okEnvelope(await services.accountData.collections(await principal(request, services))));
  app.post("/api/account/collections", async (request, reply) => {
    const body = parseInput(CollectionBody, request.body, invalidCollection); reply.code(201);
    const saved = await services.accountData.createCollection(
      await principal(request, services), body.name, body.type,
    );
    return okEnvelope(saved);
  });
  app.patch("/api/account/collections/:collectionId", async (request) => {
    const { collectionId } = parseInput(CollectionId, request.params);
    const body = parseInput(CollectionPatch, request.body, invalidCollection);
    const saved = await services.accountData.updateCollection(
      await principal(request, services), collectionId, body,
    );
    return okEnvelope(saved);
  });
  app.delete("/api/account/collections/:collectionId", async (request) => {
    const { collectionId } = parseInput(CollectionId, request.params);
    return okEnvelope(await services.accountData.removeCollection(await principal(request, services), collectionId));
  });
  app.put("/api/account/collections/:collectionId/items", async (request) => {
    const { collectionId } = parseInput(CollectionId, request.params);
    const body = parseInput(ItemBody, request.body, invalidCollection);
    return okEnvelope(await services.accountData.setCollectionItem(
      await principal(request, services), collectionId, body.kind, body.id, true,
    ));
  });
  app.delete("/api/account/collections/:collectionId/items/:kind/:itemId", async (request) => {
    const value = parseInput(CollectionItem, request.params);
    return okEnvelope(await services.accountData.setCollectionItem(
      await principal(request, services), value.collectionId, value.kind, value.itemId, false,
    ));
  });
  app.get("/api/account/items/:kind/:itemId/collections", async (request) => {
    const ref = parseInput(Ref, request.params);
    return okEnvelope(await services.accountData.memberships(await principal(request, services), ref.kind, ref.itemId));
  });
  app.get("/api/account/watch", async (request) =>
    okEnvelope(await services.accountData.listWatch(await principal(request, services))));
  app.put("/api/account/watch", async (request) => {
    const body = parseInput(AccountWatchBody, request.body);
    return okEnvelope(await services.accountData.writeWatch(await principal(request, services), body));
  });
  app.delete("/api/account/watch/:watchId", async (request) => {
    const { watchId } = parseInput(WatchId, request.params);
    return okEnvelope(await services.accountData.dropWatch(await principal(request, services), watchId));
  });
  app.delete("/api/account/watch", async (request) =>
    okEnvelope(await services.accountData.clearWatch(await principal(request, services))));
}
