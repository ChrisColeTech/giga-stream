import { useCallback } from "react";
import { REFUSAL_SENTENCES, SIGNED_IN_NOTICE } from "@/constants/sign-in-copy";
import { authPort } from "@/services/auth";
import { useAppStore } from "@/store/app-store";
import type { AuthResult } from "@/types/auth";

/** The Sign in verb: marks the gate submitting, awaits the port, hands the answer to the store and says it on the notice
 *  line (the audit log is read by `useSessionState`, called by the shell once the session starts). A port that rejects counts as unreachable. A second call while one is waiting sends nothing and answers null. */
export function useSignIn(): (username: string, password: string) => Promise<AuthResult | null> {
  const beginSignIn = useAppStore((state) => state.beginSignIn);
  const finishSignIn = useAppStore((state) => state.finishSignIn);
  const say = useAppStore((state) => state.say);

  return useCallback(
    async (username, password) => {
      if (useAppStore.getState().gate.phase === "submitting") return null;
      beginSignIn();
      const result = await authPort
        .signIn(username.trim(), password)
        .catch((): AuthResult => ({ ok: false, refusal: "unreachable" }));
      finishSignIn(result);
      if (result.ok) say(SIGNED_IN_NOTICE);
      else say(REFUSAL_SENTENCES[result.refusal], "warn", "Session");
      return result;
    },
    [beginSignIn, finishSignIn, say],
  );
}
