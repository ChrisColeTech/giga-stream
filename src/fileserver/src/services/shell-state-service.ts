import type { ShellStateRepository } from "../store/shell-state-repository.js";
import {
  DEFAULT_SHELL_STATE,
  ShellStateSchema,
  stripUnknownPanes,
  type ShellState,
  type ShellStatePatch,
} from "../types/shell.js";

export interface ShellStateService {
  /** The stored record, or the default (library surface, no panes recorded) when absent or unreadable. */
  get(): ShellState;
  /**
   * Merge a validated patch (docs/03 section 3.3): `activeSurface` and `window` replace, the pane
   * maps merge per pane id. Returns the whole committed state.
   */
  patch(patch: ShellStatePatch): ShellState;
}

export function createShellStateService(deps: {
  repository: ShellStateRepository;
  now: () => number;
}): ShellStateService {
  const { repository, now } = deps;

  function get(): ShellState {
    const parsed = ShellStateSchema.safeParse(repository.read());
    // A stored layout from an earlier build may carry pane ids this one does not know; the known
    // ones are kept rather than dropping the whole record.
    return parsed.success ? stripUnknownPanes(parsed.data) : structuredClone(DEFAULT_SHELL_STATE);
  }

  return {
    get,

    patch(patch) {
      const current = get();
      const next: ShellState = {
        activeSurface: patch.activeSurface ?? current.activeSurface,
        paneVisibility: { ...current.paneVisibility, ...patch.paneVisibility },
        paneSizes: { ...current.paneSizes, ...patch.paneSizes },
      };
      const window = patch.window ?? current.window;
      if (window) next.window = window;
      repository.write(next, now());
      return next;
    },
  };
}
