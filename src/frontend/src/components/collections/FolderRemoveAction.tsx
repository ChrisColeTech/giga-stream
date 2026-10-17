import { Check, FolderMinus } from "lucide-react";
import { useArmedAction } from "@/hooks/useArmedAction";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { ARM_TIMEOUT_MS, CONSEQUENCE, FOLDER_ARMED_LABEL } from "@/lib/collections-copy";
import { CollectionIconAction } from "./CollectionIconAction";

/** A folder's Remove as a two-step (`01` section 9): the first press arms the control, which then shows a check and names
 *  the consequence; the second press removes the folder. A timeout or focus leaving disarms it. */
export function FolderRemoveAction({ folderId }: { readonly folderId: string }) {
  const verbs = useCollectionVerbs();
  const { armed, arm, disarm } = useArmedAction(ARM_TIMEOUT_MS);

  const onPress = () => {
    if (!armed) {
      arm();
      return;
    }
    disarm();
    verbs.removeFolder(folderId);
  };

  return armed ? (
    <CollectionIconAction
      icon={Check}
      label={FOLDER_ARMED_LABEL}
      title={`${FOLDER_ARMED_LABEL} ${CONSEQUENCE}`}
      onPress={onPress}
      onBlur={disarm}
    />
  ) : (
    <CollectionIconAction icon={FolderMinus} label="Remove folder" onPress={onPress} />
  );
}
