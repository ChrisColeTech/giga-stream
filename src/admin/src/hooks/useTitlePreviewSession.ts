import { useEffect, useRef, useState } from "react";
import { episodeSourceViews, firstSeasonOf, sourceViews, type TitleSourceView } from "@/lib/title-preview-state";
import { titles } from "@/services/titles";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";
import { useTitleDetail } from "./useTitleDetail";

export interface TitlePreviewSession {
  /** The title's detail once the existing detail flow answered it. */
  readonly detail: AdminTitleDetail | undefined;
  /** The detail read failed: the window says `missing` (the flow said its sentence). */
  readonly gone: boolean;
  /** The sources the `Provider` select offers: a movie's at once from its detail, a series' after the season read.
   *  Undefined while they are still unknown. */
  readonly sources: readonly TitleSourceView[] | undefined;
  /** The series' season read failed. */
  readonly failed: boolean;
  /** The detail or the season read is running. */
  readonly reading: boolean;
}

/** The title preview window's session (`55` decision 8): the title's detail through the EXISTING detail flow
 *  (`useTitleDetail`, `GET /api/titles/:id?includeDisabled=true` - the store's held detail carries a movie's sources),
 *  and a series' first episode's sources through the existing seasons read (`GET /api/titles/:id/seasons/:season`),
 *  read once per title, into the window's own state: the store's lists are never re-read and no page is dropped. */
export function useTitlePreviewSession(titleId: string): TitlePreviewSession {
  const detailState = useTitleDetail(titleId);
  const [season, setSeason] = useState<{ sources?: readonly TitleSourceView[]; failed: boolean } | null>(null);
  const readFor = useRef<string | null>(null);

  /* `value`'s type admits null (a held row, a kept earlier answer); only a `ready` answer is shown, so a re-read says
     `loading` again and a failed one says `missing`. */
  const detail = (detailState?.status === "ready" ? detailState.value : null) ?? undefined;
  const gone = detailState?.status === "failed";
  const reading = detailState === undefined || detailState.status === "loading";

  useEffect(() => {
    if (detail === undefined || detail.kind !== "tv") return;
    if (readFor.current === detail.id) return;
    readFor.current = detail.id;
    let open = true;
    void titles
      .episodes(detail.id, firstSeasonOf(detail))
      .then((answer) => {
        if (open) setSeason({ sources: episodeSourceViews(answer.episodes), failed: false });
      })
      .catch(() => {
        if (open) setSeason({ sources: [], failed: true });
      });
    return () => {
      open = false;
    };
  }, [detail]);

  const series = detail !== undefined && detail.kind === "tv";
  return {
    detail,
    gone,
    sources: series ? season?.sources : detail === undefined ? undefined : sourceViews(detail.sources ?? []),
    failed: season?.failed === true && series,
    reading: reading || (series && season === null),
  };
}