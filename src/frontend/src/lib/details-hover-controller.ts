/** Lets one details popover be open at a time: a card claiming it closes whichever card held it. */
export interface HoverGroup {
  /** `close` now holds the group; the previous holder, if another, is closed first. */
  claim: (close: () => void) => void;
  /** `close` no longer holds the group (it closed). */
  release: (close: () => void) => void;
}

export function createHoverGroup(): HoverGroup {
  let holder: (() => void) | null = null;
  return {
    claim: (close) => {
      const previous = holder;
      holder = close;
      if (previous !== null && previous !== close) previous();
    },
    release: (close) => {
      if (holder === close) holder = null;
    },
  };
}

export interface DetailsHoverDeps {
  /** Runs `task` once after `delay` milliseconds (the hook passes `setTimeout`). */
  readonly schedule: (task: () => void, delay: number) => number;
  readonly cancel: (id: number) => void;
  readonly openDelay: number;
  readonly closeGrace: number;
  readonly group: HoverGroup;
  /** The popover should now be shown (the detail read starts with it). */
  readonly onOpen: () => void;
  /** The popover should now be hidden (a read still under way is abandoned with it). */
  readonly onClose: () => void;
}

export interface DetailsHover {
  /** The pointer entered the glyph or the popover (they are one hover area). Opens after the open delay. */
  pointerEnter: () => void;
  /** The pointer left the glyph and the popover. Cancels a pending open; closes after the grace period. */
  pointerLeave: () => void;
  /** Keyboard focus arrived on the glyph or the popover. Opens at once. */
  focus: () => void;
  /** Focus left. Closes after the grace period unless the pointer or focus is back by then. */
  blur: () => void;
  /** A press on a device without hover: opens and holds it open, or closes it. */
  toggle: () => void;
  /** Closes at once (Escape, the X, an outside press) and drops anything pending. */
  close: () => void;
  /** Drops timers and the group claim without announcing. */
  dispose: () => void;
}

/** The when-to-show rule of a tooltip-like popover, with its scheduler injected. Open after the delay of resting on
 *  it; a pass that ends before the delay opens nothing; close after the grace once neither the pointer nor focus is
 *  on it, and coming back inside the grace keeps it open; opening one closes any other in the group. */
export function createDetailsHover(deps: DetailsHoverDeps): DetailsHover {
  let open = false;
  let hovering = false;
  let focused = false;
  let pinned = false;
  let openTimer: number | null = null;
  let closeTimer: number | null = null;

  const dropOpenTimer = (): void => {
    if (openTimer !== null) deps.cancel(openTimer);
    openTimer = null;
  };
  const dropCloseTimer = (): void => {
    if (closeTimer !== null) deps.cancel(closeTimer);
    closeTimer = null;
  };

  const closeNow = (): void => {
    dropOpenTimer();
    dropCloseTimer();
    pinned = false;
    if (!open) return;
    open = false;
    deps.group.release(closeNow);
    deps.onClose();
  };

  const openNow = (): void => {
    dropOpenTimer();
    dropCloseTimer();
    if (open) return;
    deps.group.claim(closeNow);
    open = true;
    deps.onOpen();
  };

  /* Nothing holds it up any more: forget a pending open, and start the grace if it is shown. */
  const settle = (): void => {
    if (hovering || focused || pinned) return;
    dropOpenTimer();
    if (open && closeTimer === null) {
      closeTimer = deps.schedule(() => {
        closeTimer = null;
        closeNow();
      }, deps.closeGrace);
    }
  };

  return {
    pointerEnter: () => {
      hovering = true;
      dropCloseTimer();
      if (open || openTimer !== null) return;
      openTimer = deps.schedule(() => {
        openTimer = null;
        openNow();
      }, deps.openDelay);
    },
    pointerLeave: () => {
      hovering = false;
      settle();
    },
    focus: () => {
      focused = true;
      openNow();
    },
    blur: () => {
      focused = false;
      settle();
    },
    toggle: () => {
      if (open) {
        closeNow();
        return;
      }
      pinned = true;
      openNow();
    },
    close: closeNow,
    dispose: () => {
      dropOpenTimer();
      dropCloseTimer();
      deps.group.release(closeNow);
      open = false;
    },
  };
}
