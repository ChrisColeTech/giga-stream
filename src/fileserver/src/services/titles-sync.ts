import { CATALOG_PAGE_SIZE, CATALOG_ROWS_MAX } from "../constants/backend-cache.js";
import { decodeGenres } from "../lib/genre-decode.js";
import type { CacheStateRepository } from "../store/cache-state-repository.js";
import type { CachedTitleRepository } from "../store/cached-title-repository.js";
import type { DatasetSync, SyncOutcome } from "../types/backend-cache.js";
import { badResponse, unreachable, type AdminFailure } from "./admin-client.js";
import type { AdminCatalog } from "./admin-catalog.js";
import type { TitleKind } from "./admin-titles.js";

const KINDS: readonly TitleKind[] = ["movie", "tv"];

/**
 * The titles sync (docs/46 section C): the genre dictionary, then the catalog walked page by page, each page one
 * transaction of upserts, then a sweep of the titles the walk did not see. `synced_at` is stamped only when the walk
 * ended normally (and the sweep with it, in one transaction); a failure, a cursor that does not advance, a walk past the
 * row cap or a quit leaves every row alone and stamps only the error code. Public reads only: nothing is sent but GETs.
 */
export function createTitlesSync(deps: {
  catalog: AdminCatalog;
  titles: CachedTitleRepository;
  state: CacheStateRepository;
}): DatasetSync {
  const { catalog, titles, state } = deps;

  return async ({ baseUrl, sourceKey, startedAt, signal }): Promise<SyncOutcome> => {
    const quit: SyncOutcome = { ok: false, failure: unreachable };
    const fail = (failure: AdminFailure): SyncOutcome => {
      state.markFailed("titles", failure.code);
      return { ok: false, failure };
    };
    const run = state.nextRun("titles");

    // The dictionaries: a failed read keeps the stored one; with none stored there is nothing to decode with.
    for (const kind of KINDS) {
      const answer = await catalog.genres(baseUrl, kind, signal);
      if (signal.aborted) return quit;
      if (answer.ok) titles.replaceGenres(kind, answer.value);
      else if (titles.genreNames(kind).size === 0) return fail(answer.failure);
    }
    const names = new Map(KINDS.map((kind) => [kind, titles.genreNames(kind)]));

    let after: string | undefined;
    let seen = 0;
    for (;;) {
      if (signal.aborted) return quit;
      const answer = await catalog.page(baseUrl, after, CATALOG_PAGE_SIZE, signal);
      if (signal.aborted) return quit;
      if (!answer.ok) return fail(answer.failure);
      seen += answer.value.items.length;
      if (seen > CATALOG_ROWS_MAX) return fail(badResponse);
      titles.upsertPage(
        answer.value.items.map((item) => ({ ...item, genres: decodeGenres(item.genres, names.get(item.kind) ?? new Map()) })),
        run,
      );
      const next = answer.value.next;
      if (next === undefined) break;
      if (after !== undefined && next <= after) return fail(badResponse);
      after = next;
    }

    if (signal.aborted) return quit;
    state.commitSynced("titles", { sourceKey, syncedAt: startedAt, revision: null }, () => titles.sweep(run));
    return { ok: true };
  };
}
