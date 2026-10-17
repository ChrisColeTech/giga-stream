import { useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Allotment } from "allotment";
import { usePaneOpen } from "../hooks/usePaneOpen";
import { useWorkspaceSplit } from "../hooks/useWorkspaceSplit";
import { cn } from "../lib/cn";
import { limitsOf, surfaceOf } from "./pane-limits";
import type { PaneEngine } from "./pane-types";

export interface WorkspaceSplitProps {
  /** The program's store, limits table and repaint slot. */
  engine: PaneEngine;
  surface: string;
  active: boolean;
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
}

/** The repaint slot of a program that has none: a ref nothing reads. */
function useNoRepaint(): RefObject<HTMLDivElement | null> {
  return useRef<HTMLDivElement | null>(null);
}

/** THE WORKSPACE: the sole owner of pane geometry (ported from Giga Cut). A vertical Allotment [row | bottom] whose
 *  top pane holds the horizontal [left | centre | right]. The bottom pane is a SIBLING of the whole row, which is what
 *  makes ONE row gutter resize all three top panes against it together. Sizes, clamps, collapses and adoption live in
 *  useWorkspaceSplit; this file only composes. Every surface stays mounted so a switch never loses its panes; the
 *  inactive ones are `hidden`. A closed pane is `inert`: its controls leave the tab order and the accessibility tree.
 *  The hooks run in this order on purpose: the splitter, then the program's repaint slot, then the open flags. */
export function WorkspaceSplit({ engine, surface, active, left, center, right, bottom }: WorkspaceSplitProps) {
  const { host, table, stageMin } = engine;
  const split = useWorkspaceSplit(engine, surface);
  const useRepaint = engine.useRepaint ?? useNoRepaint;
  const videoBox = useRepaint(active);
  const config = surfaceOf(table, surface);
  const leftOpen = usePaneOpen(host, surface, "left");
  const rightOpen = usePaneOpen(host, surface, "right");
  const bottomOpen = usePaneOpen(host, surface, "bottom");
  const hasLeft = limitsOf(table, surface, "left") !== null;
  const hasRight = limitsOf(table, surface, "right") !== null;
  const hasBottom = limitsOf(table, surface, "bottom") !== null;

  const row = (
    <Allotment
      ref={split.rowRef}
      proportionalLayout={false}
      defaultSizes={split.defaultRow}
      onChange={split.onRowChange}
      onDragStart={split.onRowDragStart}
      onDragEnd={split.onRowDragEnd}
    >
      {hasLeft && (
        <Allotment.Pane minSize={split.minFor("left")} maxSize={split.maxFor("left")}>
          <div className="pane pane-left" data-open={leftOpen || undefined} inert={!leftOpen} aria-label="Left pane">
            {left}
          </div>
        </Allotment.Pane>
      )}
      <Allotment.Pane minSize={config.centerMin}>
        <div className="pane pane-center" aria-label="Centre">
          {center}
        </div>
      </Allotment.Pane>
      {hasRight && (
        <Allotment.Pane minSize={split.minFor("right")} maxSize={split.maxFor("right")}>
          <div className="pane pane-right" data-open={rightOpen || undefined} inert={!rightOpen} aria-label="Right pane">
            {right}
          </div>
        </Allotment.Pane>
      )}
    </Allotment>
  );

  return (
    <div
      className={cn("workspace", !active && "hidden")}
      ref={(node) => {
        split.boxRef(node);
        videoBox.current = node;
      }}
    >
      {hasBottom ? (
        <Allotment
          ref={split.columnRef}
          vertical
          proportionalLayout={false}
          defaultSizes={split.defaultColumn}
          onChange={split.onColumnChange}
          onDragStart={split.onColumnDragStart}
          onDragEnd={split.onColumnDragEnd}
        >
          <Allotment.Pane minSize={stageMin}>{row}</Allotment.Pane>
          <Allotment.Pane minSize={split.minFor("bottom")} maxSize={split.maxFor("bottom")}>
            <div className="pane pane-bottom" data-open={bottomOpen || undefined} inert={!bottomOpen} aria-label="Bottom pane">
              {bottom}
            </div>
          </Allotment.Pane>
        </Allotment>
      ) : (
        row
      )}
    </div>
  );
}
