import { Check, CircleStop, FolderMinus, FolderSync, RefreshCw } from "lucide-react";
import { useArmedAction } from "@/hooks/useArmedAction";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import {
  ARM_TIMEOUT_MS,
  FOLDER_ARMED_LABEL,
  FOLDER_CONSEQUENCE,
  SCANNING_REASON,
} from "@/lib/collections-copy";
import type { CollectionFolder } from "@/types/collection";
import { useAppStore } from "@/store/app-store";
import { CollectionIconAction } from "./CollectionIconAction";

/** One folder's controls in the folders table: Replace, Rescan, Cancel scan (only while scanning) and Remove. Rescan is
 *  disabled only while the folder is already scanning. Remove is a two-step (`01` section 9): the first press arms it,
 *  which shows the consequence in words beside a check; the check removes the folder. A timeout, focus leaving, or the
 *  window closing disarms it. */
export function FolderControls({ folder }: { readonly folder: CollectionFolder }) {
  const verbs = useCollectionVerbs();
  const { armed, arm, disarm } = useArmedAction(ARM_TIMEOUT_MS);
  const scanning = folder.scan === "scanning";
  const desktop = useAppStore((state) => state.runtime === "electron");

  if (armed) {
    return (
      <span className="inline-flex items-center justify-end gap-2">
        <span role="status" className="text-right text-sm leading-4 whitespace-normal text-muted">
          {FOLDER_CONSEQUENCE}
        </span>
        <CollectionIconAction
          icon={Check}
          label={FOLDER_ARMED_LABEL}
          onPress={() => {
            disarm();
            void verbs.removeFolder(folder.id);
          }}
          onBlur={disarm}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <CollectionIconAction
        icon={FolderSync}
        label="Replace folder"
        reason={desktop ? undefined : "This action is available in the desktop app."}
        onPress={() => void verbs.replace(folder.id)}
      />
      <CollectionIconAction
        icon={RefreshCw}
        label="Rescan folder"
        reason={scanning ? SCANNING_REASON : undefined}
        onPress={() => void verbs.rescan(folder.id)}
      />
      {scanning && (
        <CollectionIconAction icon={CircleStop} label="Cancel scan" onPress={() => void verbs.cancelScan(folder.id)} />
      )}
      <CollectionIconAction icon={FolderMinus} label="Remove folder" onPress={arm} />
    </span>
  );
}
