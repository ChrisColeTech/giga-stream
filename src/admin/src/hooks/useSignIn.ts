import { useCallback } from "react";
import { REFUSAL_SENTENCES, SIGNED_IN_NOTICE } from "@/constants/sign-in-copy";
import { authPort } from "@/services/auth";
import { useAppStore } from "@/store/app-store";
import type { AuthResult } from "@/types/auth";

/** The Sign in verb: marks the gate submitting, awaits the port, hands the answer to the store and says it on the notice
 *  line. A port that rejects counts as unreachable. A second call while one is waiting sends nothing and answers null. */
export function useSignIn(): (email: string, password: string) => Promise<AuthResult | null> {
  const beginSignIn = useAppStore((state) => state.beginSignIn);
  const finishSignIn = useAppStore((state) => state.finishSignIn);
  const say = useAppStore((state) => state.say);
  const loadAudit = useAppStore((state) => state.loadAudit);

  return useCallback(
    async (email, password) => {
      if (useAppStore.getState().gate.phase === "submitting") return null;
      beginSignIn();
      const result = await authPort
        .signIn(email.trim(), password)
        .catch((): AuthResult => ({ ok: false, refusal: "unreachable" }));
      finishSignIn(result);
      if (result.ok) {
        say(SIGNED_IN_NOTICE);
        void loadAudit();
      } else say(REFUSAL_SENTENCES[result.refusal], "warn", "Session");
      return result;
    },
    [beginSignIn, finishSignIn, say, loadAudit],
  );
}
