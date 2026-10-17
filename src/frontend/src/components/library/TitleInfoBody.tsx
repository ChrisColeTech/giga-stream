import { Clapperboard } from "lucide-react";
import { Group, Row, Wide } from "@/components/ui/Form";
import { NAME_CHIP } from "@/components/ui/name-chip";
import { PosterImage } from "@/components/ui/PosterImage";
import { SHIMMER } from "@/components/ui/SkeletonRows";
import { cn } from "@/lib/cn";
import { durationLabel, identityLine, ratingLabel, seasonsLabel } from "@/lib/library-facts";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import type { TitleDetail } from "@/types/title";
import { TitleWatchBlock } from "./TitleWatchBlock";

/** The labels the body's rows can carry, so the window sizes its label column once. */
export const TITLE_INFO_LABELS = ["Identity", "Genres", LIBRARY_COPY.rating, LIBRARY_COPY.seasons, "Progress"] as const;

/* A read-only value, in LoRA's About pane style. */
const FACT = "flex min-h-9 items-center font-mono text-sm text-muted";

export interface TitleInfoBodyProps {
  readonly item: ResolvedItem;
  /** The title's detail; absent while it is not read, drawn as shimmer lines. A local file never has one. */
  readonly detail: TitleDetail | undefined;
}

/** Title information's one group on the family page grammar: the title as the heading, the 180px poster beside the
 *  plot, then each fact as a row, and the watch progress last. */
export function TitleInfoBody({ item, detail }: TitleInfoBodyProps) {
  const local = item.kind === "local";
  const progress = item.progress;
  return (
    /* Not foldable: the window holds this one group, and folding it would leave only the actions. */
    <Group
      icon={Clapperboard}
      title={item.title}
      badge={item.year === undefined ? undefined : String(item.year)}
      collapsible={false}
      last
    >
      <Wide className="flex gap-4">
        <div className="w-[180px] flex-none">
          <PosterImage src={item.posterUrl} alt={item.title} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {!local && detail === undefined && (
            <>
              <span className={cn(SHIMMER, "w-[95%]")} />
              <span className={cn(SHIMMER, "w-[88%]")} />
              <span className={cn(SHIMMER, "w-[70%]")} />
            </>
          )}
          {detail?.plot !== undefined && <p className="m-0 text-sm leading-5 text-muted">{detail.plot}</p>}
        </div>
      </Wide>
      <Row label="Identity">
        <span className={FACT}>{identityLine(item)}</span>
      </Row>
      {item.genres.length > 0 && (
        <Row label="Genres" align="start">
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 py-2" aria-label="Genres">
            {item.genres.map((name) => (
              <li key={name} className={NAME_CHIP}>
                {name}
              </li>
            ))}
          </ul>
        </Row>
      )}
      {detail?.rating !== undefined && (
        <Row label={LIBRARY_COPY.rating}>
          <span className={FACT}>{ratingLabel(detail.rating)}</span>
        </Row>
      )}
      {detail?.runtimeMs !== undefined && (
        <Row label={LIBRARY_COPY.runtime}>
          <span className={FACT}>{durationLabel(detail.runtimeMs)}</span>
        </Row>
      )}
      {detail?.seasons !== undefined && (
        <Row label={LIBRARY_COPY.seasons}>
          <span className={FACT}>{seasonsLabel(detail.seasons)}</span>
        </Row>
      )}
      {detail !== undefined && detail.cast.length > 0 && (
        <Row label={LIBRARY_COPY.cast} align="start">
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 py-2" aria-label={LIBRARY_COPY.cast}>
            {detail.cast.map((name) => (
              <li key={name} className={NAME_CHIP}>
                {name}
              </li>
            ))}
          </ul>
        </Row>
      )}
      {progress !== undefined && (
        <Row label="Progress">
          <TitleWatchBlock progress={progress} />
        </Row>
      )}
    </Group>
  );
}
