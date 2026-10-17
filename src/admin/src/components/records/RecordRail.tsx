import { NavItem } from "@giga/ui/lists/NavItem";
import { NavRail } from "@giga/ui/lists/NavRail";
import type { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";

/** One entry of the rail: the key the page binds its group to, and the label. */
export interface RailSection {
  readonly id: string;
  readonly label: string;
}

export interface RecordRailProps {
  /** The accessible name, `Channel sections`. */
  readonly ariaLabel: string;
  /** The way back to the tab's index: the full-width stock button, named for the tab. */
  readonly back: { readonly label: string; readonly onPress: () => void };
  /** The sections in page order. Pass a module constant: a new array every render re-binds the scroll listener. */
  readonly sections: readonly RailSection[];
  /** The page's scroll spy: it lights the entry the page is on and scrolls a clicked group into view. */
  readonly spy: ReturnType<typeof useScrollSpy>;
}

/** A workspace's rail (`28` section 7.2): `‹ Channels` above the sections, the selected one in the accent with its strip,
 *  following the scroll. It is the pane engine's left pane, so it sits on the panel inside the engine's border. */
export function RecordRail({ ariaLabel, back, sections, spy }: RecordRailProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      <NavRail ariaLabel={ariaLabel} back={{ label: back.label, onClick: back.onPress }}>
        {sections.map((section) => (
          <NavItem key={section.id} selected={spy.active === section.id} onClick={() => spy.goTo(section.id)}>
            {section.label}
          </NavItem>
        ))}
      </NavRail>
    </div>
  );
}
