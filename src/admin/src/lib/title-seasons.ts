import type { AdminTitleDetail } from "@/services/schemas/title-schema";

/* What the read-only part of a title's workspace draws (`37` section 4.3), pure: a synced series' seasons as counts. */

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
