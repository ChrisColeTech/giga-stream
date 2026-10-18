import type { TitleInventory } from "@/services/schemas/title-stored-schema";

/** The list heading's count (`docs/41` section 5.2, `01` section 9 Headings: tile, title and badge): how many titles the
 *  store holds, whatever the filters (`10,921`). A number only, no sentence; undefined until the first page answers. */
export function storedBadge(inventory: TitleInventory | null): string | undefined {
  return inventory === null ? undefined : (inventory.movie + inventory.tv).toLocaleString("en-US");
}
