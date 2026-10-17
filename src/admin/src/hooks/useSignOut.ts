import { useCallback } from "react";
import { SIGNED_OUT_NOTICE } from "@/constants/sign-in-copy";
import { authPort } from "@/services/auth";
import { useAppStore } from "@/store/app-store";

/** Sign out: tell the port, then clear the session whatever the answer was (`29` section 6.1), then say so. */
export function useSignOut(): () => Promise<void> {
  const signOut = useAppStore((state) => state.signOut);
  const say = useAppStore((state) => state.say);

  return useCallback(async () => {
    await authPort.signOut().catch(() => undefined);
    signOut();
    say(SIGNED_OUT_NOTICE);
  }, [signOut, say]);
}
