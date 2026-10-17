import { useEffect, useRef } from "react";
import { DEFAULT_QUERY, FILTER_DEFAULTS, type LibraryQuery, type ListView } from "@/lib/library-query";
import { useAppStore } from "@/store/app-store";

export interface LibraryRequestTargets {
  readonly patch: (change: Partial<LibraryQuery>) => void;
  readonly setView: (view: ListView) => void;
  readonly setSelected: (id: string | null) => void;
}

/** What Library takes from outside itself: the Default view and Default sort settings (a change applies at once, as the
 *  theme does), and a library request from Settings (Open History) or the Player (Reveal in Library). A revealed item
 *  is shown with the filters cleared, selected, and scrolled into view. */
export function useLibraryRequest({ patch, setView, setSelected }: LibraryRequestTargets): void {
  const libraryView = useAppStore((state) => state.library.libraryView);
  const librarySort = useAppStore((state) => state.library.librarySort);
  const request = useAppStore((state) => state.libraryRequest);
  const handled = useRef(0);

  useEffect(() => setView(libraryView), [libraryView, setView]);
  useEffect(() => patch({ sort: librarySort }), [librarySort, patch]);

  useEffect(() => {
    if (request === null || request.serial === handled.current) return;
    handled.current = request.serial;
    if (request.source !== undefined) patch({ source: request.source });
    const select = request.select;
    if (select === undefined) return;
    patch({ ...FILTER_DEFAULTS, scope: DEFAULT_QUERY.scope, source: request.source ?? "all", search: "" });
    setSelected(select.id);
    /* The card exists once the cleared query has rendered and the surface is shown. */
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(select.id)}"]`);
      card?.scrollIntoView({ block: "nearest" });
      card?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });
    });
  }, [request, patch, setSelected]);
}
