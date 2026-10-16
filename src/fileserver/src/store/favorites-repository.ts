import type { ItemKind } from "./collection-repository.js";
import type { Database } from "./database.js";

/** The favorites table (001): an item kind and id with the time it was added. */
export interface FavoritesRepository {
  isFavorite(kind: ItemKind, itemId: string): boolean;
  /** Idempotent: adding one that is there is no change (docs/03 section 3.12). */
  add(kind: ItemKind, itemId: string, at: number): void;
  /** Idempotent the other way: removing one that is not there is no change. */
  remove(kind: ItemKind, itemId: string): void;
}

export function createFavoritesRepository(db: Database): FavoritesRepository {
  const select = db.prepare("SELECT item_id FROM favorites WHERE item_kind = ? AND item_id = ?");
  const insert = db.prepare(
    "INSERT OR IGNORE INTO favorites (item_kind, item_id, added_at) VALUES (?, ?, ?)",
  );
  const remove = db.prepare("DELETE FROM favorites WHERE item_kind = ? AND item_id = ?");

  return {
    isFavorite(kind, itemId) {
      return select.get(kind, itemId) !== undefined;
    },
    add(kind, itemId, at) {
      insert.run(kind, itemId, at);
    },
    remove(kind, itemId) {
      remove.run(kind, itemId);
    },
  };
}
