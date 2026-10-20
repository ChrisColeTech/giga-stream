import type { SourceId } from "@/lib/library-query";
import type { ItemRef } from "@/types/library";
import type { OverlayId } from "@/types/overlays";
import type { Surface } from "@/types/shell";

/* Cross-surface navigation, a slice of the one store: a request is a value with a serial, so asking twice for the same
 * thing still lands. The surface that owns the request reads it and acts; nothing here calls the fileserver. */

export interface NavigationSlice {
  /** The last thing a Play asked the Player to open. */
  playRequest: { ref: ItemRef; serial: number } | null;
  /** Shows the Player and asks it to open an item (the Player starts the stream itself). */
  requestPlay: (ref: ItemRef) => void;
  /** The last request to show Library on a view and, optionally, with one item selected and in view. */
  libraryRequest: { source?: SourceId; select?: ItemRef; serial: number } | null;
  requestLibrary: (request: { source?: SourceId; select?: ItemRef }) => void;
  /** The collection the Collections window should open on, read once as the window opens. */
  collectionsFocus: string | null;
  openCollections: (collectionId?: string) => void;
  takeCollectionsFocus: () => string | null;
}

/** What the slice needs of the rest of the store: the surface and the open window it changes. */
interface Host {
  surface: Surface;
  shellRevision: number;
  overlay: OverlayId | null;
  overlayAnchor: null;
  overlayItem: ItemRef | null;
}

type Set = (partial: Partial<NavigationSlice & Host>) => void;
type Get = () => NavigationSlice & Host;

/* Leaving for another surface closes the open work window (`06` section 4.4: only Play hands off). */
const closed = { overlay: null, overlayAnchor: null, overlayItem: null } as const;

export function navigationSlice(set: Set, get: Get): NavigationSlice {
  return {
    playRequest: null,
    requestPlay: (ref) =>
      set({
        ...closed,
        surface: "player",
        shellRevision: get().shellRevision + 1,
        playRequest: { ref, serial: (get().playRequest?.serial ?? 0) + 1 },
      }),
    libraryRequest: null,
    requestLibrary: (request) =>
      set({
        ...closed,
        surface: "library",
        shellRevision: get().shellRevision + 1,
        libraryRequest: { ...request, serial: (get().libraryRequest?.serial ?? 0) + 1 },
      }),
    collectionsFocus: null,
    openCollections: (collectionId) =>
      set({ overlay: "collections", overlayAnchor: null, overlayItem: null, collectionsFocus: collectionId ?? null }),
    takeCollectionsFocus: () => {
      const focus = get().collectionsFocus;
      if (focus !== null) set({ collectionsFocus: null });
      return focus;
    },
  };
}
