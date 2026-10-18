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
  /** The heading's action slot: `Refresh`, or the Titles pager `Older` and `Newer`. */
  readonly action?: ReactNode;
  /** The list: the page's grid, or its skeleton rows while it loads. */
  readonly children: ReactNode;
  /** False when another group follows (the Titles page's `Deleted titles`); the splitter then follows this one. */
  readonly last?: boolean;
}

/** The list frame every index closes with: the tile, the mono title, the heading's action slot, the fold, and the list
 *  across the full width of the page. It is the page's last group unless told otherwise, so no splitter follows it. */
export function ListGroup({ id, icon, title, action, children, last = true }: ListGroupProps) {
  return (
    <Group id={id} icon={icon} title={title} action={action} last={last}>
      <Wide>{children}</Wide>
    </Group>
  );
}
