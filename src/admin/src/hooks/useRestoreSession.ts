import { useEffect } from "react";
import { authPort } from "@/services/auth";
import { useAppStore } from "@/store/app-store";

/** On load, before the gate shows: ask the port once whether the httpOnly refresh cookie still names a session, and hand
 *  the answer to the store. The port shares one call between mounts, so a double mount sends one refresh; nothing else
 *  refreshes until a session exists, so the probe races no other refresh. */
export function useRestoreSession(): void {
  const finishRestore = useAppStore((state) => state.finishRestore);
  useEffect(() => {
    if (!useAppStore.getState().restoring) return;
    void authPort.restore().then(finishRestore, () => finishRestore(null));
  }, [finishRestore]);
}
