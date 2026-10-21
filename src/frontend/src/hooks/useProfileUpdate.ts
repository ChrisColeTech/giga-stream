import { useCallback, useEffect, useReducer, useRef } from "react";
import { nextProfile, PROFILE_START, type ProfileState } from "@/lib/profile-state";
import { profileUsernameError } from "@/lib/profile-verb";
import { authPort } from "@/services/auth-port";
import { useAppStore } from "@/store/app-store";
import type { ProfileResult } from "@/types/auth";

export interface ProfileUpdateHook {
  readonly state: ProfileState;
  readonly updateUsername: (username: string) => Promise<ProfileResult | null>;
  readonly reset: () => void;
}

export function useProfileUpdate(): ProfileUpdateHook {
  const [state, dispatch] = useReducer(nextProfile, PROFILE_START);
  const active = useRef(0);
  const waiting = useRef(false);
  const mounted = useRef(true);
  const updateActor = useAppStore((value) => value.updateSessionActor);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current += 1; };
  }, []);

  const reset = useCallback(() => {
    active.current += 1;
    waiting.current = false;
    dispatch({ type: "reset" });
  }, []);

  const updateUsername = useCallback(async (username: string): Promise<ProfileResult | null> => {
    if (waiting.current) return null;
    const error = profileUsernameError(username);
    if (error !== null) {
      dispatch({ type: "refused", sentence: error });
      return null;
    }
    const requestId = active.current + 1;
    active.current = requestId;
    waiting.current = true;
    dispatch({ type: "submit", requestId });
    const result = await authPort.updateUsername(username.trim());
    if (!mounted.current || active.current !== requestId) return result;
    waiting.current = false;
    dispatch({ type: "answered", requestId, result });
    if (result.ok) updateActor(result.actor);
    return result;
  }, [updateActor]);

  return { state, updateUsername, reset };
}
