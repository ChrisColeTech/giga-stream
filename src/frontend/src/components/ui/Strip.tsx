import type { ReactNode } from "react";

/** The page grammar's Strip: a right-aligned action strip at the end of a Group body. A filled primary button may be its
 *  LAST child (the form's one commit) and sits at the right edge; ghost actions go before it. */
export function Strip({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2 pt-1">{children}</div>;
}
