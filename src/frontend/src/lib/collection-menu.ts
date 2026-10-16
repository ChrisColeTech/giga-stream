import type { CollectionRow } from "@/types/collection";
import type { MenuItem } from "@/types/menu";

type Submenu = Extract<MenuItem, { kind: "submenu" }>;

/**
 * The `Collections ▸` submenu of `06` section 4.5 (the family standard): one row per collection, with a check mark for
 * membership, and a click toggles membership inline with no dialog. With no collection, one disabled row says why.
 *
 * Pure: the caller supplies membership and the toggle, so the same submenu serves a card's menu, Title information and
 * the Player's Watch block.
 */
export function collectionsSubmenu(
  collections: readonly CollectionRow[],
  isMember: (collectionId: string) => boolean,
  toggle: (collectionId: string) => void,
): Submenu {
  const items: Submenu["items"] =
    collections.length === 0
      ? [
          {
            kind: "action",
            label: "No collections yet",
            disabled: true,
            disabledReason: "Create one from Manage collections in the Library rail.",
            onSelect: () => undefined,
          },
        ]
      : collections.map((collection) => ({
          kind: "action" as const,
          label: collection.name,
          checked: isMember(collection.id),
          onSelect: () => toggle(collection.id),
        }));
  return { kind: "submenu", label: "Collections", items };
}
