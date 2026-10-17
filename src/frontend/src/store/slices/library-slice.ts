import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { DEFAULT_QUERY, type LibraryQuery, type ViewCounts } from "@/lib/library-query";
import type { CollectionListSchema } from "@/services/schemas/collection-schema";
import type { StateSnapshot } from "@/services/state";
import type { z } from "zod";
import type { LibraryPrefs } from "@/types/settings";

const EMPTY_COUNTS: ViewCounts = { all: 0, history: 0, favorites: 0, collections: {} };

export interface LibrarySlice {
  collections: z.infer<typeof CollectionListSchema>;
  jobs: NonNullable<StateSnapshot["jobs"]>;
  libraryCounts: ViewCounts;
  libraryQuery: LibraryQuery;
  library: LibraryPrefs;
  setCollections: (collections: z.infer<typeof CollectionListSchema>) => void;
  setLibraryCounts: (counts: ViewCounts) => void;
  setLibraryQuery: (change: Partial<LibraryQuery>) => void;
  setLibraryPrefs: (change: Partial<LibraryPrefs>) => void;
  setFavourite: (key: string, favourite: boolean) => void;
  setMembership: (key: string, collectionId: string, member: boolean) => void;
  marks: {
    readonly favourites: Readonly<Record<string, boolean>>;
    readonly memberships: Readonly<Record<string, readonly string[]>>;
  };
}

interface Host extends LibrarySlice {
  settingsRevision: number;
}

type Set = (partial: Partial<Host>) => void;
type Get = () => Host;

export function librarySlice(set: Set, get: Get): LibrarySlice {
  return {
    collections: [],
    jobs: [],
    libraryCounts: EMPTY_COUNTS,
    libraryQuery: { ...DEFAULT_QUERY },
    library: {
      libraryView: DEFAULT_SETTINGS.libraryView,
      librarySort: DEFAULT_SETTINGS.librarySort,
      showContinue: DEFAULT_SETTINGS.showContinue,
      pauseHistory: DEFAULT_SETTINGS.pauseHistory,
      rescanOnStartup: DEFAULT_SETTINGS.rescanOnStartup,
    },
    setCollections: (collections) => set({ collections }),
    setLibraryCounts: (libraryCounts) => set({ libraryCounts }),
    setLibraryQuery: (change) => set({ libraryQuery: { ...get().libraryQuery, ...change } }),
    setLibraryPrefs: (change) =>
      set({ library: { ...get().library, ...change }, settingsRevision: get().settingsRevision + 1 }),
    marks: { favourites: {}, memberships: {} },
    setFavourite: (key, favourite) => {
      const marks = get().marks;
      set({ marks: { ...marks, favourites: { ...marks.favourites, [key]: favourite } } });
    },
    setMembership: (key, collectionId, member) => {
      const marks = get().marks;
      const current = marks.memberships[key] ?? [];
      const next = member
        ? [...current.filter((id) => id !== collectionId), collectionId]
        : current.filter((id) => id !== collectionId);
      set({ marks: { ...marks, memberships: { ...marks.memberships, [key]: next } } });
    },
  };
}
