import { createContext } from "react";
import type { Box } from "./child-types";

/** Where a child window's size and place are kept for the run. The program's store holds them (`childBounds` and
 *  `rememberChild` of the chrome slice); the window only asks for them as it opens and hands them back at the end of
 *  a gesture. `childMaximized` and `rememberMaximized` keep whether the window was maximized (`36` section 8.4); a host
 *  that does not provide them opens every window normal and forgets the flag. `childBounds` only ever holds the NORMAL box. */
export interface ChildMemory {
  readonly recall: (key: string) => Box | undefined;
  readonly remember: (key: string, box: Box) => void;
  readonly maximized?: (key: string) => boolean;
  readonly setMaximized?: (key: string, on: boolean) => void;
}

/** A host that gives no memory: every window opens fresh and forgets where it was. */
const FORGETFUL: ChildMemory = { recall: () => undefined, remember: () => undefined };

/** The program's overlay host provides its memory here once, so no window has to be handed the store. */
export const ChildMemoryContext = createContext<ChildMemory>(FORGETFUL);

/** Maximize or restore: the NORMAL box is handed to memory first (so the remembered bounds never become the maximized
 *  box), then the flag. Answers the new flag. */
export function toggleMaximized(memory: ChildMemory, key: string, normal: Box, maximized: boolean): boolean {
  if (!maximized) memory.remember(key, normal);
  memory.setMaximized?.(key, !maximized);
  return !maximized;
}
