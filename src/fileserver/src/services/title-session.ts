import { z } from "zod";

import { AVAILABILITY_TTL_MS, PROVIDERS_TTL_MS, TITLE_SESSION_CAP } from "../constants/titles.js";
import type { BackendProvider, TitleDetail } from "../types/library.js";
import type { AdminResult } from "./admin-client.js";
import type { AdminTitles, TitleKind } from "./admin-titles.js";

/** TMDB's genres of one kind as the session holds them: names for facets, ids to decode rows. */
export interface GenreView {
  names: string[];
  byId: Map<string, string>;
  byName: Map<string, string>;
}

/** What the library reports about the backend's titles (docs/03 section 3.5). */
export interface TitlesAvailability {
  available: boolean;
  trending: boolean;
}

const HealthSchema = z.object({ tmdb: z.enum(["configured", "absent"]) });

/**
 * The session's in-memory view of the backend's titles (docs/03 sections 3.6 and 5.1): title
 * details for card facts, TMDB's genre lists, the active providers, and the availability the
 * library's flags report. Nothing here is ever written to disk.
 */
export function createTitleSession(deps: {
  admin: AdminTitles;
  adminUrl: () => string;
  /** `GET /healthz` through the channels half of the client: the availability read. */
  health: () => Promise<AdminResult<unknown>>;
  now: () => number;
}) {
  const { admin, adminUrl, health, now } = deps;
  /** Title id -> its detail, oldest dropped at the cap (03 section 3.6). */
  const details = new Map<string, TitleDetail>();
  const genres = new Map<TitleKind, GenreView>();
  /** The read in flight, so a page of rows decodes through one genre read. */
  const genreReads = new Map<TitleKind, Promise<GenreView | undefined>>();
  let providersView: { items: BackendProvider[]; readAt: number } | undefined;
  let availabilityView: TitlesAvailability | undefined;
  let healthView: { reachable: boolean; tmdbConfigured: boolean; readAt: number } | undefined;

  async function readGenres(kind: TitleKind): Promise<GenreView | undefined> {
    const answer = await admin.titleGenres(adminUrl(), kind);
    if (!answer.ok) return undefined;
    const view: GenreView = { names: [], byId: new Map(), byName: new Map() };
    for (const genre of answer.value) {
      view.names.push(genre.name);
      view.byId.set(String(genre.id), genre.name);
      view.byName.set(genre.name, String(genre.id));
    }
    genres.set(kind, view);
    return view;
  }

  return {
    rememberDetail(id: string, detail: TitleDetail): void {
      details.delete(id);
      details.set(id, detail);
      if (details.size > TITLE_SESSION_CAP) {
        const oldest = details.keys().next().value;
        if (oldest !== undefined) details.delete(oldest);
      }
    },

    heldDetail(id: string): TitleDetail | undefined {
      return details.get(id);
    },

    /** TMDB's genre names for one kind, read once per session (03 section 3.5). */
    async genreView(kind: TitleKind): Promise<GenreView | undefined> {
      const held = genres.get(kind);
      if (held !== undefined) return held;
      let read = genreReads.get(kind);
      if (read === undefined) {
        read = readGenres(kind);
        genreReads.set(kind, read);
        void read.then(() => genreReads.delete(kind));
      }
      return read;
    },

    /** The active providers, read on demand and kept for the TTL (03 section 3.6, 5.1). */
    async activeProviders(): Promise<BackendProvider[] | undefined> {
      if (providersView !== undefined && now() - providersView.readAt < PROVIDERS_TTL_MS) {
        return providersView.items.filter((provider) => provider.is_active);
      }
      const answer = await admin.providers(adminUrl());
      if (!answer.ok) return undefined;
      providersView = { items: answer.value.items, readAt: now() };
      return answer.value.items.filter((provider) => provider.is_active);
    },

    /** The last known availability; unknown before any read (03 section 4: a fact of the last read). */
    availability(): TitlesAvailability {
      return availabilityView ?? { available: false, trending: false };
    },

    noteAvailability(view: TitlesAvailability): void {
      availabilityView = view;
    },

    /** What one title read proved: a reached backend, or one that was not (03 section 5.1). */
    noteTitleRead(reached: boolean): void {
      availabilityView = { available: reached, trending: availabilityView?.trending ?? false };
    },

    /** The backend's health as the library's flags use it, kept for the TTL (03 section 5.1). */
    async health(): Promise<{ reachable: boolean; tmdbConfigured: boolean }> {
      if (healthView !== undefined && now() - healthView.readAt < AVAILABILITY_TTL_MS) return healthView;
      const answer = await health();
      const parsed = answer.ok ? HealthSchema.safeParse(answer.value) : undefined;
      const view = {
        reachable: answer.ok,
        tmdbConfigured: parsed !== undefined && parsed.success && parsed.data.tmdb === "configured",
        readAt: now(),
      };
      healthView = view;
      return view;
    },
  };
}

export type TitleSession = ReturnType<typeof createTitleSession>;
