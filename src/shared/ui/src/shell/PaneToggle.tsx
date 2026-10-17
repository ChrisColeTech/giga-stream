import { PanelBottom, PanelLeft, PanelRight, type LucideIcon } from "lucide-react";
import { IconButton } from "../controls/IconButton";

export type PaneSide = "left" | "bottom" | "right";

export interface PaneToggleProps {
  readonly side: PaneSide;
  /** Whether the pane is shown: the pressed look. */
  readonly lit: boolean;
  /** Why the toggle is asleep or has no pane to show. Absent when it works. */
  readonly reason?: string;
  readonly onToggle: () => void;
  /** What the toggle shows, when the app calls its pane something else (the admin's `the events band`): the toggle reads
   *  `Toggle <name>`. Absent, the side's own name. */
  readonly name?: string;
}

const TOGGLES: Readonly<Record<PaneSide, { label: string; Icon: LucideIcon }>> = {
  left: { label: "left pane", Icon: PanelLeft },
  bottom: { label: "bottom pane", Icon: PanelBottom },
  right: { label: "right pane", Icon: PanelRight },
};

/** A pane's show and hide toggle. Ghost: transparent at rest, a hover fill, the accent tint while the pane is shown. A
 *  toggle with a reason stays in place, disabled, never hidden, so the chrome does not shuffle from page to page. A
 *  disabled button takes no pointer events, so the reason hangs on the wrapper, which does. */
export function PaneToggle({ side, lit, reason, onToggle, name }: PaneToggleProps) {
  const { label: sideName, Icon } = TOGGLES[side];
  const label = name ?? sideName;
  return (
    <span className="inline-flex" title={reason}>
      <IconButton
        title={reason ?? `Toggle ${label}`}
        aria-label={`Toggle ${label}`}
        aria-pressed={lit}
        on={lit}
        disabled={reason !== undefined}
        onClick={onToggle}
      >
        <Icon className="size-3.75" />
      </IconButton>
    </span>
  );
}
