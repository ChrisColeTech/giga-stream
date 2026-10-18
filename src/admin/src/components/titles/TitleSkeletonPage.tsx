import { FileText, Layers, Plug, Users } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { SkeletonFields } from "@/components/records/SkeletonFields";
import type { TitleSpy } from "./TitleFrame";

/* The rows each group will hold, so the shimmer lines stand where the fields land. */
const DETAILS_ROWS = 12;
const PEOPLE_ROWS = 2;
const SEASON_ROWS = 3;
const SOURCE_ROWS = 3;

/** A title's workspace before its detail answers (`37` section 4.3): the same groups, in the same order, each wearing
 *  shimmer lines in its shape; no sentence over them. A movie has no Seasons group. */
export function TitleSkeletonPage({ series, bind }: { readonly series: boolean; readonly bind: TitleSpy["bind"] }) {
  return (
    <>
      <div ref={bind("tw-details")}>
        <Group id="tw-details" icon={FileText} title="Details">
          <SkeletonFields count={DETAILS_ROWS} />
        </Group>
      </div>
      <div ref={bind("tw-people")}>
        <Group id="tw-people" icon={Users} title="People and plot">
          <SkeletonFields count={PEOPLE_ROWS} />
        </Group>
      </div>
      {series && (
        <div ref={bind("tw-seasons")}>
          <Group id="tw-seasons" icon={Layers} title="Seasons">
            <SkeletonFields count={SEASON_ROWS} />
          </Group>
        </div>
      )}
      <div ref={bind("tw-sources")}>
        <Group id="tw-sources" icon={Plug} title="Sources" last>
          <SkeletonFields count={SOURCE_ROWS} />
        </Group>
      </div>
    </>
  );
}
