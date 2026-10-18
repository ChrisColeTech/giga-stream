import type { AdminTitleDetail } from "@/services/schemas/title-schema";

/* What the read-only parts of a title's workspace draw (`37` section 4.3), pure: the stream sources the providers
 * produce (derived, so never edited) and a synced series' seasons as counts. */

export interface SourceView {
  readonly key: string;
  readonly name: string;
  readonly url: string;
}

/** The detail's sources, narrowed: one with no name or address is left out. */
export function sourcesOf(detail: Pick<AdminTitleDetail, "sources">): SourceView[] {
  return (detail.sources ?? []).flatMap((source, index) => {
    const name = source["name"];
    const url = source["url"];
    return typeof name === "string" && typeof url === "string" ? [{ key: `${index}-${name}`, name, url }] : [];
  });
}

export interface SeasonCountView {
  readonly season: number;
  readonly episodes: string;
}

/** A synced series' seasons as their episode counts (`8 episodes`). */
export function seasonCounts(detail: Pick<AdminTitleDetail, "seasons">): SeasonCountView[] {
  return (detail.seasons ?? []).map((season) => {
    const count = season.episodeCount ?? season.episodes?.length ?? 0;
    return { season: season.season, episodes: `${count} ${count === 1 ? "episode" : "episodes"}` };
  });
}
