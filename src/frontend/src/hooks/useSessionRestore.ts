import { useEffect } from "react";
import { authPort } from "@/services/auth-port";
import { mergeAccountSettings } from "@/services/settings-merge";
import { useAppStore } from "@/store/app-store";

/** The boot's bound on the restore probe: the same length as the app's boot fallback (useAppHydration's 1500 ms).
 *  Past it the gate shows rather than the window hanging on a silent backend; a probe that lands late is dropped,
 *  because the slice counts only the first answer. */
const RESTORE_LIMIT_MS = 1_500;

/** On load, before the gate decides (`62` section 3.5): ask the port once whether the httpOnly refresh cookie still
 *  names a session, hand the answer to the store and - restored - run the one-time settings merge of `62` D8. The
 *  port shares one probe between callers, so a double mount sends one restore. */
export function useSessionRestore(): void {
  const finishRestore = useAppStore((state) => state.finishRestore);
  useEffect(() => {
    if (!useAppStore.getState().restoring) return;
    let late = false;
    const timeout = window.setTimeout(() => {
      late = true;
      finishRestore(null);
    }, RESTORE_LIMIT_MS);
    void authPort.restore().then((session) => {
      if (late) return;
      window.clearTimeout(timeout);
      finishRestore(session);
      if (session !== null) void mergeAccountSettings();
    });
    return () => window.clearTimeout(timeout);
  }, [finishRestore]);
}
