import { fixtureAuthPort } from "@/fixtures/auth-port";
import type { AuthPort } from "@/types/auth";

/** The one auth port the app uses. Wave 7 (`29` section 6) replaces this file with the backend's login and logout and
 *  deletes the fixture; nothing that imports `authPort` changes. */
export const authPort: AuthPort = fixtureAuthPort;
