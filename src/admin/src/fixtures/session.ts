/* The fixture session: who is signed in and Settings' About facts (`28` section 8). Example hosts only. Deleted by `29`,
 * when the backend answers `/api/auth/me` and `/healthz`. */

export interface SessionActor {
  readonly email: string;
  readonly name: string;
}

/** The actor the events sentences name (the mockup's `MOCK_ACTOR`). */
export const FIXTURE_ACTOR: SessionActor = { email: "ada@example.test", name: "Ada" };

/** The actor for an email typed on the sign-in page: the fixture actor for its own address, else a name from the part
 *  before the `@`. */
export function actorFor(email: string): SessionActor {
  const trimmed = email.trim();
  if (trimmed.toLowerCase() === FIXTURE_ACTOR.email) return FIXTURE_ACTOR;
  return { email: trimmed, name: trimmed.split("@")[0] ?? trimmed };
}

export interface AboutFacts {
  readonly version: string;
  readonly backendVersion: string;
  readonly backendRevision: string;
  /** Whether the backend has a TMDB key. */
  readonly tmdb: "configured" | "absent";
}

export const ABOUT_FACTS: AboutFacts = {
  version: "0.1.0",
  backendVersion: "0.1.0",
  backendRevision: "r-0000",
  tmdb: "configured",
};
