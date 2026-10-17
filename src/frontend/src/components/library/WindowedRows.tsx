import { useEffect, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useWindowedRows, type Measured } from "@/hooks/useWindowedRows";
import { gridStep } from "@/lib/window-rows";
import type { RowSpec } from "@/types/window-rows";

/** A request to bring one item into view and focus it. The page makes a new object for every request. */
export interface Reveal {
  readonly id: string;
}

export interface WindowedRowsProps {
  readonly count: number;
  readonly spec: RowSpec;
  /** The scroller the rows live in; its scroll position and height decide the window. */
  readonly scroller: RefObject<HTMLElement | null>;
  readonly label: string;
  /** The id of an item, for selection and for finding a revealed one. */
  readonly idAt: (index: number) => string | undefined;
  readonly onSelect: (id: string) => void;
  /** One item's markup; it carries `data-index={index}` and a `[data-primary]` button. */
  readonly renderCell: (index: number) => ReactNode;
  readonly reveal?: Reveal | null;
  /** Called once the request has been tried (found or not), so a later list never repeats it. */
  readonly onRevealed?: () => void;
  readonly measured?: Measured;
}

/** Rows of fixed height inside a scroller, only the ones near the viewport mounted (`docs/32`). Blank gaps stand for
 *  the rest, so the box is as tall as if every row were there and the pager's sentinel, which follows it, sits at the
 *  end of the loaded list. A focused card's row stays mounted. Arrow keys move by index, so they reach cards that are
 *  not mounted yet. */
export function WindowedRows({
  count, spec, scroller, label, idAt, onSelect, renderCell, reveal = null, onRevealed, measured,
}: WindowedRowsProps) {
  const { container, layout, segments, pin, focusIndex } = useWindowedRows(count, spec, scroller, measured);

  /* One attempt per request: a card that is not loaded is not chased as pages arrive. */
  useEffect(() => {
    if (reveal === null || layout === null) return;
    onRevealed?.();
    for (let index = 0; index < count; index += 1) {
      if (idAt(index) === reveal.id) {
        focusIndex(index);
        return;
      }
    }
  }, [reveal, layout, count, idAt, focusIndex, onRevealed]);

  const onFocus = (event: FocusEvent<HTMLElement>): void => {
    const index = cardIndex(event.target);
    if (index !== null) pin(index);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const index = event.target instanceof HTMLElement && event.target.hasAttribute("data-primary")
      ? cardIndex(event.target) : null;
    const next = index === null || layout === null ? null : gridStep(event.key, index, layout.columns, count);
    if (next === null) return;
    event.preventDefault();
    focusIndex(next);
    const id = idAt(next);
    if (id !== undefined) onSelect(id);
  };

  return (
    <div
      ref={container}
      role="group"
      aria-label={label}
      style={{ padding: `${spec.padTop}px ${spec.padX}px 0` }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      {layout !== null && segments.map((segment, position) => {
        if (segment.kind === "gap") return <div key={`gap-${position}`} aria-hidden style={{ height: segment.height }} />;
        const first = segment.index * layout.columns;
        const cells = Array.from({ length: Math.min(layout.columns, count - first) }, (_, offset) => renderCell(first + offset));
        return (
          <div
            key={`row-${segment.index}`}
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
              columnGap: spec.gap,
              height: layout.rowHeight,
              marginBottom: spec.gap,
            }}
          >
            {cells}
          </div>
        );
      })}
    </div>
  );
}

function cardIndex(target: EventTarget): number | null {
  const card = target instanceof Element ? target.closest("[data-index]") : null;
  const index = Number(card?.getAttribute("data-index"));
  return card === null || Number.isNaN(index) ? null : index;
}
