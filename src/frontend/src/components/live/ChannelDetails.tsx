import { detailRows } from "@/lib/live-details";
import { DETAILS_HEADING } from "@/lib/live-constants";
import type { Channel } from "@/types/channel";

/** The details block pinned under the channel list, as LoRA Studio pins its job details under the queue
 *  (components/generate/JobDetails.tsx): a mono heading, then the selected channel's name, category, number and
 *  revision as key and value, a dash where nothing is selected. It does not scroll with the list. */
export function ChannelDetails({ channel }: { readonly channel: Channel | null }) {
  return (
    <div className="flex flex-none flex-col gap-2.5 border-t border-border bg-surface p-2.75">
      <div className="font-mono text-xs text-text">{channel?.name ?? DETAILS_HEADING}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 font-mono text-xs">
        {detailRows(channel).map((row) => (
          <div key={row.label} className="contents">
            <span className="text-faint">{row.label}</span>
            <span className="min-w-0 break-words text-muted">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
