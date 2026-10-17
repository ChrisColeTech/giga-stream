import { X } from "lucide-react";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import type { ItemRef } from "@/types/library";
import { CollectionIconAction } from "./CollectionIconAction";

/** A member's remove control: takes the title out of this collection and leaves the title itself alone. */
export function MemberRemoveAction({
  collectionId,
  memberRef,
  title,
}: {
  readonly collectionId: string;
  readonly memberRef: ItemRef;
  readonly title: string;
}) {
  const verbs = useCollectionVerbs();
  return (
    <CollectionIconAction
      icon={X}
      label={`Remove ${title}`}
      onPress={() => void verbs.removeMember(collectionId, memberRef)}
    />
  );
}
