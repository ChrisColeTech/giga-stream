import { useCallback, useEffect, useReducer, useRef } from "react";
import { SIGNED_IN_NOTICE } from "@/constants/gate-copy";
import { nextRegistration, REGISTRATION_START, type RegistrationState } from "@/lib/registration-state";
import { registrationError } from "@/lib/registration-verb";
import { authPort } from "@/services/auth-port";
import { mergeAccountSettings } from "@/services/settings-merge";
import { useAppStore } from "@/store/app-store";
import type { RegistrationInput, RegistrationResult } from "@/types/auth";

export interface RegistrationHook {
  readonly state: RegistrationState;
  readonly register: (input: RegistrationInput) => Promise<RegistrationResult | null>;
  readonly reset: () => void;
}

/** Owns registration request identity, so double submits and answers from an abandoned form cannot start a session. */
export function useRegister(): RegistrationHook {
  const [state, dispatch] = useReducer(nextRegistration, REGISTRATION_START);
  const active = useRef(0);
  const waiting = useRef(false);
  const mounted = useRef(true);
  const adoptSession = useAppStore((value) => value.adoptSession);
  const say = useAppStore((value) => value.say);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current += 1; };
  }, []);

  const reset = useCallback(() => {
    active.current += 1;
    waiting.current = false;
    dispatch({ type: "reset" });
  }, []);

  const register = useCallback(async (input: RegistrationInput): Promise<RegistrationResult | null> => {
    if (waiting.current) return null;
    const error = registrationError(input);
    if (error !== null) {
      dispatch({ type: "refused", error });
      return null;
    }
    if (input.securityQuestion === null) return null;
    const requestId = active.current + 1;
    active.current = requestId;
    waiting.current = true;
    dispatch({ type: "submit", requestId });
    const result = await authPort.register({
      ...input,
      username: input.username.trim(),
      securityQuestion: input.securityQuestion,
    });
    if (!mounted.current || active.current !== requestId) return result;
    waiting.current = false;
    dispatch({ type: "answered", requestId, result });
    if (result.ok) {
      adoptSession(result.session);
      say(SIGNED_IN_NOTICE);
      await mergeAccountSettings();
    }
    return result;
  }, [adoptSession, say]);

  return { state, register, reset };
}
