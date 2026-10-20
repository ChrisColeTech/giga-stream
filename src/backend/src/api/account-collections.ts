import type { FastifyInstance } from "fastify";

import type { Services } from "../services/service-registry.js";
import {
  CollectionCreateSchema,
  CollectionItemBody,
  CollectionItemParams,
  CollectionParams,
  CollectionPatchSchema,
  ItemOfKindParams,
} from "../types/user-collection.js";
import { ERRORS } from "../constants/errors.js";
import { ok } from "./envelope.js";
import { anySignedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/**
 * The signed-in account's collections and their members (docs/62 section 3.3): the fileserver's verbs and
 * shapes (`src/fileserver/src/routes/collections.ts`), re-pointed at the account's rows, every query filtered
 * on the principal's account so another account's id reads as absent. Mounted under `/api/account` (app.ts).
 */
export function registerAccountCollections(app: FastifyInstance, services: Services): void {
  app.get("/collections", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    return ok(reply, await services.userCollections.list(principal));
  });

  app.post("/collections", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const body = parseInput(CollectionCreateSchema, request.body, ERRORS.collectionInvalid);
    return ok(reply, await services.userCollections.create(principal, body), 201);
  });

  app.patch("/collections/:collectionId", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { collectionId } = parseInput(CollectionParams, request.params);
    const body = parseInput(CollectionPatchSchema, request.body, ERRORS.collectionInvalid);
    return ok(reply, await services.userCollections.update(principal, collectionId, body));
  });

  app.delete("/collections/:collectionId", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { collectionId } = parseInput(CollectionParams, request.params);
    return ok(reply, await services.userCollections.remove(principal, collectionId));
  });

  app.put("/collections/:collectionId/items", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { collectionId } = parseInput(CollectionParams, request.params);
    const body = parseInput(CollectionItemBody, request.body, ERRORS.collectionInvalid);
    return ok(reply, await services.userCollections.addItem(principal, collectionId, body.kind, body.id));
  });

  app.delete("/collections/:collectionId/items/:kind/:itemId", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { collectionId, kind, itemId } = parseInput(CollectionItemParams, request.params);
    return ok(reply, await services.userCollections.removeItem(principal, collectionId, kind, itemId));
  });

  app.get("/items/:kind/:itemId/collections", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { kind, itemId } = parseInput(ItemOfKindParams, request.params);
    return ok(reply, await services.userCollections.itemCollections(principal, kind, itemId));
  });
}
