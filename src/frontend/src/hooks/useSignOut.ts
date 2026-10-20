import { useCallback } from "react";
import { SIGNED_OUT_NOTICE } from "@/constants/gate-copy";
import { authPort } from "@/services/auth-port";
import { useAppStore } from "@/store/app-store";

/** Sign out: tell the port, then clear the session whatever the answer was (`62` section 3.5), then say so. The
 *  device's local state is kept - nothing is wiped (`62` D8); the gate returns over the shell as it stands. */
export function useSignOut(): () => Promise<void> {
  const signOut = useAppStore((state) => state.signOut);
  const say = useAppStore((state) => state.say);

  return useCallback(async () => {
    await authPort.signOut();
    signOut();
    say(SIGNED_OUT_NOTICE);
  }, [signOut, say]);
}
