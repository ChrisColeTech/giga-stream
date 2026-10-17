import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  VIDEO_REPAINT_PANE_SELECTOR,
  VIDEO_REPAINT_SELECTOR,
  VIDEO_REPAINT_WIDTH_TOLERANCE_PX,
} from "@/constants/video-repaint";
import { repaintElement } from "@/lib/video-repaint";
import { createRepaintController, type RepaintController } from "@/lib/video-repaint-controller";

/** Repaints every `<video>` in a workspace box when its picture may be stale. WHY THIS EXISTS: every surface stays
 *  mounted and the inactive ones are `display: none`, and a surface's panes can change while it is hidden (Theatre
 *  collapses them all, the saved layout is restored, a narrow window collapses one). The shown surface's video element
 *  then measures the full width, but Chromium keeps its layer and native controls painted at the old narrower width and
 *  leaves a blank strip at the right edge. Forcing a re-layout (`repaintElement`) closes it. Do not remove this as dead
 *  code: the layout is right, only the paint is stale.
 *
 *  It runs one frame AFTER the panes are laid out (so Allotment's sizes have landed) when the surface becomes active,
 *  and when the centre pane's width changes by more than a pixel while active; requests in one frame coalesce into
 *  one repaint. Nothing runs while the surface is hidden. Returns the ref to put on the workspace box. */
export function useVideoRepaint(active: boolean): RefObject<HTMLDivElement | null> {
  const box = useRef<HTMLDivElement | null>(null);
  const controller = useRef<RepaintController | null>(null);

  useEffect(() => {
    const node = box.current;
    if (node === null) return undefined;
    const repaint = createRepaintController({
      schedule: (task) => requestAnimationFrame(task),
      cancel: (id) => cancelAnimationFrame(id),
      repaint: () => {
        for (const video of node.querySelectorAll(VIDEO_REPAINT_SELECTOR)) {
          if (video instanceof HTMLElement) repaintElement(video);
        }
      },
      tolerance: VIDEO_REPAINT_WIDTH_TOLERANCE_PX,
    });
    controller.current = repaint;
    const observer = new ResizeObserver((entries) => {
      const latest = entries[entries.length - 1];
      if (latest !== undefined) repaint.widthChanged(latest.contentRect.width);
    });
    observer.observe(node.querySelector(VIDEO_REPAINT_PANE_SELECTOR) ?? node);
    return () => {
      observer.disconnect();
      repaint.dispose();
      controller.current = null;
    };
  }, []);

  /* Declared after the effect above so, on mount, the controller exists when the first show is announced. */
  useEffect(() => {
    controller.current?.setActive(active);
  }, [active]);

  return box;
}
