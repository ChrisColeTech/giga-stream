export interface IdlePosition {
  readonly x: number;
  readonly y: number;
}

export interface IdleControllerDeps {
  readonly idleMs: number;
  readonly schedule: (task: () => void, delay: number) => number;
  readonly cancel: (id: number) => void;
  readonly onIdle: () => void;
  readonly onActive: () => void;
  /** Asked when the timer fires: false means something (a menu, a field in use) forbids hiding right now. The
   *  controller then stays awake and starts no timer; the next activity re-arms it. */
  readonly canIdle?: () => boolean;
}

export interface IdleController {
  /** Input happened. A pointer move to the point of the previous one is ignored. */
  activity: (position?: IdlePosition) => void;
  /** Starts the countdown without waiting for input (Theatre was just entered). */
  arm: () => void;
  /** Cancels the countdown and reports active if idle. */
  stop: () => void;
}

/** The idle state machine with its clock injected, so a test drives it with a fake scheduler. It owns one timer and
 *  never polls: only activity or `arm` starts the countdown. */
export function createIdleController(deps: IdleControllerDeps): IdleController {
  let timer: number | null = null;
  let idle = false;
  let last: IdlePosition | null = null;

  const clear = (): void => {
    if (timer !== null) deps.cancel(timer);
    timer = null;
  };

  const fire = (): void => {
    timer = null;
    if (deps.canIdle !== undefined && !deps.canIdle()) return;
    idle = true;
    deps.onIdle();
  };

  const arm = (): void => {
    clear();
    timer = deps.schedule(fire, deps.idleMs);
  };

  const wake = (): void => {
    if (!idle) return;
    idle = false;
    deps.onActive();
  };

  return {
    activity: (position) => {
      if (position !== undefined) {
        const same = last !== null && last.x === position.x && last.y === position.y;
        last = position;
        if (same) return;
      }
      wake();
      arm();
    },
    arm,
    stop: () => {
      clear();
      last = null;
      wake();
    },
  };
}
