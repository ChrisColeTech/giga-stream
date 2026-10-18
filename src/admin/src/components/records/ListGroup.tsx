import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Group } from "@giga/ui/form/Group";
import { Wide } from "@giga/ui/form/Wide";

export interface ListGroupProps {
  /** Prefixed by the page (`ch-list`), so two groups never fold together. */
  readonly id: string;
  readonly icon: LucideIcon;
  /** `Channels`. */
  readonly title: string;
  /** The table strip (`TableStrip`) directly above the list: Refresh, paging and the bulk verbs. The heading has no slot. */
  readonly strip?: ReactNode;
  /** The list: the page's grid, or its skeleton rows while it loads. */
  readonly children: ReactNode;
  /** False when another group follows (the Titles page's `Deleted titles`); the splitter then follows this one. */
  readonly last?: boolean;
}

/** The list frame every index closes with: the tile, the mono title and the fold (a heading carries no button), then the
 *  table strip and the list across the full width of the page. It is the page's last group unless told otherwise, so no
 *  splitter follows it. */
export function ListGroup({ id, icon, title, strip, children, last = true }: ListGroupProps) {
  return (
    <Group id={id} icon={icon} title={title} last={last}>
      <Wide>
        {strip}
        {children}
      </Wide>
    </Group>
  );
}
