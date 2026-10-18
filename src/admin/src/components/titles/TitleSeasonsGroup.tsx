import { Layers } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SeasonList } from "@/components/records/SeasonList";
import { SkeletonFields } from "@/components/records/SkeletonFields";
import type { SeasonDraft } from "@/lib/season-edit";
import { seasonCounts } from "@/lib/title-seasons";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";

export interface TitleSeasonsGroupProps {
  readonly detail: AdminTitleDetail;
  readonly manual: boolean;
  readonly seasons: readonly SeasonDraft[];
  readonly error: string | undefined;
  readonly onChange: (seasons: SeasonDraft[]) => void;
}

const SKELETON_ROWS = 2;

/** `Seasons` (`37` section 4.3; a series only): the editable ordered `SeasonList` for a series made by hand; a synced
 *  series' seasons read-only with their episode counts (shimmer lines when it has none). A movie has no such group. */
export function TitleSeasonsGroup({ detail, manual, seasons, error, onChange }: TitleSeasonsGroupProps) {
  const counts = seasonCounts(detail);
  return (
    <Group id="tw-seasons" icon={Layers} title="Seasons" last>
      {manual ? (
        <>
          <SeasonList seasons={seasons} onChange={onChange} />
          {error !== undefined && (
            <p className="m-0 text-sm leading-5 text-st-failed" role="alert">
              {error}
            </p>
          )}
        </>
      ) : counts.length === 0 ? (
        <SkeletonFields count={SKELETON_ROWS} />
      ) : (
        counts.map((season) => (
          <Row key={season.season} label={`Season ${season.season}`}>
            <span className="flex h-9 items-center font-mono text-sm text-muted">{season.episodes}</span>
          </Row>
        ))
      )}
    </Group>
  );
}
