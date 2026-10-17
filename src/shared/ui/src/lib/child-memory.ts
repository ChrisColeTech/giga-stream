import { createContext } from "react";
import type { Box } from "./child-types";

/** Where a child window's size and place are kept for the run. The program's store holds them (`childBounds` and
 *  `rememberChild` of the chrome slice); the window only asks for them as it opens and hands them back at the end of
 *  a gesture. */
export interface ChildMemory {
  readonly recall: (key: string) => Box | undefined;
  readonly remember: (key: string, box: Box) => void;
}

/** A host that gives no memory: every window opens fresh and forgets where it was. */
const FORGETFUL: ChildMemory = { recall: () => undefined, remember: () => undefined };

/** The program's overlay host provides its memory here once, so no window has to be handed the store. */
export const ChildMemoryContext = createContext<ChildMemory>(FORGETFUL);
