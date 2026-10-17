import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

const IdParams = z.object({ collectionId: z.string() });
const CreateBody = z.object({ name: z.string(), type: z.string() }).passthrough();
const PatchBody = z.object({ name: z.string().optional(), type: z.string().optional() }).passthrough();
const ItemBody = z.object({ kind: z.string(), id: z.string() });
const ItemParams = z.object({ collectionId: z.string(), kind: z.string(), itemId: z.string() });
const ItemOfKind = z.object({ kind: z.string(), itemId: z.string() });

/** Collections: `GET|POST`, `PATCH|DELETE`, members, and what an item is in (docs/03 section 3.7). */
export function registerCollectionsRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/collections", async () => okEnvelope(services.collections.list()));

  app.post("/api/collections", async (request, reply) => {
    const body = parseInput(CreateBody, request.body);
    reply.code(201);
    return okEnvelope(services.collections.create(body.name, body.type));
  });

  app.patch("/api/collections/:collectionId", async (request) => {
    const params = parseInput(IdParams, request.params);
    const body = parseInput(PatchBody, request.body);
    return okEnvelope(services.collections.update(params.collectionId, body));
  });

  app.delete("/api/collections/:collectionId", async (request) => {
    const params = parseInput(IdParams, request.params);
    return okEnvelope(services.collections.remove(params.collectionId));
  });

  app.put("/api/collections/:collectionId/items", async (request) => {
    const params = parseInput(IdParams, request.params);
    const body = parseInput(ItemBody, request.body);
    return okEnvelope(services.collections.addItem(params.collectionId, body.kind, body.id));
  });

  app.delete("/api/collections/:collectionId/items/:kind/:itemId", async (request) => {
    const { collectionId, kind, itemId } = parseInput(ItemParams, request.params);
    return okEnvelope(services.collections.removeItem(collectionId, kind, itemId));
  });

  app.get("/api/items/:kind/:itemId/collections", async (request) => {
    const { kind, itemId } = parseInput(ItemOfKind, request.params);
    return okEnvelope(services.collections.itemCollections(kind, itemId));
  });
}
