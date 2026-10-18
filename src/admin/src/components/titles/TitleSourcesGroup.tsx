import { Plug } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SkeletonFields } from "@/components/records/SkeletonFields";
import { sourcesOf } from "@/lib/title-sources";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";

const SKELETON_ROWS = 3;

/** `Sources` (`37` section 4.3): the stream sources the providers produce for this title, READ-ONLY because they are
 *  derived (the detail's `sources[]`): each provider's name and the address. A title with none shows shimmer lines,
 *  never a sentence. */
export function TitleSourcesGroup({ detail }: { readonly detail: AdminTitleDetail | null }) {
  const sources = detail === null ? [] : sourcesOf(detail);
  return (
    <Group id="tw-sources" icon={Plug} title="Sources" last>
      {sources.length === 0 ? (
        <SkeletonFields count={SKELETON_ROWS} />
      ) : (
        sources.map((source) => (
          <Row key={source.key} label={source.name}>
            <span className="flex h-9 min-w-0 items-center truncate font-mono text-xs text-muted" title={source.url}>
              {source.url}
            </span>
          </Row>
        ))
      )}
    </Group>
  );
}
