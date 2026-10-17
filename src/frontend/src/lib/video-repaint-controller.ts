export interface RepaintControllerDeps {
  /** Runs `task` once the next frame has been painted (the page passes `requestAnimationFrame`). */
  readonly schedule: (task: () => void) => number;
  readonly cancel: (id: number) => void;
  /** Repaints the surface's videos. */
  readonly repaint: () => void;
  /** A width change of this many pixels or fewer is ignored. */
  readonly tolerance: number;
}

export interface RepaintController {
  /** The surface was shown (true) or hidden (false). Showing it asks for a repaint; hiding it drops any pending one. */
  setActive: (active: boolean) => void;
  /** The centre pane now measures `width`. Asks for a repaint when the surface is active and the width moved. */
  widthChanged: (width: number) => void;
  /** Drops any pending repaint. */
  dispose: () => void;
}

/** The when-to-repaint rule with its scheduler injected. However many requests land before a frame, one repaint runs;
 *  nothing runs while the surface is inactive (a hidden element has no layout to repaint). A hidden surface measures
 *  width 0, so the width is reset to 0 on every flip: the first real measurement after showing always counts. */
export function createRepaintController(deps: RepaintControllerDeps): RepaintController {
  let active = false;
  let lastWidth = 0;
  let pending: number | null = null;

  const drop = (): void => {
    if (pending !== null) deps.cancel(pending);
    pending = null;
  };

  const request = (): void => {
    if (pending !== null) return;
    pending = deps.schedule(() => {
      pending = null;
      if (active) deps.repaint();
    });
  };

  return {
    setActive: (next) => {
      if (next === active) return;
      active = next;
      lastWidth = 0;
      if (active) request();
      else drop();
    },
    widthChanged: (width) => {
      if (!active || Math.abs(width - lastWidth) <= deps.tolerance) return;
      lastWidth = width;
      request();
    },
    dispose: drop,
  };
}
