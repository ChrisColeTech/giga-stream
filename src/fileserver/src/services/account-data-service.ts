import { randomUUID } from "node:crypto";
import { z } from "zod";

import { clampPosition, entryState } from "../../../shared/watch/dist/threshold.js";
import { AppError } from "../lib/app-error.js";
import { runAdminTransaction, type AdminDatabase } from "../store/admin-database.js";
import type { AccountCollectionRepository } from "../store/account-collection-repository.js";
import type { AccountDataRepository } from "../store/account-data-repository.js";
import type { AccountWatchRepository, AccountWatchRow } from "../store/account-watch-repository.js";
import { SETTING_SCHEMAS } from "../types/settings.js";
import type { Principal } from "../types/account.js";
import type { Actor, AuditService } from "./audit-service.js";

export const AccountSettingsSchema = z.object(SETTING_SCHEMAS).partial().strict();
export type AccountSettings = z.infer<typeof AccountSettingsSchema>;

const notFound = () => new AppError("collection.not_found", 404, "There is no such collection.");

export function createAccountDataService(deps: {
  data: AccountDataRepository; collections: AccountCollectionRepository;
  watches: AccountWatchRepository; audit: AuditService; database: AdminDatabase; now: () => number;
}) {
  const { data, collections, watches, audit, database, now } = deps;
  const settings = async (principal: Principal) => {
    const row = await data.settings(principal.accountId);
    const parsed = AccountSettingsSchema.safeParse(row.value);
    return {
      settings: parsed.success ? parsed.data : {},
      ...(row.updatedAt !== undefined && { updatedAt: row.updatedAt }),
    };
  };
  const existing = async (principal: Principal, id: string) => {
    const row = await collections.find(principal.accountId, id);
    if (row === undefined) throw notFound();
    return row;
  };
  const assertNameFree = async (principal: Principal, name: string, except?: string) => {
    const holder = (await collections.list(principal.accountId))
      .find((row) => row.id !== except && row.name.toLowerCase() === name.toLowerCase());
    if (holder !== undefined) throw new AppError("collection.invalid", 422, "That collection name is already in use.");
  };
  const watchView = (row: AccountWatchRow) => ({
    watchId: row.id, item: { kind: row.itemKind, id: row.itemId },
    ...(row.season !== undefined && { season: row.season }), ...(row.episode !== undefined && { episode: row.episode }),
    positionMs: row.positionMs, ...(row.durationMs !== undefined && { durationMs: row.durationMs }),
    state: row.state, updatedAt: row.updatedAt,
  });
  return {
    settings,
    async writeSettings(principal: Principal, value: AccountSettings, actor: Actor) {
      const at = now();
      return runAdminTransaction(database, async () => {
        await data.writeSettings(principal.accountId, value, at);
        await audit.record({ ...actor, principal }, {
          action: "settings.updated", subject: principal.accountId, detail: { fields: Object.keys(value) },
        });
        return { settings: value, updatedAt: at };
      });
    },
    favorites: (principal: Principal) => data.favorites(principal.accountId).then((items) => ({ items })),
    favorite: (
      principal: Principal, kind: "title" | "local", id: string, value: boolean, actor: Actor,
    ) => runAdminTransaction(database, async () => {
      const result = await data.setFavorite(principal.accountId, kind, id, value, now());
      await audit.record({ ...actor, principal }, {
        action: value ? "favorite.added" : "favorite.removed", subject: id, detail: { kind },
      });
      return result;
    }),
    collections: (principal: Principal) => collections.list(principal.accountId).then((items) => ({ items })),
    async createCollection(
      principal: Principal, name: string, type: "movie" | "tv" | "local", actor: Actor,
    ) {
      await assertNameFree(principal, name);
      const at = now();
      const row = { id: `col_${randomUUID()}`, name, type, itemCount: 0, createdAt: at, updatedAt: at };
      return runAdminTransaction(database, async () => {
        await collections.insert(row, principal.accountId);
        await audit.record({ ...actor, principal }, {
          action: "collection.created", subject: row.id, detail: { name, type },
        });
        return row;
      });
    },
    async updateCollection(
      principal: Principal,
      id: string,
      patch: { name?: string; type?: "movie" | "tv" | "local" },
      actor: Actor,
    ) {
      const row = await existing(principal, id);
      if (patch.name !== undefined) await assertNameFree(principal, patch.name, id);
      return runAdminTransaction(database, async () => {
        await collections.update(principal.accountId, id, patch.name ?? row.name, patch.type ?? row.type, now());
        const saved = await existing(principal, id);
        await audit.record({ ...actor, principal }, {
          action: "collection.updated", subject: id, detail: { fields: Object.keys(patch) },
        });
        return saved;
      });
    },
    async removeCollection(principal: Principal, id: string, actor: Actor) {
      const row = await existing(principal, id);
      return runAdminTransaction(database, async () => {
        await collections.remove(principal.accountId, id);
        await audit.record({ ...actor, principal }, {
          action: "collection.deleted", subject: id, detail: { name: row.name },
        });
        return { removed: id };
      });
    },
    async setCollectionItem(
      principal: Principal, id: string, kind: "title" | "local", itemId: string,
      add: boolean, actor: Actor,
    ) {
      await existing(principal, id);
      return runAdminTransaction(database, async () => {
        if (add) await collections.addItem(id, kind, itemId, now());
        else await collections.removeItem(id, kind, itemId);
        const saved = await existing(principal, id);
        await audit.record({ ...actor, principal }, {
          action: add ? "collection.item_added" : "collection.item_removed",
          subject: id, detail: { kind, itemId },
        });
        return saved;
      });
    },
    async memberships(principal: Principal, kind: "title" | "local", id: string) {
      const ids = await collections.memberships(principal.accountId, kind, id);
      return { memberships: ids.map((collectionId) => ({ collectionId, source: "manual" as const })) };
    },
    async writeWatch(principal: Principal, input: {
      item: { kind: "title" | "local"; id: string }; season?: number; episode?: number;
      positionMs: number; durationMs?: number; playbackId: string; seq: number;
    }, actor: Actor) {
      const old = await watches.findIdentity(principal.accountId, {
        kind: input.item.kind, itemId: input.item.id, season: input.season, episode: input.episode,
      });
      const ownSettings = await settings(principal);
      const late = old?.playbackId === input.playbackId && input.seq <= old.seq;
      if (ownSettings.settings.pauseHistory === true || late) {
        return { applied: false, entry: old === undefined ? null : watchView(old) };
      }
      const position = clampPosition(input.positionMs, input.durationMs);
      const state = entryState(old?.state, position, input.durationMs, ownSettings.settings.watchedPercent ?? 90);
      return runAdminTransaction(database, async () => {
        const row = await watches.upsert(principal.accountId, {
          id: old?.id ?? randomUUID(), itemKind: input.item.kind, itemId: input.item.id,
          ...(input.season !== undefined && { season: input.season }),
          ...(input.episode !== undefined && { episode: input.episode }), positionMs: position,
          ...(input.durationMs !== undefined && { durationMs: input.durationMs }), state, updatedAt: now(),
          playbackId: input.playbackId, seq: input.seq,
        });
        await audit.record({ ...actor, principal }, {
          action: "watch.updated", subject: row.id,
          detail: { kind: input.item.kind, itemId: input.item.id, state },
        });
        return { applied: true, entry: watchView(row) };
      });
    },
    async dropWatch(principal: Principal, id: string, actor: Actor) {
      return runAdminTransaction(database, async () => {
        if (!(await watches.remove(principal.accountId, id))) {
          throw new AppError("watch.not_found", 404, "There is no such watch entry.");
        }
        await audit.record({ ...actor, principal }, { action: "watch.deleted", subject: id });
        return { removed: id };
      });
    },
    clearWatch: (principal: Principal, actor: Actor) => runAdminTransaction(database, async () => {
      const cleared = await watches.clear(principal.accountId);
      await audit.record({ ...actor, principal }, {
        action: "watch.cleared", subject: principal.accountId, detail: { cleared },
      });
      return { cleared };
    }),
    listWatch: (principal: Principal) =>
      watches.list(principal.accountId).then((rows) => ({ entries: rows.map(watchView) })),
  };
}

export type AccountDataService = ReturnType<typeof createAccountDataService>;
