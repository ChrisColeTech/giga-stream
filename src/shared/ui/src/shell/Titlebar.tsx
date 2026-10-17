import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { PaneToggle, type PaneToggleProps } from "./PaneToggle";
import { TabPill, type TabPillProps } from "./TabPill";

/* left toggle · brand · centred nav · spacer · the app's own verb · bottom toggle · right toggle. No window controls:
 * those are the OS's own. The right padding reserves Win11's caption-button strip: `env(titlebar-area-width)` is the
 * width the PAGE may use, so the difference from 100% is the strip. In a plain browser the variable is unset and the bar
 * keeps its 8px. */
const TITLEBAR =
  "relative z-20 flex h-10 flex-none items-center gap-2 border-b pl-2 " +
  "pr-[calc(100%-env(titlebar-area-width,100%)+8px)] [-webkit-app-region:drag] " +
  "[&_button]:[-webkit-app-region:no-drag] " +
  "transition-[background-color,border-color] duration-fast ease-linear";

/** The normal bar colour. An app that paints its bar otherwise (Theatre's black) passes its own tone. */
const NORMAL_TONE = "border-border bg-panel";

export interface TitlebarProps<T extends string> {
  readonly brand: ReactNode;
  readonly tabs: TabPillProps<T>;
  readonly left: PaneToggleProps;
  readonly bottom: PaneToggleProps;
  readonly right: PaneToggleProps;
  /** The app's own verb, placed after the nav and before the bottom toggle, when the app has one. */
  readonly trailing?: ReactNode;
  readonly tone?: string;
}

export function Titlebar<T extends string>({ brand, tabs, left, bottom, right, trailing, tone = NORMAL_TONE }: TitlebarProps<T>) {
  return (
    <header className={cn("chrome-bar", TITLEBAR, tone)}>
      <PaneToggle {...left} />
      {brand}
      {/* Absolutely centred on the TITLEBAR, not flex-centred among siblings, so showing or disabling a pane toggle never
          shifts the nav. */}
      <div className="flex-1">
        <TabPill {...tabs} />
      </div>
      {trailing}
      <PaneToggle {...bottom} />
      <PaneToggle {...right} />
    </header>
  );
}
