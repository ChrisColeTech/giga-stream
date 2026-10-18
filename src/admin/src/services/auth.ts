import type { AuthPort } from "@/types/auth";
import { sessionApi } from "./api";
import { createAuthPort } from "./auth-port";

/** The one auth port the app uses: the backend's login and logout (`29` section 6). */
export const authPort: AuthPort = createAuthPort(sessionApi);
