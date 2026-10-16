import type { AdminChannel } from "./admin-client.js";
import type { ChannelSummary } from "../types/channel.js";

/**
 * The renderer's view of one published channel (docs/03 sections 3.4 and 5.2). A channel whose
 * stream address did not change keeps its last verdict until the next probe round replaces it;
 * anything else starts `unknown`.
 */
export function summaryOf(channel: AdminChannel, before: ReadonlyMap<string, ChannelSummary>): ChannelSummary {
  const summary: ChannelSummary = {
    id: channel.id,
    name: channel.name,
    category: channel.category,
    revision: channel.revision,
    streamUrl: channel.streamUrl,
    status: "unknown",
    ...(channel.logoUrl !== undefined && { logoUrl: channel.logoUrl }),
    ...(channel.number !== undefined && { number: channel.number }),
  };
  const previous = before.get(channel.id);
  if (previous && previous.streamUrl === summary.streamUrl) {
    summary.status = previous.status;
    if (previous.checkedAt !== undefined) summary.checkedAt = previous.checkedAt;
  }
  return summary;
}

/** The view with each probed address's verdict applied; an address that was not probed is untouched. */
export function withVerdicts(
  view: readonly ChannelSummary[],
  verdicts: ReadonlyMap<string, ChannelSummary["status"]>,
  at: number,
): ChannelSummary[] {
  return view.map((channel) => {
    const verdict = verdicts.get(channel.streamUrl);
    return verdict === undefined || verdict === "unknown" ? channel : { ...channel, status: verdict, checkedAt: at };
  });
}
