import type { CollectionRow } from "@/types/collection";
import type { MenuItem } from "@/types/menu";
import type { MembershipSource } from "@/types/library";

type Submenu = Extract<MenuItem, { kind: "submenu" }>;
export const FOLDER_MEMBERSHIP_REASON = "This video comes from an attached folder.";

/**
 * The `Collections ▸` submenu of `06` section 4.5 (the family standard): one row per collection, with a check mark for
 * membership, and a click toggles membership inline with no dialog. With no collection, one disabled row says why.
 *
 * Pure: the caller supplies membership and the toggle, so the same submenu serves a card's menu, Title information and
 * the Player's Watch block.
 */
export function collectionsSubmenu(
  collections: readonly CollectionRow[],
  membership: (collectionId: string) => boolean | MembershipSource,
  toggle: (collectionId: string) => void,
): Submenu {
  const items: Submenu["items"] =
    collections.length === 0
      ? [
          {
            kind: "action",
            label: "No collections",
            disabled: true,
            disabledReason: "Create one from Manage collections in the Library rail.",
            onSelect: () => undefined,
          },
        ]
      : collections.map((collection) => {
          const source = membership(collection.id);
          const folder = source === "folder";
          return {
            kind: "action" as const,
            label: collection.name,
            checked: source !== false,
            disabled: folder,
            disabledReason: folder ? FOLDER_MEMBERSHIP_REASON : undefined,
            onSelect: () => toggle(collection.id),
          };
        });
  return { kind: "submenu", label: "Collections", items };
}
