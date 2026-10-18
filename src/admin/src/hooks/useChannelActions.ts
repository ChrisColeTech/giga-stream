import { useCallback, useState } from "react";
import { ADDRESS_COPIED, ADDRESS_NOT_COPIED } from "@/constants/channel-copy";
import { chooseFolder, hostAvailable } from "@/services/admin-host";
import type { ChannelFlows } from "@/services/channel-flows";
import { useAppStore } from "@/store/app-store";
import { useChannelFlows } from "./useChannelFlows";

/** The Channels page's verbs over the flows, each marked busy for the length of its call so its control can say
 *  `Saving.`; plus the two device calls a control makes: the backend window's folder dialog and the clipboard. Keys:
 *  `create`, `save`, `delete:<id>`, `rebuild`, `revert`, `refresh`. */
export interface ChannelActions {
  readonly flows: ChannelFlows;
  /** True while any write is running. */
  readonly saving: boolean;
  readonly isBusy: (key: string) => boolean;
  readonly track: <T>(key: string, call: () => Promise<T>) => Promise<T>;
  /** Whether `Choose` can open a dialog here (the backend's own window); in a browser it cannot. */
  readonly canChoose: boolean;
  /** The chosen folder, or null when the dialog was cancelled. */
  readonly chooseFolder: () => Promise<string | null>;
  /** Copies an address and says whether it worked: a plain-http LAN page has no clipboard. */
  readonly copyAddress: (address: string) => void;
}

export function useChannelActions(): ChannelActions {
  const flows = useChannelFlows();
  const say = useAppStore((state) => state.say);
  const [busy, setBusy] = useState<readonly string[]>([]);
  const track = useCallback(async <T>(key: string, call: () => Promise<T>): Promise<T> => {
    setBusy((keys) => [...keys, key]);
    try {
      return await call();
    } finally {
      setBusy((keys) => keys.filter((one) => one !== key));
    }
  }, []);

  const copyAddress = useCallback(
    (address: string): void => {
      const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
      if (clipboard === undefined) {
        say(ADDRESS_NOT_COPIED, "warn", "Channel");
        return;
      }
      clipboard.writeText(address).then(
        () => say(ADDRESS_COPIED, "info", "Channel"),
        () => say(ADDRESS_NOT_COPIED, "warn", "Channel"),
      );
    },
    [say],
  );

  const writes = busy.filter((key) => key !== "refresh");
  return {
    flows,
    saving: writes.length > 0,
    isBusy: (key) => busy.includes(key),
    track,
    canChoose: hostAvailable(),
    chooseFolder,
    copyAddress,
  };
}
