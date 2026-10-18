import { useAppStore } from "@/store/app-store";
import { createSessionApi } from "./session-api";

/** THE ONE FILE THAT CALLS `fetch` (`01` section 4.1; a source-scan test holds it to that): the request layer wired to
 *  the app's store. Paths are same-origin `/api/...` (the Vite proxy in development, the backend itself in production).
 *  Tokens live in the store, in memory, and nowhere else; the refresh token's only other home is the backend's httpOnly
 *  cookie, which no script can read. Every service module calls `request`. */
export const sessionApi = createSessionApi({
  /* Same-origin credentials carry the httpOnly refresh cookie; there is no CORS, so no other origin ever gets one. */
  fetch: (input, init) => fetch(input, { ...init, credentials: "same-origin" }),
  now: () => Date.now(),
  tokens: () => useAppStore.getState().tokens,
  adopt: (tokens) => useAppStore.getState().adoptTokens(tokens),
  end: (sentence) => {
    const state = useAppStore.getState();
    if (state.signedIn) state.endSession(sentence);
  },
});

export const request = sessionApi.request;
export const stream = sessionApi.stream;
