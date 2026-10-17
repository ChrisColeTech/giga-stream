import { Fragment } from "react";
import { RailSection } from "@/components/ui/RailSection";
import { detailRows } from "@/lib/live-details";
import { DETAILS_HEADING, DETAILS_SECTION_ID } from "@/lib/live-constants";
import type { Channel } from "@/types/channel";

/** The Details section at the foot of the channels pane: the selected channel's name, category, number and revision, a
 *  sans label beside a mono value, a dash where nothing is selected. It folds like every rail group. */
export function ChannelDetails({ channel }: { readonly channel: Channel | null }) {
  return (
    <RailSection id={DETAILS_SECTION_ID} title={DETAILS_HEADING}>
      <dl className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 px-2 py-1">
        {detailRows(channel).map((row) => (
          <Fragment key={row.label}>
            <dt className="font-sans text-xs text-muted">{row.label}</dt>
            <dd className="min-w-0 truncate font-mono text-[11px] text-text tabular-nums">{row.value}</dd>
          </Fragment>
        ))}
      </dl>
    </RailSection>
  );
}
