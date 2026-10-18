import type { CSSProperties, ReactNode } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import {
  TITLE_KEYS_MOVIE,
  TITLE_KEYS_SERIES,
  TITLE_SECTIONS_MOVIE,
  TITLE_SECTIONS_SERIES,
  TITLE_WORKSPACE_LABELS,
} from "@/constants/title-copy";
import { useAppStore } from "@/store/app-store";

export type TitleSpy = ReturnType<typeof useScrollSpy>;

export interface TitleFrameProps {
  readonly series: boolean;
  readonly active: boolean;
  readonly toolbar: ReactNode;
  readonly children: (spy: TitleSpy) => ReactNode;
}

/** The frame both states of a title's workspace share (`37` section 4.3): the rail (`‹ Titles`, Details, People and
 *  plot, Seasons for a series only, Sources), the toolbar, and the one scrolling page sized by the page's label column.
 *  The groups bind themselves to the scroll spy the frame hands them. */
export function TitleFrame({ series, active, toolbar, children }: TitleFrameProps) {
  const keys = series ? TITLE_KEYS_SERIES : TITLE_KEYS_MOVIE;
  const spy = useScrollSpy(keys, keys[0] ?? "tw-details");
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  return (
    <WorkspaceFrame
      tab="titles"
      active={active}
      rail={
        <RecordRail
          ariaLabel="Title sections"
          back={{ label: "Titles", onPress: () => closeWorkspace("titles") }}
          sections={series ? TITLE_SECTIONS_SERIES : TITLE_SECTIONS_MOVIE}
          spy={spy}
        />
      }
      toolbar={toolbar}
    >
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div
          className="flex flex-col px-6 pb-8"
          style={{ "--label-col": labelColumn(TITLE_WORKSPACE_LABELS) } as CSSProperties}
        >
          {children(spy)}
        </div>
      </div>
    </WorkspaceFrame>
  );
}
