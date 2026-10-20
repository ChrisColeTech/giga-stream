import { useCallback } from "react";
import { REFUSAL_SENTENCES, SIGNED_IN_NOTICE } from "@/constants/gate-copy";
import { authPort } from "@/services/auth-port";
import { mergeAccountSettings } from "@/services/settings-merge";
import { useAppStore } from "@/store/app-store";
import type { AuthResult } from "@/types/auth";

/** The gate's Sign in verb: marks the gate submitting, awaits the port, hands the answer to the store, says it and -
 *  accepted - runs the one-time merge of `62` D8 (the account's settings win, the drawer speaks). A port that rejects
 *  counts as unreachable. A second call while one is waiting sends nothing and answers null. */
export function useSignIn(): (username: string, password: string) => Promise<AuthResult | null> {
  const beginSignIn = useAppStore((state) => state.beginSignIn);
  const finishSignIn = useAppStore((state) => state.finishSignIn);
  const say = useAppStore((state) => state.say);

  return useCallback(async (username, password) => {
    if (useAppStore.getState().gate.phase === "submitting") return null;
    beginSignIn();
    const result = await authPort
      .signIn(username.trim(), password)
      .catch((): AuthResult => ({ ok: false, refusal: "unreachable" }));
    finishSignIn(result);
    if (result.ok) {
      say(SIGNED_IN_NOTICE);
      await mergeAccountSettings();
    } else {
      say(REFUSAL_SENTENCES[result.refusal], "warn");
    }
    return result;
  }, [beginSignIn, finishSignIn, say]);
}
