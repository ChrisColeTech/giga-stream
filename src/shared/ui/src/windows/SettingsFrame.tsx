import type { CSSProperties, ReactNode } from "react";
import { labelColumn } from "../lib/label-column";
import { SettingsRail } from "./SettingsRail";
import type { SettingsSection } from "./SettingsRail";

export interface SettingsFrameProps<Id extends string> {
  readonly sections: readonly SettingsSection<Id>[];
  readonly selected: Id;
  readonly onSelect: (id: Id) => void;
  /** Every row label the sections render; the label column is sized from the longest, so it stays put as the rail
   *  moves from section to section. */
  readonly labels: readonly string[];
  /** The selected section's workspace. */
  readonly children: ReactNode;
}

/** The body of a Settings window: the rail on the left and the selected section's workspace beside it. The window
 *  itself (title, close, drag) is a `ChildWindow` the program wraps this in; the frame knows no section's content. */
export function SettingsFrame<Id extends string>(props: SettingsFrameProps<Id>) {
  const { sections, selected, onSelect, labels, children } = props;
  const label = sections.find((entry) => entry.id === selected)?.label ?? selected;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
      <SettingsRail sections={sections} selected={selected} onSelect={onSelect} />
      <div
        role="tabpanel"
        aria-label={label}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        style={{ "--label-col": labelColumn(labels) } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
