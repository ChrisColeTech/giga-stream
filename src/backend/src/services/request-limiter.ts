interface Waiting {
  host: string;
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * The sync's one request limit (docs/43 section 3.4): at most `global` tasks run at once across every playlist, and at
 * most `perHost` to one host (a provider list is mostly one host; many parallel connections to one subscription can get
 * it banned). Waiting tasks start in the order they asked, except that one whose host is full lets later ones past it.
 * Time-free: a task starts when a slot frees, never after a delay.
 */
export function createRequestLimiter(limits: { global: number; perHost: number }) {
  const hosts = new Map<string, number>();
  const queue: Waiting[] = [];
  let active = 0;

  function release(host: string): void {
    active -= 1;
    const left = (hosts.get(host) ?? 1) - 1;
    if (left <= 0) hosts.delete(host);
    else hosts.set(host, left);
    pump();
  }

  function start(waiting: Waiting): void {
    active += 1;
    hosts.set(waiting.host, (hosts.get(waiting.host) ?? 0) + 1);
    let running: Promise<unknown>;
    try {
      running = waiting.task();
    } catch (error) {
      running = Promise.reject(error);
    }
    running.then(waiting.resolve, waiting.reject).finally(() => release(waiting.host));
  }

  function pump(): void {
    let index = 0;
    while (active < limits.global && index < queue.length) {
      const next = queue[index];
      if (next === undefined || (hosts.get(next.host) ?? 0) >= limits.perHost) {
        index += 1;
        continue;
      }
      queue.splice(index, 1);
      start(next);
    }
  }

  return {
    /** Runs `task` when a global slot and a slot for `host` are both free. */
    run<T>(host: string, task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push({ host, task, resolve: (v) => resolve(v as T), reject });
        pump();
      });
    },
    /** Tasks running now, and tasks waiting (a test seam and a progress figure). */
    active: (): number => active,
    waiting: (): number => queue.length,
  };
}

export type RequestLimiter = ReturnType<typeof createRequestLimiter>;
