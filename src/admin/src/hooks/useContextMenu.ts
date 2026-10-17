import { useCallback, useEffect, useState } from "react";

import { on } from "@giga/ui/lib/bus";
import type { MenuAnchor, MenuItem } from "@/types/menu";

interface OpenMenu {
  anchor: MenuAnchor;
  items: MenuItem[];
}

/**
 * ONE floating menu at a time, app-wide. Mounted once, by the shell (`AppShell`).
 *
 * Requests arrive over the bus rather than through a context provider or the store: menu items carry an `onSelect`
 * callback and a React icon, neither of which belongs in a serializable store.
 *
 * This hook holds state and nothing else. Dismissal (outside press, Escape, a selected row) is the menu primitive's
 * job (`ui/ContextMenu.tsx`), which reports back through `close`.
 */
export function useContextMenu() {
  const [menu, setMenu] = useState<OpenMenu | null>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    return on("menu:open", (payload) => {
      const request = payload as OpenMenu | undefined;
      if (request) setMenu(request);
    });
  }, []);

  return { menu, close };
}
