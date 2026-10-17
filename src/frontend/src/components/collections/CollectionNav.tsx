import { NavGroup, NavItem, NavRail } from "@/components/ui/NavRail";
import { LIST_LABEL } from "@/lib/collections-copy";
import type { CollectionRow } from "@/types/collection";

/* The collection workspace's rail, as LoRA's DatasetNav (components/dataset/DatasetNav.tsx): `← Collections`, the name
 * with its totals beneath, and the section nav. */
export const COLLECTION_SECTIONS = ["folders", "members"] as const;
export type CollectionSection = (typeof COLLECTION_SECTIONS)[number];
export const COLLECTION_SECTION_LABEL: Record<CollectionSection, string> = {
  folders: "Folders",
  members: "Members",
};

export interface CollectionNavProps {
  readonly collection: CollectionRow;
  readonly section: CollectionSection;
  readonly counts: Partial<Record<CollectionSection, number>>;
  readonly onSection: (id: CollectionSection) => void;
  readonly onBack: () => void;
}

export function CollectionNav({ collection, section, counts, onSection, onBack }: CollectionNavProps) {
  return (
    <NavRail
      ariaLabel="Collection"
      back={{ label: LIST_LABEL, onClick: onBack }}
      title={collection.name}
      subtitle={`${collection.total} items · ${collection.manual} manual`}
    >
      <NavGroup heading="Sections">
        {COLLECTION_SECTIONS.map((id) => (
          <NavItem key={id} selected={section === id} onClick={() => onSection(id)} count={counts[id]}>
            {COLLECTION_SECTION_LABEL[id]}
          </NavItem>
        ))}
      </NavGroup>
    </NavRail>
  );
}
