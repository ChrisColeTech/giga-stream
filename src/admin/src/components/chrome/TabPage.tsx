import type { ReactNode } from "react";
import { cn } from "@giga/ui/lib/cn";

/** What every tab's page takes: whether it is the tab shown. */
export interface PageProps {
  readonly active: boolean;
}

/** A tab's page: the box the toolbar strip and the index or workspace sit in. It is always mounted; an inactive tab is
 *  `hidden` (display none, so its controls leave the tab order), so scroll and form state survive a tab switch and a
 *  return never resets or reflows it (`28` section 6.2). */
export function TabPage({ active, label, children }: PageProps & { readonly label: string; readonly children: ReactNode }) {
  return (
    <section aria-label={label} className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !active && "hidden")}>
      {children}
    </section>
  );
}
