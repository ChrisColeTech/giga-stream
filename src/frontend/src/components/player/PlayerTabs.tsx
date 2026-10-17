import type { MouseEvent } from "react";
import { PlayerTab } from "@/components/player/PlayerTab";
import { openMenu } from "@/lib/menu";
import { tabMenuItems } from "@/lib/player-menus";
import type { PlayerTab as TabItem } from "@/types/player";

export interface PlayerTabsProps {
  readonly tabs: readonly TabItem[];
  readonly activeId: string | null;
  readonly onActivate: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onCloseOthers: (id: string) => void;
  readonly onReveal: () => void;
}

/** The fixed strip above the stage. Its tabs scroll sideways rather than grow the strip. */
export function PlayerTabs({ tabs, activeId, onActivate, onClose, onCloseOthers, onReveal }: PlayerTabsProps) {
  const contextMenu = (tab: TabItem) => (event: MouseEvent<HTMLDivElement>) => {
    openMenu(
      event,
      tabMenuItems({
        othersOpen: tabs.length - 1,
        onClose: () => onClose(tab.id),
        onCloseOthers: () => onCloseOthers(tab.id),
        onReveal,
      }),
    );
  };

  return (
    <div role="group" aria-label="Open tabs" className="flex h-8 flex-none items-stretch overflow-x-auto border-b border-border bg-surface">
      {tabs.map((tab) => (
        <PlayerTab
          key={tab.id}
          tab={tab}
          active={tab.id === activeId}
          onActivate={() => onActivate(tab.id)}
          onClose={() => onClose(tab.id)}
          onContextMenu={contextMenu(tab)}
        />
      ))}
    </div>
  );
}
