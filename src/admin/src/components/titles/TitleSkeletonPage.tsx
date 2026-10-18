import { FileText, ImageIcon, Layers, Users } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { SkeletonFields } from "@/components/records/SkeletonFields";
import type { TitleSpy } from "./TitleFrame";

/* The rows each group will hold, so the shimmer lines stand where the fields land. */
const DETAILS_ROWS = 10;
const PLOT_ROWS = 2;
const IMAGE_ROWS = 2;
const SEASON_ROWS = 3;

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
      <div ref={bind("tw-plot")}>
        <Group id="tw-plot" icon={Users} title="Plot">
          <SkeletonFields count={PLOT_ROWS} />
        </Group>
      </div>
      <div ref={bind("tw-images")}>
        <Group id="tw-images" icon={ImageIcon} title="Images" last={!series}>
          <SkeletonFields count={IMAGE_ROWS} />
        </Group>
      </div>
      {series && (
        <div ref={bind("tw-seasons")}>
          <Group id="tw-seasons" icon={Layers} title="Seasons" last>
            <SkeletonFields count={SEASON_ROWS} />
          </Group>
        </div>
      )}
    </>
  );
}
