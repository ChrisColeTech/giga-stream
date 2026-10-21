import type { FastifyInstance } from "fastify";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { RefParams } from "../types/user-collection.js";
import { UserSettingsSchema } from "../types/user-settings.js";
import { ok } from "./envelope.js";
import { anySignedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/**
 * The signed-in account's own data (docs/62 sections 3.3 and 3.5): the profile, the settings document and the
 * favorites, every route behind `anySignedIn` and every read and write scoped to the principal's account, so
 * no route can reach another account's rows. Mounted under `/api/account` (app.ts).
 */
export function registerAccountData(app: FastifyInstance, services: Services): void {
  // The profile (docs/62 D5): the account row itself, no profile table and no display name.
  app.get("/me", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    return ok(reply, await services.auth.me(principal));
  });

  app.get("/settings", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    return ok(reply, await services.userSettings.read(principal));
  });

  // Whole-document replace: the last write wins, no merge server-side (docs/62 D8).
  app.put("/settings", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const settings = parseInput(UserSettingsSchema, request.body, ERRORS.settingsInvalid);
    return ok(reply, await services.userSettings.write(principal, settings));
  });

  // Favorites: idempotent both ways, like the fileserver's routes (docs/03 section 3.12).
  app.get("/favorites", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    return ok(reply, await services.userFavorites.list(principal));
  });

  app.put("/favorites/:kind/:itemId", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { kind, itemId } = parseInput(RefParams, request.params);
    return ok(reply, await services.userFavorites.set(principal, kind, itemId, true));
  });

  app.delete("/favorites/:kind/:itemId", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { kind, itemId } = parseInput(RefParams, request.params);
    return ok(reply, await services.userFavorites.set(principal, kind, itemId, false));
  });
}
