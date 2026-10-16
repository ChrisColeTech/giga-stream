import type { Channel } from "@/types/channel";
import { EMPTY_VALUE } from "./live-constants";

export interface DetailRow {
  readonly label: string;
  readonly value: string;
}

/** The Details section's rows for the selected channel (`06` section 3.2): every row is present, and a dash stands in
 *  for each value when nothing is selected. */
export function detailRows(channel: Channel | null): readonly DetailRow[] {
  return [
    { label: "name", value: channel?.name ?? EMPTY_VALUE },
    { label: "category", value: channel?.category ?? EMPTY_VALUE },
    { label: "number", value: channel?.number ?? EMPTY_VALUE },
    { label: "revision", value: channel === null ? EMPTY_VALUE : String(channel.revision) },
  ];
}
